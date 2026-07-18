# Relatório de Auditoria — Invoice Manager

**Projeto:** `invoice-manager` (micro SaaS de registro de documentos / notas fiscais para contabilidade)
**Stack:** FastAPI + SQLAlchemy + PostgreSQL; frontend HTML/CSS/JS puro servido pelo próprio FastAPI.
**Data da auditoria:** 18/07/2026
**Escopo:** varredura de segurança, bugs de lógica, dependências (CVEs) e *code smells*.
**Natureza deste documento:** apenas diagnóstico. **Nenhuma correção foi aplicada** — cada achado traz uma sugestão descrita para você/seu irmão decidirem se e quando corrigir.

---

## 1. Resumo executivo

Foram encontrados **17 achados**. Os dois mais graves são **vazamento de segredos versionados no Git** (a chave que assina os tokens de login e a senha do banco de dados estão dentro do repositório). Esses dois pontos exigem ação imediata, independentemente do redesign.

| Severidade | Quantidade |
| --- | --- |
| 🔴 **Crítico** | 2 |
| 🟠 **Alto** | 3 |
| 🟡 **Médio** | 5 |
| 🔵 **Baixo** | 7 |
| **Total** | **17** |

**Prioridade número 1 (fazer já):** remover o `app/.env` e a senha do `docker-compose.yml` do histórico do Git **e trocar (rotacionar) tanto o `SECRET_KEY` quanto a senha do banco**, porque eles já foram expostos e devem ser considerados comprometidos.

**Pontos positivos observados** (o código não é ruim — ver seção 4): a autorização por usuário está correta (cada cliente só acessa as próprias notas), as queries usam ORM parametrizado (sem SQL injection), as senhas são armazenadas com hash bcrypt e a `SECRET_KEY` é lida de variável de ambiente (não está *hardcoded* no código-fonte `.py`).

---

## 2. Metodologia

- **Análise automatizada de dependências:** `pip-audit` (bases PyPI Advisory DB + OSV.dev) sobre as versões fixadas no `requirements.txt`.
  - *Observação técnica:* o `pip-audit` no modo padrão falhou porque tentou "buildar" o pacote `uvloop`, que não suporta Windows. Para contornar, as 58 dependências fixadas foram consultadas diretamente nas bases de vulnerabilidade (mesmas fontes que o `pip-audit` usa), sem instalar/compilar nada.
- **Análise estática de código:** `bandit` sobre a pasta `app/` (462 linhas).
- **Revisão manual (leitura de código):** autenticação/autorização, tratamento de erros, validação de entrada, tratamento de segredos, lógica de negócio e o frontend (`index.html`, `api.js`, `app.js`).

---

## 3. Achados

### 🔴 CRÍTICO

---

#### C-01 — Arquivo `.env` com segredos reais versionado no Git

- **Arquivo/linha:** `app/.env` (linhas 1–2), rastreado pelo Git (`git ls-files` confirma).
- **Descrição:** o arquivo `app/.env` está **commitado no repositório** e contém segredos de produção reais:
  - `SECRET_KEY=56465556c7c0093b606eddef9aa200e407a6773b92860a2df6ae58325cc7ebab` — esta é a chave usada para **assinar os tokens JWT de login** (`app/core/security.py`). Quem tiver essa chave consegue **forjar um token válido para qualquer cliente** (basta assinar um JWT com `sub` = id de qualquer usuário) e acessar as notas de qualquer um, sem senha.
  - `DATABASE_URL=postgresql://postgres:R4ph43lLim429@localhost:5432/invoice_manager` — expõe usuário e **senha do banco**.
- **Impacto:** comprometimento total da autenticação (personificação de qualquer cliente) e exposição das credenciais do banco. Qualquer pessoa com acesso ao repositório (ou ao histórico, mesmo que o arquivo seja removido depois) tem esses valores.
- **Sugestão de correção (não aplicada):**
  1. Remover `app/.env` do controle de versão (`git rm --cached app/.env`) e adicioná-lo ao `.gitignore`.
  2. **Rotacionar os segredos:** gerar um novo `SECRET_KEY` e trocar a senha do PostgreSQL — os valores atuais devem ser tratados como já vazados. Trocar o `SECRET_KEY` invalida os tokens existentes (todos precisarão logar de novo), o que é o comportamento desejado.
  3. Como o segredo está no **histórico** do Git, considerar reescrever o histórico (`git filter-repo` / BFG) se o repositório for/ficar público.

---

#### C-02 — Senha do PostgreSQL *hardcoded* no `docker-compose.yml` versionado

- **Arquivo/linha:** `docker-compose.yml`, linha 8 (`POSTGRES_PASSWORD: R4ph43lLim429`).
- **Descrição:** a senha do banco está escrita diretamente no `docker-compose.yml`, que está versionado. É a **mesma senha** presente no `app/.env` (C-01), reforçando o vazamento.
- **Impacto:** exposição da senha do banco no repositório; reutilização da mesma credencial em dois lugares aumenta a superfície de exposição.
- **Sugestão de correção (não aplicada):** substituir o valor por uma variável de ambiente (`POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`), lida de um `.env` **não versionado**, e rotacionar a senha (ver C-01).

---

### 🟠 ALTO

---

#### A-01 — Ausência de `.gitignore` (causa-raiz dos vazamentos)

- **Arquivo/linha:** raiz do projeto (não existe `.gitignore`).
- **Descrição:** o projeto não tem `.gitignore`. Por isso o `app/.env` (C-01) e a pasta de IDE `.idea/` acabaram versionados, e novos segredos correm o mesmo risco a cada commit.
- **Impacto:** vazamento recorrente de segredos e poluição do repositório com arquivos locais.
- **Sugestão de correção (não aplicada):** criar um `.gitignore` incluindo, no mínimo: `.env`, `app/.env`, `.idea/`, `__pycache__/`, `*.pyc`, `.venv/`.

---

#### A-02 — Sem limitação de tentativas (rate limiting) em login e cadastro

- **Arquivo/linha:** `app/api/v1/routers/auth.py` — `login` (linhas 21–33) e `register` (linhas 13–18).
- **Descrição:** os endpoints `/api/v1/auth/login` e `/api/v1/auth/register` não têm nenhum controle de taxa/tentativas. O login aceita tentativas ilimitadas.
- **Impacto:** permite **ataque de força bruta** de senha, **enumeração de e-mails** (a mensagem de registro "Email already registered" revela se um e-mail já existe) e abuso do cadastro (criação em massa de contas).
- **Sugestão de correção (não aplicada):** aplicar rate limiting (ex.: `slowapi`, ou limite no proxy/reverse proxy); padronizar mensagens para não confirmar existência de e-mail; opcionalmente adicionar bloqueio temporário após N falhas.

---

#### A-03 — Dependência `ecdsa 0.19.2` com CVE conhecida (CVE-2024-23342)

- **Arquivo/linha:** `requirements.txt` (`ecdsa==0.19.2`). Puxada transitivamente pelo `python-jose`.
- **Descrição:** identificado por `pip-audit` (PYSEC-2026-1325 / GHSA-wj6h-64fc-37mp / **CVE-2024-23342**). A biblioteca `python-ecdsa` é vulnerável a um ataque de temporização ("Minerva") na curva P-256, que pode permitir a extração da chave privada em operações de assinatura/ECDH. **Não há versão corrigida publicada** — o projeto `python-ecdsa` declara a proteção contra side-channel como fora de escopo.
- **Impacto no seu caso:** **baixo na prática**, porque a aplicação assina JWT com **HS256** (algoritmo simétrico, não usa ECDSA). O `ecdsa` entra apenas como dependência do `python-jose`. Ainda assim, é uma CVE presente na árvore de dependências e deve constar no inventário.
- **Sugestão de correção (não aplicada):** avaliar trocar o `python-jose` por `pyjwt` (mais mantido e sem essa dependência), ou garantir que ECDSA nunca seja usado. Documentar a CVE como aceita/mitigada caso se mantenha o `python-jose`.

---

### 🟡 MÉDIO

---

#### M-01 — XSS armazenado potencial no frontend (uso de `innerHTML` sem escapar dados)

- **Arquivo/linha:** `app/static/js/app.js` — `renderInvoiceCard` (linhas 119–131), `renderBalance` (linhas 150–153), `addItemRow` (linhas 230–236).
- **Descrição:** campos vindos do backend (`invoice.number`, `invoice.destination`, `item.company`, `item.description` etc.) são inseridos na página via `innerHTML` sem sanitização. Como esses campos são texto livre preenchido no cadastro, um valor como `<img src=x onerror=...>` seria executado ao renderizar a lista.
- **Impacto:** **médio-baixo** — cada cliente só vê os próprios dados, então na prática é *self-XSS* (a vítima seria o próprio autor). Torna-se mais relevante se, no futuro, um usuário (ex.: um admin da contabilidade) visualizar notas cadastradas por terceiros.
- **Sugestão de correção (não aplicada):** usar `textContent` em vez de `innerHTML` para conteúdo dinâmico, ou escapar os valores antes de interpolar. (Correção é **no frontend**, portanto dentro do escopo do redesign — mas só se você autorizar.)

---

#### M-02 — Token JWT armazenado em `localStorage`

- **Arquivo/linha:** `app/static/js/api.js` (linhas 11, 64, 69, 73).
- **Descrição:** o token de acesso é guardado em `localStorage`, acessível por qualquer JavaScript da página. Combinado com M-01, um XSS conseguiria ler o token.
- **Impacto:** roubo de sessão em caso de XSS.
- **Sugestão de correção (não aplicada):** idealmente usar cookie `HttpOnly`/`Secure` (isso exigiria mudança no backend — **fora do escopo sem autorização**). Como mitigação imediata dentro do frontend, corrigir M-01 reduz bastante o risco.

---

#### M-03 — Erro não tratado ao cadastrar CNPJ duplicado

- **Arquivo/linha:** `app/api/v1/routers/auth.py` (linhas 13–18) + `app/crud/client.py` (`create_client`) + `app/models/client.py` (`cnpj ... unique=True`).
- **Descrição:** o `register` verifica e-mail duplicado (retorna 400 amigável), mas **não** verifica CNPJ. Como `cnpj` tem restrição `unique` no banco, um CNPJ repetido dispara `IntegrityError` não tratado → resposta **500 Internal Server Error** em vez de uma mensagem clara. Há também uma pequena janela de condição de corrida no e-mail (duas requisições simultâneas passando na verificação antes do commit).
- **Impacto:** experiência ruim (erro 500) e possível vazamento de stack trace dependendo da configuração.
- **Sugestão de correção (não aplicada):** capturar `IntegrityError` no `create_client`/router e retornar 400 com mensagem clara ("CNPJ já cadastrado"); validar CNPJ antes de inserir.

---

#### M-04 — Falta de validação de valores e formatos nos dados de entrada

- **Arquivo/linha:** `app/schemas/invoice.py` (`amount`, `ReceivedAmountUpdate.received_amount`), `app/schemas/client.py` (`cnpj`, `zip_code`, `phone`).
- **Descrição:** não há validação de domínio: `amount` e `received_amount` aceitam valores **negativos**; `cnpj`, `cep` e `telefone` são strings livres sem validação de formato. Isso permite dados inconsistentes (ex.: nota com valor negativo, CNPJ inválido).
- **Impacto:** integridade de dados; cálculos de `total_amount`/`balance` podem ficar sem sentido.
- **Sugestão de correção (não aplicada):** usar validadores Pydantic (`condecimal(ge=0)`, `field_validator` para CNPJ/CEP). No frontend, o redesign pode adicionar máscaras e validação de formato (dentro do escopo, sem mudar as regras do backend).

---

#### M-05 — Sem política mínima de senha

- **Arquivo/linha:** `app/schemas/client.py` (`ClientCreate.password: str`).
- **Descrição:** a senha não tem tamanho mínimo nem requisitos. O próprio seed usa `"123456"`. Combinado com A-02 (sem rate limiting), facilita ataques de senha.
- **Impacto:** contas com senhas fracas.
- **Sugestão de correção (não aplicada):** exigir tamanho mínimo (ex.: ≥ 8) e, opcionalmente, complexidade, via validação no schema; reforçar também no frontend.

---

### 🔵 BAIXO

---

#### B-01 — Senha *hardcoded* no script de seed

- **Arquivo/linha:** `app/db/seed.py`, linha 24 (`"password": "123456"`). Detectado por `bandit` (B105 / CWE-259).
- **Descrição:** senha em texto puro no script de seed. É apenas para dados de teste (nunca salva em texto puro no banco — é feito hash), mas é uma má prática que pode ser copiada para produção.
- **Sugestão (não aplicada):** ler a senha do seed de variável de ambiente, ou deixar claro que é só para desenvolvimento.

---

#### B-02 — Arquivos de IDE (`.idea/`) versionados

- **Arquivo/linha:** `.idea/*`.
- **Descrição:** configurações locais do PyCharm/IntelliJ estão no repositório. Higiene de repositório.
- **Sugestão (não aplicada):** adicionar `.idea/` ao `.gitignore` e removê-los do versionamento.

---

#### B-03 — `passlib 1.7.4` desatualizada / risco de manutenção com `bcrypt`

- **Arquivo/linha:** `requirements.txt` (`passlib==1.7.4`, `bcrypt==4.0.1`).
- **Descrição:** o `passlib` 1.7.4 é de 2020 e está praticamente sem manutenção. Ele lê um atributo interno do `bcrypt` (`__about__`) que foi removido nas versões `bcrypt >= 4.1`, gerando avisos/erros de compatibilidade — por isso o `bcrypt` está fixado em `4.0.1`. Não é uma vulnerabilidade, mas é dívida técnica que trava atualizações de segurança do `bcrypt`.
- **Sugestão (não aplicada):** planejar migração para uma alternativa mantida (ex.: `bcrypt` diretamente, ou `argon2-cffi`).

---

#### B-04 — Dependência `dotenv==0.9.9` redundante/suspeita

- **Arquivo/linha:** `requirements.txt` (`dotenv==0.9.9` **e** `python-dotenv==1.2.2`).
- **Descrição:** o pacote `dotenv` (0.9.9) no PyPI é um *wrapper* placeholder que apenas depende do `python-dotenv` (o pacote correto, também presente). Manter os dois é confuso e é um pequeno risco de cadeia de suprimentos (nome parecido, manutenção duvidosa).
- **Sugestão (não aplicada):** remover `dotenv==0.9.9` e manter só `python-dotenv`.

---

#### B-05 — CORS não configurado (informativo)

- **Arquivo/linha:** `app/main.py` (nenhum middleware).
- **Descrição:** não há CORS configurado. Hoje isso é **seguro** porque o frontend é servido pelo próprio FastAPI (mesma origem). Registrado apenas para constar: se um dia o frontend for separado (outro domínio), será preciso configurar CORS de forma restrita (evitar `allow_origins=["*"]` com credenciais).
- **Sugestão (não aplicada):** manter como está enquanto for mesma origem; documentar a necessidade caso separe front/back.

---

#### B-06 — `update_invoice` faz `items.clear()` seguido de reatribuição

- **Arquivo/linha:** `app/crud/invoice.py`, `update_invoice` (as duas linhas: `invoice.items.clear()` e depois `invoice.items = [...]`).
- **Descrição:** o `clear()` seguido de reatribuir a lista é redundante e confuso. Funciona por causa do `cascade="all, delete-orphan"`, mas recria todos os itens a cada edição (perde os `id` dos itens). *Code smell*, não bug funcional.
- **Sugestão (não aplicada):** simplificar para uma única atribuição, ou fazer *diff* dos itens se preservar `id` for importante.

---

#### B-07 — Mensagens de erro em inglês numa aplicação em pt-BR

- **Arquivo/linha:** `app/api/v1/routers/auth.py` ("Email already registered", "Incorrect email or password"), `invoices.py` ("Invoice not found"), `deps.py` ("Invalid credentials").
- **Descrição:** as mensagens de erro da API estão em inglês, enquanto a interface é em português. O frontend exibe o `detail` diretamente ao usuário (`api.js`), gerando mensagens em inglês na UI.
- **Sugestão (não aplicada):** padronizar as mensagens em pt-BR (mudança no backend → **fora do escopo sem autorização**); alternativamente, o frontend pode mapear mensagens conhecidas para pt-BR.

---

## 4. Boas práticas observadas (para equilíbrio)

Nem tudo são problemas — vale registrar o que está bem feito:

- **Autorização correta (sem IDOR):** todas as operações de nota filtram por `client_id` (`app/crud/invoice.py` + `deps.get_current_client`). Um cliente não consegue ler/editar/excluir notas de outro.
- **Sem SQL injection:** todo acesso ao banco usa o ORM do SQLAlchemy com parâmetros; não há concatenação de SQL cru.
- **Senhas com hash forte:** uso de `bcrypt` via `passlib` (`app/core/security.py`); a senha em texto nunca é persistida.
- **Segredo fora do código-fonte `.py`:** o `SECRET_KEY` é lido de variável de ambiente (o problema é o `.env` ter sido versionado — C-01 —, não o código).
- **Schemas de saída seguros:** `ClientOut` não expõe `password_hash`.
- **Validação básica de e-mail:** uso de `EmailStr` no cadastro.

---

## 5. O que uma análise adicional cobriria

As ferramentas usadas (`pip-audit`, `bandit`) e a revisão manual cobrem bem segredos, CVEs de dependências e padrões inseguros comuns. Para uma auditoria mais profunda, complementariam:

- **`semgrep`** (com regras para FastAPI/Python) — detecção de padrões de segurança mais sofisticados e específicos de framework.
- **Teste dinâmico (DAST)** com a aplicação rodando — cabeçalhos de segurança HTTP ausentes, comportamento de erros em runtime, testes de brute force reais.
- **Análise de cobertura de testes** — os testes existentes (`tests/`) cobrem os fluxos principais, mas não medi cobertura; valeria verificar cenários de erro e autorização.
- **Revisão de logging/observabilidade** — o `sentry-sdk` está nas dependências mas não parece configurado; confirmar que erros não vazam dados sensíveis.

---

*Fim do relatório. Nenhuma alteração de código foi feita — todas as sugestões acima estão apenas descritas, aguardando sua decisão item a item.*
