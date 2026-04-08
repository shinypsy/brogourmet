/**
 * 프론트 전용 참고용: API `MAPO_BROG_DEMO_SPECS`(gourmet/app/seed.py)와 동일한 마포구 데모 6곳.
 * 스토리북·오프라인 목업 등에 쓸 때만 import 하세요.
 */
export type MockRestaurant = {
  id: number
  name: string
  district: string
  category: string
  mainMenu: string
  mainPrice: number
  subMenu: string
  subPrice: number
  summary: string
}

export const mockRestaurants: MockRestaurant[] = [
  {
    id: 1,
    name: '연남동 파스타 하우스',
    district: '마포구',
    category: '양식',
    mainMenu: '런치 토마토 파스타',
    mainPrice: 10000,
    subMenu: '트러플 크림 파스타',
    subPrice: 16000,
    summary: '대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.',
  },
  {
    id: 2,
    name: '망원 수제버거 키친',
    district: '마포구',
    category: '패스트푸드',
    mainMenu: '클래식 버거',
    mainPrice: 8000,
    subMenu: '더블치즈 버거',
    subPrice: 12500,
    summary: '기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.',
  },
  {
    id: 3,
    name: '합정 돈가스 살롱',
    district: '마포구',
    category: '일식',
    mainMenu: '등심돈까스 정식',
    mainPrice: 9000,
    subMenu: '치즈 돈까스',
    subPrice: 11000,
    summary: '바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.',
  },
  {
    id: 4,
    name: '상수동 쌀국수 길',
    district: '마포구',
    category: '분식',
    mainMenu: '얼큰 쌀국수',
    mainPrice: 9500,
    subMenu: '짜조 반채',
    subPrice: 6000,
    summary: '향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.',
  },
  {
    id: 5,
    name: 'DMC역 김치찌개 백반',
    district: '마포구',
    category: '한식',
    mainMenu: '김치찌개 백반',
    mainPrice: 9000,
    subMenu: '제육볶음 추가',
    subPrice: 8000,
    summary: '직장인 단골이 많은 백반집으로, 김치찌개와 반찬이 안정적인 편입니다.',
  },
  {
    id: 6,
    name: '홍대 입구 에그토스트',
    district: '마포구',
    category: '패스트푸드',
    mainMenu: '베이컨 에그토스트',
    mainPrice: 5000,
    subMenu: '아메리카노',
    subPrice: 3000,
    summary: '이동 중에도 먹기 좋은 에그토스트와 음료 조합이 인기입니다.',
  },
]
