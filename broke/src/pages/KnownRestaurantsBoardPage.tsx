import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteKnownRestaurantPost, fetchKnownRestaurantPosts, type KnownRestaurantPost } from '../api/community'
import { API_BASE_URL } from '../api/config'
import { canEditOrDeleteCommunityPost } from '../lib/roles'

export function KnownRestaurantsBoardPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  function reload() {
    setIsLoading(true)
    setError('')
    fetchKnownRestaurantPosts()
      .then(setPosts)
      .catch((loadError) => {
        setPosts([])
        setError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => {})
  }, [])

  async function handleDelete(postId: number) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    if (!window.confirm('이 글을 삭제할까요?')) return
    try {
      await deleteKnownRestaurantPost(token, postId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="board-layout">
      <section className="card">
        <p className="eyebrow">Community</p>
        <h1>MyG</h1>
        <p className="description">
          개인 일기에 가깝게 남기는 맛집 메모입니다. <strong>가격 제한은 없습니다</strong> — BroG(지도·카드 맛집)의
          1만 원 정책과는 따로 둡니다.           가입 회원은 글을 쓸 수 있고, 수정·삭제는 작성자 본인 또는 최종 관리자·해당 구 지역 담당자가 할 수
          있습니다. 제목을 누르면 상세에서 사진·메뉴까지 수정할 수 있습니다.
        </p>
        <p className="helper">
          <Link to="/">홈으로</Link>
          {' · '}
          <Link to="/known-restaurants/write">글쓰기</Link>
        </p>
      </section>

      <section className="card">
        <h2>제보 목록</h2>
        {isLoading ? <p>불러오는 중...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-list-item">
              <div className="post-list-meta">
                <strong>
                  <Link to={`/known-restaurants/${post.id}`} className="compact-link">
                    {post.title}
                  </Link>
                </strong>
                <span>
                  {post.author_nickname} · {new Date(post.created_at).toLocaleString()}
                  {post.category ? ` · ${post.category}` : null}
                </span>
              </div>
              <p className="post-body">
                {post.restaurant_name} ({post.district}) · {post.main_menu_name}{' '}
                {post.main_menu_price > 0
                  ? `${post.main_menu_price.toLocaleString()}원`
                  : '(가격 메모 없음)'}
              </p>
              {post.summary ? <p className="post-body">{post.summary}</p> : <p className="post-body">{post.body}</p>}
              {(post.image_urls && post.image_urls.length > 0
                ? post.image_urls
                : post.image_url
                  ? [post.image_url]
                  : []
              ).map((url, i) => (
                <img
                  key={`${post.id}-${i}-${url.slice(0, 24)}`}
                  className="post-image"
                  src={`${API_BASE_URL}${url}`}
                  alt={`${post.title} 첨부 ${i + 1}`}
                />
              ))}
              {canEditOrDeleteCommunityPost(user, post.author_id, post.district) ? (
                <p className="helper">
                  <button
                    type="button"
                    className="compact-link"
                    onClick={() => navigate(`/known-restaurants/${post.id}`)}
                  >
                    상세·수정
                  </button>
                  {' · '}
                  <button type="button" className="compact-link" onClick={() => handleDelete(post.id)}>
                    삭제
                  </button>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {!isLoading && posts.length === 0 && !error ? <p>아직 제보가 없습니다.</p> : null}
      </section>
    </div>
  )
}
