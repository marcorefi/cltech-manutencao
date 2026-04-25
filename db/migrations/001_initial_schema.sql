-- GestorPrev :: Schema inicial PostgreSQL
-- Migração das planilhas Google Sheets para banco relacional
-- Versão: 1.0  ·  Data: 2026-04-25

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- emails case-insensitive

-- ============================================================
-- TRIGGER: atualiza coluna atualizado_em em UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USUARIOS
-- Substitui CONFIG_USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  email          CITEXT PRIMARY KEY,
  nome           VARCHAR(255) NOT NULL,
  senha_hash     VARCHAR(255) NOT NULL,           -- bcrypt $2b$...
  perfil         VARCHAR(20)  NOT NULL CHECK (perfil IN ('supervisor','gestao','campo','cliente')),
  contratos      TEXT         DEFAULT '*',        -- '*' = todos, ou CSV de IDs
  ativo          BOOLEAN      DEFAULT true,
  criado_em      TIMESTAMPTZ  DEFAULT NOW(),
  criado_por     CITEXT,
  atualizado_em  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_usuarios_perfil ON usuarios(perfil) WHERE ativo = true;

CREATE TRIGGER usuarios_set_atualizado
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- CONTRATOS
-- Substitui CONFIG_CONTRATOS. Cada contrato define seu próprio
-- conjunto de campos via campos_loja/campos_ponto/campos_equipamento (JSONB).
-- ============================================================
CREATE TABLE contratos (
  id                   VARCHAR(50)  PRIMARY KEY,        -- ex: 'parangaba', 'klabin-monte-alegre'
  nome                 VARCHAR(255) NOT NULL,
  slug                 VARCHAR(100) UNIQUE NOT NULL,
  tipo                 VARCHAR(20)  NOT NULL CHECK (tipo IN ('A','B')),
  has_categorias       BOOLEAN      DEFAULT false,
  campos_loja          JSONB        DEFAULT '[]'::jsonb,
  campos_ponto         JSONB        DEFAULT '[]'::jsonb,
  campos_equipamento   JSONB        DEFAULT '[]'::jsonb,
  ativo                BOOLEAN      DEFAULT true,
  criado_em            TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_contratos_tipo ON contratos(tipo) WHERE ativo = true;

CREATE TRIGGER contratos_set_atualizado
  BEFORE UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- SESSOES
-- Substitui CONFIG_SESSOES. Token = uuid + assinatura HMAC.
-- ============================================================
CREATE TABLE sessoes (
  token         VARCHAR(255) PRIMARY KEY,
  email         CITEXT       NOT NULL REFERENCES usuarios(email) ON DELETE CASCADE,
  criado_em     TIMESTAMPTZ  DEFAULT NOW(),
  expira_em     TIMESTAMPTZ  NOT NULL,
  ip_address    INET,
  user_agent    TEXT
);
CREATE INDEX idx_sessoes_email  ON sessoes(email);
CREATE INDEX idx_sessoes_expira ON sessoes(expira_em);

-- ============================================================
-- LOJAS  (contratos Tipo A)
-- Substitui DADOS_LOJAS. Campos fixos = colunas; resto vai em dados (JSONB).
-- ============================================================
CREATE TABLE lojas (
  id               BIGSERIAL    PRIMARY KEY,
  contrato_id      VARCHAR(50)  NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  identificador    VARCHAR(100) NOT NULL,                -- "ID LOJA"
  nome             VARCHAR(255),                          -- "NOME LOJA"
  data_manutencao  DATE,
  status           VARCHAR(50),
  dados            JSONB        DEFAULT '{}'::jsonb,      -- demais campos dinâmicos
  criado_em        TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(contrato_id, identificador)
);
CREATE INDEX idx_lojas_contrato ON lojas(contrato_id);
CREATE INDEX idx_lojas_data     ON lojas(data_manutencao);
CREATE INDEX idx_lojas_dados    ON lojas USING GIN (dados);

CREATE TRIGGER lojas_set_atualizado
  BEFORE UPDATE ON lojas
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- PONTOS  (contratos Tipo B)
-- Substitui DADOS_PONTOS.
-- ============================================================
CREATE TABLE pontos (
  id               BIGSERIAL    PRIMARY KEY,
  contrato_id      VARCHAR(50)  NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  point_name       VARCHAR(255) NOT NULL,
  identificador    VARCHAR(100),
  data_manutencao  DATE,
  status           VARCHAR(50),
  dados            JSONB        DEFAULT '{}'::jsonb,
  criado_em        TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(contrato_id, point_name)
);
CREATE INDEX idx_pontos_contrato ON pontos(contrato_id);
CREATE INDEX idx_pontos_data     ON pontos(data_manutencao);
CREATE INDEX idx_pontos_dados    ON pontos USING GIN (dados);

CREATE TRIGGER pontos_set_atualizado
  BEFORE UPDATE ON pontos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- EQUIPAMENTOS
-- Substitui EQUIP SHOPPING. Pode pertencer a uma loja OU a um ponto.
-- ============================================================
CREATE TABLE equipamentos (
  id               BIGSERIAL    PRIMARY KEY,
  contrato_id      VARCHAR(50)  NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  loja_id          BIGINT       REFERENCES lojas(id)   ON DELETE CASCADE,
  ponto_id         BIGINT       REFERENCES pontos(id)  ON DELETE CASCADE,
  identificador    VARCHAR(100),                          -- ID EQUIPAMENTO
  tipo             VARCHAR(100),                          -- TIPO EQUIPAMENTO
  categoria        VARCHAR(100),
  piso             VARCHAR(50),
  data_recarga     DATE,
  data_th          DATE,                                  -- Teste hidrostático
  data_manutencao  DATE,
  status           VARCHAR(50),
  foto_url         TEXT,
  dados            JSONB        DEFAULT '{}'::jsonb,
  criado_em        TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ  DEFAULT NOW(),
  CONSTRAINT chk_equip_owner CHECK (loja_id IS NOT NULL OR ponto_id IS NOT NULL)
);
CREATE INDEX idx_equip_contrato ON equipamentos(contrato_id);
CREATE INDEX idx_equip_loja     ON equipamentos(loja_id)  WHERE loja_id  IS NOT NULL;
CREATE INDEX idx_equip_ponto    ON equipamentos(ponto_id) WHERE ponto_id IS NOT NULL;
CREATE INDEX idx_equip_recarga  ON equipamentos(data_recarga);
CREATE INDEX idx_equip_th       ON equipamentos(data_th);
CREATE INDEX idx_equip_dados    ON equipamentos USING GIN (dados);

CREATE TRIGGER equipamentos_set_atualizado
  BEFORE UPDATE ON equipamentos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- HISTORICO
-- Substitui HISTORICO. Audit trail técnico de manutenções.
-- ============================================================
CREATE TABLE historico (
  id              BIGSERIAL    PRIMARY KEY,
  ts              TIMESTAMPTZ  DEFAULT NOW(),
  contrato_id     VARCHAR(50)  REFERENCES contratos(id) ON DELETE SET NULL,
  usuario_email   CITEXT,
  acao            VARCHAR(100) NOT NULL,
  entidade_tipo   VARCHAR(50),                            -- 'loja','ponto','equipamento','usuario','contrato'
  entidade_id     VARCHAR(255),
  detalhes        JSONB        DEFAULT '{}'::jsonb,
  ip_address      INET
);
CREATE INDEX idx_hist_contrato ON historico(contrato_id, ts DESC);
CREATE INDEX idx_hist_usuario  ON historico(usuario_email, ts DESC);
CREATE INDEX idx_hist_entidade ON historico(entidade_tipo, entidade_id);

-- ============================================================
-- AUDITORIA_ACESSO  (LGPD)
-- Substitui aba AUDITORIA_ACESSO. Logs de login/logout/falhas.
-- Retenção: 12 meses, depois anonimização (cron job).
-- ============================================================
CREATE TABLE auditoria_acesso (
  id           BIGSERIAL    PRIMARY KEY,
  ts           TIMESTAMPTZ  DEFAULT NOW(),
  email        CITEXT,
  evento       VARCHAR(50)  NOT NULL,                    -- login_sucesso|login_falha|logout|bloqueio|token_invalido
  ip_address   INET,
  user_agent   TEXT,
  detalhes     JSONB        DEFAULT '{}'::jsonb
);
CREATE INDEX idx_audit_email   ON auditoria_acesso(email, ts DESC);
CREATE INDEX idx_audit_evento  ON auditoria_acesso(evento, ts DESC);
CREATE INDEX idx_audit_ts      ON auditoria_acesso(ts DESC);

-- ============================================================
-- BLOQUEIO_TENTATIVAS  (rate limiting persistente)
-- Substitui o uso de CacheService do Apps Script.
-- ============================================================
CREATE TABLE bloqueio_tentativas (
  email           CITEXT       PRIMARY KEY,
  tentativas      INT          DEFAULT 0,
  primeira_em     TIMESTAMPTZ  DEFAULT NOW(),
  bloqueado_ate   TIMESTAMPTZ
);
CREATE INDEX idx_bloqueio_ate ON bloqueio_tentativas(bloqueado_ate) WHERE bloqueado_ate IS NOT NULL;

-- ============================================================
-- VIEWS úteis (dashboards e supervisor)
-- ============================================================

-- Equipamentos com vencimento próximo (recarga ou TH em ≤ 30 dias)
CREATE VIEW equipamentos_a_vencer AS
SELECT
  e.id, e.contrato_id, c.nome AS contrato_nome,
  e.identificador, e.tipo, e.piso,
  e.data_recarga, e.data_th,
  CASE
    WHEN e.data_recarga IS NOT NULL AND e.data_recarga <= CURRENT_DATE + INTERVAL '30 days'
      THEN GREATEST(0, (e.data_recarga - CURRENT_DATE))
    WHEN e.data_th IS NOT NULL AND e.data_th <= CURRENT_DATE + INTERVAL '30 days'
      THEN GREATEST(0, (e.data_th - CURRENT_DATE))
    ELSE NULL
  END AS dias_restantes
FROM equipamentos e
JOIN contratos c ON c.id = e.contrato_id
WHERE
  (e.data_recarga IS NOT NULL AND e.data_recarga <= CURRENT_DATE + INTERVAL '30 days')
  OR
  (e.data_th IS NOT NULL AND e.data_th <= CURRENT_DATE + INTERVAL '30 days');

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE usuarios            IS 'Substitui aba CONFIG_USUARIOS. Senha em bcrypt.';
COMMENT ON TABLE contratos           IS 'Define schema dinâmico via JSONB de campos.';
COMMENT ON TABLE sessoes             IS 'Tokens HMAC-SHA256 com TTL de 8h.';
COMMENT ON TABLE lojas               IS 'Tipo A (lojas/shopping). Campos fixos + dados JSONB.';
COMMENT ON TABLE pontos              IS 'Tipo B (industrial/pontos). Campos fixos + dados JSONB.';
COMMENT ON TABLE equipamentos        IS 'Equipamentos pertencentes a loja OU ponto.';
COMMENT ON TABLE historico           IS 'Audit trail técnico (manutenções, alterações).';
COMMENT ON TABLE auditoria_acesso    IS 'Audit log LGPD (login, logout, falhas).';
COMMENT ON TABLE bloqueio_tentativas IS 'Rate limit: 5 tentativas / 15min = bloqueio 30min.';
