import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  createRestaurant,
  fetchRestaurant,
  updateRestaurant,
  type RestaurantWritePayload,
} from '../api/restaurants'

const EMPTY_FORM: RestaurantWritePayload = {
  name: '',
  city: '서울특별시',
  district: '마포구',
  category: '',
  summary: '',
  image_url: '',
  latitude: null,
  longitude: null,
  main_menu_name: '',
  main_menu_price: 10000,
}

export function RestaurantManagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const [user, setUser] = useState<User | null>(null)
  const [form, setForm] = useState<RestaurantWritePayload>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('로그인이 필요합니다.')
      setIsLoading(false)
      return
    }

    let cancelled = false
    fetchMe(token)
      .then((me) => {
        if (!cancelled) {
          setUser(me)
          if (me.role !== 'admin') {
            setError('관리자만 접근할 수 있습니다.')
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '권한 확인에 실패했습니다.')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const numericId = Number(id)
    if (!id || !Number.isFinite(numericId)) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    fetchRestaurant(numericId)
      .then((restaurant) => {
        if (cancelled) return
        const main = restaurant.menu_items.find((item) => item.is_main_menu)
        setForm({
          name: restaurant.name,
          city: restaurant.city,
          district: restaurant.district,
          category: restaurant.category,
          summary: restaurant.summary,
          image_url: restaurant.image_url,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          main_menu_name: main?.name ?? '',
          main_menu_price: main?.price_krw ?? 10000,
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'BroG 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || user?.role !== 'admin') {
      setError('관리자만 저장할 수 있습니다.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        image_url: form.image_url?.trim() || null,
        latitude: form.latitude == null || Number.isNaN(Number(form.latitude)) ? null : Number(form.latitude),
        longitude:
          form.longitude == null || Number.isNaN(Number(form.longitude)) ? null : Number(form.longitude),
        main_menu_price: Number(form.main_menu_price),
      }
      const saved = id ? await updateRestaurant(token, Number(id), payload) : await createRestaurant(token, payload)
      navigate(`/restaurants/${saved.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>{id ? 'BroG 수정' : 'BroG 작성'}</h1>
      <p className="helper">
        <Link to="/me">Myinfo</Link>
        {' · '}
        <Link to="/map">BroG</Link>
      </p>

      {isLoading ? <p>불러오는 중...</p> : null}
      {!isLoading ? (
        <form className="form" onSubmit={handleSubmit}>
          <label>
            이름
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            구
            <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
          </label>
          <label>
            카테고리
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          </label>
          <label>
            소개
            <textarea
              rows={4}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              required
            />
          </label>
          <label>
            이미지 URL
            <input
              value={form.image_url ?? ''}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </label>
          <label>
            위도
            <input
              type="number"
              step="any"
              value={form.latitude ?? ''}
              onChange={(e) =>
                setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          <label>
            경도
            <input
              type="number"
              step="any"
              value={form.longitude ?? ''}
              onChange={(e) =>
                setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          <label>
            대표 메뉴명
            <input
              value={form.main_menu_name}
              onChange={(e) => setForm({ ...form, main_menu_name: e.target.value })}
              required
            />
          </label>
          <label>
            대표 메뉴 가격
            <input
              type="number"
              min={0}
              max={10000}
              value={form.main_menu_price}
              onChange={(e) => setForm({ ...form, main_menu_price: Number(e.target.value) })}
              required
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}
