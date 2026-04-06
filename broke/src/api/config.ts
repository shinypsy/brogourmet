export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const ACCESS_TOKEN_KEY = 'brogourmet_access_token'
/**
 * 카카오 지도 Javascript API `sdk.js?appkey=` 용.
 * developers.kakao.com → 앱 → 플랫폼 키 → JavaScript 키 + 해당 키의 JavaScript SDK 도메인 등록.
 * REST API 키는 지도 스크립트 appkey에 넣을 수 없음.
 */
export const KAKAO_MAP_APP_KEY = (import.meta.env.VITE_KAKAO_MAP_APP_KEY ?? '').trim()
/** 로컬/좌표 REST 호출용 (Authorization: KakaoAK …). 지도 SDK와 별도 키. */
export const KAKAO_REST_API_KEY = (import.meta.env.VITE_KAKAO_REST_API_KEY ?? '').trim()
