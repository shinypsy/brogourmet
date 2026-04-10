export {}

/** 카카오 지도 JS SDK — BrogKakaoMap·MapPage 등 공통 */
declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void
        event?: {
          addListener: (target: unknown, type: string, handler: () => void) => void
        }
        LatLng: new (lat: number, lng: number) => unknown
        LatLngBounds: new () => { extend: (latlng: unknown) => void }
        Map: new (container: HTMLElement, options: Record<string, unknown>) => {
          setCenter: (latlng: unknown) => void
          setBounds: (bounds: unknown) => void
          setLevel?: (level: number) => void
          getLevel?: () => number
          relayout?: () => void
          getCenter?: () => { getLat: () => number; getLng: () => number }
        }
        Marker: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void }
        MarkerImage: new (
          src: string,
          size: unknown,
          options?: { offset?: unknown },
        ) => unknown
        Size: new (width: number, height: number) => unknown
        Point: new (x: number, y: number) => unknown
      }
    }
  }
}
