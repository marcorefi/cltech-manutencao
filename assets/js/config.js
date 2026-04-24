// CLTECH Fire - Configuração global
// Após deploy do Apps Script, cole a URL /exec abaixo:
window.APP_CONFIG = {
  // Será preenchido automaticamente após deploy. Se vazio, usa localStorage
  API_URL: localStorage.getItem('cltech_api_url') || '',
  VERSION: '1.0',
  EMPRESA: 'CLTECH Fire',
  CNPJ: '30.452.788/0001-38',
  SESSION_KEY: 'cltech_session',
  CONTRATO_KEY: 'cltech_contrato_atual'
};
