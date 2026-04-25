// Seed inicial do GestorPrev
// Cria usuário supervisor + contrato Parangaba (Tipo A) + Klabin Monte Alegre (Tipo B)
// Uso: node scripts/seed.mjs   (lê .env.local automaticamente)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) {
  console.error('[seed] .env.local não encontrado em', envPath);
  process.exit(1);
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
  console.error('[seed] DATABASE_URL inválida — substitua [YOUR-PASSWORD] em .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SUPERVISOR_EMAIL = 'marcoslimacltech@gmail.com';
const SUPERVISOR_NOME = 'Marcos Lima';
const SUPERVISOR_SENHA_INICIAL = 'Trocar@2026';   // ⚠️ alterar no primeiro login

async function seed() {
  console.log('[seed] iniciando...');

  // 1. Usuário supervisor
  const hash = await bcrypt.hash(SUPERVISOR_SENHA_INICIAL, 12);
  await pool.query(
    `INSERT INTO usuarios (email, nome, senha_hash, perfil, contratos, criado_por)
     VALUES ($1, $2, $3, 'supervisor', '*', 'sistema')
     ON CONFLICT (email) DO NOTHING`,
    [SUPERVISOR_EMAIL, SUPERVISOR_NOME, hash]
  );
  console.log('[seed] supervisor:', SUPERVISOR_EMAIL, '(senha:', SUPERVISOR_SENHA_INICIAL + ')');

  // 2. Contrato Parangaba (Tipo A)
  await pool.query(
    `INSERT INTO contratos (id, nome, slug, tipo, has_categorias, campos_loja, campos_equipamento)
     VALUES ('parangaba', 'Shopping Parangaba', 'parangaba', 'A', true, $1::jsonb, $2::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      JSON.stringify([
        { key: 'identificador', label: 'LUC', tipo: 'text', fixo: true },
        { key: 'nome', label: 'Loja', tipo: 'text', fixo: true },
        { key: 'PISO', label: 'Piso', tipo: 'text' },
        { key: 'INTERLIGADA', label: 'Interligada', tipo: 'sim_nao' },
        { key: 'POSSUI MÓDULO', label: 'Possui módulo', tipo: 'sim_nao' },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: ['CONFORME','PENDÊNCIA','ALARME'], fixo: true },
        { key: 'data_manutencao', label: 'Data manutenção', tipo: 'date', fixo: true },
        { key: 'OBSERVAÇÃO', label: 'Observação', tipo: 'textarea' }
      ]),
      JSON.stringify([
        { key: 'identificador', label: 'ID', tipo: 'text', fixo: true },
        { key: 'tipo', label: 'Tipo Disp.', tipo: 'text', fixo: true },
        { key: 'categoria', label: 'Categoria', tipo: 'text', fixo: true },
        { key: 'piso', label: 'Piso', tipo: 'text', fixo: true },
        { key: 'LOCAL DE INSTALAÇÃO', label: 'Local instalação', tipo: 'text' },
        { key: 'data_manutencao', label: 'Data manut.', tipo: 'date', fixo: true },
        { key: 'data_recarga', label: 'Recarga', tipo: 'date', fixo: true },
        { key: 'data_th', label: 'Teste hidrostático', tipo: 'date', fixo: true },
        { key: 'OBS', label: 'Observação', tipo: 'textarea' }
      ])
    ]
  );
  console.log('[seed] contrato: parangaba (Tipo A)');

  // 3. Contrato Klabin (Tipo B)
  await pool.query(
    `INSERT INTO contratos (id, nome, slug, tipo, campos_ponto)
     VALUES ('klabin-monte-alegre', 'Klabin — Monte Alegre', 'klabin-monte-alegre', 'B', $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      JSON.stringify([
        { key: 'point_name', label: 'POINT NAME', tipo: 'text', fixo: true },
        { key: 'identificador', label: 'TAG', tipo: 'text', fixo: true },
        { key: 'CENTRAL', label: 'Central', tipo: 'text' },
        { key: 'DEVICE TYPE', label: 'Device Type', tipo: 'text' },
        { key: 'VISITA', label: 'Visita', tipo: 'select', opcoes: ['REALIZADA','PENDENTE'] },
        { key: 'DATA PRÓX MANUTENÇÃO', label: 'Próx. manutenção', tipo: 'date' },
        { key: 'data_manutencao', label: 'Última manut.', tipo: 'date', fixo: true },
        { key: 'status', label: 'Status', tipo: 'select', opcoes: ['CONFORME','PENDÊNCIA'], fixo: true },
        { key: 'OBSERVAÇÃO', label: 'Observação', tipo: 'textarea' }
      ])
    ]
  );
  console.log('[seed] contrato: klabin-monte-alegre (Tipo B)');

  await pool.end();
  console.log('[seed] ok');
}

seed().catch((err) => {
  console.error('[seed] falha:', err);
  process.exit(1);
});
