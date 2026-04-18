import { requestJson } from './http'

export type PaymentIntent = {
  id: number
  amount_krw: number
  description: string | null
  status: string
  intent_kind?: string
  created_at: string
  merchant_order_id?: string | null
  paid_at?: string | null
}

export async function fetchMyPayments(token: string): Promise<PaymentIntent[]> {
  return requestJson<PaymentIntent[]>('/payments/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createPaymentIntent(
  token: string,
  body: {
    amount_krw: number
    description?: string | null
    intent_kind?: 'merchant' | 'point_charge'
  },
): Promise<PaymentIntent> {
  return requestJson<PaymentIntent>('/payments/intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}
