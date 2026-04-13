import { MapPageBody } from '../components/MapPageBody'

/** 홈 `HomePage`와 동일 `home-layout--map-home` 조상 → 위치 지도 카드·`kakao-map-embed` 높이 등 동일 CSS 적용 */
export function MapPage() {
  return (
    <div className="home-layout home-layout--hub home-layout--map-home">
      <MapPageBody
        syncDistrictToSearchParams
        listPresentation="textLines"
        mapSpeechBubbles
        showMapInteractionHints={false}
      />
    </div>
  )
}
