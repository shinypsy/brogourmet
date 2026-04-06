import { requestJson } from './http'
import { API_BASE_URL } from './config'

export type FreeSharePost = {
  id: number
  title: string
  body: string
  district: string | null
  image_url: string | null
  author_nickname: string
  created_at: string
}

export type KnownRestaurantPost = {
  id: number
  title: string
  body: string
  restaurant_name: string
  district: string
  main_menu_name: string
  main_menu_price: number
  image_url: string | null
  author_nickname: string
  created_at: string
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

export async function createKnownRestaurantPost(
  token: string,
  body: {
    title: string
    body: string
    restaurant_name: string
    district: string
    main_menu_name: string
    main_menu_price: number
    image_url?: string | null
  },
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
  body: {
    title: string
    body: string
    restaurant_name: string
    district: string
    main_menu_name: string
    main_menu_price: number
    image_url?: string | null
  },
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

export async function uploadCommunityImage(token: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE_URL}/uploads/image`, {
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
