/** 무료나눔 / Q&A 등 동일 API(`free-share`)를 쓰는 보드별 내비·경로 */

import { normalizeFreeShareCategory } from './freeShareCategory'

export type CommunityBoardNav = {
  listPath: string
  writePath: string
  boardName: string
  placeBasePath: string
  completeCheckboxLabel: string
  /** Q&A: 댓글을 답변으로 표시하고, 작성은 관리자·해당 구 지역 담당자만 */
  answerThread?: boolean
}

export const FREE_SHARE_BOARD_NAV: CommunityBoardNav = {
  listPath: '/free-share',
  writePath: '/free-share/write',
  boardName: '무료나눔',
  placeBasePath: '/free-share',
  completeCheckboxLabel: '나눔 완료',
}

export const QNA_BOARD_NAV: CommunityBoardNav = {
  listPath: '/qna?tab=qna',
  writePath: '/qna/write?variant=qna',
  boardName: 'Q&A',
  placeBasePath: '/qna',
  completeCheckboxLabel: '질문 해결됨',
  answerThread: true,
}

export const FAQ_BOARD_NAV: CommunityBoardNav = {
  listPath: '/qna?tab=faq',
  writePath: '/qna/write?variant=faq',
  boardName: 'FAQ',
  placeBasePath: '/qna',
  completeCheckboxLabel: '게시 종료',
  answerThread: false,
}

/** 상세 글 `share_category`로 목록·작성 경로(쿼리 포함) 결정 */
export function communityNavForFreeSharePost(shareCategory: string | null | undefined): CommunityBoardNav {
  const c = normalizeFreeShareCategory(shareCategory)
  if (c === 'faq') return FAQ_BOARD_NAV
  if (c === 'qa') return QNA_BOARD_NAV
  return FREE_SHARE_BOARD_NAV
}
