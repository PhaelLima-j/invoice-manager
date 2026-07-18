// app.js — lógica de interface: alterna telas, renderiza dados, trata formulários

// ---------- Referências de elementos ----------
const loginScreen = document.getElementById("login-screen");
const registerScreen = document.getElementById("register-screen");
const dashboardScreen = document.getElementById("dashboard-screen");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const invoiceForm = document.getElementById("invoice-form");

const invoiceModal = document.getElementById("invoice-modal");
const itemsContainer = document.getElementById("items-container");

let editingInvoiceId = null; // null = criando nova nota; caso contrário, editando

// ---------- Navegação entre telas ----------
function showScreen(screen) {
  [loginScreen, registerScreen, dashboardScreen].forEach((el) => el.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function initialRoute() {
  if (api.isLoggedIn()) {
    showScreen(dashboardScreen);
    loadInvoices();
  } else {
    showScreen(loginScreen);
  }
}

document.getElementById("go-to-register").addEventListener("click", () => showScreen(registerScreen));
document.getElementById("go-to-login").addEventListener("click", () => showScreen(loginScreen));

document.getElementById("logout-btn").addEventListener("click", () => {
  api.logout();
  showScreen(loginScreen);
});

// ---------- Login ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("login-error");
  errorBox.classList.add("hidden");

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await api.login(email, password);
    showScreen(dashboardScreen);
    loadInvoices();
    loginForm.reset();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
});

// ---------- Registro ----------
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("register-error");
  const successBox = document.getElementById("register-success");
  errorBox.classList.add("hidden");
  successBox.classList.add("hidden");

  const payload = {
    company_name: document.getElementById("reg-company").value,
    cnpj: document.getElementById("reg-cnpj").value,
    email: document.getElementById("reg-email").value,
    phone: document.getElementById("reg-phone").value || null,
    address: document.getElementById("reg-address").value || null,
    zip_code: document.getElementById("reg-zip").value || null,
    password: document.getElementById("reg-password").value,
  };

  try {
    await api.register(payload);
    successBox.textContent = "Conta criada com sucesso! Faça login.";
    successBox.classList.remove("hidden");
    registerForm.reset();
    setTimeout(() => showScreen(loginScreen), 1200);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
});

// ---------- Listagem de invoices ----------
async function loadInvoices() {
  const listEl = document.getElementById("invoices-list");
  listEl.innerHTML = "<p class='empty-state'>Carregando...</p>";

  try {
    const invoices = await api.listInvoices();

    if (invoices.length === 0) {
      listEl.innerHTML = "<p class='empty-state'>Nenhuma nota fiscal cadastrada ainda.</p>";
      return;
    }

    listEl.innerHTML = "";
    invoices.forEach((invoice) => {
      listEl.appendChild(renderInvoiceCard(invoice));
    });
  } catch (err) {
    listEl.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

function renderInvoiceCard(invoice) {
  const card = document.createElement("div");
  card.className = "card invoice-card";

  const period = `${formatDate(invoice.period_start)} a ${formatDate(invoice.period_end)}`;
  const balanceHtml = renderBalance(invoice);

  card.innerHTML = `
    <div>
      <h3>Nº ${invoice.number} — ${invoice.destination}</h3>
      <p class="meta">${period} • ${invoice.items.length} item(ns)</p>
      <p class="total">Valor da nota: R$ ${Number(invoice.total_amount).toFixed(2)}</p>
      ${balanceHtml}
    </div>
    <div class="actions">
      <button class="btn-received">Registrar Recebimento</button>
      <button class="btn-edit">Editar</button>
      <button class="btn-delete">Excluir</button>
    </div>
  `;

  card.querySelector(".btn-received").addEventListener("click", () => openReceivedAmountPrompt(invoice));
  card.querySelector(".btn-edit").addEventListener("click", () => openEditModal(invoice));
  card.querySelector(".btn-delete").addEventListener("click", () => handleDelete(invoice.id));

  return card;
}

function renderBalance(invoice) {
  if (invoice.received_amount === null || invoice.received_amount === undefined) {
    return `<p class="meta">Valor recebido: não informado</p>`;
  }

  const balance = Number(invoice.balance);
  const isPositive = balance >= 0;
  const label = isPositive ? "Saldo a favor" : "Falta pagar";
  const colorClass = isPositive ? "balance-positive" : "balance-negative";

  return `
    <p class="meta">Valor recebido: R$ ${Number(invoice.received_amount).toFixed(2)}</p>
    <p class="${colorClass}">${label}: R$ ${Math.abs(balance).toFixed(2)}</p>
  `;
}

function openReceivedAmountPrompt(invoice) {
  const currentValue = invoice.received_amount ?? "";
  const input = prompt(
    `Quanto o cliente pagou/recebeu para a nota nº ${invoice.number}?`,
    currentValue
  );

  if (input === null) return; // cancelou

  const value = parseFloat(input);
  if (isNaN(value) || value < 0) {
    alert("Digite um valor numérico válido.");
    return;
  }

  api
    .updateReceivedAmount(invoice.id, value)
    .then(() => loadInvoices())
    .catch((err) => alert(err.message));
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

async function handleDelete(invoiceId) {
  if (!confirm("Tem certeza que deseja excluir essa nota fiscal?")) return;

  try {
    await api.deleteInvoice(invoiceId);
    loadInvoices();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Modal: criar / editar invoice ----------
document.getElementById("new-invoice-btn").addEventListener("click", () => openCreateModal());
document.getElementById("cancel-modal-btn").addEventListener("click", () => closeModal());
document.getElementById("add-item-btn").addEventListener("click", () => addItemRow());

function openCreateModal() {
  editingInvoiceId = null;
  document.getElementById("modal-title").textContent = "Nova Nota Fiscal";
  invoiceForm.reset();
  itemsContainer.innerHTML = "";
  addItemRow(); // já começa com 1 item vazio
  invoiceModal.classList.remove("hidden");
}

function openEditModal(invoice) {
  editingInvoiceId = invoice.id;
  document.getElementById("modal-title").textContent = "Editar Nota Fiscal";

  document.getElementById("inv-number").value = invoice.number;
  document.getElementById("inv-destination").value = invoice.destination;
  document.getElementById("inv-period-start").value = invoice.period_start;
  document.getElementById("inv-period-end").value = invoice.period_end;

  itemsContainer.innerHTML = "";
  invoice.items.forEach((item) => addItemRow(item));

  invoiceModal.classList.remove("hidden");
}

function closeModal() {
  invoiceModal.classList.add("hidden");
  document.getElementById("invoice-form-error").classList.add("hidden");
}

function addItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="date" class="item-date" value="${item.date || ""}" required />
    <input type="text" class="item-company" placeholder="Empresa" value="${item.company || ""}" required />
    <input type="text" class="item-description" placeholder="Descrição" value="${item.description || ""}" required />
    <input type="number" step="0.01" class="item-amount" placeholder="Valor" value="${item.amount || ""}" required />
    <button type="button" title="Remover item">✕</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  itemsContainer.appendChild(row);
}

invoiceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("invoice-form-error");
  errorBox.classList.add("hidden");

  const items = Array.from(itemsContainer.querySelectorAll(".item-row")).map((row) => ({
    date: row.querySelector(".item-date").value,
    company: row.querySelector(".item-company").value,
    description: row.querySelector(".item-description").value,
    amount: parseFloat(row.querySelector(".item-amount").value),
  }));

  const payload = {
    number: document.getElementById("inv-number").value,
    destination: document.getElementById("inv-destination").value,
    period_start: document.getElementById("inv-period-start").value,
    period_end: document.getElementById("inv-period-end").value,
    items,
  };

  try {
    if (editingInvoiceId) {
      await api.updateInvoice(editingInvoiceId, payload);
    } else {
      await api.createInvoice(payload);
    }
    closeModal();
    loadInvoices();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
});

// ---------- Start ----------
initialRoute();