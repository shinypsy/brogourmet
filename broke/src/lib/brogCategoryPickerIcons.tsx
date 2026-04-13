import type { BrogCategory } from './brogCategories'

/** BroG 카테고리 칩용 — 동일 viewBox·선 굵기로 통일 */
export function BrogCategoryPickerIcon({ category }: { category: BrogCategory }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (category) {
    case '한식':
      return (
        <svg {...common}>
          <path d="M12 4v16M8 8h8M7 12h10M6 16h12" />
          <ellipse cx="12" cy="19" rx="6" ry="1.5" opacity="0.35" />
        </svg>
      )
    case '중식':
      return (
        <svg {...common}>
          <path d="M6 8h12v10H6z" />
          <path d="M9 8V6h6v2M12 8v10" />
        </svg>
      )
    case '일식':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="14" rx="7" ry="3.5" />
          <path d="M8 11c1.5-3 4.5-3 8 0" />
          <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case '양식':
      return (
        <svg {...common}>
          <path d="M6 10c2-4 10-4 12 0v8H6z" />
          <path d="M9 14h6M12 12v6" />
        </svg>
      )
    case '분식':
      return (
        <svg {...common}>
          <path d="M8 6h8l-1 14H9L8 6z" />
          <path d="M10 4h4" />
        </svg>
      )
    case '패스트푸드':
      return (
        <svg {...common}>
          <path d="M5 11h14v6H5z" />
          <path d="M7 11V9h10v2M9 7h6" />
        </svg>
      )
    case '음료':
      return (
        <svg {...common}>
          <path d="M9 3h6l-1 16h-4L9 3z" />
          <path d="M10 8h4" opacity="0.5" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

/** 점메추 등 「상관없음」 — `BrogCategoryPickerIcon`과 동일 선 스타일 */
export function BrogGameTasteAnyIcon() {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="2.25" />
      <circle cx="15" cy="9" r="2.25" />
      <circle cx="9" cy="15" r="2.25" />
      <circle cx="15" cy="15" r="2.25" />
    </svg>
  )
}
