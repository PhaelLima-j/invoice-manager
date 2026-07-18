INVOICE_PAYLOAD = {
    "number": "0001",
    "model": "F1",
    "destination": "LAVRINHAS",
    "period_start": "2026-01-23",
    "period_end": "2026-01-25",
    "items": [
        {
            "date": "2026-01-23",
            "company": "SUSSSP TUR FRET LTDA",
            "description": "FRETAMENTO",
            "amount": "4100.00",
            "invoice_key": "3526 0144 1111 1111 0111 1111 1111 0195 3217 3748 0009",
        }
    ],
}


def test_create_invoice_requires_auth(client):
    response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD)
    assert response.status_code == 401


def test_create_invoice(client, auth_headers):
    response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["number"] == "0001"
    assert data["destination"] == "LAVRINHAS"
    assert len(data["items"]) == 1
    assert data["total_amount"] == "4100.00"


def test_list_invoices_empty(client, auth_headers):
    response = client.get("/api/v1/invoices/", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_invoices_after_create(client, auth_headers):
    client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=auth_headers)

    response = client.get("/api/v1/invoices/", headers=auth_headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_invoice_by_id(client, auth_headers):
    create_response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=auth_headers)
    invoice_id = create_response.json()["id"]

    response = client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == invoice_id


def test_get_invoice_not_found(client, auth_headers):
    response = client.get("/api/v1/invoices/999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Invoice not found"


def test_update_invoice(client, auth_headers):
    create_response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=auth_headers)
    invoice_id = create_response.json()["id"]

    updated_payload = {**INVOICE_PAYLOAD, "number": "0002", "destination": "CAMPOS DO JORDAO"}
    response = client.put(f"/api/v1/invoices/{invoice_id}", json=updated_payload, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["number"] == "0002"
    assert data["destination"] == "CAMPOS DO JORDAO"


def test_delete_invoice(client, auth_headers):
    create_response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=auth_headers)
    invoice_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_client_cannot_see_another_clients_invoice(client, test_client_payload):
    # cliente A cria uma invoice
    client.post("/api/v1/auth/register", json=test_client_payload)
    login_a = client.post("/api/v1/auth/login", data={
        "username": test_client_payload["email"],
        "password": test_client_payload["password"],
    })
    headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

    create_response = client.post("/api/v1/invoices/", json=INVOICE_PAYLOAD, headers=headers_a)
    invoice_id = create_response.json()["id"]

    # cliente B tenta acessar a invoice do cliente A
    client_b_payload = {
        "company_name": "Outra Agência LTDA",
        "cnpj": "11222333000144",
        "email": "contato@outraagencia.com.br",
        "password": "outra_senha_456",
    }
    client.post("/api/v1/auth/register", json=client_b_payload)
    login_b = client.post("/api/v1/auth/login", data={
        "username": client_b_payload["email"],
        "password": client_b_payload["password"],
    })
    headers_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}

    response = client.get(f"/api/v1/invoices/{invoice_id}", headers=headers_b)

    assert response.status_code == 404  # não acha, pois é de outro cliente