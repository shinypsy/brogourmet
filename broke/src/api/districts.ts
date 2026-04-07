import { requestJson } from './http'

export type District = {
  id: number
  name: string
  active: boolean
  sort_order: number
}

export async function fetchDistricts(): Promise<District[]> {
  return requestJson<District[]>('/districts')
}
