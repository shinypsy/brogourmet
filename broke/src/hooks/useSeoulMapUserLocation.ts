import { useCallback, useEffect, useState } from 'react'

import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { DEFAULT_HOME_DISTRICT, resolveSeoulDistrictFromCoords } from '../lib/resolveSeoulDistrictFromCoords'
import { mapGeoHintMessage } from '../lib/mapGeoHint'

/**
 * GPS·수동 좌표 → 구 역지오코딩·지도 마커용 state.
 * `setDistrict`는 호출 측에서 URL 동기화 등과 함께 구현.
 */
export function useSeoulMapUserLocation(setDistrict: (gu: string) => void) {
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
        await applyUserCoords(coords)
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
  }, [geoRetryToken, applyUserCoords])

  const myLocationFromDevice = useCallback(async () => {
    if (!navigator.geolocation) return
    setGeoBusy(true)
    setGeoHint('위치 확인 중…')
    try {
      const coords = await requestGeolocation()
      await applyUserCoords(coords)
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
  }, [applyUserCoords])

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
