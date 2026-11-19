"""Grava o filme do site de apresentação a partir da app real (dados de demonstração).

EM PAUSA (2026-11-19, decisão do Pedro): o site ainda não mostra o filme. O guião chega à Prática;
falta afinar o passo do menu «Mais» → Progresso e o Tutor (respostas simuladas) antes de o usar.

Uso:
  npm run build && python3 scripts/record-demo.py            # 4 línguas × telemóvel + desktop
  python3 scripts/record-demo.py --lang pt-PT --device mobile --base http://localhost:5173

Para cada língua e dispositivo:
  - abre a app com ?demo=1 (semestre de exemplo, nunca escreve na nuvem),
  - segue um guião (Hoje → Plano → Foco → Prática → Progresso → Tutor) com um cursor/toque visível,
  - grava por CDP screencast e monta MP4 (H.264) + WebM (VP9) com o ffmpeg do sistema,
  - escreve chapters.json, captions.vtt, poster.jpg e capturas por cena em site/public/media/<lng>/.

O Tutor nunca chama a IA real: o App Check e o Firebase AI Logic são respondidos localmente
com uma resposta escrita à mão (por língua).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'site' / 'public' / 'media'
LOCALES = ROOT / 'src' / 'locales'
# ffmpeg do sistema (brew install ffmpeg); não fica nas dependências do projeto para não pesar no CI.
FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'

LANGS = ['pt-PT', 'pt-BR', 'es', 'en']
DEVICES = {
    'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=False),
    'desktop': dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=1),
}

CHAPTERS = ['hoje', 'plano', 'foco', 'pratica', 'progresso', 'tutor']

# Resposta do Tutor usada na gravação (nunca vem da IA real).
TUTOR_REPLY = {
    'pt-PT': 'Hoje começava por **Derivadas e Regras de Derivação** (25 min): o teste de Cálculo I vale 40 % e é já para a semana. '
    'Depois, 10 min de revisão rápida dos cartões de Limites que falhaste ontem. Se ainda tiveres energia, fecha com Cinemática.',
    'pt-BR': 'Hoje eu começaria por **Derivadas e Regras de Derivação** (25 min): a prova de Cálculo I vale 40 % e é na semana que vem. '
    'Depois, 10 min de revisão rápida dos cartões de Limites que você errou ontem. Se ainda tiver energia, termine com Cinemática.',
    'es': 'Hoy empezaría por **Derivadas y Reglas de Derivación** (25 min): el examen de Cálculo I vale un 40 % y es la semana que viene. '
    'Después, 10 min de repaso rápido de las tarjetas de Límites que fallaste ayer. Si te queda energía, cierra con Cinemática.',
    'en': "Today I'd start with **Derivatives and Differentiation Rules** (25 min): the Calculus I test is worth 40% and it's next week. "
    "Then a quick 10-minute review of the Limits cards you missed yesterday. If you still have energy, finish with Kinematics.",
}


# ---------------------------------------------------------------- textos da app

class Strings:
    """Encontra o texto de um botão na língua pedida a partir do texto em pt-PT."""

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

    def __call__(self, ns: str, pt_value: str) -> str:
        path = self._find(self._load('pt-PT', ns), pt_value)
        if not path:
            raise KeyError(f'«{pt_value}» não existe em pt-PT/{ns}.json')
        node = self._load(self.lang, ns)
        for k in path:
            node = node[k]
        return node


# ---------------------------------------------------------------- cursor visível

CURSOR_JS = r"""
(() => {
  const mobile = %s;
  const install = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = `
      #__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;
        transition:transform var(--d,600ms) cubic-bezier(.22,.8,.26,1), opacity .25s}
      #__cur .dot{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%%;
        background:rgba(20,19,18,.16);border:2px solid rgba(20,19,18,.55);transition:transform .18s, background .18s}
      #__cur.down .dot{transform:scale(.78);background:rgba(20,19,18,.3)}
      #__cur svg{position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))}
      #__cur.down svg{transform:scale(.9)}
      .__ripple{position:fixed;z-index:2147483646;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;
        border-radius:50%%;border:2px solid #157F58;animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:scale(4.2);opacity:0}}`;
    document.head.appendChild(st);
    const el = document.createElement('div');
    el.id = '__cur';
    el.innerHTML = mobile ? '<div class="dot"></div>' :
      '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l17 11-7.5 1.6L15 23l-3.4 1.4-3.6-8.3L2 20z" fill="#141312" stroke="#FAF8F2" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    el.style.transform = `translate(${innerWidth * 0.55}px, ${innerHeight * 0.62}px)`;
    document.body.appendChild(el);
  };
  window.__cur = {
    move(x, y, ms) { install(); const el = document.getElementById('__cur');
      el.style.setProperty('--d', ms + 'ms'); el.style.transform = `translate(${x}px, ${y}px)`; },
    press(x, y) { const el = document.getElementById('__cur'); el.classList.add('down');
      const r = document.createElement('div'); r.className = '__ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700); setTimeout(() => el.classList.remove('down'), 160); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
"""


class Director:
    def __init__(self, page: Page, mobile: bool):
        self.page = page
        self.mobile = mobile
        self.pos = (0.0, 0.0)
        self.marks: list[tuple[str, float]] = []

    def wait(self, ms: int):
        self.page.wait_for_timeout(ms)

    def mark(self, chapter: str):
        self.marks.append((chapter, time.time()))

    def move_to(self, x: float, y: float, ms: int = 650):
        self.page.evaluate('([x, y, ms]) => window.__cur && window.__cur.move(x, y, ms)', [x, y, ms])
        self.pos = (x, y)
        self.wait(ms + 80)

    def tap(self, locator, pause: int = 450):
        locator.scroll_into_view_if_needed()
        self.wait(250)
        box = locator.bounding_box()
        if not box:
            raise RuntimeError(f'Sem caixa para {locator}')
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.move_to(x, y)
        self.page.evaluate('([x, y]) => window.__cur && window.__cur.press(x, y)', [x, y])
        locator.click(timeout=8000)
        self.wait(pause)

    def scroll(self, dy: int, steps: int = 12, x: float | None = None, y: float | None = None):
        vp = self.page.viewport_size
        x = x if x is not None else vp['width'] * 0.5
        y = y if y is not None else vp['height'] * 0.5
        self.move_to(x, y, 400)
        for _ in range(steps):
            self.page.mouse.move(x, y)
            self.page.mouse.wheel(0, dy / steps)
            self.wait(45)
        self.wait(500)

    def type(self, locator, text: str):
        self.tap(locator, 200)
        locator.press_sequentially(text, delay=38)


# ---------------------------------------------------------------- respostas falsas

def sse_body(text: str) -> str:
    words = text.split(' ')
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= 4:
            chunks.append(' '.join(cur) + ' ')
            cur = []
    if cur:
        chunks.append(' '.join(cur))
    out = []
    for i, c in enumerate(chunks):
        payload = {
            'candidates': [{
                'content': {'role': 'model', 'parts': [{'text': c}]},
                'index': 0,
                **({'finishReason': 'STOP'} if i == len(chunks) - 1 else {}),
            }],
            'modelVersion': 'demo',
        }
        out.append('data: ' + json.dumps(payload, ensure_ascii=False) + '\r\n\r\n')
    return ''.join(out)


def install_stubs(page: Page, lang: str):
    fake_recaptcha = """
      window.grecaptcha = { enterprise: {
        ready: (cb) => cb(),
        render: () => 1,
        execute: () => Promise.resolve('demo-token'),
      } };
      (window.___grecaptcha_cfg = window.___grecaptcha_cfg || {});
    """
    page.route('**/recaptcha/enterprise.js*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body=fake_recaptcha))
    page.route('**/firebaseappcheck.googleapis.com/**', lambda r: r.fulfill(
        status=200, content_type='application/json', body=json.dumps({'token': 'demo', 'ttl': '3600s'})))

    def ai(route):
        url = route.request.url
        if 'streamGenerateContent' in url:
            route.fulfill(status=200, content_type='text/event-stream', body=sse_body(TUTOR_REPLY[lang]))
        elif 'countTokens' in url:
            route.fulfill(status=200, content_type='application/json', body='{"totalTokens": 120}')
        else:
            route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'candidates': [{'content': {'role': 'model', 'parts': [{'text': TUTOR_REPLY[lang]}]},
                                'finishReason': 'STOP', 'index': 0}]}))
    page.route('**/firebasevertexai.googleapis.com/**', ai)


# ---------------------------------------------------------------- guião

def script(d: Director, s: Strings, shots: pathlib.Path):
    page = d.page

    def shot(name: str):
        page.evaluate("document.getElementById('__cur') && (document.getElementById('__cur').style.opacity = 0)")
        page.screenshot(path=str(shots / f'{name}.png'))
        page.evaluate("document.getElementById('__cur') && (document.getElementById('__cur').style.opacity = 1)")

    def nav(href: str):
        return page.locator(f'a[href="{href}"]:visible').last

    # 1. Hoje
    d.mark('hoje')
    d.wait(2600)
    shot('hoje')
    d.scroll(520)
    d.wait(900)
    d.scroll(-520)
    d.wait(700)

    # 2. Plano
    d.mark('plano')
    d.tap(nav('/plano'), 1600)
    shot('plano')
    d.scroll(700, 16)
    d.wait(1400)
    d.scroll(-700, 10)

    # 3. Foco
    d.mark('foco')
    d.tap(nav('/'), 1200)
    d.tap(page.get_by_role('button', name='25 min').first, 1300)
    d.tap(page.get_by_role('button', name=s('plan', 'Iniciar'), exact=True).first, 2200)
    shot('foco')
    page.clock.fast_forward('24:52')
    d.wait(9500)

    # 4. Prática
    d.mark('pratica')
    d.wait(1500)
    shot('pratica')
    d.tap(page.get_by_role('button', name=s('plan', 'Dominei'), exact=True).first, 1400)
    d.tap(page.get_by_role('button', name=s('plan', 'Fechar'), exact=True).last, 2200)

    # 5. Progresso
    d.mark('progresso')
    if d.mobile:
        more = page.get_by_role('button', name=s('common', 'Mais opções e definições')).first
        link = page.locator('a[href="/progresso"]:visible')
        for _ in range(3):
            d.tap(more, 1100)
            if link.count():
                break
        d.tap(link.last, 1600)
    else:
        d.tap(nav('/progresso'), 1600)
    shot('progresso')
    d.scroll(900, 18)
    d.wait(1500)

    # 6. Tutor
    d.mark('tutor')
    d.tap(nav('/assistente'), 1500)
    enable = page.get_by_role('button', name=s('assistant', 'Ativar Uni'), exact=True)
    if enable.count():
        d.tap(enable.first, 1200)
    d.tap(page.get_by_role('button', name=s('assistant', 'O que devo estudar hoje?')).first, 4500)
    shot('tutor')
    d.wait(2500)
    d.mark('fim')


# ---------------------------------------------------------------- gravação

def record(base: str, lang: str, device: str, out_dir: pathlib.Path, headed: bool):
    mobile = device == 'mobile'
    work = pathlib.Path(tempfile.mkdtemp(prefix=f'film-{lang}-{device}-'))
    frames_dir = work / 'frames'
    frames_dir.mkdir()
    shots = work / 'shots'
    shots.mkdir()
    frames: list[tuple[float, pathlib.Path]] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        ctx = browser.new_context(locale=lang, color_scheme='light', reduced_motion='no-preference', **DEVICES[device])
        page = ctx.new_page()
        page.add_init_script(CURSOR_JS % ('true' if mobile else 'false'))
        install_stubs(page, lang)
        page.clock.install()
        page.goto(f'{base}/?demo=1', wait_until='networkidle')
        page.wait_for_timeout(1500)
        # Recomeça já com os dados da demonstração carregados (sem o primeiro ecrã em branco).
        page.goto(f'{base}/', wait_until='networkidle')
        page.wait_for_timeout(800)

        cdp = ctx.new_cdp_session(page)
        vp = DEVICES[device]['viewport']
        dsf = DEVICES[device].get('device_scale_factor', 1)

        def on_frame(ev):
            path = frames_dir / f'{len(frames):05d}.jpg'
            import base64
            path.write_bytes(base64.b64decode(ev['data']))
            frames.append((ev['metadata']['timestamp'], path))
            try:
                cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
            except Exception:
                pass

        cdp.on('Page.screencastFrame', on_frame)
        cdp.send('Page.startScreencast', {
            'format': 'jpeg', 'quality': 92,
            'maxWidth': vp['width'] * dsf, 'maxHeight': vp['height'] * dsf, 'everyNthFrame': 1,
        })
        t0 = time.time()
        d = Director(page, mobile)
        d.move_to(vp['width'] * 0.55, vp['height'] * 0.62, 10)
        try:
            script(d, Strings(lang), shots)
        except Exception:
            fail = work / 'falhou.png'
            page.screenshot(path=str(fail))
            print(f'  ✗ falhou; ecrã em {fail}; capturas em {shots}', file=sys.stderr)
            raise
        finally:
            page.wait_for_timeout(300)
            cdp.send('Page.stopScreencast')
            page.wait_for_timeout(300)
            browser.close()

    if len(frames) < 10:
        raise RuntimeError('Gravação sem frames suficientes')
    start = frames[0][0]
    end = time.time()
    # Lista para o demuxer concat do ffmpeg (cada frame dura até ao seguinte).
    lines = []
    for i, (ts, path) in enumerate(frames):
        nxt = frames[i + 1][0] if i + 1 < len(frames) else ts + 0.5
        lines.append(f"file '{path}'\nduration {max(nxt - ts, 0.001):.4f}")
    lines.append(f"file '{frames[-1][1]}'")
    (work / 'list.txt').write_text('\n'.join(lines))

    out_dir.mkdir(parents=True, exist_ok=True)
    w, h = vp['width'] * dsf, vp['height'] * dsf
    scale = 'scale=720:-2' if mobile else 'scale=1440:-2'
    base_args = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(work / 'list.txt')]
    vf = f'fps=30,{scale}:flags=lanczos,format=yuv420p'
    subprocess.run(base_args + ['-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
                                '-movflags', '+faststart', '-an', str(out_dir / f'film-{device}.mp4')], check=True)
    subprocess.run(base_args + ['-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1',
                                '-an', str(out_dir / f'film-{device}.webm')], check=True)

    chapters = []
    for i, (name, ts) in enumerate(d.marks):
        if name == 'fim':
            break
        chapters.append({'id': name, 'start': round(max(ts - start, 0), 2)})
    duration = round(min(end, d.marks[-1][1]) - start, 2)
    for i, c in enumerate(chapters):
        c['end'] = chapters[i + 1]['start'] if i + 1 < len(chapters) else duration
    (out_dir / f'chapters-{device}.json').write_text(json.dumps({'duration': duration, 'chapters': chapters}, indent=2))

    # Capturas por cena (webp) e poster.
    for png in shots.glob('*.png'):
        target = out_dir / f'{png.stem}-{device}.webp'
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', str(png), '-vf',
                        ('scale=600:-2' if mobile else 'scale=1440:-2'), '-quality', '82', str(target)], check=True)
    if mobile:
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', str(shots / 'hoje.png'), '-vf', 'scale=720:-2',
                        '-q:v', '4', str(out_dir / 'poster.jpg')], check=True)
        # Loop curto para o ecrã do telemóvel 3D do hero (Hoje → Plano).
        loop_end = chapters[2]['start'] if len(chapters) > 2 else 12
        subprocess.run(base_args + ['-t', f'{min(loop_end, 14):.2f}', '-vf', 'fps=30,scale=540:-2:flags=lanczos,format=yuv420p',
                                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', '-an',
                                    str(out_dir / 'hero-loop.mp4')], check=True)
    shutil.rmtree(work, ignore_errors=True)
    print(f'  ✓ {lang} {device}: {duration:.1f}s, {len(frames)} frames → {out_dir.relative_to(ROOT)}')


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
    ap.add_argument('--device', choices=list(DEVICES), action='append')
    ap.add_argument('--base', help='URL de uma app já a correr (por omissão: vite preview do dist/)')
    ap.add_argument('--headed', action='store_true')
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
            for device in args.device or list(DEVICES):
                record(base, lang, device, OUT / lang, args.headed)
    finally:
        if server:
            server.terminate()
    return 0


if __name__ == '__main__':
    sys.exit(main())
