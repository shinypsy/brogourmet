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
