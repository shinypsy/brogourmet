import { notifyAuthChange } from '../authEvents'
import { ACCESS_TOKEN_KEY, API_BASE_URL } from './config'

function errorDetail(data: unknown): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === 'object' && item !== null && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : JSON.stringify(item),
        )
        .join(', ')
    }
  }
  return 'Request failed'
}

function isLikelyNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && String(error.message).toLowerCase().includes('fetch')
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? undefined)
  // GET/HEAD에 Content-Type을 붙이면 단순 요청이 아니어서 CORS preflight가 생깁니다.
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const url = `${API_BASE_URL}${path}`
  let response: Response
  try {
    const cache =
      init?.cache ?? (method === 'GET' || method === 'HEAD' ? ('no-store' as RequestCache) : undefined)
    response = await fetch(url, {
      ...init,
      headers,
      ...(cache ? { cache } : {}),
    })
  } catch (error) {
    if (isLikelyNetworkFailure(error)) {
      const proxyHint =
        import.meta.env.DEV && API_BASE_URL.startsWith('/')
          ? ' 개발 모드는 Vite가 API로 프록시합니다. gourmet가 이 PC에서 uvicorn --host 0.0.0.0 --port 8001 로 떠 있는지 확인하세요.'
          : ' broke/.env의 VITE_API_BASE_URL은 API 주소(예: http://192.168.0.47:8001)여야 하며, 집 안에서 공인IP:8001이 안 되면 DEV에서 VITE_API_BASE_URL을 비워 프록시를 쓰세요.'
      throw new Error(
        `서버에 연결할 수 없습니다. gourmet API(uvicorn)가 켜져 있는지 확인하세요. (현재 API 베이스: ${API_BASE_URL})${proxyHint}`,
      )
    }
    throw error
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      headers.get('Authorization')?.startsWith('Bearer ')
    ) {
      try {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        notifyAuthChange()
      } catch {
        /* private mode 등 */
      }
    }
    let message = response.statusText || 'Request failed'
    try {
      message = errorDetail(await response.json())
    } catch {
      /* keep statusText */
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
