// app.js — lógica de interface (SPA de telas, sem framework)
// Consome os mesmos endpoints do FastAPI. Não altera o backend.

// ============================================================
// Helpers de DOM (construção segura — evita XSS por innerHTML)
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v != null) node.setAttribute(k, v);
    }
  }
  if (opts.on) {
    for (const [ev, fn] of Object.entries(opts.on)) node.addEventListener(ev, fn);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

// Ícone SVG inline (a partir do path)
function icon(path, cls = "ic") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  svg.appendChild(p);
  return svg;
}

const ICONS = {
  check: "M20 6 9 17l-5-5",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 16v-4m0-4h.01M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z",
  empty: "M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6",
  dash: "M12 5v14",
};

// ============================================================
// Formatação
// ============================================================
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function formatMoney(value) {
  const n = Number(value || 0);
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Situação de pagamento derivada de dado real (sem campo status no backend)
function paymentStatus(invoice) {
  if (invoice.received_amount === null || invoice.received_amount === undefined) {
    return { key: "sem", label: "Sem recebimento", cls: "badge-neutral", icon: ICONS.dash };
  }
  const balance = Number(invoice.balance);
  if (balance >= 0) {
    return { key: "quitada", label: "Quitada", cls: "badge-success", icon: ICONS.check };
  }
  return { key: "falta", label: "Falta pagar", cls: "badge-danger", icon: ICONS.alert };
}

// ============================================================
// Toasts
// ============================================================
function toast(message, type = "info", timeout = 3800) {
  const container = $("#toast-container");
  const path = type === "success" ? ICONS.check : type === "error" ? ICONS.alert : ICONS.info;
  const node = el("div", { class: `toast ${type}`, attrs: { role: "status" } }, [
    icon(path),
    el("span", { text: message }),
  ]);
  container.appendChild(node);
  const remove = () => {
    node.classList.add("leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  };
  setTimeout(remove, timeout);
}

// ============================================================
// Validação de formulários
// ============================================================
function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const box = $(`[data-error-for="${inputId}"]`);
  if (input) input.classList.toggle("invalid", Boolean(message));
  if (box) box.textContent = message || "";
}

function clearErrors(form) {
  $$(".field-error", form).forEach((b) => (b.textContent = ""));
  $$("input.invalid", form).forEach((i) => i.classList.remove("invalid"));
}

// ============================================================
// Navegação entre telas
// ============================================================
const authLayer = $("#auth-layer");
const appShell = $("#app-shell");

function showAuth(screen) {
  authLayer.classList.remove("hidden");
  appShell.classList.add("hidden");
  $$("[data-auth-screen]").forEach((s) => s.classList.add("hidden"));
  const target = document.getElementById(`${screen}-screen`);
  if (target) target.classList.remove("hidden");
}

const PANEL_BY_VIEW = {
  dashboard: "dashboard-view",
  "consultar-list": "dashboard-view",
  cadastrar: "cadastrar-view",
  detail: "consultar-view",
};

function showPanel(panelId) {
  $$("[data-view-panel]").forEach((p) => p.classList.add("hidden"));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.remove("hidden");
}

function setActiveNav(view) {
  $$(".sidebar-nav .nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
}

function closeMobileNav() {
  appShell.classList.remove("nav-open");
  $("#sidebar-backdrop").classList.add("hidden");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
}

function goView(view) {
  authLayer.classList.add("hidden");
  appShell.classList.remove("hidden");
  setActiveNav(view);
  showPanel(PANEL_BY_VIEW[view] || "dashboard-view");
  closeMobileNav();

  if (view === "dashboard" || view === "consultar-list") {
    loadInvoices();
  } else if (view === "cadastrar") {
    resetInvoiceForm();
  }
}

// ============================================================
// Estado da listagem (para busca/filtro no client)
// ============================================================
let allInvoices = [];

function renderListState({ mode, message }) {
  const box = $("#list-state");
  const table = $(".data-table");
  box.textContent = "";
  box.classList.remove("hidden");
  table.classList.add("hidden");

  if (mode === "loading") {
    box.classList.add("hidden");
    table.classList.remove("hidden");
    const tbody = $("#invoices-tbody");
    tbody.textContent = "";
    for (let i = 0; i < 3; i++) {
      const tr = el("tr");
      const td = el("td", { attrs: { colspan: "5" } }, [el("div", { class: "skeleton-row" })]);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    return;
  }

  const iconPath = mode === "error" ? ICONS.alert : ICONS.empty;
  box.appendChild(el("div", { class: "state-ic" }, [icon(iconPath)]));
  box.appendChild(el("h3", { text: mode === "error" ? "Não foi possível carregar" : "Nenhuma nota por aqui" }));
  box.appendChild(el("p", { text: message }));
  if (mode === "error") {
    box.appendChild(el("button", { class: "btn btn-secondary", text: "Tentar de novo", on: { click: loadInvoices } }));
  } else {
    box.appendChild(el("button", { class: "btn btn-primary", text: "+ Cadastrar nota", on: { click: () => goView("cadastrar") } }));
  }
}

async function loadInvoices() {
  renderListState({ mode: "loading" });
  try {
    allInvoices = await api.listInvoices();
    applyFilters();
  } catch (err) {
    renderListState({ mode: "error", message: err.message });
  }
}

function applyFilters() {
  const term = $("#search-input").value.trim().toLowerCase();
  const status = $("#status-filter").value;

  const filtered = allInvoices.filter((inv) => {
    const matchesTerm =
      !term ||
      String(inv.number).toLowerCase().includes(term) ||
      String(inv.destination).toLowerCase().includes(term) ||
      String(inv.id).includes(term);
    const matchesStatus = !status || paymentStatus(inv).key === status;
    return matchesTerm && matchesStatus;
  });

  renderTable(filtered);
}

function renderTable(invoices) {
  const box = $("#list-state");
  const table = $(".data-table");
  const tbody = $("#invoices-tbody");
  tbody.textContent = "";

  if (invoices.length === 0) {
    const emptyMsg = allInvoices.length === 0
      ? "Cadastre a primeira nota fiscal para começar."
      : "Nenhuma nota corresponde à busca/filtro.";
    renderListState({ mode: "empty", message: emptyMsg });
    return;
  }

  box.classList.add("hidden");
  table.classList.remove("hidden");

  invoices.forEach((inv) => {
    const st = paymentStatus(inv);

    const nameCell = el("td", { class: "cell-name", attrs: { "data-label": "Nome da nota" } }, [
      document.createTextNode(inv.destination || `Nota ${inv.number}`),
      el("small", { text: `Nº ${inv.number} • ${inv.items.length} item(ns) • ${formatMoney(inv.total_amount)}` }),
    ]);

    const badge = el("span", { class: `badge ${st.cls}` }, [icon(st.icon), el("span", { text: st.label })]);

    const consultarBtn = el("button", {
      class: "btn btn-secondary",
      text: "Consultar",
      on: { click: () => openDetail(inv.id) },
    });

    const tr = el("tr", {}, [
      el("td", { class: "cell-id", text: String(inv.id), attrs: { "data-label": "ID" } }),
      nameCell,
      el("td", { text: `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}`, attrs: { "data-label": "Período" } }),
      el("td", { attrs: { "data-label": "Situação" } }, [badge]),
      el("td", { class: "col-actions", attrs: { "data-label": "Ações" } }, [consultarBtn]),
    ]);
    tbody.appendChild(tr);
  });
}

// ============================================================
// Detalhe / Consultar nota
// ============================================================
async function openDetail(id) {
  goViewRaw("detail");
  const body = $("#detail-body");
  body.textContent = "";
  body.appendChild(el("div", { class: "list-state" }, [el("div", { class: "spinner" }), el("p", { text: "Carregando nota..." })]));

  try {
    const inv = await api.getInvoice(id);
    renderDetail(inv);
  } catch (err) {
    body.textContent = "";
    body.appendChild(el("div", { class: "list-state" }, [
      el("div", { class: "state-ic" }, [icon(ICONS.alert)]),
      el("h3", { text: "Não foi possível abrir a nota" }),
      el("p", { text: err.message }),
      el("button", { class: "btn btn-secondary", text: "Voltar", on: { click: () => goView("dashboard") } }),
    ]));
  }
}

// Navega para um painel sem recarregar lista (usado pelo detalhe)
function goViewRaw(view) {
  authLayer.classList.add("hidden");
  appShell.classList.remove("hidden");
  setActiveNav("consultar-list");
  showPanel(PANEL_BY_VIEW[view]);
  closeMobileNav();
}

function summaryItem(k, v, big = false) {
  return el("div", { class: "detail-item" }, [
    el("div", { class: "k", text: k }),
    el("div", { class: `v${big ? " big" : ""}`, text: v }),
  ]);
}

function renderDetail(inv) {
  $("#detail-title").textContent = `Nota nº ${inv.number}`;
  const st = paymentStatus(inv);
  const body = $("#detail-body");
  body.textContent = "";

  // Resumo
  const summary = el("div", { class: "detail-summary" }, [
    summaryItem("Operação / Destino", inv.destination),
    summaryItem("Modelo", inv.model),
    summaryItem("Período", `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}`),
    summaryItem("Valor da nota", formatMoney(inv.total_amount), true),
    summaryItem("Recebido", inv.received_amount == null ? "Não informado" : formatMoney(inv.received_amount)),
    el("div", { class: "detail-item" }, [
      el("div", { class: "k", text: "Situação" }),
      el("div", { class: "v" }, [el("span", { class: `badge ${st.cls}` }, [icon(st.icon), el("span", { text: st.label })])]),
    ]),
  ]);
  body.appendChild(summary);

  // Ações
  body.appendChild(el("div", { class: "detail-actions" }, [
    el("button", { class: "btn btn-primary", text: "Registrar recebimento", on: { click: () => openReceivedModal(inv) } }),
    el("button", { class: "btn btn-secondary", text: "Editar", on: { click: () => openEdit(inv) } }),
    el("button", { class: "btn btn-danger-soft", text: "Excluir", on: { click: () => handleDelete(inv) } }),
  ]));

  // Tabela de itens
  const itemsTable = el("table", { class: "data-table" });
  const thead = el("thead", {}, [el("tr", {}, [
    el("th", { text: "Data" }),
    el("th", { text: "Empresa" }),
    el("th", { text: "Descrição" }),
    el("th", { text: "Chave NF" }),
    el("th", { text: "Valor" }),
  ])]);
  const tbody = el("tbody");
  inv.items.forEach((it) => {
    tbody.appendChild(el("tr", {}, [
      el("td", { text: formatDate(it.date), attrs: { "data-label": "Data" } }),
      el("td", { text: it.company, attrs: { "data-label": "Empresa" } }),
      el("td", { text: it.description, attrs: { "data-label": "Descrição" } }),
      el("td", { text: it.invoice_key || "—", attrs: { "data-label": "Chave NF" } }),
      el("td", { text: formatMoney(it.amount), attrs: { "data-label": "Valor" } }),
    ]));
  });
  itemsTable.appendChild(thead);
  itemsTable.appendChild(tbody);
  body.appendChild(el("h2", { class: "section-title", text: "Itens" }));
  body.appendChild(itemsTable);
}

async function handleDelete(inv) {
  if (!confirm(`Excluir a nota nº ${inv.number}? Esta ação não pode ser desfeita.`)) return;
  try {
    await api.deleteInvoice(inv.id);
    toast("Nota excluída.", "success");
    goView("dashboard");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ============================================================
// Modal: registrar recebimento
// ============================================================
const receivedModal = $("#received-modal");
let receivedTarget = null;

function openReceivedModal(inv) {
  receivedTarget = inv;
  $("#received-sub").textContent = `Nota nº ${inv.number} • Valor: ${formatMoney(inv.total_amount)}`;
  const input = $("#received-input");
  input.value = inv.received_amount != null ? Mask.money(String(Math.round(inv.received_amount * 100))) : "";
  setFieldError("received-input", "");
  receivedModal.classList.remove("hidden");
  input.focus();
}

function closeReceivedModal() {
  receivedModal.classList.add("hidden");
  receivedTarget = null;
}

$("#received-cancel").addEventListener("click", closeReceivedModal);
receivedModal.addEventListener("click", (e) => {
  if (e.target === receivedModal) closeReceivedModal();
});

$("#received-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = Mask.moneyToNumber($("#received-input").value);
  if (isNaN(value) || value < 0) {
    setFieldError("received-input", "Informe um valor válido (≥ 0).");
    return;
  }
  try {
    await api.updateReceivedAmount(receivedTarget.id, value);
    toast("Recebimento registrado.", "success");
    const id = receivedTarget.id;
    closeReceivedModal();
    openDetail(id);
  } catch (err) {
    setFieldError("received-input", err.message);
  }
});

// ============================================================
// Formulário de nota (criar / editar) + itens repetíveis
// ============================================================
const invoiceForm = $("#invoice-form");
const itemsContainer = $("#items-container");
let editingInvoiceId = null;

function resetInvoiceForm() {
  editingInvoiceId = null;
  invoiceForm.reset();
  $("#invoice-id").value = "";
  $("#inv-model").value = "F1";
  $("#cadastrar-title").textContent = "Cadastro De Notas";
  $("#submit-invoice-btn").textContent = "Enviar";
  clearErrors(invoiceForm);
  $("#invoice-form-error").classList.add("hidden");
  itemsContainer.textContent = "";
  addItemRow();
  updateItemsTotal();
}

function addItemRow(item = {}) {
  const mk = (cls, attrs, value) =>
    el("input", { class: cls, attrs, on: { input: updateItemsTotal } });

  const dateInput = mk("item-date", { type: "date", required: "" });
  dateInput.value = item.date || "";
  const companyInput = mk("item-company", { type: "text", placeholder: "Empresa", required: "" });
  companyInput.value = item.company || "";
  const descInput = mk("item-description", { type: "text", placeholder: "Descrição", required: "" });
  descInput.value = item.description || "";
  const keyInput = mk("item-key", { type: "text", placeholder: "Chave NF (opcional)" });
  keyInput.value = item.invoice_key || "";
  const amountInput = mk("item-amount", { type: "text", inputmode: "decimal", placeholder: "Valor", required: "" });
  amountInput.value = item.amount != null ? Mask.money(String(Math.round(Number(item.amount) * 100))) : "";
  amountInput.addEventListener("input", () => {
    amountInput.value = Mask.money(amountInput.value);
    updateItemsTotal();
  });

  const removeBtn = el("button", {
    class: "item-remove",
    attrs: { type: "button", title: "Remover item", "aria-label": "Remover item" },
    text: "✕",
    on: {
      click: () => {
        row.remove();
        updateItemsTotal();
      },
    },
  });

  const row = el("div", { class: "item-row" }, [dateInput, companyInput, descInput, keyInput, amountInput, removeBtn]);
  itemsContainer.appendChild(row);
  updateItemsTotal();
}

function collectItems() {
  return $$(".item-row", itemsContainer).map((row) => ({
    date: $(".item-date", row).value,
    company: $(".item-company", row).value.trim(),
    description: $(".item-description", row).value.trim(),
    invoice_key: $(".item-key", row).value.trim() || null,
    amount: Mask.moneyToNumber($(".item-amount", row).value),
    _row: row,
  }));
}

function updateItemsTotal() {
  const total = collectItems().reduce((sum, it) => sum + (isNaN(it.amount) ? 0 : it.amount), 0);
  $("#items-total").textContent = formatMoney(total);
}

function openEdit(inv) {
  goView("cadastrar");
  editingInvoiceId = inv.id;
  $("#invoice-id").value = inv.id;
  $("#cadastrar-title").textContent = "Editar Nota";
  $("#submit-invoice-btn").textContent = "Salvar alterações";
  $("#inv-number").value = inv.number;
  $("#inv-destination").value = inv.destination;
  $("#inv-model").value = inv.model || "F1";
  $("#inv-period-start").value = inv.period_start;
  $("#inv-period-end").value = inv.period_end;
  itemsContainer.textContent = "";
  if (inv.items.length === 0) addItemRow();
  else inv.items.forEach((it) => addItemRow(it));
  updateItemsTotal();
}

function validateInvoice(header, items) {
  clearErrors(invoiceForm);
  let ok = true;

  if (!Validate.required(header.number)) { setFieldError("inv-number", "Informe o número."); ok = false; }
  if (!Validate.required(header.destination)) { setFieldError("inv-destination", "Informe a operação/destino."); ok = false; }
  if (!Validate.required(header.period_start)) { setFieldError("inv-period-start", "Informe o início."); ok = false; }
  if (!Validate.required(header.period_end)) { setFieldError("inv-period-end", "Informe o fim."); ok = false; }
  if (header.period_start && header.period_end && header.period_end < header.period_start) {
    setFieldError("inv-period-end", "O fim não pode ser antes do início."); ok = false;
  }

  if (items.length === 0) {
    showFormError("Adicione ao menos um item à nota.");
    ok = false;
  }
  items.forEach((it) => {
    const invalid =
      !Validate.required(it.date) ||
      !Validate.required(it.company) ||
      !Validate.required(it.description) ||
      isNaN(it.amount) || it.amount < 0;
    $$("input", it._row).forEach((inp) => {
      const isAmount = inp.classList.contains("item-amount");
      const bad =
        (inp.hasAttribute("required") && !inp.value.trim()) ||
        (isAmount && (isNaN(it.amount) || it.amount < 0));
      inp.classList.toggle("invalid", Boolean(bad));
    });
    if (invalid) ok = false;
  });
  if (items.some((it) => isNaN(it.amount) || it.amount < 0)) {
    showFormError("Cada item precisa de um valor válido (≥ 0).");
  }
  return ok;
}

function showFormError(msg) {
  const box = $("#invoice-form-error");
  box.textContent = msg;
  box.classList.remove("hidden");
}

$("#add-item-btn").addEventListener("click", () => addItemRow());
$("#cancel-cadastro-btn").addEventListener("click", () => goView("dashboard"));

invoiceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#invoice-form-error").classList.add("hidden");

  const header = {
    number: $("#inv-number").value.trim(),
    destination: $("#inv-destination").value.trim(),
    model: $("#inv-model").value.trim() || "F1",
    period_start: $("#inv-period-start").value,
    period_end: $("#inv-period-end").value,
  };
  const items = collectItems();

  if (!validateInvoice(header, items)) {
    toast("Confira os campos destacados.", "error");
    return;
  }

  const payload = {
    ...header,
    items: items.map(({ date, company, description, invoice_key, amount }) => ({
      date,
      company,
      description,
      invoice_key,
      amount,
    })),
  };

  const btn = $("#submit-invoice-btn");
  btn.disabled = true;
  try {
    if (editingInvoiceId) {
      await api.updateInvoice(editingInvoiceId, payload);
      toast("Nota atualizada.", "success");
    } else {
      await api.createInvoice(payload);
      toast("Nota cadastrada.", "success");
    }
    goView("dashboard");
  } catch (err) {
    showFormError(err.message);
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Auth: login / registro / recuperar senha
// ============================================================
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors($("#login-screen"));
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  let ok = true;
  if (!Validate.email(email)) { setFieldError("login-email", "E-mail inválido."); ok = false; }
  if (!Validate.required(password)) { setFieldError("login-password", "Informe a senha."); ok = false; }
  if (!ok) return;

  try {
    await api.login(email, password);
    e.target.reset();
    goView("dashboard");
  } catch (err) {
    setFieldError("login-password", err.message);
  }
});

$("#register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = $("#register-screen");
  clearErrors(form);

  const payload = {
    company_name: $("#reg-company").value.trim(),
    cnpj: $("#reg-cnpj").value.trim(),
    email: $("#reg-email").value.trim(),
    phone: $("#reg-phone").value.trim() || null,
    address: $("#reg-address").value.trim() || null,
    zip_code: $("#reg-zip").value.trim() || null,
    password: $("#reg-password").value,
  };

  let ok = true;
  if (!Validate.required(payload.company_name)) { setFieldError("reg-company", "Informe a razão social."); ok = false; }
  if (!Validate.cnpj(payload.cnpj)) { setFieldError("reg-cnpj", "CNPJ inválido."); ok = false; }
  if (!Validate.email(payload.email)) { setFieldError("reg-email", "E-mail inválido."); ok = false; }
  if (payload.phone && !Validate.phone(payload.phone)) { setFieldError("reg-phone", "Telefone incompleto."); ok = false; }
  if (payload.zip_code && !Validate.cep(payload.zip_code)) { setFieldError("reg-zip", "CEP incompleto."); ok = false; }
  if (String(payload.password).length < 6) { setFieldError("reg-password", "Mínimo de 6 caracteres."); ok = false; }
  if (!ok) return;

  try {
    await api.register(payload);
    e.target.reset();
    toast("Conta criada! Faça login.", "success");
    showAuth("login");
  } catch (err) {
    setFieldError("reg-email", err.message);
  }
});

// Recuperar senha — STUB: o backend não expõe endpoint de recuperação.
$("#forgot-form").addEventListener("submit", (e) => {
  e.preventDefault();
  clearErrors($("#forgot-screen"));
  const email = $("#forgot-email").value.trim();
  if (!Validate.email(email)) {
    setFieldError("forgot-email", "E-mail inválido.");
    return;
  }
  const note = $("#forgot-note");
  note.textContent =
    "Recuperação de senha ainda não está disponível no sistema. Entre em contato com o suporte da contabilidade para redefinir seu acesso.";
  note.classList.remove("hidden");
});

// ============================================================
// Navegação: sidebar, links de auth, logout, menu mobile
// ============================================================
$$("[data-goto]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showAuth(link.dataset.goto);
    $("#forgot-note")?.classList.add("hidden");
  });
});

$$(".sidebar-nav .nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    goView(item.dataset.view);
  });
});

$$("[data-view].btn-back, .btn-back[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => goView(btn.dataset.view));
});

$("#logout-btn").addEventListener("click", () => {
  api.logout();
  allInvoices = [];
  showAuth("login");
});

// Menu mobile
$("#menu-toggle").addEventListener("click", () => {
  const open = appShell.classList.toggle("nav-open");
  $("#sidebar-backdrop").classList.toggle("hidden", !open);
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
});
$("#sidebar-backdrop").addEventListener("click", closeMobileNav);

// Fecha modal/menu com Esc
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!receivedModal.classList.contains("hidden")) closeReceivedModal();
  closeMobileNav();
});

// Busca e filtro
$("#search-input").addEventListener("input", applyFilters);
$("#status-filter").addEventListener("change", applyFilters);

// ============================================================
// Inicialização
// ============================================================
Mask.bind(document);

function initialRoute() {
  if (api.isLoggedIn()) {
    goView("dashboard");
  } else {
    showAuth("login");
  }
}

initialRoute();
