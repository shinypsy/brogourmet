const rawApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

/**
 * gourmet API 베이스.
 * - 값이 있으면 그대로 사용(끝 슬래시 제거).
 * - 개발(DEV)에서 비어 있으면 `/__gourmet_api__` → Vite가 127.0.0.1:8001로 프록시.
 *   브라우저는 항상 프론트 origin(:5173)만 쓰므로 공인IP:8001 직접 접속·NAT 루프백 문제를 피함.
 * - 프로덕션 빌드에서 비어 있으면 기본 localhost:8001 (배포 시 .env로 반드시 지정 권장).
 */
export const API_BASE_URL =
  rawApiBase !== ''
    ? rawApiBase.replace(/\/$/, '')
    : import.meta.env.DEV
      ? '/__gourmet_api__'
      : 'http://localhost:8001'

/** `/uploads` 등 — 프록시(상대 경로)일 때는 현재 페이지 origin 기준 */
export function resolveApiBaseUrl(): URL {
  const b = API_BASE_URL
  if (b.startsWith('http://') || b.startsWith('https://')) {
    return new URL(b.endsWith('/') ? b : `${b}/`)
  }
  if (typeof window !== 'undefined') {
    return new URL(b.startsWith('/') ? b : `/${b}`, window.location.origin)
  }
  return new URL('http://localhost:8001/')
}

export const ACCESS_TOKEN_KEY = 'brogourmet_access_token'
/**
 * 카카오 지도 Javascript API `sdk.js?appkey=` 용.
 * developers.kakao.com → 앱 → 플랫폼 키 → JavaScript 키 + 해당 키의 JavaScript SDK 도메인 등록.
 * REST API 키는 지도 스크립트 appkey에 넣을 수 없음.
 */
export const KAKAO_MAP_APP_KEY = (import.meta.env.VITE_KAKAO_MAP_APP_KEY ?? '').trim()
/** 로컬/좌표 REST 호출용 (Authorization: KakaoAK …). 지도 SDK와 별도 키. */
export const KAKAO_REST_API_KEY = (import.meta.env.VITE_KAKAO_REST_API_KEY ?? '').trim()
