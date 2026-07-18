from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceItem
from app.schemas.invoice import InvoiceCreate


def create_invoice(db: Session, payload: InvoiceCreate, client_id: int) -> Invoice:
    invoice = Invoice(
        client_id=client_id,
        number=payload.number,
        model=payload.model,
        destination=payload.destination,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    invoice.items = [InvoiceItem(**item.model_dump()) for item in payload.items]

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def get_invoice(db: Session, invoice_id: int, client_id: int) -> Invoice | None:
    return db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.client_id == client_id)
    ).scalar_one_or_none()


def list_invoices(db: Session, client_id: int) -> list[Invoice]:
    result = db.execute(select(Invoice).where(Invoice.client_id == client_id))
    return list(result.scalars().all())


def update_invoice(db: Session, invoice: Invoice, payload: InvoiceCreate) -> Invoice:
    invoice.number = payload.number
    invoice.model = payload.model
    invoice.destination = payload.destination
    invoice.period_start = payload.period_start
    invoice.period_end = payload.period_end

    invoice.items.clear()
    invoice.items = [InvoiceItem(**item.model_dump()) for item in payload.items]

    db.commit()
    db.refresh(invoice)
    return invoice


def delete_invoice(db: Session, invoice: Invoice) -> None:
    db.delete(invoice)
    db.commit()

def update_received_amount(db: Session, invoice: Invoice, received_amount) -> Invoice:
    invoice.received_amount = received_amount
    db.commit()
    db.refresh(invoice)
    return invoice