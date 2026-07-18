def test_register_client(client, test_client_payload):
    response = client.post("/api/v1/auth/register", json=test_client_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_client_payload["email"]
    assert data["company_name"] == test_client_payload["company_name"]
    assert "password" not in data
    assert "password_hash" not in data


def test_register_duplicate_email(client, test_client_payload):
    client.post("/api/v1/auth/register", json=test_client_payload)
    response = client.post("/api/v1/auth/register", json=test_client_payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "E-mail já cadastrado"


def test_login_success(client, test_client_payload):
    client.post("/api/v1/auth/register", json=test_client_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_client_payload["email"],
            "password": test_client_payload["password"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, test_client_payload):
    client.post("/api/v1/auth/register", json=test_client_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_client_payload["email"],
            "password": "senha_errada",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos"


def test_login_nonexistent_email(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "naoexiste@email.com", "password": "qualquer"},
    )

    assert response.status_code == 401