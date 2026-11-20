"""Captura os ecrãs reais da app para o site de apresentação.

Uso (precisa do build da app):
  npm run build && python3 scripts/site-screens.py            # 4 línguas × claro/escuro
  python3 scripts/site-screens.py --lang pt-PT --theme light --base http://127.0.0.1:4173

Abre a app com ?demo=1 (semestre de exemplo, nunca escreve na nuvem), junta alguns materiais
de exemplo, segue os fluxos (onboarding, adotar um Uni, Caderno do Uni…) e grava cada ecrã em
site/public/screens/<língua>/<tema>/<ecrã>.webp. Volta a correr quando a interface da app mudar.
"""

from __future__ import annotations

import argparse
import io
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

from PIL import Image
from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'site' / 'public' / 'screens'
LOCALES = ROOT / 'src' / 'locales'
LANGS = ['pt-PT', 'pt-BR', 'es', 'en']
THEMES = ['light', 'dark']
WIDTH = 600  # largura final das imagens (o ecrã é 390 pt a 2x)


class Strings:
    """Texto de um botão na língua pedida, a partir do texto em pt-PT (ou do caminho da chave)."""

    def __init__(self, lang: str):
        self.lang = lang
        self.cache: dict[str, dict] = {}

    def _load(self, lang: str, ns: str) -> dict:
        key = f'{lang}/{ns}'
        if key not in self.cache:
            self.cache[key] = json.loads((LOCALES / lang / f'{ns}.json').read_text('utf8'))
        return self.cache[key]

    @staticmethod
    def _find(obj, value, path=()):
        if isinstance(obj, dict):
            for k, v in obj.items():
                hit = Strings._find(v, value, path + (k,))
                if hit:
                    return hit
        elif obj == value:
            return path
        return None

    def key(self, ns: str, dotted: str) -> str:
        node = self._load(self.lang, ns)
        for k in dotted.split('.'):
            node = node[k]
        return node

    def __call__(self, ns: str, pt_value: str) -> str:
        path = self._find(self._load('pt-PT', ns), pt_value)
        if not path:
            raise KeyError(f'«{pt_value}» não existe em pt-PT/{ns}.json')
        return self.key(ns, '.'.join(path))


# Materiais de exemplo (como se viessem do Google Drive, do NotebookLM e do disco).
MATERIALS = {
    'pt-PT': ['Slides · Aula 6 · Derivadas', 'Teste 2024 (com resolução)', 'Sebenta de Cálculo I', 'Ficha 3 · Leis de Newton', 'Exame 2023 · Época normal', 'Apontamentos de Recursividade', 'Relatório de laboratório'],
    'pt-BR': ['Slides · Aula 6 · Derivadas', 'Prova 2024 (com resolução)', 'Apostila de Cálculo I', 'Lista 3 · Leis de Newton', 'Exame 2023 · Época normal', 'Anotações de Recursão', 'Relatório de laboratório'],
    'es': ['Diapositivas · Clase 6 · Derivadas', 'Examen 2024 (resuelto)', 'Apuntes de Cálculo I', 'Hoja 3 · Leyes de Newton', 'Examen 2023 · Convocatoria ordinaria', 'Apuntes de Recursividad', 'Informe de laboratorio'],
    'en': ['Slides · Lecture 6 · Derivatives', 'Test 2024 (with solutions)', 'Calculus I course notes', 'Worksheet 3 · Newton\'s Laws', 'Exam 2023 · Main sitting', 'Recursion notes', 'Lab report'],
}


# Nome e semestre credíveis nas capturas (a demonstração da app diz «Visitante» e «Semestre de Exemplo»).
PROFILE = {
    'pt-PT': ('Inês', '1.º Semestre · 2026/27'),
    'pt-BR': ('Ana', '1º Semestre · 2026'),
    'es': ('Lucía', '1.er cuatrimestre · 2026/27'),
    'en': ('Sam', 'Semester 1 · 2026/27'),
}


def demo_materials(lang: str) -> list[dict]:
    t = MATERIALS[lang]
    now = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
    rows = [
        ('demo-c1', t[0], 'gdrive', 'slide_oficial', 'application/pdf', False),
        ('demo-c1', t[1], 'gdrive', 'teste_antigo', 'application/pdf', True),
        ('demo-c1', t[2], 'upload', 'sebenta', 'application/pdf', False),
        ('demo-c2', t[3], 'upload', 'ficha', 'application/pdf', False),
        ('demo-c2', t[4], 'gdrive', 'exame_antigo', 'application/pdf', True),
        ('demo-c3', t[5], 'notebooklm', 'outro', None, False),
        ('demo-c3', t[6], 'upload', 'relatorio', 'application/pdf', False),
    ]
    out = []
    for i, (cid, title, provider, cat, mime, sol) in enumerate(rows):
        m = {
            'id': f'sitemat{i + 1}', 'courseId': cid, 'title': title, 'provider': provider, 'category': cat,
            'url': 'https://notebooklm.google.com/' if provider == 'notebooklm' else f'https://example.invalid/{i + 1}',
            'modifiedAt': now, 'year': '2025/26', 'pinned': i in (0, 4),
        }
        if mime:
            m['mimeType'] = mime
            m['fileName'] = f'{title}.pdf'
        if sol:
            m['hasSolution'] = True
        out.append(m)
    return out


class Shooter:
    def __init__(self, page: Page, lang: str, theme: str):
        self.page = page
        self.dir = OUT / lang / theme
        self.dir.mkdir(parents=True, exist_ok=True)
        self.done: list[str] = []

    def shot(self, name: str, settle: int = 400):
        self.page.wait_for_timeout(settle)
        png = self.page.screenshot()
        img = Image.open(io.BytesIO(png)).convert('RGB')
        img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
        img.save(self.dir / f'{name}.webp', 'WEBP', quality=82, method=6)
        self.done.append(name)

    def go(self, base: str, path: str, wait: int = 1800):
        self.page.goto(base + path, wait_until='networkidle')
        self.page.wait_for_timeout(wait)


def capture(base: str, lang: str, theme: str):
    s = Strings(lang)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            locale=lang, color_scheme=theme, viewport={'width': 390, 'height': 844},
            device_scale_factor=2, is_mobile=True, reduced_motion='reduce',
        )
        page = ctx.new_page()
        sh = Shooter(page, lang, theme)

        sh.go(base, '/?demo=1', 1500)
        # Hub de estudo (fotos do horário e dos testes, Drive, PDFs do disco), antes dos materiais.
        page.evaluate(
            """([name, semester]) => { const k = 'uni-erp-v5'; const s = JSON.parse(localStorage.getItem(k));
                s.state.settings.hubSetupCompleted = true; s.state.settings.hubSetupDismissed = false;
                s.state.settings.userName = name; s.state.settings.semesterName = semester;
                localStorage.setItem(k, JSON.stringify(s)); }""",
            list(PROFILE[lang]),
        )
        sh.go(base, '/', 4500)
        first = page.get_by_label(s.key('today', 'firstSteps.ariaLabel'))
        if not first.count():
            print('  ! sem «Primeiros passos» no Hoje: Hub não capturado', file=sys.stderr)
        else:
            first.first.get_by_role('button').first.click()
            page.wait_for_timeout(1800)
            sh.shot('hub')
            # Mais abaixo: os passos (foto do horário, print dos testes, Drive e PDFs do disco).
            page.mouse.move(195, 560)
            for _ in range(6):
                page.mouse.wheel(0, 160)
                page.wait_for_timeout(120)
            page.wait_for_timeout(700)
            sh.shot('hub-passos')

        # Junta materiais de exemplo ao semestre de demonstração (e esconde o cartão de primeiros passos).
        page.evaluate(
            """(mats) => { const k = 'uni-erp-v5'; const s = JSON.parse(localStorage.getItem(k));
                s.state.materials = mats; s.state.settings.hubSetupDismissed = true;
                localStorage.setItem(k, JSON.stringify(s)); }""",
            demo_materials(lang),
        )
        sh.go(base, '/', 2500)
        sh.shot('hoje', 4200)  # deixa sair o aviso «Plano atualizado»
        sh.go(base, '/plano')
        sh.shot('plano')
        sh.go(base, '/cadeiras')
        sh.shot('cadeiras')
        sh.go(base, '/calendario')
        sh.shot('calendario')
        sh.go(base, '/materiais')
        sh.shot('materiais')
        # Origens: pasta do dispositivo, Google Drive e pasta raiz do semestre.
        expand = page.get_by_role('button', name=s.key('courses', 'materialsPage.expand'))
        if expand.count():
            expand.first.click()
            page.wait_for_timeout(1000)
            sh.shot('materiais-origens')
        else:
            print('  ! sem «Expandir» em Materiais: origens não capturadas', file=sys.stderr)
        sh.go(base, '/progresso')
        sh.shot('progresso')

        # Foco e prática num separador à parte, com relógio controlado (acaba o bloco de 25 min em segundos).
        # O resto da captura usa o relógio real, porque as animações da app dependem dele.
        # Contexto próprio: a sessão de foco adiantada 25 min ficava guardada e deixava outros ecrãs em branco.
        focus_ctx = browser.new_context(
            locale=lang, color_scheme=theme, viewport={'width': 390, 'height': 844},
            device_scale_factor=2, is_mobile=True, reduced_motion='reduce',
        )
        focus_page = focus_ctx.new_page()
        focus_page.clock.install()
        fsh = Shooter(focus_page, lang, theme)
        fsh.go(base, '/?demo=1', 1500)
        focus_page.evaluate(
            """([name, semester]) => { const k = 'uni-erp-v5'; const s = JSON.parse(localStorage.getItem(k));
                s.state.settings.userName = name; s.state.settings.semesterName = semester;
                s.state.settings.hubSetupDismissed = true; localStorage.setItem(k, JSON.stringify(s)); }""",
            list(PROFILE[lang]),
        )
        fsh.go(base, '/', 2500)
        focus_page.get_by_role('button', name='25 min').first.click()
        focus_page.wait_for_timeout(1500)
        fsh.shot('foco')
        focus_page.get_by_role('button', name=s.key('plan', 'focus.ui.startBtn'), exact=True).first.click()
        focus_page.wait_for_timeout(1200)
        focus_page.clock.fast_forward('25:05')
        focus_page.wait_for_timeout(2500)
        fsh.shot('pratica')
        focus_ctx.close()
        sh.done += fsh.done

        # Tutor e Caderno do Uni (o consentimento só fica guardado neste navegador de captura; nada é enviado).
        page.evaluate(
            """() => { const k = 'uni-erp-v5'; const s = JSON.parse(localStorage.getItem(k));
                s.state.settings.aiConsent = true; localStorage.setItem(k, JSON.stringify(s)); }"""
        )
        sh.go(base, '/assistente', 4000)
        sh.shot('tutor')
        nb = page.get_by_role('button', name=s.key('assistant', 'notebookBtn'), exact=True)
        if nb.count():
            nb.first.click()
            page.wait_for_timeout(1500)
            sh.shot('caderno')

        # Adotar um Uni especialista para a primeira cadeira.
        sh.go(base, '/cadeiras/demo-c1', 1800)
        adopt_prefix = s.key('uni', 'card.adoptBtn').split('(')[0].strip()
        page.get_by_role('button', name=adopt_prefix).first.click()
        page.wait_for_timeout(1500)
        sh.shot('uni-adotar')
        page.get_by_role('button', name=s('uni', 'Adotar nesta cadeira')).first.click()
        page.wait_for_timeout(4500)  # deixa sair o aviso da adoção
        sh.shot('cadeira', 800)

        sh.go(base, '/progresso', 1500)
        page.get_by_text(s('progress', 'Semestre & Estante'), exact=True).first.click()
        page.wait_for_timeout(1200)
        page.mouse.move(195, 500)
        page.mouse.wheel(0, 520)
        page.wait_for_timeout(1000)
        sh.shot('estante')

        # Onboarding num contexto novo, só com a demonstração: com o estado que a captura vai juntando
        # (materiais, consentimento do Uni, Uni adotado) o passo 2 ficava em branco.
        onb_ctx = browser.new_context(
            locale=lang, color_scheme=theme, viewport={'width': 390, 'height': 844},
            device_scale_factor=2, is_mobile=True, reduced_motion='reduce',
        )
        onb_page = onb_ctx.new_page()
        osh = Shooter(onb_page, lang, theme)
        osh.go(base, '/?demo=1', 1500)
        osh.go(base, '/configurar', 2200)
        osh.shot('onboarding')
        onb_page.get_by_role('button', name=s('onboarding', 'Continuar')).last.click()
        onb_page.get_by_role('button', name=s('onboarding', 'Ler print do horário')).first.wait_for(state='visible', timeout=8000)
        onb_page.wait_for_timeout(1500)
        osh.shot('onboarding-cadeiras')
        onb_ctx.close()
        sh.done += osh.done

        browser.close()
    print(f'  ✓ {lang} {theme}: {", ".join(sh.done)}')


def wait_server(url: str, timeout: float = 30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f'Servidor não arrancou em {url}')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', choices=LANGS, action='append')
    ap.add_argument('--theme', choices=THEMES, action='append')
    ap.add_argument('--base', help='URL de uma app já a correr (por omissão: vite preview do dist/)')
    args = ap.parse_args()
    server = None
    base = args.base
    if not base:
        if not (ROOT / 'dist' / 'index.html').exists():
            print('Falta o build da app: corre npm run build primeiro.', file=sys.stderr)
            return 1
        base = 'http://127.0.0.1:4173'
        server = subprocess.Popen(['npx', 'vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'],
                                  cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_server(base)
        for lang in args.lang or LANGS:
            for theme in args.theme or THEMES:
                capture(base, lang, theme)
    finally:
        if server:
            server.terminate()
    return 0


if __name__ == '__main__':
    sys.exit(main())
