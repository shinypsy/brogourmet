/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 카카오 지도 sdk.js — JavaScript 키만 (REST 키 금지) */
  readonly VITE_KAKAO_MAP_APP_KEY?: string
  /** Kakao Local 등 REST — 지도 appkey와 별도 */
  readonly VITE_KAKAO_REST_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
