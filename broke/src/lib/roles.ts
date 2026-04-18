/** Mirrors gourmet `app/core/roles.py` */

import type { User } from '../api/auth'

export const ROLE_SUPER_ADMIN = 'super_admin'
export const ROLE_REGIONAL_MANAGER = 'regional_manager'
export const ROLE_FRANCHISE = 'franchise'
export const ROLE_USER = 'user'

/**
 * 명시할 때만 켜는 “모든 화면을 관리자 권한으로 본다” 완화(로그인 없이 레이아웃만 볼 때 등).
 * 기본은 끔 — `npm run dev` 여도 실제 `fetchMe` 역할과 동일하게 메뉴·버튼이 갈립니다.
 * 예전처럼 dev에서 전역 관리자 UI를 쓰려면 broke `.env` 에 `VITE_ASSUME_ADMIN_UI=1`
 *
 * BroG 실제 수정 권한은 `canAccessBrogManageForRestaurant` 등(assumeAdminUi 미사용)과 서버가 판별합니다.
 */
export function assumeAdminUi(): boolean {
  const v = String(import.meta.env.VITE_ASSUME_ADMIN_UI ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isSuperAdmin(role: string | undefined): boolean {
  if (assumeAdminUi()) return true
  return role === ROLE_SUPER_ADMIN
}

/**
 * 무료나눔·MyG: 담당 구와 글의 구가 같을 때 지역 담당자가 타인 글을 수정할 수 있음(삭제는 슈퍼만).
 */
export function canModerateCommunityPost(
  user: Pick<User, 'role' | 'managed_district_name'> | null | undefined,
  postDistrict: string | null | undefined,
): boolean {
  if (assumeAdminUi()) return true
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

/** 무료나눔·MyG 글 수정: 작성자 본인 또는 슈퍼 또는 해당 구 지역 담당자 */
export function canEditCommunityPost(
  user: Pick<User, 'id' | 'role' | 'managed_district_name'> | null | undefined,
  postAuthorId: number,
  postDistrict: string | null | undefined,
): boolean {
  if (assumeAdminUi()) return true
  if (!user) return false
  if (user.id === postAuthorId) return true
  return canModerateCommunityPost(user, postDistrict)
}

/** 무료나눔 글 삭제: 최종 관리자(super_admin)만 */
export function canDeleteCommunityPost(user: Pick<User, 'role'> | null | undefined): boolean {
  if (assumeAdminUi()) return true
  if (!user) return false
  return user.role === ROLE_SUPER_ADMIN
}

/** FAQ 글 작성: 최종 관리자 또는 담당 구가 지정된 지역 담당자 */
export function canWriteFaqPost(
  user: Pick<User, 'role' | 'managed_district_id'> | null | undefined,
): boolean {
  if (assumeAdminUi()) return true
  if (!user) return false
  if (isSuperAdmin(user.role)) return true
  if (user.role === ROLE_REGIONAL_MANAGER && user.managed_district_id != null) return true
  return false
}

/** MyG(KnownRestaurant) 글 삭제: 작성자 본인 또는 해당 구 운영 권한(gourmet `ensure_community_post_author_or_moderation`) */
export function canDeleteKnownRestaurantPost(
  user: Pick<User, 'id' | 'role' | 'managed_district_name'> | null | undefined,
  postAuthorId: number,
  postDistrict: string | null | undefined,
): boolean {
  if (assumeAdminUi()) return true
  return canEditCommunityPost(user, postAuthorId, postDistrict)
}

/** @deprecated `canEditCommunityPost` 사용 */
export function canEditOrDeleteCommunityPost(
  user: Pick<User, 'id' | 'role' | 'managed_district_name'> | null | undefined,
  postAuthorId: number,
  postDistrict: string | null | undefined,
): boolean {
  return canEditCommunityPost(user, postAuthorId, postDistrict)
}

/** BroG 댓글 수정: 본인 또는 슈퍼 또는 해당 구 지역 담당자 */
export function canEditRestaurantComment(
  user: Pick<User, 'id' | 'role' | 'managed_district_id'> | null | undefined,
  commentAuthorId: number,
  restaurantDistrictId: number,
): boolean {
  if (assumeAdminUi()) return true
  if (!user) return false
  if (user.id === commentAuthorId) return true
  return canManageBrogForDistrict(user.role, user.managed_district_id, restaurantDistrictId)
}

/** BroG 댓글 삭제: 최종 관리자만 */
export function canDeleteRestaurantComment(user: Pick<User, 'role'> | null | undefined): boolean {
  if (assumeAdminUi()) return true
  if (!user) return false
  return user.role === ROLE_SUPER_ADMIN
}

/** @deprecated `canEditRestaurantComment` / `canDeleteRestaurantComment` 사용 */
export function canEditOrDeleteRestaurantComment(
  user: Pick<User, 'id' | 'role' | 'managed_district_id'> | null | undefined,
  commentAuthorId: number,
  restaurantDistrictId: number,
): boolean {
  return canEditRestaurantComment(user, commentAuthorId, restaurantDistrictId)
}

/** 슈퍼·지역담당자만 (등록 회원 BroG 작성은 로그인만 있으면 됨 — 서버와 별도) */
export function canManageBrog(role: string | undefined): boolean {
  return role === ROLE_SUPER_ADMIN || role === ROLE_REGIONAL_MANAGER
}

/** 상단 이벤트 티커 등록·목록·비활성화: 슈퍼 또는 담당 구가 있는 지역 담당자 */
export function canWriteSiteEvents(
  user: Pick<User, 'role' | 'managed_district_id'> | null | undefined,
): boolean {
  if (!user) return false
  if (assumeAdminUi()) return true
  if (user.role === ROLE_SUPER_ADMIN) return true
  if (user.role === ROLE_REGIONAL_MANAGER && user.managed_district_id != null) return true
  return false
}

/** 이벤트 비활성화·삭제: 슈퍼는 전부, 지역 담당자는 본인 작성만 */
export function canMutateSiteEvent(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  event: { author_id: number | null },
): boolean {
  if (!user) return false
  if (assumeAdminUi()) return true
  if (user.role === ROLE_SUPER_ADMIN) return true
  if (
    user.role === ROLE_REGIONAL_MANAGER &&
    event.author_id != null &&
    event.author_id === user.id
  ) {
    return true
  }
  return false
}

/** BroG 관리·수정·목록 숨김 — 슈퍼, 담당 구 지역담당자, 또는 등록자 본인 (서버와 동일, assumeAdminUi 미적용) */
export function canAccessBrogManageForRestaurant(
  user: Pick<User, 'id' | 'role' | 'managed_district_id'> | null | undefined,
  restaurant: { district_id: number; submitted_by_user_id?: number | null },
): boolean {
  if (!user) return false
  if (user.role === ROLE_SUPER_ADMIN) return true
  if (user.role === ROLE_REGIONAL_MANAGER && user.managed_district_id === restaurant.district_id) return true
  if (restaurant.submitted_by_user_id != null && restaurant.submitted_by_user_id === user.id) return true
  return false
}

/** 목록·지도 카드에서 소프트 삭제 버튼 */
export function canSoftDeleteBrogListing(
  user: Pick<User, 'id' | 'role' | 'managed_district_id'> | null | undefined,
  row: { district_id: number; submitted_by_user_id?: number | null },
): boolean {
  if (assumeAdminUi()) return true
  return canAccessBrogManageForRestaurant(user, row)
}

/** 상세 「관리」·지도/리스트 편집 권한 배지: 슈퍼는 전 구, 지역담당자는 담당 구만 (등록자는 `canAccessBrogManageForRestaurant`) */
export function canManageBrogForDistrict(
  role: string | undefined,
  managedDistrictId: number | null | undefined,
  restaurantDistrictId: number,
): boolean {
  if (role === ROLE_SUPER_ADMIN) return true
  if (role === ROLE_REGIONAL_MANAGER && managedDistrictId === restaurantDistrictId) return true
  return false
}
