import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchSiteNotices, type SiteNoticeItem } from '../api/siteNotices'
import { MapPageBody } from '../components/MapPageBody'
import { HomeAccountDock } from '../components/HomeAccountDock'
import { SaloonWelcome } from '../components/SaloonWelcome'
import { BROG_ONLY } from '../config/features'
import { isBrogPhase1Restricted } from '../lib/brogPhase1'

/** 메인 이미지 그리드 4×2(8칸) — API `limit`과 동일 */
const MAIN_BROG_IMAGE_GRID_LIMIT = 8

/** 홈 상단 공지 — 문구만 바꿔 운영 안내에 활용 */
const HOME_NOTICE_TITLE = '공지사항'
const HOME_NOTICE_BODY_FULL =
  'Broke Gourmet(고단한 미식가)는 서울 기준 대표 주 메뉴 1만 원 이하 맛집을 소개합니다. 아래는 BroG 지도와 동일한 조작(가격·구·좌표·장소 검색·지도)입니다. 홈 BroG 목록은 4×2 그리드로 최대 8곳만 미리 보여 주며, 더 많은 맛집은 BroG 지도·리스트에서 볼 수 있습니다.'
const HOME_NOTICE_BODY_PHASE1 =
  '현재 빌드는 1단계 배포 범위입니다. 지역 선택은 서울특별시 25개 자치구로 제공됩니다. 홈 BroG는 4×2 그리드로 최대 8곳 미리보기이며, 지도·리스트에서 더 볼 수 있습니다. 전국 등 추가 확장 시 빌드 옵션(VITE_BROG_FULL_MAP)과 공지로 안내합니다.'

export function HomePage() {
  const [siteNotices, setSiteNotices] = useState<SiteNoticeItem[]>([])

  useEffect(() => {
    let cancelled = false
    function loadNotices() {
      void fetchSiteNotices()
        .then((rows) => {
          if (!cancelled) setSiteNotices(rows)
        })
        .catch(() => {
          if (!cancelled) setSiteNotices([])
        })
    }
    loadNotices()
    function onVisibility() {
      if (document.visibilityState === 'visible') loadNotices()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const homeNoticeBody = isBrogPhase1Restricted() ? HOME_NOTICE_BODY_PHASE1 : HOME_NOTICE_BODY_FULL
  const homeNoticeTitle = isBrogPhase1Restricted() ? '공지 · 1단계 테스트 버전' : HOME_NOTICE_TITLE
  const visibleSiteNotices = siteNotices.filter((n) => n.title.trim() || n.body.trim())
  const hasAdminHomeNotices = visibleSiteNotices.length > 0

  return (
    <>
      <SaloonWelcome />
      <div className="home-layout home-layout--hub home-layout--map-home">
        <h1 className="visually-hidden">Broke Gourmet 홈</h1>

        <section className="service-overview home-notice" aria-labelledby="home-notice-heading">
          <div className="home-notice__head">
            <h2 id="home-notice-heading">
              {hasAdminHomeNotices ? '공지사항' : homeNoticeTitle}
            </h2>
            {!BROG_ONLY ? (
              <Link
                className="home-notice__qna"
                to="/qna"
                title="Q&A (FAQ · 질문)"
                aria-label="Q&A (FAQ · 질문)"
                onMouseEnter={() => void import('./QnaHubPage')}
                onFocus={() => void import('./QnaHubPage')}
              >
                <span className="visually-hidden">Q&A</span>
                <svg
                  className="home-notice__qna-icon"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                  />
                  <path
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    d="M9.5 9a2.5 2.5 0 0 1 4.2-1.8A2.4 2.4 0 0 1 14 11c0 1.2-.8 1.8-1.3 2.1-.3.2-.7.4-.7 1.1V15"
                  />
                  <circle cx="12" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </Link>
            ) : null}
          </div>
          {hasAdminHomeNotices ? (
            <>
              {visibleSiteNotices.map((n) => (
                <div key={n.slot} className="home-notice__slot">
                  {n.title.trim() ? (
                    <h3 className="home-notice__slot-title">{n.title.trim()}</h3>
                  ) : null}
                  {n.body.trim() ? (
                    <p className="description home-notice__slot-body">{n.body}</p>
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <p className="description">{homeNoticeBody}</p>
          )}
        </section>

        <MapPageBody
          syncDistrictToSearchParams={false}
          listPresentation="imageGrid"
          listFetchLimit={MAIN_BROG_IMAGE_GRID_LIMIT}
        />
      </div>
      <HomeAccountDock />
    </>
  )
}
