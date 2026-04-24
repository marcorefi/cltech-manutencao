"""
QA automatizado - CLTECH Fire Sistema Manutenção
Valida estrutura de arquivos, sintaxe, integridade sem precisar do backend online.
"""
import os
import re
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
RESULTS = []

def test(name):
    def decorator(fn):
        def wrapper():
            try:
                fn()
                RESULTS.append((name, True, ''))
                print(f"  [OK] {name}")
            except AssertionError as e:
                RESULTS.append((name, False, str(e)))
                print(f"  [FAIL] {name}: {e}")
            except Exception as e:
                RESULTS.append((name, False, f'{type(e).__name__}: {e}'))
                print(f"  [ERR] {name}: {e}")
        return wrapper
    return decorator

# ==================== TESTES ====================

@test("Estrutura: index.html existe")
def t_index():
    assert (ROOT / 'index.html').exists()

@test("Estrutura: supervisor.html existe")
def t_supervisor():
    assert (ROOT / 'supervisor.html').exists()

@test("Estrutura: campo.html existe")
def t_campo():
    assert (ROOT / 'campo.html').exists()

@test("Estrutura: cliente.html existe")
def t_cliente():
    assert (ROOT / 'cliente.html').exists()

@test("Estrutura: dashboard.html existe")
def t_dash():
    assert (ROOT / 'dashboard.html').exists()

@test("Estrutura: Apps Script Code.gs existe")
def t_gs():
    assert (ROOT / 'apps-script' / 'Code.gs').exists()

@test("Estrutura: CSS existe")
def t_css():
    assert (ROOT / 'assets' / 'css' / 'style.css').exists()

@test("Estrutura: todos os JS existem")
def t_js():
    for f in ['config.js', 'api.js', 'auth.js', 'utils.js']:
        assert (ROOT / 'assets' / 'js' / f).exists(), f"Faltando: {f}"

@test("Estrutura: logos CLTECH Fire existem")
def t_logos():
    for f in ['cltech-shield.png', 'cltech-horizontal.png', 'cltech-vertical.png']:
        p = ROOT / 'assets' / 'img' / f
        assert p.exists(), f"Faltando: {f}"
        assert p.stat().st_size > 1000, f"Logo {f} muito pequeno (corrompido?)"

@test("HTML: index.html tem formulário de login")
def t_login_form():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'id="loginForm"' in html
    assert 'id="email"' in html
    assert 'id="senha"' in html
    assert 'cltech-vertical' in html, "Deve usar a logo vertical (fundo azul escuro)"

@test("HTML: supervisor.html tem painel de usuários")
def t_sup_users():
    html = (ROOT / 'supervisor.html').read_text(encoding='utf-8')
    assert 'criarUsuario' in html
    assert 'listarUsuarios' in html
    assert 'criarContrato' in html

@test("HTML: supervisor.html requer perfil correto")
def t_sup_perm():
    html = (ROOT / 'supervisor.html').read_text(encoding='utf-8')
    assert "AUTH.require(['supervisor', 'gestao'])" in html

@test("HTML: campo.html requer perfil de campo")
def t_campo_perm():
    html = (ROOT / 'campo.html').read_text(encoding='utf-8')
    assert "AUTH.require(['supervisor', 'gestao', 'campo'])" in html

@test("HTML: cliente.html tem dashboard somente leitura")
def t_cliente_readonly():
    html = (ROOT / 'cliente.html').read_text(encoding='utf-8')
    assert "AUTH.require(['cliente', 'supervisor', 'gestao'])" in html
    # Não deve ter form de edição nem botão salvar
    assert 'salvarLoja' not in html, "Cliente não pode salvar"
    assert 'salvarPonto' not in html, "Cliente não pode salvar"

@test("HTML: todas páginas têm rodapé LGPD")
def t_lgpd():
    for html_file in ['supervisor.html', 'campo.html', 'cliente.html', 'dashboard.html']:
        html = (ROOT / html_file).read_text(encoding='utf-8')
        assert 'renderLgpdFooter' in html, f"Faltando LGPD em {html_file}"

@test("CSS: variáveis CLTECH definidas")
def t_css_vars():
    css = (ROOT / 'assets' / 'css' / 'style.css').read_text(encoding='utf-8')
    for var in ['--primary: #2E86C1', '--conforme: #27AE60', '--alarme: #E74C3C', '--dark: #0D1B2A']:
        assert var in css, f"Faltando: {var}"

@test("JS: config.js expõe APP_CONFIG")
def t_config():
    js = (ROOT / 'assets' / 'js' / 'config.js').read_text(encoding='utf-8')
    assert 'window.APP_CONFIG' in js
    assert 'SESSION_KEY' in js

@test("JS: api.js expõe API.call")
def t_api():
    js = (ROOT / 'assets' / 'js' / 'api.js').read_text(encoding='utf-8')
    assert 'window.API' in js
    assert 'async function call' in js
    assert 'async function ping' in js

@test("JS: auth.js expõe AUTH completo")
def t_auth():
    js = (ROOT / 'assets' / 'js' / 'auth.js').read_text(encoding='utf-8')
    for fn in ['getSession', 'login', 'logout', 'require', 'redirectByProfile', 'renderHeader', 'renderLgpdFooter']:
        assert f': {fn}' in js or f'function {fn}' in js, f"Faltando função: {fn}"

@test("JS: auth.js redireciona por perfil corretamente")
def t_auth_redirect():
    js = (ROOT / 'assets' / 'js' / 'auth.js').read_text(encoding='utf-8')
    assert "'supervisor'" in js and 'supervisor.html' in js
    assert "'campo'" in js and 'campo.html' in js
    assert "'cliente'" in js and 'cliente.html' in js

@test("JS: utils.js tem compressão de foto")
def t_utils():
    js = (ROOT / 'assets' / 'js' / 'utils.js').read_text(encoding='utf-8')
    assert 'fileToCompressedBase64' in js
    assert 'canvas' in js.lower()

@test("Apps Script: todos endpoints implementados")
def t_endpoints():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    endpoints = ['ping', 'auth', 'logout', 'me', 'listarUsuarios', 'criarUsuario',
                 'atualizarUsuario', 'removerUsuario', 'listarContratos', 'criarContrato',
                 'listarLojas', 'obterLoja', 'salvarLoja', 'listarPontos', 'obterPonto',
                 'salvarPonto', 'adicionarPonto', 'dashboard', 'uploadFoto', 'historico']
    for ep in endpoints:
        assert f"case '{ep}':" in gs, f"Faltando endpoint: {ep}"

@test("Apps Script: autenticação SHA-256")
def t_sha256():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    assert 'SHA_256' in gs
    assert 'computeDigest' in gs

@test("Apps Script: usuário supervisor inicial criado no init")
def t_init_user():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    assert 'marcoslimacltech@gmail.com' in gs
    assert "'supervisor'" in gs

@test("Apps Script: validação de perfil nas rotas críticas")
def t_perm():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    # handleCriarUsuario deve requerer supervisor
    m = re.search(r'function handleCriarUsuario\(data\) \{.*?\}', gs, re.S)
    assert m
    assert 'requirePerfil' in m.group(0), "criarUsuario sem validação de perfil"

@test("Apps Script: planilha master ID correto")
def t_master_id():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    assert '12MFGQegCkrVJrMrdvUlYZeJpoj-3zQS-V6CbCuHtW2U' in gs

@test("Apps Script: pasta Drive para fotos")
def t_drive_folder():
    gs = (ROOT / 'apps-script' / 'Code.gs').read_text(encoding='utf-8')
    assert 'DRIVE_ROOT_FOLDER_NAME' in gs
    assert 'createFolder' in gs

@test("HTML: index.html tem configuração de API URL")
def t_url_config():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'API.setUrl' in html
    assert 'testPing' in html

@test("HTML: supervisor permite criar os 3 tipos de perfil")
def t_supervisor_creates_all():
    html = (ROOT / 'supervisor.html').read_text(encoding='utf-8')
    for perfil in ['gestao', 'campo', 'cliente', 'supervisor']:
        assert f'value="{perfil}"' in html, f"Supervisor não cria perfil {perfil}"

@test("HTML: campo suporta Tipo A e Tipo B")
def t_campo_AB():
    html = (ROOT / 'campo.html').read_text(encoding='utf-8')
    assert "tipoContrato === 'A'" in html
    assert 'carregarLojas' in html
    assert 'carregarPontos' in html

@test("Dashboard: tem gráficos Chart.js")
def t_charts():
    html = (ROOT / 'dashboard.html').read_text(encoding='utf-8')
    assert 'chart.umd' in html or 'Chart.js' in html or 'new Chart' in html
    assert 'canvas' in html

@test("Dashboard: exporta CSV")
def t_csv():
    html = (ROOT / 'dashboard.html').read_text(encoding='utf-8')
    assert 'exportarCSV' in html
    assert 'text/csv' in html

@test("Dashboard: busca individual (como REV02)")
def t_ind_search():
    html = (ROOT / 'dashboard.html').read_text(encoding='utf-8')
    assert 'searchIndividual' in html or 'datalist' in html

# ==================== RUN ====================

if __name__ == '__main__':
    print("=" * 60)
    print("CLTECH Fire - Testes automatizados (estrutura + codigo)")
    print("=" * 60)

    tests = [v for k, v in globals().items() if k.startswith('t_')]
    for t in tests:
        t()

    print()
    print("=" * 60)
    total = len(RESULTS)
    ok = sum(1 for _, p, _ in RESULTS if p)
    fail = total - ok
    print(f"Resultado: {ok}/{total} passaram ({fail} falharam)")
    if fail:
        print()
        print("FALHAS:")
        for name, passed, err in RESULTS:
            if not passed:
                print(f"  - {name}: {err}")
        sys.exit(1)
    else:
        print("Todos os testes passaram!")
        sys.exit(0)
