/** 무료나눔 / Q&A 등 동일 API(`free-share`)를 쓰는 보드별 내비·경로 */

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
  listPath: '/qna',
  writePath: '/qna/write',
  boardName: 'Q&A',
  placeBasePath: '/qna',
  completeCheckboxLabel: '질문 해결됨',
  answerThread: true,
}
