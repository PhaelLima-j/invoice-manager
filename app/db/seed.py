"""
Script de seed — popula o banco com um cliente de teste para facilitar o login manual.

Uso:
    python -m app.db.seed

Requer que o banco (Docker) já esteja rodando e as tabelas já criadas
(isso acontece automaticamente ao subir a API pelo menos uma vez, via lifespan).
"""

from app.db.session import SessionLocal
from app.models.client import Client
from app.models import invoice
from app.core.security import hash_password

# Dados do cliente de teste — ajuste à vontade
SEED_CLIENT = {
    "company_name": "Oliveiras Trips Agência de Viagem e Turismo LTDA",
    "cnpj": "29733173000120",
    "address": "R Elo Eppiger, 354",
    "zip_code": "04809-230",
    "email": "teste@olivastrips.com.br",
    "phone": "11961338335",
    "password": "123456",  # senha em texto puro só aqui no seed, nunca salva assim no banco
}


def run_seed():
    db = SessionLocal()

    try:
        existing = db.query(Client).filter(Client.email == SEED_CLIENT["email"]).first()

        if existing:
            print(f"Cliente '{SEED_CLIENT['email']}' já existe. Nada foi criado.")
            return

        client = Client(
            company_name=SEED_CLIENT["company_name"],
            cnpj=SEED_CLIENT["cnpj"],
            address=SEED_CLIENT["address"],
            zip_code=SEED_CLIENT["zip_code"],
            email=SEED_CLIENT["email"],
            phone=SEED_CLIENT["phone"],
            password_hash=hash_password(SEED_CLIENT["password"]),
        )

        db.add(client)
        db.commit()

        print("Cliente de teste criado com sucesso!")
        print(f"  Email: {SEED_CLIENT['email']}")
        print(f"  Senha: {SEED_CLIENT['password']}")

    finally:
        db.close()


if __name__ == "__main__":
    run_seed()