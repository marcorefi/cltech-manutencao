import * as auth from './auth.js';
import * as usuarios from './usuarios.js';
import * as contratos from './contratos.js';
import * as lojas from './lojas.js';
import * as pontos from './pontos.js';
import * as equipamentos from './equipamentos.js';
import * as dashboard from './dashboard.js';
import * as historico from './historico.js';

export const actions = {
  ping: auth.ping,
  auth: auth.login,
  logout: auth.logout,
  me: auth.me,

  listarUsuarios: usuarios.listar,
  criarUsuario: usuarios.criar,
  atualizarUsuario: usuarios.atualizar,
  removerUsuario: usuarios.remover,

  listarContratos: contratos.listar,
  obterContrato: contratos.obter,
  criarContrato: contratos.criar,
  atualizarContrato: contratos.atualizar,

  listarLojas: lojas.listar,
  obterLoja: lojas.obter,
  salvarLoja: lojas.salvar,

  listarPontos: pontos.listar,
  obterPonto: pontos.obter,
  salvarPonto: pontos.salvar,
  adicionarPonto: pontos.adicionar,
  bulkInserirPontos: pontos.bulkInserir,

  listarEquipamentosShopping: equipamentos.listar,
  listarEquipamentos: equipamentos.listar,
  salvarEquipamento: equipamentos.salvar,

  dashboard: dashboard.resumo,
  notificacoes: dashboard.notificacoes,

  historico: historico.listar
};
