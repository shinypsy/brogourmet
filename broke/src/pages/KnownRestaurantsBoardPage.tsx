import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPosts,
  type KnownRestaurantPost,
  updateKnownRestaurantPost,
} from '../api/community'
import { API_BASE_URL } from '../api/config'

export function KnownRestaurantsBoardPage() {
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

  async function handleEdit(post: KnownRestaurantPost) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    const title = window.prompt('제목', post.title)
    if (!title) return
    const body = window.prompt('내용', post.body)
    if (!body) return
    const restaurantName = window.prompt('식당 이름', post.restaurant_name)
    if (!restaurantName) return
    const district = window.prompt('구', post.district)
    if (!district) return
    const mainMenuName = window.prompt('대표 메뉴명', post.main_menu_name)
    if (!mainMenuName) return
    const price = window.prompt('대표 메뉴 가격', String(post.main_menu_price))
    if (!price) return
    try {
      await updateKnownRestaurantPost(token, post.id, {
        title,
        body,
        restaurant_name: restaurantName,
        district,
        main_menu_name: mainMenuName,
        main_menu_price: Number(price),
        image_url: post.image_url,
      })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.')
    }
  }

  return (
    <div className="board-layout">
      <section className="card">
        <p className="eyebrow">Community</p>
        <h1>내가 아는 맛집</h1>
        <p className="description">
          아는 맛집을 제보하는 게시판입니다. 제안하는 <strong>대표 메뉴 가격은 10,000원 이하</strong>만 입력할 수
          있습니다 (등재 정책과 동일).
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
                <strong>{post.title}</strong>
                <span>
                  {post.author_nickname} · {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
              <p className="post-body">
                {post.restaurant_name} ({post.district}) · 대표 {post.main_menu_name}{' '}
                {post.main_menu_price.toLocaleString()}원
              </p>
              <p className="post-body">{post.body}</p>
              {post.image_url ? (
                <img className="post-image" src={`${API_BASE_URL}${post.image_url}`} alt={`${post.title} 첨부 이미지`} />
              ) : null}
              {user?.role === 'admin' ? (
                <p className="helper">
                  <button type="button" className="compact-link" onClick={() => handleEdit(post)}>
                    수정
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
