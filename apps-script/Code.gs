/**
 * CLTECH Fire - Sistema de Gestão de Contratos de Manutenção
 * Backend - Google Apps Script (Web App)
 * Versão: 1.0 (24/04/2026)
 * Autor: CLTECH Fire (via Claude Code)
 *
 * INSTRUÇÕES DE DEPLOY:
 * 1. Abrir https://script.google.com
 * 2. Novo projeto, colar este código
 * 3. Criar as abas de configuração: ver função initMasterSheet()
 * 4. Deploy > Nova implantação > Tipo: App da Web
 *    - Executar como: Eu (cltechinstalacoeseautomacao@gmail.com)
 *    - Acesso: Qualquer pessoa
 * 5. Autorizar os escopos solicitados
 * 6. Copiar a URL /exec gerada e colar no frontend (assets/js/api.js)
 */

// ========================================================================
// CONFIGURAÇÃO
// ========================================================================

const MASTER_SHEET_ID = '1ZJi9BAvgmuT4B-I2M80qZ6lXO6sBR_A43HGlfz0nVXw';
const PARANGABA_SHEET_ID = '12MFGQegCkrVJrMrdvUlYZeJpoj-3zQS-V6CbCuHtW2U';
const DRIVE_ROOT_FOLDER_NAME = 'Fotos SDAI - Sistema Manutencao';
const SESSION_TTL_HOURS = 8;

// Nomes das abas de configuração (na planilha master)
const SHEET_USUARIOS = 'CONFIG_USUARIOS';
const SHEET_CONTRATOS = 'CONFIG_CONTRATOS';
const SHEET_SESSOES = 'CONFIG_SESSOES';
const SHEET_HISTORICO = 'HISTORICO';
const SHEET_DADOS_LOJAS = 'DADOS_LOJAS';

// Headers das abas
const HEADERS_USUARIOS = ['email', 'nome', 'senhaHash', 'perfil', 'contratos', 'ativo', 'criadoEm', 'criadoPor'];
const HEADERS_CONTRATOS = ['id', 'nome', 'tipoServico', 'tipoContrato', 'planilhaId', 'abaDados', 'driveFolderId', 'ativo', 'criadoEm'];
const HEADERS_SESSOES = ['token', 'email', 'perfil', 'criadoEm', 'expiraEm'];
const HEADERS_HISTORICO = ['timestamp', 'contratoId', 'identificador', 'tecnico', 'acao', 'dados', 'fotoUrl'];

// Perfis permitidos
const PERFIS = ['supervisor', 'gestao', 'campo', 'cliente'];

// ========================================================================
// ROTEADOR - doGet e doPost
// ========================================================================

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const params = e.parameter || {};
    let body = {};

    if (method === 'POST' && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        body = {};
      }
    }

    // Merge query params with body (body prioridade)
    const data = Object.assign({}, params, body);
    const action = data.action || '';

    // Roteamento por ação
    let result;
    switch (action) {
      case 'ping':
        result = { ok: true, version: '1.0', timestamp: new Date().toISOString() };
        break;
      case 'init':
        result = initMasterSheet();
        break;
      case 'auth':
        result = handleAuth(data);
        break;
      case 'logout':
        result = handleLogout(data);
        break;
      case 'me':
        result = handleMe(data);
        break;
      case 'listarUsuarios':
        result = handleListarUsuarios(data);
        break;
      case 'criarUsuario':
        result = handleCriarUsuario(data);
        break;
      case 'atualizarUsuario':
        result = handleAtualizarUsuario(data);
        break;
      case 'removerUsuario':
        result = handleRemoverUsuario(data);
        break;
      case 'listarContratos':
        result = handleListarContratos(data);
        break;
      case 'criarContrato':
        result = handleCriarContrato(data);
        break;
      case 'obterContrato':
        result = handleObterContrato(data);
        break;
      case 'listarLojas':
        result = handleListarLojas(data);
        break;
      case 'obterLoja':
        result = handleObterLoja(data);
        break;
      case 'salvarLoja':
        result = handleSalvarLoja(data);
        break;
      case 'listarPontos':
        result = handleListarPontos(data);
        break;
      case 'obterPonto':
        result = handleObterPonto(data);
        break;
      case 'salvarPonto':
        result = handleSalvarPonto(data);
        break;
      case 'adicionarPonto':
        result = handleAdicionarPonto(data);
        break;
      case 'bulkInserirPontos':
        result = handleBulkInserirPontos(data);
        break;
      case 'initContratoSheet':
        result = handleInitContratoSheet(data);
        break;
      case 'notificacoes':
        result = handleNotificacoes(data);
        break;
      case 'migrarConfig':
        result = migrarConfigParaNovaPlanilha(data);
        break;
      case 'limparConfigAntiga':
        result = limparConfigAntiga(data);
        break;
      case 'dashboard':
        result = handleDashboard(data);
        break;
      case 'uploadFoto':
        result = handleUploadFoto(data);
        break;
      case 'historico':
        result = handleHistorico(data);
        break;
      default:
        result = { ok: false, error: 'Ação desconhecida: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message, stack: err.stack });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================================================
// INICIALIZAÇÃO DA PLANILHA MASTER
// ========================================================================

function initMasterSheet() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const created = [];

  // CONFIG_USUARIOS
  if (!ss.getSheetByName(SHEET_USUARIOS)) {
    const sheet = ss.insertSheet(SHEET_USUARIOS);
    sheet.appendRow(HEADERS_USUARIOS);
    sheet.getRange(1, 1, 1, HEADERS_USUARIOS.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    // Usuário supervisor inicial
    const hash = sha256('Fco@789963000');
    sheet.appendRow([
      'marcoslimacltech@gmail.com',
      'Marcos Lima',
      hash,
      'supervisor',
      '*',
      'SIM',
      new Date().toISOString(),
      'sistema'
    ]);
    created.push(SHEET_USUARIOS);
  }

  // CONFIG_CONTRATOS
  if (!ss.getSheetByName(SHEET_CONTRATOS)) {
    const sheet = ss.insertSheet(SHEET_CONTRATOS);
    sheet.appendRow(HEADERS_CONTRATOS);
    sheet.getRange(1, 1, 1, HEADERS_CONTRATOS.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    // Contrato inicial: Shopping Parangaba
    sheet.appendRow([
      'shopping-parangaba',
      'Shopping Parangaba',
      'SDAI',
      'A',
      MASTER_SHEET_ID,
      SHEET_DADOS_LOJAS,
      '',
      'SIM',
      new Date().toISOString()
    ]);
    created.push(SHEET_CONTRATOS);
  }

  // CONFIG_SESSOES
  if (!ss.getSheetByName(SHEET_SESSOES)) {
    const sheet = ss.insertSheet(SHEET_SESSOES);
    sheet.appendRow(HEADERS_SESSOES);
    sheet.getRange(1, 1, 1, HEADERS_SESSOES.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    created.push(SHEET_SESSOES);
  }

  // HISTORICO
  if (!ss.getSheetByName(SHEET_HISTORICO)) {
    const sheet = ss.insertSheet(SHEET_HISTORICO);
    sheet.appendRow(HEADERS_HISTORICO);
    sheet.getRange(1, 1, 1, HEADERS_HISTORICO.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    created.push(SHEET_HISTORICO);
  }

  // Criar pasta raiz no Drive
  let folderId = '';
  const folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    folderId = folders.next().getId();
  } else {
    const folder = DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
    folderId = folder.getId();
  }

  return { ok: true, created: created, driveFolderId: folderId, masterSheetId: MASTER_SHEET_ID };
}

// ========================================================================
// AUTENTICAÇÃO
// ========================================================================

function sha256(input) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function generateToken() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function handleAuth(data) {
  const email = (data.email || '').trim().toLowerCase();
  const senha = data.senha || '';

  if (!email || !senha) {
    return { ok: false, error: 'Email e senha obrigatórios' };
  }

  const user = findUser(email);
  if (!user) return { ok: false, error: 'Usuário não encontrado' };
  if (user.ativo !== 'SIM') return { ok: false, error: 'Usuário inativo' };

  const hash = sha256(senha);
  if (hash !== user.senhaHash) {
    return { ok: false, error: 'Senha incorreta' };
  }

  // Gera token e salva sessão
  const token = generateToken();
  const now = new Date();
  const expira = new Date(now.getTime() + SESSION_TTL_HOURS * 3600 * 1000);

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SESSOES);
  sheet.appendRow([token, email, user.perfil, now.toISOString(), expira.toISOString()]);

  return {
    ok: true,
    token: token,
    usuario: {
      email: user.email,
      nome: user.nome,
      perfil: user.perfil,
      contratos: user.contratos
    },
    expiraEm: expira.toISOString()
  };
}

function handleLogout(data) {
  const token = data.token || '';
  if (!token) return { ok: false, error: 'Token obrigatório' };

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SESSOES);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === token) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: true };
}

function handleMe(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;
  const user = findUser(session.email);
  if (!user) return { ok: false, error: 'Usuário não encontrado' };
  return {
    ok: true,
    usuario: {
      email: user.email,
      nome: user.nome,
      perfil: user.perfil,
      contratos: user.contratos
    }
  };
}

function validateToken(token) {
  if (!token) return { ok: false, error: 'Token ausente' };

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SESSOES);
  const values = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === token) {
      const expira = new Date(values[i][4]);
      if (expira < now) {
        sheet.deleteRow(i + 1);
        return { ok: false, error: 'Sessão expirada' };
      }
      return {
        ok: true,
        email: values[i][1],
        perfil: values[i][2],
        token: token
      };
    }
  }

  return { ok: false, error: 'Token inválido' };
}

function requirePerfil(session, perfis) {
  if (!session.ok) return session;
  if (perfis.indexOf(session.perfil) === -1) {
    return { ok: false, error: 'Sem permissão. Requer: ' + perfis.join(', ') };
  }
  return { ok: true };
}

function findUser(email) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === email.toLowerCase()) {
      return {
        row: i + 1,
        email: values[i][0],
        nome: values[i][1],
        senhaHash: values[i][2],
        perfil: values[i][3],
        contratos: values[i][4],
        ativo: values[i][5],
        criadoEm: values[i][6],
        criadoPor: values[i][7]
      };
    }
  }
  return null;
}

// ========================================================================
// GESTÃO DE USUÁRIOS (Supervisor)
// ========================================================================

function handleListarUsuarios(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);
  const values = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < values.length; i++) {
    users.push({
      email: values[i][0],
      nome: values[i][1],
      perfil: values[i][3],
      contratos: values[i][4],
      ativo: values[i][5],
      criadoEm: values[i][6]
    });
  }
  return { ok: true, usuarios: users };
}

function handleCriarUsuario(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = (data.email || '').trim().toLowerCase();
  const nome = (data.nome || '').trim();
  const senha = data.senha || '';
  const perfil = (data.perfil || '').trim();
  const contratos = data.contratos || '*';

  if (!email || !nome || !senha || !perfil) {
    return { ok: false, error: 'Campos obrigatórios: email, nome, senha, perfil' };
  }
  if (PERFIS.indexOf(perfil) === -1) {
    return { ok: false, error: 'Perfil inválido. Use: ' + PERFIS.join(', ') };
  }
  if (findUser(email)) {
    return { ok: false, error: 'Email já cadastrado' };
  }

  const hash = sha256(senha);
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);
  sheet.appendRow([email, nome, hash, perfil, contratos, 'SIM', new Date().toISOString(), session.email]);

  return { ok: true, usuario: { email: email, nome: nome, perfil: perfil, contratos: contratos } };
}

function handleAtualizarUsuario(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = (data.email || '').trim().toLowerCase();
  const user = findUser(email);
  if (!user) return { ok: false, error: 'Usuário não encontrado' };

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);

  if (data.nome !== undefined) sheet.getRange(user.row, 2).setValue(data.nome);
  if (data.senha) sheet.getRange(user.row, 3).setValue(sha256(data.senha));
  if (data.perfil !== undefined && PERFIS.indexOf(data.perfil) !== -1) sheet.getRange(user.row, 4).setValue(data.perfil);
  if (data.contratos !== undefined) sheet.getRange(user.row, 5).setValue(data.contratos);
  if (data.ativo !== undefined) sheet.getRange(user.row, 6).setValue(data.ativo);

  return { ok: true };
}

function handleRemoverUsuario(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = (data.email || '').trim().toLowerCase();
  if (email === session.email) return { ok: false, error: 'Não pode remover a si mesmo' };

  const user = findUser(email);
  if (!user) return { ok: false, error: 'Usuário não encontrado' };

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);
  sheet.deleteRow(user.row);
  return { ok: true };
}

// ========================================================================
// CONTRATOS
// ========================================================================

function handleListarContratos(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CONTRATOS);
  const values = sheet.getDataRange().getValues();

  const user = findUser(session.email);
  const userContratos = (user.contratos || '').toString();
  const allowedAll = userContratos === '*' || session.perfil === 'supervisor' || session.perfil === 'gestao';
  const allowedList = userContratos.split(',').map(function(s) { return s.trim(); });

  const contratos = [];
  for (let i = 1; i < values.length; i++) {
    const contrato = {
      id: values[i][0],
      nome: values[i][1],
      tipoServico: values[i][2],
      tipoContrato: values[i][3],
      planilhaId: values[i][4],
      abaDados: values[i][5],
      driveFolderId: values[i][6],
      ativo: values[i][7]
    };
    if (contrato.ativo !== 'SIM') continue;
    if (allowedAll || allowedList.indexOf(contrato.id) !== -1) {
      contratos.push(contrato);
    }
  }

  return { ok: true, contratos: contratos };
}

function handleCriarContrato(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const id = (data.id || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!id || !data.nome || !data.tipoServico || !data.tipoContrato) {
    return { ok: false, error: 'Campos obrigatórios: id, nome, tipoServico, tipoContrato' };
  }

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CONTRATOS);
  sheet.appendRow([
    id,
    data.nome,
    data.tipoServico,
    data.tipoContrato,
    data.planilhaId || MASTER_SHEET_ID,
    data.abaDados || 'DADOS',
    data.driveFolderId || '',
    'SIM',
    new Date().toISOString()
  ]);

  return { ok: true, id: id };
}

function handleObterContrato(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const id = data.id;
  const contrato = findContrato(id);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  return { ok: true, contrato: contrato };
}

function findContrato(id) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CONTRATOS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      return {
        id: values[i][0],
        nome: values[i][1],
        tipoServico: values[i][2],
        tipoContrato: values[i][3],
        planilhaId: values[i][4],
        abaDados: values[i][5],
        driveFolderId: values[i][6],
        ativo: values[i][7]
      };
    }
  }
  return null;
}

// ========================================================================
// TIPO A - LOJAS (Shopping)
// ========================================================================

function handleListarLojas(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const contrato = findContrato(data.contratoId || 'shopping-parangaba');
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };
  if (contrato.tipoContrato !== 'A') return { ok: false, error: 'Contrato não é tipo A (lojas)' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  if (!sheet) return { ok: false, error: 'Aba de dados não encontrada: ' + contrato.abaDados };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const lojas = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    headers.forEach(function(h, idx) { row[h] = values[i][idx]; });
    row._row = i + 1;
    lojas.push(row);
  }

  return { ok: true, headers: headers, lojas: lojas };
}

function handleObterLoja(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const contrato = findContrato(data.contratoId || 'shopping-parangaba');
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const lucIdx = headers.indexOf('LUC');
  const luc = String(data.luc || '').trim();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][lucIdx]).trim() === luc) {
      const row = {};
      headers.forEach(function(h, idx) { row[h] = values[i][idx]; });
      row._row = i + 1;

      // Buscar histórico
      row._historico = obterHistoricoPorIdentificador(contrato.id, luc);

      return { ok: true, loja: row, headers: headers };
    }
  }

  return { ok: false, error: 'Loja LUC=' + luc + ' não encontrada' };
}

function handleSalvarLoja(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId || 'shopping-parangaba');
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const lucIdx = headers.indexOf('LUC');
  const luc = String(data.luc || '').trim();

  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][lucIdx]).trim() === luc) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'Loja LUC=' + luc + ' não encontrada' };

  // Atualizar campos enviados
  const campos = data.campos || {};
  const alteracoes = [];
  Object.keys(campos).forEach(function(campo) {
    const colIdx = headers.indexOf(campo);
    if (colIdx !== -1) {
      const antigo = sheet.getRange(targetRow, colIdx + 1).getValue();
      const novo = campos[campo];
      if (String(antigo) !== String(novo)) {
        sheet.getRange(targetRow, colIdx + 1).setValue(novo);
        alteracoes.push({ campo: campo, de: antigo, para: novo });
      }
    }
  });

  // Foto (se enviada)
  let fotoUrl = '';
  if (data.foto && data.foto.base64) {
    const up = uploadFotoInternal(contrato, luc, data.foto);
    if (up.ok) fotoUrl = up.url;
  }

  // Registrar no histórico
  registrarHistorico({
    contratoId: contrato.id,
    identificador: luc,
    tecnico: session.email,
    acao: 'atualizar_loja',
    dados: JSON.stringify({ alteracoes: alteracoes, observacao: campos['OBSERVAÇÃO'] || '' }),
    fotoUrl: fotoUrl
  });

  return { ok: true, alteracoes: alteracoes, fotoUrl: fotoUrl };
}

// ========================================================================
// TIPO B - PONTOS (Industrial / Comercial)
// ========================================================================

function handleListarPontos(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };
  if (contrato.tipoContrato !== 'B') return { ok: false, error: 'Contrato não é tipo B (pontos)' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  if (!sheet) return { ok: false, error: 'Aba de dados não encontrada' };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, headers: values[0] || [], pontos: [] };

  const headers = values[0];
  const pontos = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    headers.forEach(function(h, idx) { row[h] = values[i][idx]; });
    row._row = i + 1;

    // Filtro opcional por central
    if (data.central && row['CENTRAL'] && String(row['CENTRAL']) !== String(data.central)) continue;

    pontos.push(row);
  }

  return { ok: true, headers: headers, pontos: pontos };
}

function handleObterPonto(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const nameIdx = headers.indexOf('POINT NAME');
  const pointName = String(data.pointName || '').trim();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameIdx]).trim() === pointName) {
      const row = {};
      headers.forEach(function(h, idx) { row[h] = values[i][idx]; });
      row._row = i + 1;
      row._historico = obterHistoricoPorIdentificador(contrato.id, pointName);
      return { ok: true, ponto: row, headers: headers };
    }
  }

  return { ok: false, error: 'Ponto não encontrado: ' + pointName };
}

function handleSalvarPonto(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const nameIdx = headers.indexOf('POINT NAME');
  const pointName = String(data.pointName || '').trim();

  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameIdx]).trim() === pointName) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'Ponto não encontrado: ' + pointName };

  const campos = data.campos || {};
  const alteracoes = [];
  Object.keys(campos).forEach(function(campo) {
    const colIdx = headers.indexOf(campo);
    if (colIdx !== -1) {
      const antigo = sheet.getRange(targetRow, colIdx + 1).getValue();
      const novo = campos[campo];
      if (String(antigo) !== String(novo)) {
        sheet.getRange(targetRow, colIdx + 1).setValue(novo);
        alteracoes.push({ campo: campo, de: antigo, para: novo });
      }
    }
  });

  let fotoUrl = '';
  if (data.foto && data.foto.base64) {
    const up = uploadFotoInternal(contrato, pointName, data.foto);
    if (up.ok) fotoUrl = up.url;
  }

  registrarHistorico({
    contratoId: contrato.id,
    identificador: pointName,
    tecnico: session.email,
    acao: 'manutencao_ponto',
    dados: JSON.stringify({ alteracoes: alteracoes, observacao: campos['OBSERVAÇÃO'] || campos['OBSERVACAO'] || '' }),
    fotoUrl: fotoUrl
  });

  return { ok: true, alteracoes: alteracoes, fotoUrl: fotoUrl };
}

// Migra as abas CONFIG_* + HISTORICO da planilha Parangaba para uma nova planilha em pasta restrita
function migrarConfigParaNovaPlanilha(data) {
  const session = data ? validateToken(data.token) : null;
  if (data && !session.ok) return session;
  if (data && session.perfil !== 'supervisor') return { ok: false, error: 'Apenas supervisor pode migrar' };

  // Buscar a pasta "DASHBOARD Manutenção - CLTECH" no Drive
  const folderName = 'DASHBOARD Manutenção - CLTECH';
  const folders = DriveApp.getFoldersByName(folderName);
  if (!folders.hasNext()) return { ok: false, error: 'Pasta "' + folderName + '" não encontrada no Drive' };
  const targetFolder = folders.next();

  // Cria nova planilha
  const newSS = SpreadsheetApp.create('CLTECH_Sistema_Config_Master_' + new Date().toISOString().substring(0,10));
  const newFile = DriveApp.getFileById(newSS.getId());
  newFile.moveTo(targetFolder);

  // Copia abas de config + historico da planilha atual para a nova
  const oldSS = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const toMigrate = [SHEET_USUARIOS, SHEET_CONTRATOS, SHEET_SESSOES, SHEET_HISTORICO];
  const copiadas = [];

  toMigrate.forEach(function(name) {
    const old = oldSS.getSheetByName(name);
    if (!old) return;
    const copy = old.copyTo(newSS);
    copy.setName(name);
    copiadas.push(name);
  });

  // Remove a aba default "Página1"/"Sheet1" da nova planilha se existir e há outras abas
  const sheets = newSS.getSheets();
  if (sheets.length > 1) {
    const first = sheets[0];
    const nm = first.getName();
    if (nm === 'Página1' || nm === 'Sheet1' || nm === 'Sheet 1') {
      newSS.deleteSheet(first);
    }
  }

  return { ok: true, newId: newSS.getId(), url: newSS.getUrl(), pasta: targetFolder.getName(), copiadas: copiadas };
}

// Remove as abas CONFIG_* + HISTORICO da planilha Parangaba (depois de migradas)
function limparConfigAntiga(data) {
  const session = data ? validateToken(data.token) : null;
  if (data && !session.ok) return session;
  if (data && session.perfil !== 'supervisor') return { ok: false, error: 'Apenas supervisor' };
  const parangabaId = data.parangabaId || '12MFGQegCkrVJrMrdvUlYZeJpoj-3zQS-V6CbCuHtW2U';
  const ss = SpreadsheetApp.openById(parangabaId);
  const toDelete = [SHEET_USUARIOS, SHEET_CONTRATOS, SHEET_SESSOES, SHEET_HISTORICO];
  const removidas = [];
  toDelete.forEach(function(name) {
    const s = ss.getSheetByName(name);
    if (s) { ss.deleteSheet(s); removidas.push(name); }
  });
  return { ok: true, removidas: removidas };
}

function handleInitContratoSheet(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  let sheet = ss.getSheetByName(contrato.abaDados);
  const headers = data.headers || [];
  if (!headers.length) return { ok: false, error: 'Headers obrigatórios' };

  if (!sheet) {
    sheet = ss.insertSheet(contrato.abaDados);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    return { ok: true, created: true };
  }
  // Se existe e está vazia (apenas headers), não faz nada
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return { ok: true, created: false };
}

function handleBulkInserirPontos(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor', 'gestao']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  if (!sheet) return { ok: false, error: 'Aba não encontrada' };

  const headers = sheet.getDataRange().getValues()[0];
  const pontos = data.pontos || [];
  if (!pontos.length) return { ok: false, error: 'Nenhum ponto enviado' };

  const rows = pontos.map(function(p) {
    return headers.map(function(h) { return p[h] !== undefined ? p[h] : ''; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return { ok: true, inseridos: rows.length };
}

function handleNotificacoes(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const user = findUser(session.email);
  const userContratos = (user.contratos || '').toString();
  const allowedAll = userContratos === '*' || session.perfil === 'supervisor' || session.perfil === 'gestao';
  const allowedList = userContratos.split(',').map(function(s) { return s.trim(); });

  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const contratosSheet = ss.getSheetByName(SHEET_CONTRATOS);
  const contratos = contratosSheet.getDataRange().getValues().slice(1).filter(function(r) {
    return r[7] === 'SIM' && (allowedAll || allowedList.indexOf(r[0]) !== -1);
  });

  const hoje = new Date();
  const alertas = [];

  contratos.forEach(function(c) {
    const contratoId = c[0];
    const contratoNome = c[1];
    const tipoContrato = c[3];
    const planilhaId = c[4];
    const abaDados = c[5];

    try {
      const dataSheet = SpreadsheetApp.openById(planilhaId).getSheetByName(abaDados);
      if (!dataSheet) return;
      const values = dataSheet.getDataRange().getValues();
      if (values.length < 2) return;
      const headers = values[0];

      if (tipoContrato === 'B') {
        const nameIdx = headers.indexOf('POINT NAME');
        const proxIdx = headers.indexOf('DATA PRÓX MANUTENÇÃO');
        const visitaIdx = headers.indexOf('VISITA');
        if (nameIdx < 0) return;
        for (let i = 1; i < values.length; i++) {
          const prox = values[i][proxIdx];
          if (!prox) continue;
          const proxDate = new Date(prox);
          if (isNaN(proxDate)) continue;
          const diff = Math.floor((proxDate - hoje) / (1000 * 60 * 60 * 24));
          if (diff < 0) {
            alertas.push({ contratoId: contratoId, contratoNome: contratoNome, identificador: values[i][nameIdx], tipo: 'vencida', diasAtraso: -diff, data: proxDate.toISOString().substring(0,10) });
          } else if (diff <= 15) {
            alertas.push({ contratoId: contratoId, contratoNome: contratoNome, identificador: values[i][nameIdx], tipo: 'proxima', diasRestantes: diff, data: proxDate.toISOString().substring(0,10) });
          }
        }
      } else if (tipoContrato === 'A') {
        const statusIdx = headers.indexOf('STATUS');
        const lucIdx = headers.indexOf('LUC');
        const lojasIdx = headers.indexOf('LOJAS');
        for (let i = 1; i < values.length; i++) {
          const st = String(values[i][statusIdx] || '').toUpperCase();
          if (st === 'ALARME') {
            alertas.push({ contratoId: contratoId, contratoNome: contratoNome, identificador: values[i][lucIdx], nome: values[i][lojasIdx], tipo: 'alarme' });
          }
        }
      }
    } catch (e) {}
  });

  return { ok: true, alertas: alertas, total: alertas.length };
}

function handleAdicionarPonto(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor', 'gestao']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  if (!sheet) return { ok: false, error: 'Aba de dados não encontrada' };

  const headers = sheet.getDataRange().getValues()[0];
  const row = headers.map(function(h) {
    return (data.campos && data.campos[h] !== undefined) ? data.campos[h] : '';
  });
  sheet.appendRow(row);

  return { ok: true, row: sheet.getLastRow() };
}

// ========================================================================
// DASHBOARD
// ========================================================================

function handleDashboard(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const contrato = findContrato(data.contratoId || 'shopping-parangaba');
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  const ss = SpreadsheetApp.openById(contrato.planilhaId);
  const sheet = ss.getSheetByName(contrato.abaDados);
  if (!sheet) return { ok: false, error: 'Aba de dados não encontrada' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  if (contrato.tipoContrato === 'A') {
    return dashboardTipoA(contrato, headers, rows);
  } else {
    return dashboardTipoB(contrato, headers, rows);
  }
}

function dashboardTipoA(contrato, headers, rows) {
  const statusIdx = headers.indexOf('STATUS');
  const pisoIdx = headers.indexOf('PISO');
  const interligadaIdx = headers.indexOf('INTERLIGADA');
  const moduloIdx = headers.findIndex(function(h) { return String(h).toUpperCase().indexOf('POSSUI MÓDULO') !== -1 || String(h).toUpperCase().indexOf('POSSUI MODULO') !== -1; });

  const byStatus = {};
  const byPiso = {};
  let interligadas = 0;
  let comModulo = 0;

  rows.forEach(function(r) {
    const st = String(r[statusIdx] || '').trim().toUpperCase() || 'SEM_STATUS';
    byStatus[st] = (byStatus[st] || 0) + 1;

    const piso = String(r[pisoIdx] || '').trim() || 'SEM_PISO';
    byPiso[piso] = byPiso[piso] || { total: 0, conforme: 0, pendencia: 0, alarme: 0 };
    byPiso[piso].total++;
    if (st === 'CONFORME') byPiso[piso].conforme++;
    if (st === 'PENDÊNCIA' || st === 'PENDENCIA') byPiso[piso].pendencia++;
    if (st === 'ALARME') byPiso[piso].alarme++;

    if (String(r[interligadaIdx] || '').toUpperCase() === 'SIM') interligadas++;
    if (moduloIdx >= 0 && String(r[moduloIdx] || '').toUpperCase() === 'SIM') comModulo++;
  });

  const result = {
    ok: true,
    tipoContrato: 'A',
    contrato: contrato,
    total: rows.length,
    byStatus: byStatus,
    byPiso: byPiso,
    interligadas: interligadas,
    comModulo: comModulo,
    headers: headers
  };

  // Se existe a aba EQUIP SHOPPING na mesma planilha, adiciona KPIs de equipamentos
  try {
    const ss = SpreadsheetApp.openById(contrato.planilhaId);
    const equipSheet = ss.getSheetByName('EQUIP SHOPPING');
    if (equipSheet) {
      result.equipamentos = dashboardEquipShopping(equipSheet);
    }
  } catch (e) {}

  return result;
}

function dashboardEquipShopping(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { total: 0 };
  const headers = values[0];
  const localIdx = headers.indexOf('LOCAL DE INSTALAÇÃO');
  const pisoIdx = headers.indexOf('PISO');
  const tipoIdx = headers.indexOf('TIPO DISP');
  const idIdx = headers.indexOf('ID');
  const dataIdx = headers.indexOf('DATA MANUT.');
  const obsIdx = headers.findIndex(function(h) { return String(h).toUpperCase().indexOf('OBS') === 0; });

  const equipamentos = [];
  let categoriaAtual = '';
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const local = String(r[localIdx] || '').trim();
    const piso = String(r[pisoIdx] || '').trim();
    // Linha de categoria: tem LOCAL mas sem PISO e sem TIPO
    if (local && !piso && !r[tipoIdx]) {
      categoriaAtual = local;
      continue;
    }
    if (!local) continue;
    equipamentos.push({
      local: local,
      piso: piso,
      tipo: String(r[tipoIdx] || '').trim(),
      id: String(r[idIdx] || '').trim(),
      data: r[dataIdx],
      obs: obsIdx >= 0 ? String(r[obsIdx] || '').trim() : '',
      categoria: categoriaAtual
    });
  }

  const byCategoria = {};
  const byTipo = {};
  const byPiso = {};
  let semManutencao = 0;
  let manutMaisDeSeisMeses = 0;
  const hoje = new Date();
  const seis_meses_ms = 180 * 24 * 60 * 60 * 1000;

  equipamentos.forEach(function(e) {
    byCategoria[e.categoria] = (byCategoria[e.categoria] || 0) + 1;
    byTipo[e.tipo || 'OUTROS'] = (byTipo[e.tipo || 'OUTROS'] || 0) + 1;
    byPiso[e.piso || '-'] = (byPiso[e.piso || '-'] || 0) + 1;
    if (!e.data) semManutencao++;
    else {
      const d = new Date(e.data);
      if (!isNaN(d) && (hoje - d) > seis_meses_ms) manutMaisDeSeisMeses++;
    }
  });

  return {
    total: equipamentos.length,
    byCategoria: byCategoria,
    byTipo: byTipo,
    byPiso: byPiso,
    semManutencao: semManutencao,
    manutMaisDeSeisMeses: manutMaisDeSeisMeses,
    lista: equipamentos
  };
}

function dashboardTipoB(contrato, headers, rows) {
  const visitaIdx = headers.indexOf('VISITA');
  const centralIdx = headers.indexOf('CENTRAL');
  const deviceIdx = headers.indexOf('DEVICE TYPE');

  const byVisita = {};
  const byCentral = {};
  const byDevice = {};

  rows.forEach(function(r) {
    const visita = String(r[visitaIdx] || '').trim().toUpperCase() || 'PENDENTE';
    byVisita[visita] = (byVisita[visita] || 0) + 1;

    const central = String(r[centralIdx] || '').trim() || 'SEM_CENTRAL';
    byCentral[central] = byCentral[central] || { total: 0, realizadas: 0, pendentes: 0 };
    byCentral[central].total++;
    if (visita === 'REALIZADA') byCentral[central].realizadas++;
    else byCentral[central].pendentes++;

    const device = String(r[deviceIdx] || '').trim() || 'OUTROS';
    byDevice[device] = (byDevice[device] || 0) + 1;
  });

  return {
    ok: true,
    tipoContrato: 'B',
    contrato: contrato,
    total: rows.length,
    byVisita: byVisita,
    byCentral: byCentral,
    byDevice: byDevice,
    headers: headers
  };
}

// ========================================================================
// FOTOS (Drive)
// ========================================================================

function handleUploadFoto(data) {
  const session = validateToken(data.token);
  const perm = requirePerfil(session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contrato = findContrato(data.contratoId);
  if (!contrato) return { ok: false, error: 'Contrato não encontrado' };

  return uploadFotoInternal(contrato, data.identificador || 'sem-id', data.foto || {});
}

function uploadFotoInternal(contrato, identificador, foto) {
  try {
    if (!foto.base64) return { ok: false, error: 'Foto sem dados base64' };

    // Pasta raiz
    let rootFolder;
    const rootIter = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
    if (rootIter.hasNext()) {
      rootFolder = rootIter.next();
    } else {
      rootFolder = DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
    }

    // Subpasta do contrato
    let contratoFolder;
    const contratoIter = rootFolder.getFoldersByName(contrato.nome);
    if (contratoIter.hasNext()) {
      contratoFolder = contratoIter.next();
    } else {
      contratoFolder = rootFolder.createFolder(contrato.nome);
    }

    // Subpasta do identificador
    let idFolder;
    const idIter = contratoFolder.getFoldersByName(identificador);
    if (idIter.hasNext()) {
      idFolder = idIter.next();
    } else {
      idFolder = contratoFolder.createFolder(identificador);
    }

    const base64 = foto.base64.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Utilities.base64Decode(base64);
    const mime = foto.mime || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    const fileName = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd_HH-mm-ss') + '.' + ext;
    const blob = Utilities.newBlob(bytes, mime, fileName);
    const file = idFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { ok: true, url: file.getUrl(), id: file.getId(), name: fileName };
  } catch (err) {
    return { ok: false, error: 'Erro upload: ' + err.message };
  }
}

// ========================================================================
// HISTÓRICO
// ========================================================================

function registrarHistorico(obj) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_HISTORICO);
  sheet.appendRow([
    new Date().toISOString(),
    obj.contratoId,
    obj.identificador,
    obj.tecnico,
    obj.acao,
    obj.dados,
    obj.fotoUrl || ''
  ]);
}

function obterHistoricoPorIdentificador(contratoId, identificador) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_HISTORICO);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const historico = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === contratoId && String(values[i][2]) === String(identificador)) {
      historico.push({
        timestamp: values[i][0],
        tecnico: values[i][3],
        acao: values[i][4],
        dados: values[i][5],
        fotoUrl: values[i][6]
      });
    }
  }
  return historico.reverse(); // mais recente primeiro
}

function handleHistorico(data) {
  const session = validateToken(data.token);
  if (!session.ok) return session;

  const h = obterHistoricoPorIdentificador(data.contratoId, data.identificador);
  return { ok: true, historico: h };
}
