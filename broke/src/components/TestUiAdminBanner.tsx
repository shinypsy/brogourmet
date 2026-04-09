import { assumeAdminUi } from '../lib/roles'

/** 테스트 기간 전역 안내 — 관리자 권한 UI 기준으로 화면을 본다는 뜻 */
export function TestUiAdminBanner() {
  if (!assumeAdminUi()) return null

  const modeLabel = import.meta.env.DEV
    ? 'broke/.env → VITE_ASSUME_ADMIN_UI=1 (로컬)'
    : 'VITE_ASSUME_ADMIN_UI=1 (스테이징·프로덕션 빌드)'

  return (
    <div className="test-ui-admin-banner" role="status">
      <p>
        <strong>테스트 UI</strong> — 화면은 <strong>최고 관리자 권한</strong>을 가정해 배치했습니다. 저장·삭제·업로드 등은
        로그인 토큰이 있어야 API가 동작합니다. <span className="test-ui-admin-banner__mode">({modeLabel})</span>
      </p>
    </div>
  )
}
