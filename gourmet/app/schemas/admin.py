"""슈퍼 관리자 전용 API 스키마."""

from pydantic import BaseModel, Field


class SetRegionalManagerBody(BaseModel):
    district_id: int = Field(ge=1)


class AdminDistrictOption(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    sort_order: int


class AdminRestaurantRow(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    district_id: int
    district_name: str
    category: str
    status: str
    bro_list_pin: int | None = None
    is_deleted: bool
    # 지도·목록 가맹 깃발(실제 표시 여부)
    is_franchise: bool = False
    # NULL = 등록자 franchise 역할 따름 · True/False = 관리자 강제
    franchise_pin: bool | None = None


class AdminFranchisePinBody(BaseModel):
    """가맹 표시: true/false 강제, null이면 등록자 역할에 맡김."""

    franchise_pin: bool | None = None
