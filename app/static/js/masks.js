// masks.js — máscaras de input e validação (somente frontend)
// Não altera regras do backend; apenas melhora a entrada de dados.

const Mask = {
  onlyDigits(v) {
    return (v || "").replace(/\D/g, "");
  },

  cnpj(v) {
    return this.onlyDigits(v)
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  },

  cep(v) {
    return this.onlyDigits(v)
      .slice(0, 8)
      .replace(/^(\d{5})(\d)/, "$1-$2");
  },

  phone(v) {
    const d = this.onlyDigits(v).slice(0, 11);
    if (d.length <= 10) {
      return d
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  },

  // Máscara monetária: mantém sempre 2 casas, separador brasileiro.
  money(v) {
    const d = this.onlyDigits(v);
    if (!d) return "";
    const number = (parseInt(d, 10) / 100).toFixed(2);
    return number
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  },

  // Converte texto mascarado "1.234,56" -> número 1234.56
  moneyToNumber(v) {
    if (v === null || v === undefined || v === "") return NaN;
    const normalized = String(v).replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  },

  apply(input) {
    const type = input.dataset.mask;
    if (!type || typeof this[type] !== "function") return;
    input.value = this[type](input.value);
  },

  // Liga a máscara a todos os inputs com [data-mask] dentro de um container.
  bind(container = document) {
    container.querySelectorAll("[data-mask]").forEach((input) => {
      if (input.dataset.maskBound) return;
      input.dataset.maskBound = "1";
      input.addEventListener("input", () => this.apply(input));
    });
  },
};

const Validate = {
  cnpj(value) {
    const d = Mask.onlyDigits(value);
    if (d.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(d)) return false; // todos iguais

    const calc = (base) => {
      let factor = base.length - 7;
      let sum = 0;
      for (let i = 0; i < base.length; i++) {
        sum += Number(base[i]) * factor;
        factor = factor === 2 ? 9 : factor - 1;
      }
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };

    const d1 = calc(d.slice(0, 12));
    const d2 = calc(d.slice(0, 12) + d1);
    return d === d.slice(0, 12) + String(d1) + String(d2);
  },

  cep(value) {
    return Mask.onlyDigits(value).length === 8;
  },

  phone(value) {
    const len = Mask.onlyDigits(value).length;
    return len === 10 || len === 11;
  },

  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
  },

  required(value) {
    return String(value || "").trim().length > 0;
  },
};
