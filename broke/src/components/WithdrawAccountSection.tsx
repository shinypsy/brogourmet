import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, deleteAccount } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'

/**
 * Myinfo 등 — 회원 탈퇴 버튼·모달만 담당 (홈 하단 독에서는 사용하지 않음).
 */
export function WithdrawAccountSection() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function openModal() {
    setPassword('')
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (pending) return
    setModalOpen(false)
    setPassword('')
    setError('')
  }

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) {
        setModalOpen(false)
        setPassword('')
        setError('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, pending])

  async function handleWithdraw() {
    if (!password.trim()) {
      setError('비밀번호를 입력하세요.')
      return
    }
    if (!window.confirm('정말 탈퇴할까요? 삭제된 계정은 복구할 수 없습니다.')) {
      return
    }
    setPending(true)
    setError('')
    try {
      await deleteAccount(password)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
      setModalOpen(false)
      setPassword('')
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '탈퇴 처리에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="withdraw-account-section">
        <button
          type="button"
          className="withdraw-account-section__btn"
          title="회원 탈퇴"
          aria-label="회원 탈퇴"
          onClick={openModal}
        >
          <span className="withdraw-account-section__icon" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
              />
            </svg>
          </span>
          <span className="withdraw-account-section__label">회원 탈퇴</span>
        </button>
      </div>

      {modalOpen ? (
        <div className="home-account-dock__backdrop" role="presentation" onClick={closeModal}>
          <div
            className="home-account-dock__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-dialog-title-my"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="withdraw-dialog-title-my" className="home-account-dock__modal-title">
              회원 탈퇴
            </h2>
            <p className="home-account-dock__modal-desc">
              MyG·Free 글, 결제 시도 내역, BroG에 남긴 댓글·좋아요가 삭제됩니다. BroG 매장 정보는 서비스에 남을 수
              있으며, 제출·승인 기록만 연결이 끊깁니다.
            </p>
            <label className="home-account-dock__field">
              <span>비밀번호 확인</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </label>
            {error ? <p className="home-account-dock__error">{error}</p> : null}
            <div className="home-account-dock__modal-actions">
              <button type="button" className="ghost-button" onClick={closeModal} disabled={pending}>
                취소
              </button>
              <button
                type="button"
                className="compact-link danger-text"
                onClick={handleWithdraw}
                disabled={pending}
              >
                {pending ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
