import { type ResolveDistrictReason } from './resolveSeoulDistrictFromCoords'

export function mapGeoHintMessage(reason: ResolveDistrictReason, district: string): string {
  switch (reason) {
    case 'ok':
      return `위치를 기준으로 ${district}를 선택했습니다.`
    case 'outside_seoul':
      return '이 좌표는 서울 시내로 인식되지 않았습니다. 구는 드롭다운에서 선택해 주세요.'
    case 'no_key':
      return '좌표로 구를 자동 맞추려면 .env의 VITE_KAKAO_REST_API_KEY가 필요합니다. 지금은 화면에서 선택한 구를 유지합니다.'
    case 'denied':
      return '위치 권한이 없어 기본 구를 사용합니다. 구는 아래에서 바꿀 수 있습니다.'
    case 'position_error':
      return '위치를 가져오지 못해 기본 구를 사용합니다.'
    case 'network':
    case 'unknown_address':
      return '주소를 확인하지 못했습니다. 구는 드롭다운에서 선택해 주세요.'
    default:
      return '기본 구를 사용합니다.'
  }
}
