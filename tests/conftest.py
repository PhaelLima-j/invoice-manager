import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db

# necessário importar os models para o create_all "enxergar" as tabelas
from app.models import client, invoice  # noqa: F401


SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    from app.core.rate_limit import reset as reset_rate_limit

    reset_rate_limit()  # isola o rate limiting entre os testes
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def test_client_payload() -> dict:
    """Dados de um cliente de teste para registro/login."""
    return {
        "company_name": "Oliveiras Trips Agência de Viagem",
        "cnpj": "29733173000120",
        "address": "R Elo Eppiger, 354",
        "zip_code": "04809-230",
        "email": "financeiro@olivastrips.com.br",
        "phone": "11961338335",
        "password": "senha_segura_123",
    }


@pytest.fixture
def auth_headers(client: TestClient, test_client_payload: dict) -> dict:
    """
    Registra um cliente, faz login e retorna os headers já com o Bearer token.
    Use essa fixture em qualquer teste que precise de autenticação
    """
    client.post("/api/v1/auth/register", json=test_client_payload)

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_client_payload["email"],
            "password": test_client_payload["password"],
        },
    )
    token = login_response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}