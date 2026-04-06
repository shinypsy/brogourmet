from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PaymentIntentCreate(BaseModel):
    amount_krw: int = Field(ge=100, le=10_000_000)
    description: str | None = Field(default=None, max_length=500)


class PaymentIntentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_krw: int
    description: str | None
    status: str
    created_at: datetime
