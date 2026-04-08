/**
 * 브라우저에서 이미지 파일 EXIF의 GPS만 읽습니다 (JPEG/HEIC 등, 서버 업로드 전 원본 File).
 * @see https://github.com/MikeKovarik/exifr
 */

export function coordsFieldsBothEmpty(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  const latEmpty = lat == null || Number.isNaN(Number(lat))
  const lngEmpty = lng == null || Number.isNaN(Number(lng))
  return latEmpty && lngEmpty
}

/** 유효한 WGS84 범위면 true */
function isValidWgs84(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

/**
 * 사진에 GPS 태그가 있으면 십진 위도·경도 반환. 없거나 파싱 실패 시 null.
 */
export async function readGpsFromImageFile(file: File): Promise<{ latitude: number; longitude: number } | null> {
  if (!file?.type.startsWith('image/')) return null
  try {
    const { gps } = await import('exifr')
    const out = await gps(file)
    if (!out || typeof out.latitude !== 'number' || typeof out.longitude !== 'number') return null
    if (!isValidWgs84(out.latitude, out.longitude)) return null
    return { latitude: out.latitude, longitude: out.longitude }
  } catch {
    return null
  }
}
