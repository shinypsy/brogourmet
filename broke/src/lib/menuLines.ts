import type { ExtraCardMenuPayload, MenuItem } from '../api/restaurants'

/** 한 메뉴판에서 최대 10줄: 1=대표, 2~4=카드강조, 5~10=부메뉴(카드 미노출) */
export const MAX_MENU_LINES = 10

export type ParsedMenuLines = {
  main: { name: string; price_krw: number }
  extras: ExtraCardMenuPayload[]
  more: ExtraCardMenuPayload[]
  errors: string[]
}

function parsePricePart(raw: string): number | null {
  const cleaned = raw.replace(/[,，]/g, '').replace(/\s/g, '').replace(/원/gi, '')
  const m = cleaned.match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, 1_000_000)
}

/** 한 줄: `이름 : 가격` 또는 `이름:가격` 또는 `이름 9000원` */
export function parseMenuLine(line: string): { name: string; price_krw: number } | null {
  const t = line.trim()
  if (!t) return null

  const colon = t.match(/^(.+?)\s*[:：∶]\s*(.+)$/)
  if (colon) {
    const name = colon[1].trim()
    const price = parsePricePart(colon[2])
    if (!name || price == null) return null
    return { name, price_krw: price }
  }

  const tailWon = t.match(/^(.+?)\s+([\d][\d,]*)\s*(?:원)?\s*$/i)
  if (tailWon) {
    const name = tailWon[1].trim()
    const price = parsePricePart(tailWon[2])
    if (!name || price == null) return null
    return { name, price_krw: price }
  }

  return null
}

export function parseMenuLinesText(text: string): ParsedMenuLines {
  const errors: string[] = []
  const rawLines = text.split(/\r?\n/)
  const nonEmpty = rawLines.map((l) => l.trim()).filter(Boolean)

  if (nonEmpty.length === 0) {
    return {
      main: { name: '', price_krw: 0 },
      extras: [],
      more: [],
      errors: ['메뉴를 한 줄 이상 입력하세요. 예: 수육국밥 : 9000'],
    }
  }

  if (nonEmpty.length > MAX_MENU_LINES) {
    errors.push(`메뉴는 최대 ${MAX_MENU_LINES}줄까지 입력할 수 있습니다.`)
  }

  const toParse = nonEmpty.slice(0, MAX_MENU_LINES)
  const parsed: { name: string; price_krw: number }[] = []

  toParse.forEach((line, i) => {
    const row = parseMenuLine(line)
    if (!row) {
      errors.push(
        `${i + 1}번째 줄을 읽지 못했습니다. "이름 : 가격" 형식인지 확인하세요: "${line.slice(0, 36)}${line.length > 36 ? '…' : ''}"`,
      )
      return
    }
    parsed.push(row)
  })

  if (parsed.length === 0) {
    return {
      main: { name: '', price_krw: 0 },
      extras: [],
      more: [],
      errors: errors.length ? errors : ['유효한 메뉴 줄이 없습니다.'],
    }
  }

  const main = parsed[0]!
  if (main.price_krw > 10_000) {
    errors.push('대표 메뉴(첫 줄) 가격은 10,000원 이하여야 합니다.')
  }

  const extras = parsed.slice(1, 4).map((r) => ({ name: r.name, price_krw: r.price_krw }))
  const more = parsed.slice(4, MAX_MENU_LINES).map((r) => ({ name: r.name, price_krw: r.price_krw }))

  return { main, extras, more, errors }
}

export function menuItemsToMenuLinesText(items: MenuItem[]): string {
  const main = items.find((i) => i.is_main_menu)
  const cards = items
    .filter((i) => !i.is_main_menu && i.card_slot != null && i.card_slot >= 2)
    .sort((a, b) => (a.card_slot ?? 0) - (b.card_slot ?? 0))
  const sides = items.filter((i) => !i.is_main_menu && (i.card_slot == null || i.card_slot < 2))
  const lines: string[] = []
  if (main) {
    lines.push(`${main.name} : ${main.price_krw}`)
  }
  cards.forEach((c) => lines.push(`${c.name} : ${c.price_krw}`))
  sides.forEach((s) => lines.push(`${s.name} : ${s.price_krw}`))
  return lines.slice(0, MAX_MENU_LINES).join('\n')
}

/** OCR/붙여넣기 결과에서 앞쪽 최대 10줄만 취해 텍스트로 */
export function takeFirstMenuLinesFromRawText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_MENU_LINES)
  return lines.join('\n')
}

/** 비어 있지 않은 줄이 최대 MAX_MENU_LINES개가 되도록 잘라냄 */
export function clampMenuTextLineCount(text: string): string {
  const lines = text.split(/\r?\n/)
  let nonEmpty = 0
  const out: string[] = []
  for (const line of lines) {
    if (line.trim()) {
      if (nonEmpty >= MAX_MENU_LINES) break
      nonEmpty += 1
    }
    out.push(line)
  }
  return out.join('\n')
}
