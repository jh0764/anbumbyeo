# 🛠️ 지표·전략 및 트러블슈팅 명세서 (Troubleshooting & Architecture Decisions)
> **서비스명**: 안붐벼 (전국 실시간 축제·명소 밀집도 & 주차 정보 통합 플랫폼)  
> **최종 개정일**: 2026-08-24  
> **문서 버전**: v1.0.0

---

## 1. 트러블슈팅 사례 1: iOS Safari 커스텀 URL 스킴 호출 에러 해결

### 🔴 문제 상황 (Problem)
- 모바일 Safari 및 iOS 인앱 브라우저에서 '길찾기' 클릭 시 `kakaonavi://`, `tmap://`, `nmap://` 등 앱 커스텀 스킴을 호출할 경우, 해당 앱이 미설치된 기기에서 **`"주소가 유효하지 않기 때문에 Safari가 해당 페이지를 열 수 없습니다"`**라는 브라우저 팝업 경고가 발생하여 사용자 이탈을 유발함.

### 🟢 해결 전략 및 구현 (Solution)
- 앱 미설치 시에도 브라우저 길찾기 웹뷰로 자동 연결되고, 앱 설치 기기에서는 자동으로 앱을 실행해주는 **3대 내비게이션 공식 범용 통합 URL**로 전면 전환함.

```typescript
// src/components/common/NavigationModal.tsx
const handleLaunchNavi = (type: 'kakao' | 'tmap' | 'naver') => {
  if (!lat || !lng) return;
  const encodedName = encodeURIComponent(targetName);

  if (type === 'kakao') {
    // 1. 카카오맵 / 카카오내비 공식 길찾기 링크
    const url = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
    window.open(url, '_blank');
  } else if (type === 'tmap') {
    // 2. 티맵 (TMAP) 통합 길찾기 링크
    const url = `https://smap.tmap.co.kr/route.html?name=${encodedName}&lat=${lat}&lon=${lng}`;
    window.open(url, '_blank');
  } else if (type === 'naver') {
    // 3. 네이버 지도 도착지 자동 세팅 차량 길찾기 링크
    const url = `https://map.naver.com/v5/directions/-,/${lng},${lat},${encodedName},,PLACE_POI/-/car`;
    window.open(url, '_blank');
  }
};
```

---

## 2. 트러블슈팅 사례 2: 지도 재검색 시 주차장 P 마커 중복 난립 버그

### 🔴 문제 상황 (Problem)
- '이 지역에서 재검색' 버튼을 누르거나 지도를 이동할 때, 모든 축제의 주차장 P 마커 수십 개가 지도 전체에 한꺼번에 렌더링되어 축제/명소 핀이 가려지고 지도 인터랙션이 극도로 저하됨.

### 🟢 해결 전략 및 구현 (Solution)
- **주차장 마커의 생명주기를 `selectedFestival` 상태에 조건부 바인딩**:
  1. 전체 탐색 모드 및 지도 이동 시에는 **명소 핀(나무/폭죽/건물)만 노출**.
  2. 특정 명소를 탭하여 `selectedFestival`이 활성화되었을 때만 **해당 명소의 5개 P 마커를 동적으로 렌더링**.
  3. 지도 빈 배경을 터치하면 `setSelectedFestivalId(null)`을 호출하여 P 마커를 즉시 안전 해제.

```tsx
// src/components/map/LeafletMapInner.tsx
{selectedFestival && selectedFestival.parkingLots && (
  selectedFestival.parkingLots.map((parking) => (
    <Marker
      key={`parking-${parking.id}-${parking.lat}-${parking.lng}`}
      position={[parking.lat, parking.lng]}
      icon={createParkingIcon(parking)}
    >
      <Popup>...</Popup>
    </Marker>
  ))
)}
```

---

## 3. 트러블슈팅 사례 3: 지자체별 실시간 주차 데이터 인프라 격차 대응

### 🔴 문제 상황 (Problem)
- 공공데이터포털 실시간 센서 연동은 5대 지자체(서울, 경기, 대전, 대구, 부산) 중심으로 제공되며, 타 시도(강원, 충청, 전라 등)나 민영 주차장은 실시간 잔여석 센서가 부재하여 API 호출 시 빈 배열이나 에러가 반환되어 UI가 깨질 위험이 있음.

### 🟢 해결 전략 및 구현 (Solution)
- **2단계 주차 데이터 Fallback 아키텍처 구축**:
  - 실시간 센서 연동 시설: 실시간 잔여석 계산 및 🟢 여유 / 🟠 혼잡 / 🔴 만차 신호등 뱃지 표출.
  - 센서 미연동 시설: 전국 250개 시군구 주차장 기본정보(총면수, 운영시간, 요금)를 파싱하여 `총 N면 (현장확인 ⚪)`으로 안전 표출.
  - `Promise.allSettled`로 비동기 호출을 격리하여 일부 지자체 API 장애 시에도 정상 지자체 데이터는 무중단 제공.

---

## 4. 트러블슈팅 사례 4: 캐러셀 카드 간 레이아웃 높이 및 길찾기 버튼 정렬 불일치

### 🔴 문제 상황 (Problem)
- 날씨 뱃지의 유무, 축제 제목의 글자 수(1줄 vs 2줄), 주차장 주소 유무에 따라 캐러셀 카드 높이가 들쑥날쑥해지고 '길찾기' 버튼의 수직 위치가 카드마다 어긋나는 시각적 결함 발생.

### 🟢 해결 전략 및 구현 (Solution)
- 상단 뱃지 바(`h-[24px]`), 타이틀 영역(`h-[20px] truncate`), 위치/기간(`h-[36px]`), 하단 주차장 박스(`h-[80px]`)의 고정 높이를 지정하고, 카드 전체를 `h-[215px] min-h-[215px]`로 통일하여 완벽한 수평/수직 정렬을 구현함.
