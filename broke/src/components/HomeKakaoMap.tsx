import { useMemo } from 'react'

import type { RestaurantListItem } from '../api/restaurants'

import { BrogKakaoMap } from './BrogKakaoMap'

type Props = {
  userCoords: { lat: number; lng: number } | null
  restaurants: RestaurantListItem[]
  locating: boolean
  onMyLocationClick: () => void
  onPickUserLocationOnMap?: (lat: number, lng: number) => void
}

export function HomeKakaoMap({
  userCoords,
  restaurants,
  locating,
  onMyLocationClick,
  onPickUserLocationOnMap,
}: Props) {
  const pins = useMemo(
    () =>
      restaurants
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r, idx) => ({
          id: r.id,
          title: r.name,
          latitude: r.latitude as number,
          longitude: r.longitude as number,
          rank: idx + 1,
          markerKind: r.is_franchise ? ('franchise' as const) : ('brog' as const),
        })),
    [restaurants],
  )

  return (
    <BrogKakaoMap
      userCoords={userCoords}
      pins={pins}
      locating={locating}
      onMyLocationClick={onMyLocationClick}
      onPickUserLocationOnMap={onPickUserLocationOnMap}
      getDetailPath={(id) => `/restaurants/${id}`}
      mapAriaLabel="주변 BroG 지도"
    />
  )
}
