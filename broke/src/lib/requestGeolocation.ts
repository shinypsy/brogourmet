/**
 * Wi-Fi/실내에서 6초 타임아웃으로 자주 끊기므로, 캐시 → 신규 → 고정밀 순으로 여러 번 시도합니다.
 */
const GEO_ATTEMPTS: PositionOptions[] = [
  { enableHighAccuracy: false, maximumAge: 120_000, timeout: 15_000 },
  { enableHighAccuracy: false, maximumAge: 0, timeout: 30_000 },
  { enableHighAccuracy: true, maximumAge: 0, timeout: 35_000 },
]

export async function requestGeolocation(): Promise<GeolocationCoordinates> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('unsupported')
  }
  if (typeof window !== 'undefined') {
    if (!window.isSecureContext) {
      const h = window.location.hostname
      if (h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]') {
        throw new Error('INSECURE_CONTEXT')
      }
    }
  }

  let lastFail: GeolocationPositionError | null = null
  for (const options of GEO_ATTEMPTS) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options)
      })
      return pos.coords
    } catch (raw) {
      const err = raw as GeolocationPositionError
      lastFail = err
      if (err?.code === 1) {
        throw err
      }
    }
  }
  throw lastFail ?? new Error('POSITION_FAILED')
}

export function geolocationFailureMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as GeolocationPositionError).code
    if (code === 1) {
      return '위치 권한이 꺼져 있거나 거부되었습니다. 브라우저 주소창 왼쪽 자물쇠에서 위치를 허용한 뒤 다시 시도해 주세요.'
    }
  }
  if (error instanceof Error) {
    if (error.message === 'INSECURE_CONTEXT') {
      return '위치는 HTTPS 또는 localhost(개발)에서만 동작합니다. http로 접속 중이면 https로 바꿔 주세요.'
    }
    if (error.message === 'unsupported') {
      return '이 브라우저에서는 위치를 사용할 수 없습니다.'
    }
  }
  return '위치 신호를 받지 못했습니다. Wi-Fi를 켜거나 창가·실외에서 잠시 기다린 뒤 「위치 다시 받기」를 눌러 보세요. (타임아웃은 최대 약 1분까지 시도합니다.)'
}
