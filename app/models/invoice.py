from datetime import date
from decimal import Decimal

from sqlalchemy import String, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)

    number: Mapped[str] = mapped_column(String(20), nullable=False)
    model: Mapped[str] = mapped_column(String(10), default="F1", nullable=False)
    destination: Mapped[str] = mapped_column(String(150), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    received_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # NOVO

    client: Mapped["Client"] = relationship(back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )

    @property
    def total_amount(self) -> Decimal:
        return sum((item.amount for item in self.items), Decimal("0"))

    @property
    def balance(self) -> Decimal | None:
        """Saldo: positivo = sobrou (cliente pagou a mais), negativo = falta pagar."""
        if self.received_amount is None:
            return None
        return self.received_amount - self.total_amount


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)

    date: Mapped[date] = mapped_column(Date, nullable=False)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(String(150), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    invoice_key: Mapped[str | None] = mapped_column(String(60), nullable=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")