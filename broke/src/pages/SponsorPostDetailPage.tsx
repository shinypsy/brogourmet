import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteSponsorPost, fetchSponsorPost, type SponsorPost } from '../api/sponsors'
import { hexToRgba } from '../lib/hexRgba'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { isSuperAdmin } from '../lib/roles'

export function SponsorPostDetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const [user, setUser] = useState<User | null>(null)
  const [post, setPost] = useState<SponsorPost | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const numericId = useMemo(() => {
    const n = idParam ? Number.parseInt(idParam, 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : NaN
  }, [idParam])

  useEffect(() => {
    if (!token?.trim()) {
      setUser(null)
      return
    }
    let cancelled = false
    void fetchMe(token)
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!Number.isFinite(numericId)) {
      setLoading(false)
      setPost(null)
      setLoadError('잘못된 글 ID입니다.')
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void fetchSponsorPost(numericId)
      .then((p) => {
        if (!cancelled) setPost(p)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPost(null)
          setLoadError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [numericId])

  const isAdmin = isSuperAdmin(user?.role)

  if (loading) {
    return (
      <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
        <div className="brog-screen brog-screen--list">
          <p className="helper">불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (!post || loadError) {
    return (
      <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
        <div className="brog-screen brog-screen--list">
          <p className="error">{loadError || '글을 찾을 수 없습니다.'}</p>
          <Link to="/sponsor">목록으로</Link>
        </div>
      </div>
    )
  }

  const band = {
    borderLeft: `4px solid ${post.accent}`,
    background: `linear-gradient(120deg, ${hexToRgba(post.accent, 0.28)} 0%, rgba(12, 16, 28, 0.96) 55%)`,
  }

  const hasCoords = post.latitude != null && post.longitude != null
  const images = post.image_urls

  async function confirmDelete() {
    if (!isAdmin || !token?.trim() || !post) return
    const pid = post.id
    const ptitle = post.title
    if (!window.confirm(`「${ptitle}」스폰서 글을 삭제할까요?`)) return
    try {
      await deleteSponsorPost(token, pid)
      navigate('/sponsor', { replace: true })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
      <article className="brog-screen brog-screen--list sponsor-detail">
        <header className="sponsor-detail__head" style={band}>
          <p className="eyebrow">
            <Link to="/sponsor">SPON</Link>
            <span aria-hidden> · </span>
            <span className="sponsor-hub__badge sponsor-hub__badge--inline">스폰서 콘텐츠</span>
          </p>
          <h1 className="brog-screen__title">{post.title}</h1>
          <p className="sponsor-detail__excerpt">{post.excerpt}</p>
          {hasCoords ? (
            <p className="helper sponsor-detail__coords-meta">
              거리 정렬용 좌표: {post.latitude?.toFixed(5)}, {post.longitude?.toFixed(5)}
            </p>
          ) : null}
          <div className="sponsor-detail__toolbar">
            <Link className="ghost-button" to="/sponsor">
              목록
            </Link>
            {post.external_url ? (
              <a
                className="brog-screen__cta"
                href={post.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                외부 링크 열기
              </a>
            ) : null}
            {isAdmin ? (
              <>
                <Link className="ghost-button" to={`/sponsor/write?edit=${post.id}`}>
                  수정
                </Link>
                <button type="button" className="brog-rank-card__delete-btn" onClick={() => void confirmDelete()}>
                  삭제
                </button>
              </>
            ) : null}
          </div>
        </header>

        {images.length > 0 ? (
          <div className="sponsor-detail__gallery-wrap">
            <div className="sponsor-detail__gallery sponsor-detail__gallery--strip">
              {images.map((u, i) => {
                const r = resolveMediaUrl(u)
                return (
                  <a key={`${i}-${u}`} className="sponsor-detail__gallery-item" href={r} target="_blank" rel="noreferrer">
                    <img src={r} alt="" referrerPolicy={imgReferrerPolicyForResolvedSrc(r)} />
                  </a>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="sponsor-detail__magazine sponsor-detail__magazine--stack">
          <div className="sponsor-detail__body map-card">
            <h2 className="visually-hidden">본문</h2>
            <div className="sponsor-detail__prose">
              {post.body.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
