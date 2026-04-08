import { takeFirstMenuLinesFromRawText } from './menuLines'

/**
 * 브라우저에서 Tesseract.js(kor+eng)로 메뉴판 이미지 → 텍스트(최대 10줄).
 * 외부 OCR API는 서비스 단계에서 재논의 예정.
 */
export async function recognizeMenuImageToMenuLines(file: File): Promise<string> {
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
