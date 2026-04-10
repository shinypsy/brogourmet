import { useCallback, useEffect, useRef, useState } from 'react'

import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import {
  DEFAULT_HOME_DISTRICT,
  resolveSeoulDistrictFromCoords,
  type ResolveDistrictResult,
} from '../lib/resolveSeoulDistrictFromCoords'
import { mapGeoHintMessage } from '../lib/mapGeoHint'

export type SeoulMapUserLocationOptions = {
  /**
   * false면 기기 GPS(자동·「위치 다시 받기」·「내 위치」 버튼)는 좌표·힌트만 반영하고 구(setDistrict)는 바꾸지 않음.
   * 지역(구)은 지도에서 **내 위치 변경**(롱프레스·우클릭 등 `applyLatLng`)이나 수동 좌표 적용 시에만 바뀜.
   * BroG/MyG 리스트 `?district=` 유지용.
   */
  initialGeolocationSetsDistrict?: boolean
  /**
   * false면 페이지 진입 시 자동 `getCurrentPosition`을 호출하지 않음.
   * true(기본): **마운트 시 1회만** 자동 GPS. 이후 갱신은 「위치 다시 받기」「내 위치」(`myLocationFromDevice`)만.
   */
  enableInitialGeolocation?: boolean
  /** 지도·좌표 적용 후 역지오 결과 — BroG 지도 `near_ignore_district` 등 */
  onApplyLatLngResolved?: (r: ResolveDistrictResult) => void
  /** BroG 지도: GPS만 반영·구는 URL 유지 직후 — 반경 API에서 구 필터 완화 */
  onDeviceCoordsWithoutDistrictSync?: () => void
}

/**
 * GPS·수동 좌표 → 구 역지오코딩·지도 마커용 state.
 * `setDistrict`는 호출 측에서 URL 동기화 등과 함께 구현.
 */
export function useSeoulMapUserLocation(
  setDistrict: (gu: string) => void,
  options: SeoulMapUserLocationOptions = {},
) {
  const { initialGeolocationSetsDistrict = true, enableInitialGeolocation = true } = options
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [geoHint, setGeoHint] = useState(() =>
    enableInitialGeolocation ? '위치 확인 중…' : '「내 위치」 또는 「위치 다시 받기」로 기기 GPS를 받을 수 있습니다.',
  )
  const [geoBusy, setGeoBusy] = useState(false)
  const [mapUserCoords, setMapUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [coordApplyError, setCoordApplyError] = useState('')

  /**
   * 자동 GPS(locate effect)와 사용자 지정(지도 롱프레스·좌표 적용)이 겹칠 때,
   * 늦게 도착한 GPS가 사용자가 고른 좌표를 덮지 않도록 세대를 맞춤.
   * effect 시작·「내 위치」 시작 시 ++, applyLatLng 진입 시 ++.
   */
  const geoLocateGenerationRef = useRef(0)

  const applyLatLng = useCallback(
    async (lat: number, lng: number) => {
      geoLocateGenerationRef.current += 1
      // 역지오코딩(await) 전에 좌표를 먼저 반영 — 지도 우클릭·롱프레스 직후 목록·near API가 바로 갱신되게 함
      setMapUserCoords({ lat, lng })
      setLatInput(lat.toFixed(5))
      setLngInput(lng.toFixed(5))
      setCoordApplyError('')
      const resolved = await resolveSeoulDistrictFromCoords(lat, lng)
      const { district: gu, reason } = resolved
      setGeoHint(mapGeoHintMessage(reason, gu))
      // no_key·네트워크 실패 등에서 API가 마포 기본값을 주어도 드롭다운 구를 덮어쓰지 않음(용산 선택 유지)
      if (reason === 'ok') {
        setDistrict(gu)
      }
      optionsRef.current.onApplyLatLngResolved?.(resolved)
    },
    [setDistrict],
  )

  const applyUserCoords = useCallback(
    async (coords: GeolocationCoordinates) => {
      await applyLatLng(coords.latitude, coords.longitude)
    },
    [applyLatLng],
  )

  /** GPS 수신만 — 마커·힌트·입력란 갱신, setDistrict 없음 */
  const applyDeviceCoordsWithoutDistrict = useCallback(async (coords: GeolocationCoordinates) => {
    const lat = coords.latitude
    const lng = coords.longitude
    setMapUserCoords({ lat, lng })
    setLatInput(lat.toFixed(5))
    setLngInput(lng.toFixed(5))
    const res = await resolveSeoulDistrictFromCoords(lat, lng)
    setGeoHint(mapGeoHintMessage(res.reason, res.district))
    optionsRef.current.onDeviceCoordsWithoutDistrictSync?.()
  }, [])

  /** `setDistrict`가 URL을 바꾸면 applyUserCoords 참조가 바뀌어 locate effect가 재실행되는 것을 막음 (우클릭 좌표가 GPS로 덮임) */
  const applyUserCoordsRef = useRef(applyUserCoords)
  applyUserCoordsRef.current = applyUserCoords
  const applyDeviceCoordsWithoutDistrictRef = useRef(applyDeviceCoordsWithoutDistrict)
  applyDeviceCoordsWithoutDistrictRef.current = applyDeviceCoordsWithoutDistrict

  const handleApplyManualCoords = useCallback(async () => {
    const lat = parseFloat(latInput.trim().replace(',', '.'))
    const lng = parseFloat(lngInput.trim().replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCoordApplyError('위도와 경도는 숫자로 입력해 주세요.')
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordApplyError('위도는 -90~90, 경도는 -180~180 범위여야 합니다.')
      return
    }
    setCoordApplyError('')
    await applyLatLng(lat, lng)
  }, [applyLatLng, latInput, lngInput])

  useEffect(() => {
    if (!enableInitialGeolocation) {
      return
    }

    let cancelled = false
    geoLocateGenerationRef.current += 1
    const gen = geoLocateGenerationRef.current

    async function locate() {
      if (!navigator.geolocation) {
        if (!cancelled) {
          setGeoHint(mapGeoHintMessage('position_error', DEFAULT_HOME_DISTRICT))
          setMapUserCoords(null)
        }
        return
      }

      setGeoBusy(true)
      try {
        const coords = await requestGeolocation()
        if (cancelled) return
        if (gen !== geoLocateGenerationRef.current) return
        if (initialGeolocationSetsDistrict) {
          await applyUserCoordsRef.current(coords)
        } else {
          await applyDeviceCoordsWithoutDistrictRef.current(coords)
        }
      } catch (e) {
        if (cancelled) return
        if (gen !== geoLocateGenerationRef.current) return
        setMapUserCoords(null)
        if (e && typeof e === 'object' && 'code' in e && (e as GeolocationPositionError).code === 1) {
          setGeoHint(mapGeoHintMessage('denied', DEFAULT_HOME_DISTRICT))
        } else {
          setGeoHint(
            `${mapGeoHintMessage('position_error', DEFAULT_HOME_DISTRICT)} ${geolocationFailureMessage(e)}`,
          )
        }
      } finally {
        if (!cancelled) setGeoBusy(false)
      }
    }

    void locate()
    return () => {
      cancelled = true
    }
  }, [initialGeolocationSetsDistrict, enableInitialGeolocation])

  const myLocationFromDevice = useCallback(async () => {
    if (!navigator.geolocation) return
    geoLocateGenerationRef.current += 1
    const gen = geoLocateGenerationRef.current
    setGeoBusy(true)
    setGeoHint('위치 확인 중…')
    try {
      const coords = await requestGeolocation()
      if (gen !== geoLocateGenerationRef.current) return
      if (initialGeolocationSetsDistrict) {
        await applyUserCoords(coords)
      } else {
        await applyDeviceCoordsWithoutDistrict(coords)
      }
    } catch (e) {
      if (gen !== geoLocateGenerationRef.current) return
      setMapUserCoords(null)
      if (e && typeof e === 'object' && 'code' in e && (e as GeolocationPositionError).code === 1) {
        setGeoHint(mapGeoHintMessage('denied', DEFAULT_HOME_DISTRICT))
      } else {
        setGeoHint(
          `${mapGeoHintMessage('position_error', DEFAULT_HOME_DISTRICT)} ${geolocationFailureMessage(e)}`,
        )
      }
    } finally {
      setGeoBusy(false)
    }
  }, [applyUserCoords, applyDeviceCoordsWithoutDistrict, initialGeolocationSetsDistrict])

  return {
    geoHint,
    geoBusy,
    mapUserCoords,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    coordApplyError,
    handleApplyManualCoords,
    myLocationFromDevice,
    /** 지도 롱프레스·우클릭 등에서 좌표만 알 때 — 구 역지오코딩·마커·입력란까지 동기화 */
    applyLatLng,
  }
}
