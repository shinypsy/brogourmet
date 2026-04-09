import { useCallback, useEffect, useRef, useState } from 'react'

import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { DEFAULT_HOME_DISTRICT, resolveSeoulDistrictFromCoords } from '../lib/resolveSeoulDistrictFromCoords'
import { mapGeoHintMessage } from '../lib/mapGeoHint'

export type SeoulMapUserLocationOptions = {
  /**
   * false면 기기 GPS(자동·「위치 다시 받기」·「내 위치」 버튼)는 좌표·힌트만 반영하고 구(setDistrict)는 바꾸지 않음.
   * 지역(구)은 지도에서 **내 위치 변경**(롱프레스·우클릭 등 `applyLatLng`)이나 수동 좌표 적용 시에만 바뀜.
   * BroG/MyG 리스트 `?district=` 유지용.
   */
  initialGeolocationSetsDistrict?: boolean
}

/**
 * GPS·수동 좌표 → 구 역지오코딩·지도 마커용 state.
 * `setDistrict`는 호출 측에서 URL 동기화 등과 함께 구현.
 */
export function useSeoulMapUserLocation(
  setDistrict: (gu: string) => void,
  options: SeoulMapUserLocationOptions = {},
) {
  const { initialGeolocationSetsDistrict = true } = options
  const [geoHint, setGeoHint] = useState('위치 확인 중…')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoRetryToken, setGeoRetryToken] = useState(0)
  const [mapUserCoords, setMapUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [coordApplyError, setCoordApplyError] = useState('')

  const applyLatLng = useCallback(
    async (lat: number, lng: number) => {
      const { district: gu, reason } = await resolveSeoulDistrictFromCoords(lat, lng)
      setDistrict(gu)
      setGeoHint(mapGeoHintMessage(reason, gu))
      setMapUserCoords({ lat, lng })
      setLatInput(lat.toFixed(5))
      setLngInput(lng.toFixed(5))
      setCoordApplyError('')
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
    let cancelled = false

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
        if (initialGeolocationSetsDistrict) {
          await applyUserCoordsRef.current(coords)
        } else {
          await applyDeviceCoordsWithoutDistrictRef.current(coords)
        }
      } catch (e) {
        if (cancelled) return
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
  }, [geoRetryToken, initialGeolocationSetsDistrict])

  const myLocationFromDevice = useCallback(async () => {
    if (!navigator.geolocation) return
    setGeoBusy(true)
    setGeoHint('위치 확인 중…')
    try {
      const coords = await requestGeolocation()
      if (initialGeolocationSetsDistrict) {
        await applyUserCoords(coords)
      } else {
        await applyDeviceCoordsWithoutDistrict(coords)
      }
    } catch (e) {
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
    geoRetryToken,
    setGeoRetryToken,
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
