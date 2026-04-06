import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteFreeSharePost,
  fetchFreeSharePosts,
  type FreeSharePost,
  updateFreeSharePost,
} from '../api/community'
import { API_BASE_URL } from '../api/config'

export function FreeShareBoardPage() {
  const [posts, setPosts] = useState<FreeSharePost[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  function reload() {
    setIsLoading(true)
    setError('')
    fetchFreeSharePosts()
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
      await deleteFreeSharePost(token, postId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  async function handleEdit(post: FreeSharePost) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    const title = window.prompt('제목', post.title)
    if (!title) return
    const body = window.prompt('내용', post.body)
    if (!body) return
    const district = window.prompt('구', post.district ?? '마포구')
    try {
      await updateFreeSharePost(token, post.id, {
        title,
        body,
        district: district || null,
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
        <h1>무료나눔 게시판</h1>
        <p className="description">
          남는 식재료·나눔 물품 등을 올리는 공간입니다. 글 작성은 JWT 로그인 후 가능합니다.
        </p>
        <p className="helper">
          <Link to="/">홈으로</Link>
          {' · '}
          <Link to="/free-share/write">글쓰기</Link>
        </p>
      </section>

      <section className="card">
        <h2>게시글</h2>
        {isLoading ? <p>불러오는 중...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-list-item">
              <div className="post-list-meta">
                <strong>{post.title}</strong>
                <span>
                  {post.author_nickname}
                  {post.district ? ` · ${post.district}` : ''} ·{' '}
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
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
        {!isLoading && posts.length === 0 && !error ? <p>아직 글이 없습니다.</p> : null}
      </section>
    </div>
  )
}
