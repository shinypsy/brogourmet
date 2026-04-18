import { requestJson } from './http'

import type { PaymentIntent } from './payments'

export type KcpMobileForm = Record<string, string | undefined>

export type KcpRegisterResponse = {
  intent: PaymentIntent
  kcp: {
    encoding_submit_url: string
    mobile_form: KcpMobileForm
  }
}

export async function registerKcpPayment(
  token: string,
  body: {
    amount_krw: number
    description?: string | null
    good_name?: string | null
    pay_method?: string
    intent_kind?: 'merchant' | 'point_charge'
  },
): Promise<KcpRegisterResponse> {
  return requestJson<KcpRegisterResponse>('/payments/kcp/register', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

/** KCP 문서: PayUrl 기준 encodingFilter.jsp 로 POST — hidden 필드는 register 응답 mobile_form 그대로. */
export function submitKcpMobileForm(encodingSubmitUrl: string, mobileForm: KcpMobileForm): void {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = encodingSubmitUrl
  form.style.display = 'none'
  for (const [name, value] of Object.entries(mobileForm)) {
    if (value === undefined || value === null) continue
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = String(value)
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}
