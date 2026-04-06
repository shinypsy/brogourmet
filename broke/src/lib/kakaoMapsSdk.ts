/**
 * Kakao 지도 JavaScript API — 공식 「시작하기」 가이드와 같은 방식
 * @see https://apis.map.kakao.com/web/guide/#loadapi
 *
 * 동적 <script>는 기본 async 로드라 sdk.js 내부 document.write 가 막히므로 async=false 유지.
 * appkey 는 카카오 콘솔의 JavaScript 키(REST API 키 아님).
 *
 * 1) https://dapi.kakao.com/v2/maps/sdk.js?appkey=…
 * 2) 개발: 실패 시 Vite 프록시 /kakao-maps-sdk.js
 */

/// <reference types="vite/client" />

const SCRIPT_ID = 'kakao-maps-sdk'

const LOG = '[Brogourmet Map]'

function dbg(...args: unknown[]) {
  console.log(LOG, ...args)
}

function dbgWarn(...args: unknown[]) {
  console.warn(LOG, ...args)
}

function dbgErr(...args: unknown[]) {
  console.error(LOG, ...args)
}

function keyHint(appKey: string): string {
  const k = appKey.trim()
  if (k.length <= 4) return '(짧음)'
  return `${k.slice(0, 4)}…(길이 ${k.length})`
}

let scriptInjectPromise: Promise<void> | null = null

type KakaoMapsNamespace = {
  Map?: new (...args: unknown[]) => unknown
  load?: (callback: () => void) => void
}

function getMaps(): KakaoMapsNamespace | undefined {
  const w = window as unknown as { kakao?: { maps: KakaoMapsNamespace } }
  return w.kakao?.maps
}

function isMapConstructorReady(): boolean {
  return typeof getMaps()?.Map === 'function'
}

function clearKakaoGlobal(): void {
  const w = window as unknown as { kakao?: unknown }
  try {
    delete w.kakao
  } catch {
    w.kakao = undefined
  }
}

function removeScriptTag(): void {
  document.getElementById(SCRIPT_ID)?.remove()
}

/** autoload=false 일 때 지도 모듈을 명시적으로 로드 */
function runKakaoMapsLoad(): Promise<void> {
  const maps = getMaps()
  if (!maps || typeof maps.load !== 'function') {
    return Promise.resolve()
  }
  if (typeof maps.Map === 'function') {
    return Promise.resolve()
  }
  dbg('runKakaoMapsLoad: kakao.maps.load() 호출')
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error('kakao.maps.load() 20초 내 완료되지 않았습니다.'))
    }, 20_000)
    try {
      maps.load!(() => {
        window.clearTimeout(t)
        dbg('runKakaoMapsLoad: load 콜백')
        resolve()
      })
    } catch (e) {
      window.clearTimeout(t)
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

/** 스크립트 실행 후 Map 생성자가 붙을 때까지 대기 */
function waitForMapConstructor(maxFrames = 480): Promise<void> {
  dbg('waitForMapConstructor: 시작 (최대 프레임', maxFrames, ')')
  return new Promise((resolve, reject) => {
    let frame = 0
    let lastLogFrame = -60
    const tick = () => {
      if (isMapConstructorReady()) {
        dbg('waitForMapConstructor: Map 생성자 확인됨, 프레임', frame)
        resolve()
        return
      }
      frame += 1
      if (frame >= maxFrames) {
        dbgErr('waitForMapConstructor: 타임아웃', maxFrames, '프레임 — kakao.maps.Map 없음')
        reject(
          new Error(
            'kakao.maps.Map을 쓸 수 없습니다. 콘솔 플랫폼 Web「사이트 도메인」·JavaScript 키의「JavaScript SDK 도메인」에 ' +
              window.location.origin +
              ' 를 넣었는지, appkey가 JavaScript 키인지 확인하세요.',
          ),
        )
        return
      }
      if (frame - lastLogFrame >= 60) {
        dbg('waitForMapConstructor: 대기 중… 프레임', frame, '/', maxFrames)
        lastLogFrame = frame
      }
      window.requestAnimationFrame(tick)
    }
    tick()
  })
}

export function buildKakaoMapsSdkScriptUrl(appKey: string): string {
  const k = appKey.trim()
  const q = new URLSearchParams({ appkey: k, autoload: 'false' })
  return `https://dapi.kakao.com/v2/maps/sdk.js?${q}`
}

function buildProxiedSdkUrl(appKey: string): string {
  const q = new URLSearchParams({ appkey: appKey.trim(), autoload: 'false' })
  return `${window.location.origin}/kakao-maps-sdk.js?${q}`
}

/** id 고정 태그 하나만 쓰고, 실패 시 제거 후 재시도 가능하게 함 */
function loadScriptFromUrl(url: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    removeScriptTag()
    dbg('inject: script 추가', label, url.replace(/appkey=[^&]+/i, 'appkey=(마스킹)'))

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.async = false
    script.src = url

    script.onload = () => {
      dbg('inject: onload', label)
      void runKakaoMapsLoad()
        .then(() => waitForMapConstructor())
        .then(() => {
          dbg('inject: 완료', label)
          resolve()
        })
        .catch((e) => {
          dbgErr('inject: onload 후 Map 대기 실패', label, e)
          removeScriptTag()
          clearKakaoGlobal()
          reject(e instanceof Error ? e : new Error(String(e)))
        })
    }

    script.onerror = () => {
      dbgErr('inject: onerror', label, '— Network에서 상태 코드 확인. 카카오 콘솔 Web 도메인에', window.location.origin)
      removeScriptTag()
      clearKakaoGlobal()
      reject(new Error(`카카오맵 SDK 로드 실패 (${label})`))
    }

    document.head.appendChild(script)
  })
}

function reconcileExistingScript(expectedUrl: string): void {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (!existing?.src) {
    dbg('reconcile: 기존 #kakao-maps-sdk 없음')
    return
  }
  try {
    const cur = new URL(existing.src, window.location.href)
    const exp = new URL(expectedUrl)
    const curKey = cur.searchParams.get('appkey')
    const expKey = exp.searchParams.get('appkey')
    const curAutoloadFalse = cur.searchParams.get('autoload') === 'false'
    const expAutoloadFalse = exp.searchParams.get('autoload') === 'false'
    const isProxy = cur.pathname.includes('kakao-maps-sdk')
    const isDirect = cur.hostname.includes('dapi.kakao.com')
    dbg('reconcile: 기존 스크립트', existing.src, { isProxy, isDirect })

    if (curKey !== expKey || curAutoloadFalse !== expAutoloadFalse) {
      dbgWarn(
        'reconcile: 제거 후 재주입',
        curKey !== expKey ? 'appkey 불일치' : 'autoload 파라미터 불일치',
      )
      existing.remove()
      clearKakaoGlobal()
      scriptInjectPromise = null
    }
  } catch (e) {
    dbgErr('reconcile: 파싱 실패 → 제거', e)
    existing.remove()
    clearKakaoGlobal()
    scriptInjectPromise = null
  }
}

async function injectSdkScript(appKey: string): Promise<void> {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

  if (existing?.src) {
    if (isMapConstructorReady()) {
      dbg('inject: 이미 Map 준비됨')
      return
    }

    dbg('inject: 기존 태그 대기(로드·에러·폴링)', existing.src)
    return new Promise((resolve, reject) => {
      let settled = false
      const ok = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const no = (e: Error) => {
        if (settled) return
        settled = true
        removeScriptTag()
        clearKakaoGlobal()
        scriptInjectPromise = null
        reject(e)
      }

      const onErr = () => {
        dbgErr('inject: 기존 태그 error 이벤트 → 제거')
        no(new Error('카카오맵 SDK 스크립트 로드 실패'))
      }

      const prepare = () => {
        void runKakaoMapsLoad()
          .then(() => waitForMapConstructor())
          .then(ok)
          .catch(no)
      }

      existing.addEventListener('load', prepare, { once: true })
      existing.addEventListener('error', onErr, { once: true })
      if ((existing as HTMLScriptElement & { complete?: boolean }).complete) {
        prepare()
      }

      const deadline = Date.now() + 40_000
      const poll = () => {
        if (settled) return
        if (isMapConstructorReady()) {
          ok()
          return
        }
        if (Date.now() > deadline) {
          dbgErr('inject: 기존 태그 폴링 타임아웃 → 제거 후 상위에서 재시도')
          existing.removeEventListener('error', onErr)
          no(new Error('카카오맵 SDK 준비 시간이 초과되었습니다.'))
          return
        }
        window.requestAnimationFrame(poll)
      }
      poll()
    })
  }

  const direct = buildKakaoMapsSdkScriptUrl(appKey)
  const proxied =
    import.meta.env.DEV && typeof window !== 'undefined' ? buildProxiedSdkUrl(appKey) : null

  try {
    await loadScriptFromUrl(direct, 'dapi 직접')
    return
  } catch (e1) {
    dbgWarn('inject: dapi 직접 실패', e1)
  }

  if (proxied) {
    try {
      await loadScriptFromUrl(proxied, 'Vite 프록시(/kakao-maps-sdk.js)')
      return
    } catch (e2) {
      dbgErr('inject: 프록시도 실패', e2)
    }
  }

  dbgErr('inject: dapi·프록시 모두 실패(401이면 카카오 콘솔 키·도메인)')

  const o = window.location.origin

  throw new Error(
    '카카오맵 SDK를 불러오지 못했습니다. 카카오 콘솔에 주소창과 동일한 origin을 넣으세요: 《' +
      o +
      '》 (localhost·127·LAN IP는 각각 다른 origin). 다른 URL로도 접속하면 그 origin도 등록하세요. JavaScript 키만 appkey에 사용(REST 키 불가).',
  )
}

export function ensureKakaoMapsReady(appKey: string): Promise<void> {
  const key = appKey.trim()
  dbg('ensureKakaoMapsReady: 호출, 키', keyHint(key), 'origin=', typeof window !== 'undefined' ? window.location.origin : 'N/A')
  if (!key) {
    dbgErr('ensureKakaoMapsReady: 키 비어 있음')
    return Promise.reject(new Error('Kakao Maps 앱 키가 비어 있습니다.'))
  }
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  const expectedUrl = buildKakaoMapsSdkScriptUrl(key)
  reconcileExistingScript(expectedUrl)

  if (isMapConstructorReady()) {
    dbg('ensureKakaoMapsReady: 즉시 완료')
    return Promise.resolve()
  }

  if (!scriptInjectPromise) {
    dbg('ensureKakaoMapsReady: injectSdkScript 시작')
    scriptInjectPromise = injectSdkScript(key).catch((err) => {
      dbgErr('ensureKakaoMapsReady: inject 실패', err)
      scriptInjectPromise = null
      throw err
    })
  } else {
    dbg('ensureKakaoMapsReady: Promise 재사용')
  }

  return scriptInjectPromise
}
