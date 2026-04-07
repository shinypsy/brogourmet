from pydantic import BaseModel, ConfigDict


class DistrictRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    active: bool
    sort_order: int
