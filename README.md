# CLTECH Fire — Sistema de Gestão de Contratos de Manutenção

Sistema web multi-contrato para gestão de manutenção preventiva/corretiva de SDAI (e outros serviços como bombas, iluminação, extintores).

## Arquitetura

- **Frontend:** HTML + CSS + JS puro (sem build), hospedado no GitHub Pages
- **Backend:** Google Apps Script (Web App) conectado ao Google Sheets
- **Storage:** Google Sheets (dados) + Google Drive (fotos)
- **Auth:** SHA-256 + token de sessão (8h)
- **LGPD:** Conforme Lei nº 13.709/2018

## Estrutura

```
Dashboard contratos de manutenção/
├── index.html          → Tela de login
├── supervisor.html     → Painel supervisor/gestão (usuários, contratos)
├── campo.html          → Interface técnico (mobile-first)
├── cliente.html        → Dashboard somente leitura (cliente)
├── dashboard.html      → Dashboard gerencial completo
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── config.js   → Config global
│   │   ├── api.js      → Cliente da API
│   │   ├── auth.js     → Sessão e header
│   │   └── utils.js    → Utilitários
│   └── img/
│       ├── cltech-shield.png      → Escudo vermelho (transparente)
│       ├── cltech-horizontal.png  → Logo horizontal
│       └── cltech-vertical.png    → Logo vertical
├── apps-script/
│   └── Code.gs         → Backend (copiar para script.google.com)
└── tests/              → Testes automatizados
```

## Perfis de usuário

| Perfil | Página pós-login | Permissões |
|--------|------------------|------------|
| `supervisor` | `supervisor.html` | Acesso total (usuários, contratos, dashboards) |
| `gestao` | `supervisor.html` | Gerencia contratos + dashboards |
| `campo` | `campo.html` | Registra manutenções com foto |
| `cliente` | `cliente.html` | Dashboard somente leitura do seu contrato |

## Deploy em 3 passos

### 1️⃣ Deploy do Apps Script (2 min)

1. Abra <https://script.google.com> logado como `cltechinstalacoeseautomacao@gmail.com`
2. Novo projeto → cole o conteúdo de `apps-script/Code.gs`
3. **Executar → `initMasterSheet`** (cria abas CONFIG_USUARIOS, CONFIG_CONTRATOS, etc. + usuário supervisor inicial)
4. Autorize os escopos quando solicitado
5. **Deploy → Nova implantação → Tipo: App da Web**
   - Descrição: `CLTECH Manutenção v1.0`
   - Executar como: `Eu`
   - Quem tem acesso: `Qualquer pessoa`
6. Copie a URL `/exec` gerada

### 2️⃣ GitHub (2 min)

```bash
cd "Dashboard contratos de manutenção"
git init
git add .
git commit -m "feat: sistema CLTECH Manutenção v1.0"
git remote add origin https://github.com/<SEU_USER>/cltech-manutencao.git
git push -u origin main
```

Ative GitHub Pages: **Settings → Pages → Source: main / root → Save**

### 3️⃣ Configurar URL da API (30s)

Na primeira vez que abrir o site, clique em **Configurações avançadas** e cole a URL do Apps Script.

## Credenciais iniciais

- **Email:** `marcoslimacltech@gmail.com`
- **Senha:** `Fco@789963000`
- **Perfil:** `supervisor`

No primeiro login, crie os demais usuários pelo painel.

## Planilhas

**Master (Shopping Parangaba + configuração):**
- ID: `12MFGQegCkrVJrMrdvUlYZeJpoj-3zQS-V6CbCuHtW2U`
- Abas: `DADOS_LOJAS`, `CONFIG_USUARIOS`, `CONFIG_CONTRATOS`, `CONFIG_SESSOES`, `HISTORICO`

**Klabin (Tipo B):** criar após validação do MVP.

## Próximas fases

- **Fase 2:** Importar planilhas Klabin e outros Tipo B
- **Fase 3:** Service Worker + IndexedDB (offline)
- **Fase 4:** Integração WordPress CLTECH, perfil cliente, relatórios PDF, cronograma, notificações

## Suporte

- **Empresa:** CLTECH Fire — CNPJ 30.452.788/0001-38
- **Diretor:** Marcos Lima — marcoslima@cltechautomacao.com.br
- **Tel:** +55 85 99931-1823
