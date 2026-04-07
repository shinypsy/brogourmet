import { takeFirstMenuLinesFromRawText } from './menuLines'

/** 메뉴판 이미지 → 텍스트 (최대 10줄). 첫 실행 시 언어 데이터 다운로드로 지연될 수 있음. */
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
