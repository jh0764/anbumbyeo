# 🚗 안붐벼
> **전국 실시간 축제·명소 밀집도 & 주차 정보 통합 플랫폼**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-green?logo=leaflet)](https://leafletjs.com/)

---

## 📌 1. 기획 및 개발 배경 (Background)

대형 지역 축제나 도심 나들이 명소를 방문할 때 가장 큰 불편을 초래하는 요인은 **현장 주차난**과 **진입로 병목 현상**입니다. 기존 포털 및 지도 서비스는 축제 정보와 주변 주차장 실시간 정보가 분절되어 있어 사용자가 주차장을 별도로 검색하고 현장 만차 여부를 가늠하기 어려웠습니다.

**안붐벼**는 한국관광공사 Tour API, 전국 주차장 기본정보 및 지자체 실시간 주차 센서 API, 그리고 실시간 기상 데이터를 **위치 기반 실시간 In-Memory 파이프라인으로 결합**하여, 방문객에게 명소 주변 최적의 주차장과 실시간 혼잡도, 날씨 및 원클릭 내비게이션 경로를 한눈에 제공합니다.

---

## 📚 2. 기술 개발 산출물 및 명세서 바로가기 (Documentation)

프로젝트 설계, 데이터 수집 파이프라인, 성능 벤치마크, 트러블슈팅 및 테스트 결과는 아래 명세서에서 상세히 확인하실 수 있습니다:

| 분류 | 문서명 | 주요 내용 |
|---|---|---|
| **통합 아키텍처** | [📖 ARCHITECTURE.md](docs/ARCHITECTURE.md) | 전체 시스템 구조도, In-Memory 조인 및 2단계 Fallback 상세 |
| **시스템 구조** | [🏛️ SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | 3계층(Presentation/Application/Data) 레이어드 아키텍처 및 System Context |
| **데이터 파이프라인** | [🔄 DATA_PIPELINE.md](docs/DATA_PIPELINE.md) | 4대 공공 API 수집 규격, 60초 캐싱 정책, 비동기 장애 격리(`Promise.allSettled`) |
| **요구사항 정의** | [📋 REQUIREMENTS.md](docs/REQUIREMENTS.md) | 7대 유즈케이스(UC-01~07), 주차 잔여율 산출 공식 및 신호등 뱃지 규격 |
| **성능 및 정합성** | [📊 PERFORMANCE_REPORT.md](docs/PERFORMANCE_REPORT.md) | 캐시 적중 시 레이턴시 3.2ms 달성, 트래픽 90% 절감 및 5개 권역 조인 정합성 |
| **트러블슈팅** | [🛠️ TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 사파리 딥링크 에러 해결, 지도 P 마커 생명주기 제어, 캐러셀 높이 규격화 |
| **테스트 결과** | [🧪 TEST_REPORT.md](docs/TEST_REPORT.md) | TypeScript/ESLint 0건 통과, 프로덕션 빌드 및 기능 테스트 매트릭스 전수 PASS |

---

## 🅿️ 3. 주차 데이터 처리 규격 및 2단계 Fallback 아키텍처

안붐벼는 공공데이터포털(디지털융합플랫폼) 및 전국 지자체 연동 규격을 준수하여 신뢰도 높은 2단계 주차 데이터 파이프라인을 운영합니다.

```
[ 축제/명소 탐색 ] ➔ [ 1km 이내 주차장 검색 ]
         │
         ├── 🟢 5대 지자체 실시간 연동 (서울·경기·대전·대구·부산)
         │    └── 3단계 신호등 뱃지: 여유 🟢 / 혼잡 🟠 / 만차 🔴
         │
         └── ⚪ 전국 지자체 및 센서 미연동 시설
              └── 시설 기본정보 기반 Fallback: 총 N면 (현장확인 ⚪) + 요금 정보
```

1. **실시간 주차 가능 정보 제공 권역 (5개 지자체)**:
   - **서울, 경기, 대전, 대구, 부산** 권역의 센서 연동 공영주차장에 한해 실시간 잔여면수 및 **3단계 신호등 컬러 뱃지**를 제공합니다.
     - 🟢 **여유**: 잔여율 ≥ 30% 또는 10대 이상 주차 가능
     - 🟠 **혼잡**: 0% < 잔여율 < 30% 또는 잔여 1~9대
     - 🔴 **만차**: 잔여석 0대
2. **그 외 권역 및 센서 미연동 시설 (안전 Fallback)**:
   - 강원, 충청, 전라, 경상, 제주 등 전국 모든 권역 및 센서 미연동 주차장에 대해서는 국토교통부/한국교통안전공단 표준 시설 기본정보(총면수, 운영 요금 체계)를 기반으로 `총 N면 (현장확인 ⚪)` 뱃지를 안전하게 표출합니다.

---

## ✨ 4. 주요 기능 (Key Features)

| 기능 | 상세 설명 |
|---|---|
| **1. 전국 10개 권역 & 3대 카테고리 필터** | 서울, 경기·인천, 부산, 대구, 대전, 강원, 충청, 전라, 경상, 제주 등 10개 권역과 `축제`, `공원·나들이`, `문화·명소` 3대 카테고리 실시간 탐색 |
| **2. 실시간 날씨 연계** | 축제/명소 좌표 기반 실시간 기온, 체감온도, 날씨 상태 뱃지 표출 (`☀️ 맑음 24℃ (체감 25℃)`) |
| **3. 스마트 지도 마커 인터랙션** | • 초기 로드 및 '이 지역에서 재검색' 시 **명소 핀만 깔끔하게 노출**<br>• 명소 마커 또는 하단 캐러셀 탭 시 **주변 5개 주차장 P 마커 동적 렌더링**<br>• 지도 빈 배경 터치 시 주차장 마커 자동 해제 |
| **4. 3대 내비게이션 딥링크 & 주소 복사** | • **카카오맵/카카오내비**, **티맵(TMAP)**, **네이버지도** 통합 팝업 모달 제공 (사파리 '유효하지 않은 주소' 에러 원천 차단)<br>• 주차장/축제 주소 클릭 시 원클릭 클립보드 복사 및 미니 토스트 알림 |
| **5. 고성능 인메모리 캐싱** | 백엔드 Route Handler에 60초 TTL 인메모리 캐시를 적용하여 공공 API Rate Limit 차단 방지 및 밀리초 단위 초고속 응답 |

---

## 🛠️ 5. 기술 스택 (Tech Stack)

- **Frontend**: Next.js 16.3 (App Router, Turbopack), TypeScript 5, Tailwind CSS 4, Lucide React, Sandoll 어그로체 웹폰트
- **Map Engine**: Leaflet, React-Leaflet, OpenStreetMap
- **Backend & Data Pipeline**:
  - Next.js Server Route Handler (`src/app/api/festivals/route.ts`)
  - 한국관광공사 Tour API 4.0 (`searchFestival2`, `locationBasedList2`)
  - 공공데이터포털 / 디지털융합플랫폼 전국 주차장 기본정보 및 실시간 잔여석 API
  - Koreaconnect 기상 정보 API
- **Optimization**: 60초 TTL 서버 인메모리 캐시, `Promise.allSettled` 비동기 장애 격리

---

## 📁 6. 프로젝트 구조 (Directory Structure)

```
anbumbyeo/
├── docs/
│   ├── ARCHITECTURE.md              # 통합 기술 아키텍처 및 파이프라인 명세서
│   ├── SYSTEM_ARCHITECTURE.md       # 시스템 아키텍처 정의서 (레이어드 구조)
│   ├── DATA_PIPELINE.md             # 데이터 수집 및 파이프라인 명세서
│   ├── REQUIREMENTS.md              # 요구사항 정의서 (유즈케이스 및 산출공식)
│   ├── PERFORMANCE_REPORT.md        # 성능 및 데이터 정합성 검증 보고서
│   ├── TROUBLESHOOTING.md           # 지표·전략 및 트러블슈팅 명세서
│   └── TEST_REPORT.md               # 테스트 계획 및 결과 보고서
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── festivals/
│   │   │       └── route.ts         # 단일 통합 백엔드 API & 60초 메모리 캐시
│   │   ├── globals.css              # 글로벌 스타일 및 SBAggroB 웹폰트 설정
│   │   ├── layout.tsx               # 루트 레이아웃
│   │   └── page.tsx                 # 메인 화면 (지도, 필터, 캐러셀, 바텀시트)
│   ├── components/
│   │   ├── common/
│   │   │   ├── BrandLogo.tsx        # 아스팔트 테마 P 표지판 + 자동차 SVG 로고
│   │   │   ├── CategoryFilter.tsx   # 3대 카테고리 필터
│   │   │   ├── Header.tsx           # 상단 브랜드 헤더 & 실시간 시계
│   │   │   ├── NavigationModal.tsx  # 3대 내비게이션(카카오/티맵/네이버) 액션시트
│   │   │   ├── RegionFilter.tsx     # 10개 광역 지역 탭
│   │   │   ├── StatusFilter.tsx     # 실시간(LIVE) / 예정(UPCOMING) 필터
│   │   │   └── Toast.tsx            # 원클릭 주소 복사 토스트
│   │   ├── festival/
│   │   │   ├── FestivalBottomSheet.tsx # 3단계 축제 상세 바텀시트
│   │   │   └── FestivalCarousel.tsx    # 지도 하단 스와이프 캐러셀 카드
│   │   └── map/
│   │       ├── LeafletMapInner.tsx  # Leaflet 지도 렌더러 및 마커 인터랙션
│   │       └── MainMap.tsx          # Dynamic NoSSR Leaflet 래퍼
│   ├── lib/
│   │   ├── festivalUtils.ts         # 축제 진행 상태 및 D-Day 계산
│   │   ├── geoUtils.ts              # 하버사인 거리 계산 및 인파 밀집도 산출
│   │   └── parkingUtils.tsx         # 3단계 신호등 주차 뱃지 렌더러
│   ├── services/
│   │   └── api.ts                   # 프론트엔드 API 클라이언트
│   └── types/
│       └── index.ts                 # Festival, Parking, WeatherInfo 인터페이스
├── .env.example                     # 환경 변수 템플릿
├── eslint.config.mjs                # ESLint 플랫 설정
├── package.json
└── README.md
```

---

## 🚀 7. 시작하기 (Getting Started)

### 1) Prerequisites
- Node.js 18.17 이상
- npm, yarn, 또는 pnpm

### 2) Environment Variables (.env.local)
프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 필수 API 인증키를 설정합니다:

```env
# 한국관광공사 Tour API 인증키
TOUR_API_KEY="YOUR_TOUR_API_KEY"
NEXT_PUBLIC_TOUR_API_KEY="YOUR_TOUR_API_KEY"

# 전국 공영/민영 주차장 기본정보 및 실시간 API 인증키
PARKING_API_KEY="YOUR_PARKING_API_KEY"

# Koreaconnect 실시간 날씨 API 인증키
WEATHER_API_KEY="YOUR_WEATHER_API_KEY"

# (선택) 지도 클라이언트 ID
NEXT_PUBLIC_MAP_CLIENT_ID=""
```

### 3) Installation & Run
```bash
# 의존성 패키지 설치
npm install

# 로컬 개발 서버 실행
npm run dev

# 브라우저 접속: http://localhost:3000
```

### 4) Production Build & Lint
```bash
# 린트 검사
npm run lint

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start
```

---

## 📄 8. 라이선스 및 데이터 출처 (License & Sources)
- **Data Sources**:
  - 한국관광공사 국문 관광정보 서비스 (Tour API 4.0)
  - 국토교통부 / 한국교통안전공단 전국 주차장 정보 서비스
  - 공공데이터포털 지자체별(서울·경기·대전·대구·부산) 실시간 주차 정보 서비스
  - Koreaconnect 기상 정보 서비스
  - OpenStreetMap Contributor Data
- **Font**: Sandoll 어그로체 (SBAggroB)
- **License**: MIT License
