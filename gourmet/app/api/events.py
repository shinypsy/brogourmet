import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.deploy_stage1 import district_name_in_stage1
from app.deps import (
    can_manage_brog_in_district,
    ensure_can_mutate_site_event,
    get_db,
    get_site_event_editor,
)
from app.models.district import District
from app.models.restaurant import Restaurant
from app.models.site_event import SiteEvent
from app.models.user import User
from app.schemas.site_event import SiteEventCreate, SiteEventRead, SiteEventTickerResponse

router = APIRouter(prefix="/events", tags=["events"])

_log = logging.getLogger(__name__)

_SEP = "  ·  "

_LIST_LIMIT = 80

_SCHEMA_HINT = (
    "이벤트 DB 스키마가 최신이 아닙니다. 저장소 `sql/add_site_events_restaurant_id.sql` 을 적용한 뒤 다시 시도하세요."
)


def _events_db_unavailable(exc: Exception) -> HTTPException:
    _log.warning("site_events 쿼리 실패(스키마·커넥션 등): %s", exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=_SCHEMA_HINT,
    )


@router.get("/ticker", response_model=SiteEventTickerResponse)
def get_ticker_text(db: Session = Depends(get_db)):
    try:
        rows = (
            db.query(SiteEvent)
            .filter(SiteEvent.is_active.is_(True), SiteEvent.restaurant_id.is_(None))
            .order_by(SiteEvent.created_at.desc())
            .all()
        )
    except (OperationalError, ProgrammingError) as exc:
        _log.warning("events ticker skipped (site_events.restaurant_id 미적용 등): %s", exc)
        return SiteEventTickerResponse(text="")
    text = _SEP.join(e.body.strip() for e in rows if e.body and e.body.strip())
    return SiteEventTickerResponse(text=text)


@router.get("", response_model=list[SiteEventRead])
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    try:
        rows = (
            db.query(SiteEvent)
            .order_by(SiteEvent.created_at.desc())
            .limit(_LIST_LIMIT)
            .all()
        )
    except (OperationalError, ProgrammingError) as exc:
        _log.warning("events list skipped (site_events.restaurant_id 미적용 등): %s", exc)
        return []
    return rows


@router.post("", response_model=SiteEventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: SiteEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    body = payload.body.strip()
    rid = payload.restaurant_id
    if rid is not None:
        r = db.query(Restaurant).filter(Restaurant.id == rid).first()
        if not r or r.is_deleted or r.status != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효한 공개 BroG ID가 아닙니다.",
            )
        drow = db.query(District).filter(District.id == r.district_id).first()
        dname = drow.name if drow else ""
        if not district_name_in_stage1(dname):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="1단계에서 공개되는 구의 BroG만 연결할 수 있습니다.",
            )
        if not can_manage_brog_in_district(current_user, r.district_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 BroG에 이벤트를 연결할 권한이 없습니다.",
            )
    event = SiteEvent(
        author_id=current_user.id,
        body=body,
        is_active=True,
        restaurant_id=rid,
    )
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        raise _events_db_unavailable(exc) from exc
    return event


@router.post("/{event_id}/deactivate", response_model=SiteEventRead)
def deactivate_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    try:
        event = db.query(SiteEvent).filter(SiteEvent.id == event_id).first()
    except (OperationalError, ProgrammingError) as exc:
        raise _events_db_unavailable(exc) from exc
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    ensure_can_mutate_site_event(current_user, event)
    event.is_active = False
    try:
        db.commit()
        db.refresh(event)
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        raise _events_db_unavailable(exc) from exc
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    try:
        event = db.query(SiteEvent).filter(SiteEvent.id == event_id).first()
    except (OperationalError, ProgrammingError) as exc:
        raise _events_db_unavailable(exc) from exc
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    ensure_can_mutate_site_event(current_user, event)
    db.delete(event)
    try:
        db.commit()
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        raise _events_db_unavailable(exc) from exc
