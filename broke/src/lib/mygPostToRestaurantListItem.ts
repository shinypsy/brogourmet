import type { KnownRestaurantPost } from '../api/community'
import type { RestaurantListItem } from '../api/restaurants'
import { galleryUrlsFromMygPost } from './mygPostGallery'

/** MyG 글 → 지도·이미지 그리드용 `RestaurantListItem` (BroG 목록 카드와 동일 필드 골격) */
export function mygPostToRestaurantListItem(post: KnownRestaurantPost): RestaurantListItem {
  const city = (post.city ?? '서울특별시').trim() || '서울특별시'
  const gallery = galleryUrlsFromMygPost(post)
  const primary = gallery[0] ?? null
  const menuPrice =
    typeof post.main_menu_price === 'number' && Number.isFinite(post.main_menu_price)
      ? post.main_menu_price
      : 0
  return {
    id: post.id,
    submitted_by_user_id: post.author_id,
    name: (post.restaurant_name ?? '').trim() || '이름 없음',
    city,
    district_id: post.district_id ?? 0,
    district: (post.district ?? '').trim() || '—',
    category: post.category ?? '',
    summary: post.summary ?? '',
    image_url: primary,
    image_urls: gallery.length > 0 ? gallery : undefined,
    latitude: post.latitude ?? null,
    longitude: post.longitude ?? null,
    main_menu_name: (post.main_menu_name ?? '').trim() || '대표 메뉴',
    main_menu_price: menuPrice,
    points_eligible: false,
    is_franchise: post.is_franchise,
  }
}
