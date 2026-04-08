from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deploy_stage1 import stage1_district_names
from app.deps import get_db
from app.models.district import District
from app.schemas.district import DistrictRead

router = APIRouter(prefix="/districts", tags=["districts"])


@router.get("", response_model=list[DistrictRead])
def list_districts(db: Session = Depends(get_db)):
    q = db.query(District).filter(District.active.is_(True))
    allowed = stage1_district_names()
    if allowed is not None:
        q = q.filter(District.name.in_(list(allowed)))
    return q.order_by(District.sort_order.asc(), District.name.asc()).all()
