import { DEFAULT_HOME_DISTRICT, type ResolveDistrictReason } from './resolveSeoulDistrictFromCoords'

export function mapGeoHintMessage(reason: ResolveDistrictReason, district: string): string {
  switch (reason) {
    case 'ok':
      return `위치를 기준으로 ${district}를 선택했습니다.`
    case 'outside_seoul':
      return `서울 외 지역이 감지되어 기본 구(${DEFAULT_HOME_DISTRICT})를 사용합니다.`
    case 'no_key':
      return `현재 위치로 구를 자동 설정할 수 없어 기본 구(${district})를 사용합니다. 아래에서 구를 바꿀 수 있습니다.`
    case 'denied':
      return '위치 권한이 없어 기본 구를 사용합니다. 구는 아래에서 바꿀 수 있습니다.'
    case 'position_error':
      return '위치를 가져오지 못해 기본 구를 사용합니다.'
    case 'network':
    case 'unknown_address':
      return '주소를 확인하지 못해 기본 구를 사용합니다.'
    default:
      return '기본 구를 사용합니다.'
  }
}
