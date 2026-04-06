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
  is_active: boolean
  created_at: string
  updated_at: string
}

type TokenResponse = {
  access_token: string
  token_type: string
}

export async function signup(payload: SignupPayload): Promise<User> {
  return requestJson<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
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
