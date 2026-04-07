from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models.district import District
from app.schemas.district import DistrictRead

router = APIRouter(prefix="/districts", tags=["districts"])


@router.get("", response_model=list[DistrictRead])
def list_districts(db: Session = Depends(get_db)):
    return (
        db.query(District)
        .filter(District.active.is_(True))
        .order_by(District.sort_order.asc(), District.name.asc())
        .all()
    )
