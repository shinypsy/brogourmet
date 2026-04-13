/** MyG 신규 작성 — 사진 입력란 용도 라벨(내용 검증은 하지 않음). */
export const BROG_MYG_REQUIRED_PHOTO_LABELS = ['매장 내부', '음식', '메뉴(메뉴판)'] as const

/** BroG 신규 등록(`/restaurants/manage/new`) — 필수 3칸 순서. */
export const BROG_NEW_REQUIRED_PHOTO_LABELS = ['음식', '매장 내부', '메뉴판'] as const

export const BROG_MYG_REQUIRED_PHOTO_COUNT = BROG_MYG_REQUIRED_PHOTO_LABELS.length

export function brogMygRequiredPhotosError(urls: readonly string[]): string | null {
  for (let i = 0; i < BROG_MYG_REQUIRED_PHOTO_COUNT; i += 1) {
    if (!(urls[i] ?? '').trim()) {
      return `필수 사진 「${BROG_MYG_REQUIRED_PHOTO_LABELS[i]}」를 넣어 주세요.`
    }
  }
  return null
}

export function brogNewRegisterRequiredPhotosError(urls: readonly string[]): string | null {
  for (let i = 0; i < BROG_NEW_REQUIRED_PHOTO_LABELS.length; i += 1) {
    if (!(urls[i] ?? '').trim()) {
      return `필수 사진 「${BROG_NEW_REQUIRED_PHOTO_LABELS[i]}」를 넣어 주세요.`
    }
  }
  return null
}

/** 신규: 빈 칸부터 채움. 수정 등: 끝에 이어 붙임. */
export function mergeUploadedImageUrls(
  prev: readonly string[],
  uploads: readonly string[],
  max: number,
  fillEmptyFirst: boolean,
): string[] {
  if (!fillEmptyFirst) {
    return [...prev, ...uploads].slice(0, max)
  }
  const result = [...prev]
  let u = 0
  for (let i = 0; i < result.length && u < uploads.length; i += 1) {
    if (!String(result[i] ?? '').trim()) {
      result[i] = uploads[u]!
      u += 1
    }
  }
  while (u < uploads.length && result.length < max) {
    result.push(uploads[u]!)
    u += 1
  }
  return result.slice(0, max)
}
