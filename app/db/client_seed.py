"""
Seed de invoices — cria uma fatura de exemplo para o cliente seed.
"""

from datetime import date
from decimal import Decimal

from app.db.session import SessionLocal
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceItem


SEED_CLIENT_EMAIL = "teste@olivastrips.com.br"


def run_seed():
    db = SessionLocal()

    try:
        client = db.query(Client).filter(Client.email == SEED_CLIENT_EMAIL).first()

        if not client:
            print("Cliente seed não encontrado. Rode o seed de client primeiro.")
            return

        # evita duplicar invoice
        existing = (
            db.query(Invoice)
            .filter(Invoice.client_id == client.id)
            .filter(Invoice.number == "INV-0001")
            .first()
        )

        if existing:
            print("Invoice seed já existe. Nada foi criado.")
            return

        invoice = Invoice(
            client_id=client.id,
            number="INV-0001",
            model="F1",
            destination="São Paulo - SP",
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 7),
        )

        invoice.items = [
            InvoiceItem(
                date=date(2026, 1, 2),
                company="Hotel Exemplo LTDA",
                description="Hospedagem pacote viagem",
                amount=Decimal("1500.00"),
                invoice_key="HOTEL-001",
            ),
            InvoiceItem(
                date=date(2026, 1, 3),
                company="Transporte XPTO",
                description="Transfer aeroporto",
                amount=Decimal("250.00"),
                invoice_key="TRANSF-001",
            ),
            InvoiceItem(
                date=date(2026, 1, 4),
                company="Agência Parceira",
                description="Taxa de serviço",
                amount=Decimal("300.00"),
                invoice_key="SERV-001",
            ),
        ]

        db.add(invoice)
        db.commit()

        print("Invoice seed criada com sucesso!")
        print(f"Número: {invoice.number}")
        print(f"Cliente: {client.email}")
        print(f"Total: {invoice.total_amount}")

    finally:
        db.close()


if __name__ == "__main__":
    run_seed()