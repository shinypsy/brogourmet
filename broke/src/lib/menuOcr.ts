import { ocrMenuImageClova } from '../api/ocr'
import { ACCESS_TOKEN_KEY } from '../api/config'
import { takeFirstMenuLinesFromRawText } from './menuLines'

function useClovaOcrFirst(): boolean {
  const v = String(import.meta.env.VITE_USE_CLOVA_OCR ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function isJpegOrPng(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png'
}

/**
 * `VITE_USE_CLOVA_OCR=1` 이고 로그인 토큰이 있으며 이미지가 JPEG/PNG이면
 * 서버 CLOVA OCR → 실패 시 Tesseract.js(kor+eng)로 폴백.
 * 그 외는 브라우저 Tesseract만 사용.
 */
export async function recognizeMenuImageToMenuLines(file: File): Promise<string> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null

  if (useClovaOcrFirst() && token && isJpegOrPng(file)) {
    try {
      const text = await ocrMenuImageClova(token, file)
      return takeFirstMenuLinesFromRawText(text)
    } catch {
      /* fall through to Tesseract */
    }
  }

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('kor+eng')
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    return takeFirstMenuLinesFromRawText(text)
  } finally {
    await worker.terminate()
  }
}
