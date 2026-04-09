import { API_BASE_URL } from './config'

/** JPEG/PNG만 서버에서 CLOVA로 전달 가능 */
export async function ocrMenuImageClova(token: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE_URL}/ocr/clova/menu-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (data.detail != null) {
        msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      }
    } catch {
      /* keep statusText */
    }
    throw new Error(msg)
  }
  const data = (await res.json()) as { text?: string }
  return (data.text ?? '').trim()
}
