# 🏛️ 안붐벼 기술 아키텍처 및 파이프라인 명세서
> **Technical Architecture & Data Pipeline Specification**

본 문서는 '안붐벼' 서비스의 시스템 아키텍처, 5대 지자체 실시간 주차 데이터 파이프라인, In-Memory 실시간 조인 알고리즘, 장애 방어 설계(Fault Tolerance), 그리고 핵심 모듈 구성을 기술합니다.

---

## 1. 시스템 아키텍처 개요 (System Architecture)

안붐벼는 서버리스 및 엣지 환경에 최적화된 **Next.js App Router** 기반 단일 파이프라인으로 설계되었습니다. 공공데이터포털 및 지자체 API의 호출 제한과 응답 지연을 방어하기 위해 **서버 사이드 In-Memory Aggregator & 60초 Caching Layer**를 구축했습니다.

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Browser)"]
        UI["React 19 UI (Next.js 16)"]
        Map["Leaflet Map Engine"]
        Modal["Navigation Modal / Toast"]
    end

    subgraph Server["Next.js Server (Route Handler)"]
        API["/api/festivals Handler"]
        Cache["60s In-Memory Cache (Map)"]
        Aggregator["Pipeline Aggregator"]
        Joiner["std_prl_cd In-Memory Joiner"]
        Sorter["2-Stage Fallback Distance Sorter"]
    end

    subgraph External["External Public Data APIs"]
        TourAPI["Tour API (한국관광공사)<br/>전국 축제/명소 원본 데이터"]
        ParkingInfoAPI["전국 주차장 기본정보 API<br/>(SIGUNGU 단위 병렬 조회)"]
        ParkingLiveAPI["5대 지자체 실시간 잔여석 API<br/>(서울·경기·대전·대구·부산)"]
        WeatherAPI["Koreaconnect Weather API<br/>(기온/체감온도/기상)"]
    end

    UI -->|GET /api/festivals?region=...| API
    API -->|1. 캐시 적중 여부 확인| Cache
    Cache -->|캐시 Hit (< 5ms)| API
    Cache -->|캐시 Miss| Aggregator

    Aggregator -->|비동기 병렬 호출 1| TourAPI
    Aggregator -->|비동기 병렬 호출 2| ParkingInfoAPI
    Aggregator -->|비동기 병렬 호출 3| ParkingLiveAPI
    Aggregator -->|비동기 병렬 호출 4| WeatherAPI

    TourAPI & ParkingInfoAPI & ParkingLiveAPI & WeatherAPI --> Joiner
    Joiner --> Sorter
    Sorter -->|결과 캐싱 (TTL 60s)| Cache
    Sorter -->|JSON 응답| API
    API --> UI
```

---

## 2. 데이터 수집 및 2단계 실시간 조인 파이프라인 (Data Pipeline)

### 2.1. 주차 데이터 연동 규격
- **실시간 주차 가능 정보 연동 지자체 (5개 권역)**:
  - 공공데이터포털(디지털융합플랫폼) 규격에 따라 **서울, 경기, 대전, 대구, 부산** 5개 지자체의 센서 연동 공영주차장에 대해 실시간 주차 잔여면수 및 3단계 신호등 뱃지(여유 🟢 / 혼잡 🟠 / 만차 🔴)를 산출합니다.
- **그 외 전국 권역 및 센서 미연동 시설 (안전 Fallback)**:
  - 전국 공영/민영 주차장 시설 기본정보(총면수, 운영 요금 체계)를 바탕으로 `총 N면 (현장확인 ⚪)` 뱃지를 표출합니다.

### 2.2. 파이프라인 처리 단계

1. **클라이언트 요청 수신 & 캐시 검증**:
   - `category`, `region`, `mapX`, `mapY`, `radius` 파라미터로 생성된 `cacheKey`를 검증합니다.
   - 60초 이내 동일 요청은 메모리 캐시에서 즉시 응답합니다.

2. **축제/명소 원본 데이터 수집**:
   - `category === '축제'`: `searchFestival2` API로 현재 일자(`eventStartDate`) 이후 활성 축제를 수집합니다.
   - `category !== '축제'`: `locationBasedList2` API를 통해 반경 내 POI 데이터를 수집합니다.
   - 종교시설(사찰, 성당 등 단순 기도처)을 사전 필터링하고 요청 권역과 주소의 일치성을 검증합니다.

3. **시군구 코드 동적 추출 & 주차 데이터 병렬 수신**:
   - 명소들의 주소(`addr1`)와 좌표를 기반으로 5자리 시군구 행정구역 코드를 동적 추출합니다.
   - 추출된 시군구 코드로 주차장 기본정보 API(`/parking/info`)와 실시간 잔여석 API(`/parking/status`)를 `Promise.allSettled`로 병렬 수신합니다.

4. **`std_prl_cd` (표준주차장코드) 기반 In-Memory Hash Join**:
   ```typescript
   // O(1) 해시 맵을 통한 기본정보와 실시간 잔여석 결합
   const liveMap = new Map<string, { currentParked: number; status: string }>();
   // ... 실시간 센서 데이터 파싱 후 liveMap에 매핑
   
   for (const info of rawCandidateList) {
     const code = info.std_prl_cd || info.prk_cmpr_cd || info.pklt_cd;
     const live = liveMap.get(code);
     const isLiveValid = Boolean(live && live.currentParked !== null);
     // ... 주차장 통합 객체 생성
   }
   ```

5. **2단계 Fallback 거리 정렬 및 슬롯 매핑**:
   - 하버사인(Haversine) 공식을 적용하여 각 명소 중심으로부터 최단거리 주차장을 탐색합니다.
   - **우선순위 가중치**:
     1. 명소 직속/부속 주차장 (우선 점수 -50,000점 가중)
     2. 실시간 센서 연동 주차장 (5대 지자체 실시간 데이터 우선 매핑)
     3. 일반 현장확인 공영/민영 주차장
   - 최대 5개 주차장을 중복 없이 슬롯에 채워 각 축제 객체에 바인딩합니다.

6. **실시간 기상 데이터 비동기 병렬 결합**:
   - 고유 위치 좌표별로 Koreaconnect Weather API를 병렬 호출하여 기온, 체감온도, 기상 상태, 이모지를 매핑합니다.

---

## 3. 장애 방어 및 에러 핸들링 전략 (Fault Tolerance)

### 3.1. 외부 API 장애 격리 (Fault Isolation)
- 외부 공공데이터 API 호출마다 `AbortSignal.timeout(2000~3000ms)`을 설정하여 지연 시 즉시 연결을 해제합니다.
- `Promise.allSettled`를 적용하여 특정 지자체 주차 API나 기상청 API가 실패하더라도 **축제 정보 및 기본 주차 정보는 정상 렌더링(Graceful Degradation)**됩니다.

### 3.2. Safe Empty Fallback
- 검색 반경 내에 등록된 주차장이 없거나 API 응답이 비어있더라도 안전 빈 배열(`[]`)과 안내 문구(`주변 1km 내 공영주차장 정보 확인 중`)를 반환하여 프론트엔드 크래시를 방지합니다.

### 3.3. 모바일 사파리(iOS) URL 스킴 에러 방지 정규화
- iOS Safari 및 인앱 브라우저에서 커스텀 스킴(`kakaonavi://`, `tmap://`) 호출 시 발생하는 `"주소가 유효하지 않습니다"` 팝업 오류를 방지하기 위해 **공식 웹/앱 통합 범용 URL**을 적용했습니다:
  - **카카오맵/카카오내비**: `https://map.kakao.com/link/to/{name},{lat},{lng}`
  - **티맵(TMAP)**: `https://smap.tmap.co.kr/route.html?name={name}&lat={lat}&lon={lng}`
  - **네이버 지도**: `https://map.naver.com/v5/directions/-,/{lng},{lat},{name},,PLACE_POI/-/car`

---

## 4. 프론트엔드 상태 관리 및 스마트 지도 인터랙션

### 4.1. 지도 마커 생명주기 제어 (Marker Lifecycle)
- **전체 탐색 모드**: 지도 이동 또는 '이 지역에서 재검색' 시에는 **명소 핀(나무/폭죽/건물)만 노출**하여 시각적 혼잡을 방지합니다.
- **포커스 모드**: 사용자가 특정 명소 마커나 하단 캐러셀 카드를 탭했을 때만 해당 명소의 **5개 주차장 P 마커가 지도에 동적으로 표출**됩니다.
- **배경 터치 해제**: 지도 빈 공간을 터치하면 선택 상태가 초기화되고 주차장 마커가 즉시 사라집니다.

### 4.2. 3단계 주차 신호등 뱃지 알고리즘 ([`parkingUtils.tsx`](file:///Users/heojihye/anbumbyeo/src/lib/parkingUtils.tsx))

```typescript
if (isLive && available !== null) {
  if (available === 0) {
    return '만차 🔴 (0/총면수)';
  }
  const rate = (available / total) * 100;
  if (rate < 30 && available < 10) {
    return '혼잡 🟠 (잔여/총면수)';
  }
  return '여유 🟢 (잔여/총면수)';
}
return '총 면수 (현장확인 ⚪)';
```

---

## 5. 핵심 모듈 및 파일 명세

| 모듈 경로 | 주요 역할 및 책임 |
|---|---|
| [`src/app/api/festivals/route.ts`](file:///Users/heojihye/anbumbyeo/src/app/api/festivals/route.ts) | • 60초 In-Memory 캐시 관리<br>• Tour API, 전국 주차 기본/5개 지자체 실시간 API, 기상 API 병렬 오케스트레이션<br>• 주차장-축제 거리순 In-Memory Join |
| [`src/app/page.tsx`](file:///Users/heojihye/anbumbyeo/src/app/page.tsx) | • 메인 상태 오케스트레이터 (선택 권역, 카테고리, 상태 필터)<br>• NavigationModal 및 Toast 전역 트리거 |
| [`src/components/map/LeafletMapInner.tsx`](file:///Users/heojihye/anbumbyeo/src/components/map/LeafletMapInner.tsx) | • Leaflet 기반 커스텀 핀 & P 마커 렌더링<br>• 드래그/줌 이벤트 감지 및 '이 지역에서 재검색' 트리거 |
| [`src/components/festival/FestivalCarousel.tsx`](file:///Users/heojihye/anbumbyeo/src/components/festival/FestivalCarousel.tsx) | • 스와이프 가능한 축제/명소 카드 캐러셀<br>• 최단거리 주차장 요약, 신호등 뱃지, 날씨 뱃지 표출 |
| [`src/components/festival/FestivalBottomSheet.tsx`](file:///Users/heojihye/anbumbyeo/src/components/festival/FestivalBottomSheet.tsx) | • 3단계(접힘/절반/전체) 제어 바텀시트<br>• 주변 5개 주차장 리스트, 요금 정보, 도보시간 상세 안내 |
| [`src/components/common/NavigationModal.tsx`](file:///Users/heojihye/anbumbyeo/src/components/common/NavigationModal.tsx) | • 3대 내비게이션(카카오/티맵/네이버) 공식 범용 URL 팝업 모달 |
| [`src/components/common/Toast.tsx`](file:///Users/heojihye/anbumbyeo/src/components/common/Toast.tsx) | • 주소 복사 알림 2초 자동 디스미스 토스트 |
| [`src/lib/geoUtils.ts`](file:///Users/heojihye/anbumbyeo/src/lib/geoUtils.ts) | • 하버사인 거리 계산 및 인파 밀집도 산출 로직 |
| [`src/lib/parkingUtils.tsx`](file:///Users/heojihye/anbumbyeo/src/lib/parkingUtils.tsx) | • 잔여율 계산 및 3단계 신호등 뱃지 렌더러 |

---

## 6. 성능 및 품질 지표 (Performance Metrics)

- **서버 응답 속도**:
  - 캐시 적중 시: **< 5ms**
  - 캐시 미적중 시: **~600ms** (외부 4대 공공 API 병렬 오케스트레이션 기준)
- **클라이언트 번들 최적화**:
  - Leaflet Map의 NoSSR 동적 임포트(`next/dynamic`) 적용으로 초기 번들 크기 최소화.
- **코드 무결성**:
  - TypeScript 컴파일: **에러 0건**
  - ESLint 룰 검사: **오류 0건**
  - Next.js 16 프로덕션 빌드: **성공 (Exit code 0)**
