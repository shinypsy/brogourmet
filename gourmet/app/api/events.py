from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import (
    ensure_can_mutate_site_event,
    get_db,
    get_site_event_editor,
)
from app.models.site_event import SiteEvent
from app.models.user import User
from app.schemas.site_event import SiteEventCreate, SiteEventRead, SiteEventTickerResponse

router = APIRouter(prefix="/events", tags=["events"])

_SEP = "  ·  "

_LIST_LIMIT = 80


@router.get("/ticker", response_model=SiteEventTickerResponse)
def get_ticker_text(db: Session = Depends(get_db)):
    rows = (
        db.query(SiteEvent)
        .filter(SiteEvent.is_active.is_(True))
        .order_by(SiteEvent.created_at.desc())
        .all()
    )
    text = _SEP.join(e.body.strip() for e in rows if e.body and e.body.strip())
    return SiteEventTickerResponse(text=text)


@router.get("", response_model=list[SiteEventRead])
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    rows = (
        db.query(SiteEvent)
        .order_by(SiteEvent.created_at.desc())
        .limit(_LIST_LIMIT)
        .all()
    )
    return rows


@router.post("", response_model=SiteEventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: SiteEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    event = SiteEvent(author_id=current_user.id, body=payload.body.strip(), is_active=True)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/deactivate", response_model=SiteEventRead)
def deactivate_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    event = db.query(SiteEvent).filter(SiteEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    ensure_can_mutate_site_event(current_user, event)
    event.is_active = False
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_site_event_editor),
):
    event = db.query(SiteEvent).filter(SiteEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    ensure_can_mutate_site_event(current_user, event)
    db.delete(event)
    db.commit()
