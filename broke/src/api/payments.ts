import { requestJson } from './http'

export type PaymentIntent = {
  id: number
  amount_krw: number
  description: string | null
  status: string
  created_at: string
}

export async function fetchMyPayments(token: string): Promise<PaymentIntent[]> {
  return requestJson<PaymentIntent[]>('/payments/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createPaymentIntent(
  token: string,
  body: { amount_krw: number; description?: string | null },
): Promise<PaymentIntent> {
  return requestJson<PaymentIntent>('/payments/intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}
