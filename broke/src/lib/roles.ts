/** Mirrors gourmet `app/core/roles.py` */

import type { User } from '../api/auth'

export const ROLE_SUPER_ADMIN = 'super_admin'
export const ROLE_REGIONAL_MANAGER = 'regional_manager'
export const ROLE_FRANCHISE = 'franchise'
export const ROLE_USER = 'user'

export function isSuperAdmin(role: string | undefined): boolean {
  return role === ROLE_SUPER_ADMIN
}

/**
 * 무료나눔·MyG 글 수정·삭제 UI — 최종 관리자 또는 글의 구가 담당 구와 같은 지역 담당자만.
 * (일반 회원은 작성만 가능, 삭제 불가)
 */
export function canModerateCommunityPost(
  user: Pick<User, 'role' | 'managed_district_name'> | null | undefined,
  postDistrict: string | null | undefined,
): boolean {
  if (!user) return false
  if (isSuperAdmin(user.role)) return true
  if (user.role !== ROLE_REGIONAL_MANAGER) return false
  const managed = (user.managed_district_name ?? '').trim()
  const post = (postDistrict ?? '').trim()
  if (!managed || !post) return false
  return managed === post
}

/** 이전 이름 호환 — `canModerateCommunityPost`와 동일 */
export { canModerateCommunityPost as isCommunityModerator }

/** 무료나눔·MyG: 작성자 본인 또는 슈퍼·해당 구 담당자 */
export function canEditOrDeleteCommunityPost(
  user: Pick<User, 'id' | 'role' | 'managed_district_name'> | null | undefined,
  postAuthorId: number,
  postDistrict: string | null | undefined,
): boolean {
  if (!user) return false
  if (user.id === postAuthorId) return true
  return canModerateCommunityPost(user, postDistrict)
}

/** BroG 댓글: 작성자 본인 또는 슈퍼·해당 구 담당자 */
export function canEditOrDeleteRestaurantComment(
  user: Pick<User, 'id' | 'role' | 'managed_district_id'> | null | undefined,
  commentAuthorId: number,
  restaurantDistrictId: number,
): boolean {
  if (!user) return false
  if (user.id === commentAuthorId) return true
  return canManageBrogForDistrict(user.role, user.managed_district_id, restaurantDistrictId)
}

/** BroG(맛집) 생성·수정·삭제 UI 노출 */
export function canManageBrog(role: string | undefined): boolean {
  return role === ROLE_SUPER_ADMIN || role === ROLE_REGIONAL_MANAGER
}

/** 상세/수정 버튼: 슈퍼는 전 구, 지역담당자는 담당 구만 */
export function canManageBrogForDistrict(
  role: string | undefined,
  managedDistrictId: number | null | undefined,
  restaurantDistrictId: number,
): boolean {
  if (role === ROLE_SUPER_ADMIN) return true
  if (role === ROLE_REGIONAL_MANAGER && managedDistrictId === restaurantDistrictId) return true
  return false
}
