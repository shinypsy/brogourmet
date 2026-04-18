import { ACCESS_TOKEN_KEY } from './config'
import { requestJson } from './http'

export { ACCESS_TOKEN_KEY }

export type SignupPayload = {
  email: string
  password: string
  nickname: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type User = {
  id: number
  email: string
  nickname: string
  role: string
  managed_district_id?: number | null
  managed_district_name?: string | null
  email_verified_at?: string | null
  is_active: boolean
  /** BroG 적립 대상 신규 등록 시 가산된 누적 포인트(백엔드 `users.points_balance`) */
  points_balance?: number
  created_at: string
  updated_at: string
}

type TokenResponse = {
  access_token: string
  token_type: string
}

export type SignupResponse = {
  user: User
  email_verification_token?: string | null
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  return requestJson<SignupResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function verifyEmail(token: string): Promise<User> {
  return requestJson<User>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export type ResendVerificationResponse = {
  ok: boolean
  email_verification_token?: string | null
}

export async function resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
  return requestJson<ResendVerificationResponse>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  return requestJson<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchMe(token: string): Promise<User> {
  return requestJson<User>('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

/** 마이페이지 — 로그인한 모든 사용자가 본인 닉네임만 변경 */
export async function patchMyNickname(token: string, nickname: string): Promise<User> {
  return requestJson<User>('/users/me/nickname', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nickname }),
  })
}

export type RequestPasswordChangeCodeResponse = {
  ok: boolean
  dev_password_change_code?: string | null
}

/** Myinfo 비밀번호 변경 1단계 — 등록 이메일로 6자리 코드 발송(SMTP 또는 개발 응답). */
export async function requestPasswordChangeCode(token: string): Promise<RequestPasswordChangeCodeResponse> {
  return requestJson<RequestPasswordChangeCodeResponse>('/auth/request-password-change-code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** 이메일 인증코드 + 새 비밀번호로 변경 */
export async function confirmPasswordChange(
  token: string,
  body: { code: string; new_password: string },
): Promise<User> {
  return requestJson<User>('/auth/confirm-password-change', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export async function deleteAccount(password: string): Promise<void> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) {
    throw new Error('로그인이 필요합니다.')
  }
  return requestJson<void>('/users/me/delete-account', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
