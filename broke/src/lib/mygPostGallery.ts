import type { KnownRestaurantPost } from '../api/community'

/** 상세 히어로·갤러리용. 빈 문자열·공백 URL 제거 후 `image_url` 폴백 */
export function galleryUrlsFromMygPost(post: KnownRestaurantPost): string[] {
  const raw = post.image_urls
  const list = Array.isArray(raw) ? raw : []
  const urls = list
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
  if (urls.length > 0) return urls
  const single = post.image_url?.trim()
  return single ? [single] : []
}
