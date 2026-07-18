from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvoiceItemBase(BaseModel):
    date: date
    company: str
    description: str
    amount: Decimal = Field(ge=0)
    invoice_key: str | None = None


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemOut(InvoiceItemBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    number: str
    model: str = "F1"
    destination: str
    period_start: date
    period_end: date


class InvoiceCreate(InvoiceBase):
    items: list[InvoiceItemCreate] = []


class InvoiceOut(InvoiceBase):
    id: int
    items: list[InvoiceItemOut] = []
    total_amount: Decimal
    received_amount: Decimal | None = None
    balance: Decimal | None = None
    model_config = ConfigDict(from_attributes=True)


# NOVO — schema exclusivo para registrar o valor recebido
class ReceivedAmountUpdate(BaseModel):
    received_amount: Decimal = Field(ge=0)