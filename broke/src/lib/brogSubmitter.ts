/** API `users.role` 값 → 상세 화면용 짧은 라벨 */
export function brogSubmitterRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null
  if (role === 'super_admin') return '슈퍼 관리자'
  if (role === 'regional_manager') return '지역 담당자'
  if (role === 'user') return '회원'
  if (role === 'franchise') return '가맹'
  return role
}
