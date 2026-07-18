// api.js — centraliza toda comunicação com o backend FastAPI

const API_BASE_URL = "/api/v1";

/**
 * Wrapper em torno do fetch que:
 * - injeta o header Authorization automaticamente (se houver token salvo)
 * - lança erro com a mensagem vinda do backend em caso de falha
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // só define Content-Type JSON se o body não for FormData/URLSearchParams
  if (options.body && !(options.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null; // delete sem conteúdo de retorno
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || "Erro inesperado. Tente novamente.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

const api = {
  // ---------- Auth ----------
  async register(payload) {
    return apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(email, password) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: form,
    });

    localStorage.setItem("access_token", data.access_token);
    return data;
  },

  logout() {
    localStorage.removeItem("access_token");
  },

  isLoggedIn() {
    return Boolean(localStorage.getItem("access_token"));
  },

  // ---------- Invoices ----------
  async listInvoices() {
    return apiFetch("/invoices/");
  },

  async getInvoice(id) {
    return apiFetch(`/invoices/${id}`);
  },

  async createInvoice(payload) {
    return apiFetch("/invoices/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateInvoice(id, payload) {
    return apiFetch(`/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async updateReceivedAmount(id, receivedAmount) {
  return apiFetch(`/invoices/${id}/received-amount`, {
    method: "PATCH",
    body: JSON.stringify({ received_amount: receivedAmount }),
    });
  },

  async deleteInvoice(id) {
    return apiFetch(`/invoices/${id}`, {
      method: "DELETE",
    });
  },
};


