import { requestJson } from './http'
import { API_BASE_URL } from './config'

export type FreeSharePost = {
  id: number
  author_id: number
  title: string
  body: string
  district: string | null
  image_url: string | null
  author_nickname: string
  created_at: string
}

export type KnownRestaurantPost = {
  id: number
  author_id: number
  title: string
  body: string
  restaurant_name: string
  district: string
  main_menu_name: string
  main_menu_price: number
  image_url: string | null
  author_nickname: string
  created_at: string
  /** BroG 작성 폼과 동일 필드(변환·표시용) */
  city?: string | null
  district_id?: number | null
  category?: string | null
  summary?: string | null
  latitude?: number | null
  longitude?: number | null
  image_urls?: string[] | null
  menu_lines?: string | null
  /** true면 지도에서 가맹점용 깃발. API 연동 시 사용 */
  is_franchise?: boolean
}

export type KnownRestaurantPostCreatePayload = {
  restaurant_name: string
  district_id: number
  city?: string
  category: string
  summary: string
  menu_lines: string
  latitude?: number | null
  longitude?: number | null
  image_urls?: string[]
}

/** 관리자 프롬프트 수정 등 레거시 페이로드 */
export type KnownRestaurantPostLegacyUpdatePayload = {
  title: string
  body: string
  restaurant_name: string
  district: string
  main_menu_name: string
  main_menu_price: number
  image_url?: string | null
}

export async function fetchFreeSharePosts(): Promise<FreeSharePost[]> {
  return requestJson<FreeSharePost[]>('/free-share/posts')
}

export async function createFreeSharePost(
  token: string,
  body: { title: string; body: string; district?: string | null; image_url?: string | null },
): Promise<FreeSharePost> {
  return requestJson<FreeSharePost>('/free-share/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export async function updateFreeSharePost(
  token: string,
  id: number,
  body: { title: string; body: string; district?: string | null; image_url?: string | null },
): Promise<FreeSharePost> {
  return requestJson<FreeSharePost>(`/free-share/posts/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export async function deleteFreeSharePost(token: string, id: number): Promise<void> {
  return requestJson<void>(`/free-share/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function fetchKnownRestaurantPosts(): Promise<KnownRestaurantPost[]> {
  return requestJson<KnownRestaurantPost[]>('/known-restaurants/posts')
}

export async function fetchFreeSharePost(id: number): Promise<FreeSharePost> {
  return requestJson<FreeSharePost>(`/free-share/posts/${id}`)
}

export async function fetchKnownRestaurantPost(id: number): Promise<KnownRestaurantPost> {
  return requestJson<KnownRestaurantPost>(`/known-restaurants/posts/${id}`)
}

export async function createKnownRestaurantPost(
  token: string,
  body: KnownRestaurantPostCreatePayload,
): Promise<KnownRestaurantPost> {
  return requestJson<KnownRestaurantPost>('/known-restaurants/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export async function updateKnownRestaurantPost(
  token: string,
  id: number,
  body: KnownRestaurantPostCreatePayload | KnownRestaurantPostLegacyUpdatePayload,
): Promise<KnownRestaurantPost> {
  return requestJson<KnownRestaurantPost>(`/known-restaurants/posts/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export async function deleteKnownRestaurantPost(token: string, id: number): Promise<void> {
  return requestJson<void>(`/known-restaurants/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** BroG → 서버(배포 시) 저장소, MyG·무료나눔 → 로컬 저장소. 레거시 평면은 `/uploads/image`. */
export type UploadImageScope = 'brog' | 'myg' | 'legacy'

export async function uploadCommunityImage(
  token: string,
  file: File,
  scope: UploadImageScope = 'myg',
): Promise<string> {
  const path =
    scope === 'brog'
      ? '/uploads/brog/image'
      : scope === 'myg'
        ? '/uploads/myg/image'
        : '/uploads/image'
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ detail: '이미지 업로드 실패' }))) as {
      detail?: string
    }
    throw new Error(body.detail ?? '이미지 업로드 실패')
  }

  const data = (await response.json()) as { url: string }
  return data.url
}
