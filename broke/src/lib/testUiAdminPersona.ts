import type { User } from '../api/auth'

import { ROLE_SUPER_ADMIN } from './roles'

/** 로그인 없이 BroG 작성·Myinfo 등 관리자 화면만 볼 때 쓰는 표시용 페르소나(API 호출에는 사용하지 않음) */
export const TEST_UI_SUPER_ADMIN_PERSONA: User = {
  id: 0,
  email: 'test-ui@brogourmet.local',
  nickname: '테스트 관리자(화면)',
  role: ROLE_SUPER_ADMIN,
  managed_district_id: null,
  managed_district_name: null,
  email_verified_at: new Date().toISOString(),
  is_active: true,
  created_at: '',
  updated_at: '',
}
