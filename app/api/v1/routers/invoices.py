from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.client import Client
from app.schemas.invoice import InvoiceCreate, InvoiceOut, ReceivedAmountUpdate
from app.crud import invoice as invoice_crud
from app.api.v1.deps import get_current_client

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.post("/", response_model=InvoiceOut)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    return invoice_crud.create_invoice(db, payload, client_id=current_client.id)


@router.get("/", response_model=list[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    return invoice_crud.list_invoices(db, client_id=current_client.id)


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    invoice = invoice_crud.get_invoice(db, invoice_id, client_id=current_client.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: int,
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    invoice = invoice_crud.get_invoice(db, invoice_id, client_id=current_client.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return invoice_crud.update_invoice(db, invoice, payload)


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    invoice = invoice_crud.get_invoice(db, invoice_id, client_id=current_client.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    invoice_crud.delete_invoice(db, invoice)

@router.patch("/{invoice_id}/received-amount", response_model=InvoiceOut)
def update_received_amount(
    invoice_id: int,
    payload: ReceivedAmountUpdate,
    db: Session = Depends(get_db),
    current_client: Client = Depends(get_current_client),
):
    invoice = invoice_crud.get_invoice(db, invoice_id, client_id=current_client.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return invoice_crud.update_received_amount(db, invoice, payload.received_amount)