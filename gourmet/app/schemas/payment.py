from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PaymentIntentCreate(BaseModel):
    amount_krw: int = Field(ge=100, le=10_000_000)
    description: str | None = Field(default=None, max_length=500)
    intent_kind: Literal["merchant", "point_charge"] = "merchant"

    @model_validator(mode="after")
    def validate_point_charge_amount(self) -> PaymentIntentCreate:
        if self.intent_kind == "point_charge":
            if self.amount_krw < 10_000 or self.amount_krw % 10_000 != 0:
                raise ValueError("포인트 충전은 1만 원 단위(10,000원 이상)로만 가능합니다.")
        return self


class PaymentIntentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_krw: int
    description: str | None
    status: str
    intent_kind: str = "merchant"
    created_at: datetime
    merchant_order_id: str | None = None
    paid_at: datetime | None = None
