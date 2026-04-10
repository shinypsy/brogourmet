"""전역 공지(슬롯 1~3) — 공개 조회."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models.site_notice import SiteNotice
from app.schemas.site_notice import SiteNoticeRead

router = APIRouter(prefix="/site-notices", tags=["site-notices"])


def _normalize_notice_fields(slot: int, title: str | None, body: str | None) -> tuple[str, str]:
    """구버전 API·데이터로 들어간 '공지 1' / '공지1' 등은 제목이 아닌 슬롯 라벨로 취급해 비움."""
    t = (title or "").strip()
    b = (body or "").strip()
    compact = t.replace(" ", "")
    if compact == f"공지{slot}":
        t = ""
    return t, b


def get_site_notices_read(db: Session) -> list[SiteNoticeRead]:
    rows = {r.slot: r for r in db.query(SiteNotice).order_by(SiteNotice.slot.asc()).all()}
    out: list[SiteNoticeRead] = []
    for s in (1, 2, 3):
        r = rows.get(s)
        if r:
            t, b = _normalize_notice_fields(s, r.title, r.body)
            out.append(
                SiteNoticeRead(
                    slot=s,
                    title=t,
                    body=b,
                    updated_at=r.updated_at,
                )
            )
        else:
            # DB에 행이 없으면 빈 슬롯 — 기본 제목을 넣으면 홈에서 '내용 없는 공지'로 잘못 노출됨
            out.append(SiteNoticeRead(slot=s, title="", body="", updated_at=None))
    return out


@router.get("", response_model=list[SiteNoticeRead])
def list_site_notices(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return get_site_notices_read(db)
