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
    name: '강남 국밥 연구소',
    district: '강남구',
    category: '한식',
    mainMenu: '수육국밥',
    mainPrice: 9000,
    subMenu: '수육 추가',
    subPrice: 12000,
    summary: '든든한 국밥과 깔끔한 반찬 구성이 강점인 직장인 점심 맛집입니다.',
  },
  {
    id: 2,
    name: '강남 덮밥 연구소',
    district: '강남구',
    category: '일식',
    mainMenu: '연어덮밥',
    mainPrice: 10000,
    subMenu: '사이드 사시미',
    subPrice: 14000,
    summary: '대표 메뉴는 1만원 이하로 즐기고, 추가 메뉴는 선택적으로 주문할 수 있습니다.',
  },
  {
    id: 3,
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
    id: 4,
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
    id: 5,
    name: '송리단길 스시 바',
    district: '송파구',
    category: '일식',
    mainMenu: '런치 초밥 8pcs',
    mainPrice: 10000,
    subMenu: '특선 초밥 12pcs',
    subPrice: 18000,
    summary: '런치 대표 메뉴로 가볍게 입문할 수 있고, 추가 세트는 별도 선택이 가능합니다.',
  },
  {
    id: 6,
    name: '잠실 냉면정',
    district: '송파구',
    category: '한식',
    mainMenu: '평양냉면',
    mainPrice: 9500,
    subMenu: '수육 반접시',
    subPrice: 15000,
    summary: '맑은 육수와 부드러운 면발로 여름철 방문이 많은 냉면집입니다.',
  },
  {
    id: 7,
    name: '광화문 한옥밥상',
    district: '종로구',
    category: '한식',
    mainMenu: '제육정식',
    mainPrice: 9000,
    subMenu: '한옥 수육전골',
    subPrice: 17000,
    summary: '관광객과 직장인 모두가 부담 없이 먹을 수 있는 정식 메뉴가 강점입니다.',
  },
  {
    id: 8,
    name: '성수 화덕피자 공방',
    district: '성동구',
    category: '양식',
    mainMenu: '조각 피자 세트',
    mainPrice: 7000,
    subMenu: '마르게리타 피자 한 판',
    subPrice: 17000,
    summary: '조각 세트로 가볍게 즐길 수 있고, 화덕피자 한 판은 부메뉴로 제공됩니다.',
  },
]
