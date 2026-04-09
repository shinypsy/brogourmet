/** BroG·MyG 상세 상단 뒤로가기 등에서 공통 사용 */
export function BrogListIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="5" cy="6.5" r="1.5" fill="currentColor" />
      <path d="M10 6.5h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <path d="M10 12h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="5" cy="17.5" r="1.5" fill="currentColor" />
      <path d="M10 17.5h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
