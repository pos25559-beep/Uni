import pathlib
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE_PATH = ROOT / 'node_modules' / 'axe-core' / 'axe.min.js'
BASE_URL = 'http://127.0.0.1:4173'
ROUTES = [
    '/',
    '/cadeiras/c1',
    '/calendario',
    '/plano',
    '/materiais',
    '/assistente',
    '/definicoes',
    '/bem-vindo',
]
VIEWPORTS = [
    ('mobile_360', {'width': 360, 'height': 800}),
    ('mobile_390', {'width': 390, 'height': 844}),
    ('desktop_1440', {'width': 1440, 'height': 900}),
]


def wait_server(url: str, timeout: float = 20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f'Preview server did not start on {url}')


def main() -> int:
    if not AXE_PATH.exists():
        print(f'ERROR: axe-core not found at {AXE_PATH}', file=sys.stderr)
        return 1
    axe_source = AXE_PATH.read_text(encoding='utf-8')

    proc = subprocess.Popen(
        ['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_server(BASE_URL)
        issues: list[str] = []

        with sync_playwright() as p:
            browser = p.chromium.launch()
            for vp_name, vp in VIEWPORTS:
                context = browser.new_context(viewport=vp, color_scheme='light')
                page = context.new_page()
                page_errors: list[str] = []
                page.on('pageerror', lambda err: page_errors.append(f'{vp_name}: {err}'))

                # Ativa dados de demonstração numa única navegação inicial
                page.goto(f'{BASE_URL}/?demo=1', wait_until='networkidle')
                page.wait_for_timeout(450)

                for route in ROUTES:
                    page.goto(f'{BASE_URL}{route}', wait_until='networkidle')
                    page.wait_for_timeout(350)

                    metrics = page.evaluate(
                        '() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })'
                    )
                    if metrics['sw'] > metrics['iw'] + 1:
                        issues.append(
                            f'OVERFLOW {vp_name} {route}: scrollWidth={metrics["sw"]} > innerWidth={metrics["iw"]}'
                        )

                    # Só corre axe completo no 390x844 e 1440x900 para rapidez
                    if vp_name in ('mobile_390', 'desktop_1440'):
                        page.evaluate(axe_source)
                        axe_res = page.evaluate(
                            """async () => {
                              const r = await window.axe.run(document, {
                                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
                              });
                              return r.violations
                                .filter(v => v.impact === 'critical' || v.impact === 'serious')
                                .map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
                            }"""
                        )
                        for v in axe_res:
                            issues.append(
                                f'AXE {vp_name} {route}: [{v["impact"]}] {v["id"]} ({v["nodes"]} nodes)'
                            )

                if page_errors:
                    issues.extend(f'PAGEERROR {e}' for e in page_errors)
                context.close()
            browser.close()

        if issues:
            print('a11y-smoke falhou:')
            for item in issues:
                print(f'  - {item}')
            return 1

        print(f'a11y-smoke OK ({len(ROUTES)} rotas × {len(VIEWPORTS)} viewports, 0 erros, 0 overflow, 0 axe critical/serious).')
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    raise SystemExit(main())
