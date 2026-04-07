/** Vite: .env 에 VITE_BROG_ONLY=true 이면 커뮤니티·결제 메뉴 숨김 (BroG 초기 버전) */
export const BROG_ONLY =
  import.meta.env.VITE_BROG_ONLY === 'true' || import.meta.env.VITE_BROG_ONLY === '1'
