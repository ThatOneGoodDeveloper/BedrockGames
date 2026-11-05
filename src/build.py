import re, datetime
from urllib.parse import quote

BUILD_ID = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
import os, json, base64
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = HERE + '/app/'
GAME = HERE + '/game/'
THUMBS = HERE + '/thumbs/'

NS = 'xmlns="http://www.w3.org/2000/svg"'
STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
_n = [0]

TOP = {'o': (32, 12), 'u': (20, 11), 'v': (-20, 11)}
LEFT = {'o': (12, 23), 'u': (20, 11), 'v': (0, 22)}
RIGHT = {'o': (32, 34), 'u': (20, -11), 'v': (0, 22)}
SPECKS = {
    'top': [(.10, .15, .16, .14, 'd'), (.45, .08, .14, .12, 'l'), (.72, .22, .15, .16, 'd'), (.22, .50, .17, .13, 'l'),
            (.55, .48, .12, .15, 'd'), (.80, .62, .13, .12, 'l'), (.08, .78, .14, .12, 'd'), (.40, .76, .16, .14, 'd'), (.65, .84, .12, .10, 'l')],
    'left': [(.14, .10, .18, .10, 'd'), (.55, .06, .14, .12, 'l'), (.30, .32, .16, .09, 'l'), (.70, .38, .18, .11, 'd'),
             (.10, .58, .15, .10, 'd'), (.48, .62, .18, .09, 'l'), (.78, .74, .14, .10, 'd'), (.25, .86, .17, .08, 'd')],
    'right': [(.60, .12, .16, .10, 'd'), (.18, .08, .14, .10, 'l'), (.45, .34, .18, .09, 'd'), (.12, .42, .15, .11, 'd'),
              (.72, .55, .16, .10, 'l'), (.34, .66, .16, .09, 'l'), (.62, .80, .15, .10, 'd'), (.15, .84, .16, .08, 'd')],
}


def _pt(f, a, b):
    return (f['o'][0] + a * f['u'][0] + b * f['v'][0], f['o'][1] + a * f['u'][1] + b * f['v'][1])


def _poly(points, fill, extra=''):
    return '<path d="M%sZ" fill="%s"%s/>' % ('L'.join('%.2f %.2f' % p for p in points), fill, extra)


def _face(f, base, specks):
    out = [_poly([_pt(f, 0, 0), _pt(f, 1, 0), _pt(f, 1, 1), _pt(f, 0, 1)], base)]
    for a, b, w, h, kind in specks:
        pts = [_pt(f, a, b), _pt(f, a + w, b), _pt(f, a + w, b + h), _pt(f, a, b + h)]
        out.append(_poly(pts, '#ffffff' if kind == 'l' else '#000000', ' fill-opacity="%s"' % ('0.17' if kind == 'l' else '0.30')))
    return ''.join(out)


def logo(size, static=False):
    _n[0] += 1
    gid, rid = 'lg%d' % _n[0], 'lr%d' % _n[0]
    if static:
        glow = '#0a84ff'
        rim = '#7cc4ff'
        glow_stop = '<stop offset="0" stop-color="%s" stop-opacity="0.55"/><stop offset="1" stop-color="%s" stop-opacity="0"/>' % (glow, glow)
    else:
        rim = 'color-mix(in srgb, var(--hi) 55%, #fff)'
        glow_stop = ('<stop offset="0" style="stop-color:var(--hi)" stop-opacity="0.55"/>'
                     '<stop offset="1" style="stop-color:var(--hi)" stop-opacity="0"/>')
    rim_attr = 'stroke="%s"' % rim if static else 'style="stroke:%s"' % rim
    return ('<svg %s width="%d" height="%d" viewBox="0 0 64 64" aria-hidden="true"><defs>'
            '<linearGradient id="%s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3c43"/><stop offset="1" stop-color="#111215"/></linearGradient>'
            '<radialGradient id="%s" cx="0.28" cy="0.18" r="0.85">%s</radialGradient></defs>'
            '<rect width="64" height="64" rx="15" fill="url(#%s)"/><rect width="64" height="64" rx="15" fill="url(#%s)"/>'
            '%s%s%s'
            '<path d="M12 23L32 12L52 23" fill="none" stroke="#fff" stroke-opacity="0.38" stroke-width="1.2" stroke-linejoin="round"/>'
            '<path d="M12 23L32 12" fill="none" %s stroke-width="1.6" stroke-linecap="butt"/>'
            '</svg>') % (NS, size, size, gid, rid, glow_stop, gid, rid,
                         _face(LEFT, '#4b4d54', SPECKS['left']), _face(RIGHT, '#33353a', SPECKS['right']),
                         _face(TOP, '#74777f', SPECKS['top']), rim_attr)


def squircle(size, top, bot, inner):
    _n[0] += 1
    uid = 'ap%d' % _n[0]
    return ('<svg %s width="%d" height="%d" viewBox="0 0 64 64" aria-hidden="true"><defs>'
            '<linearGradient id="%s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
            '<rect width="64" height="64" rx="15" fill="url(#%s)"/>%s</svg>') % (NS, size, size, uid, top, bot, uid, inner)


APP_SVG = {
    'browser': lambda s: squircle(s, '#52d3ff', '#0a6cff',
        '<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="32" r="16"/>'
        '<ellipse cx="32" cy="32" rx="7" ry="16"/><path d="M16 32h32"/><path d="M19 23h26M19 41h26" stroke-width="2.2"/></g>'),
    'options': lambda s: squircle(s, '#a4a4ac', '#5b5b64',
        '<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"><path d="M16 24h18M42 24h6M16 40h6M30 40h18"/></g>'
        '<circle cx="38" cy="24" r="4.8" fill="#fff"/><circle cx="26" cy="40" r="4.8" fill="#fff"/>'),
    'random': lambda s: squircle(s, '#ffb13d', '#ff7a00',
        '<rect x="16" y="16" width="32" height="32" rx="8" fill="#fff"/>'
        '<g fill="#ff8a00"><circle cx="24" cy="24" r="3"/><circle cx="40" cy="24" r="3"/><circle cx="32" cy="32" r="3"/>'
        '<circle cx="24" cy="40" r="3"/><circle cx="40" cy="40" r="3"/></g>'),
    'help': lambda s: squircle(s, '#8a96ff', '#5656f0',
        '<text x="32" y="45" font-size="36" font-weight="700" text-anchor="middle" fill="#fff" '
        'font-family="-apple-system,system-ui,Segoe UI,sans-serif">?</text>'),
}


def icon(name, size):
    if name in ('logo', 'app-games'):
        return logo(size)
    if name.startswith('app-'):
        return APP_SVG[name[4:]](size)
    body = {
        'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        'dice': ('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/>'
                 '<circle cx="8.6" cy="8.6" r="1.1" fill="currentColor" stroke="none"/>'
                 '<circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'
                 '<circle cx="15.4" cy="15.4" r="1.1" fill="currentColor" stroke="none"/>'),
        'sliders': '<path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2.4"/><circle cx="9" cy="17" r="2.4"/>',
    }[name]
    return '<svg %s width="%d" height="%d" viewBox="0 0 24 24" %s aria-hidden="true">%s</svg>' % (NS, size, size, STROKE, body)


def icon_html(name, size):
    size = int(size)
    return '<span class="px" style="width:%dpx;height:%dpx">%s</span>' % (size, size, icon(name, size))


def data_uri(s):
    return 'data:image/svg+xml,' + quote(s, safe='')


def rd(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def uri(path, mime):
    with open(path, 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode())


def cdata(text):
    return '<![CDATA[' + text.replace(']]>', ']]]]><![CDATA[>') + ']]>'


# ---------- Desktop styles and icons ----------
css = rd(APP + 'site.css')
arrow = ('<svg %s width="12" height="8" viewBox="0 0 12 8"><path d="M1.5 1.5l4.5 4.5 4.5-4.5" fill="none" '
         'stroke="#8e8e93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>') % NS
css = css.replace('__ARROW__', data_uri(arrow))

favicon = data_uri(logo(64, static=True))
heart = ('<svg %s width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff3b30" '
         'd="M12 20.8C6.2 16.9 2.6 13.6 2.6 9.5 2.6 6.9 4.6 5 7 5c1.9 0 3.6 1 5 3 1.4-2 3.1-3 5-3 2.4 0 4.4 1.9 4.4 4.5 '
         '0 4.1-3.6 7.4-9.4 11.3z"/></svg>') % NS
assert "'" not in heart and "'" not in favicon

app_icons = {
    'games': logo(40), 'about': logo(40), 'options': APP_SVG['options'](40),
    'help': APP_SVG['help'](40), 'random': APP_SVG['random'](40),
}
js = rd(APP + 'site.js').replace('{{APPICONS}}', json.dumps(app_icons))

# ---------- Game list: thumbnails become data addresses ----------
def thumb_line(m):
    gid = m.group(1)
    return "id: '%s'%simg: '%s'" % (gid, m.group(2), uri(THUMBS + gid + '.webp', 'image/webp'))
data_src = rd(APP + 'data.js')
data = re.sub(r"emoji: '[^']*', ", '', data_src)
data = re.sub(r"id: '([^']+)'(.*?)img: '[^']+'", thumb_line, data)
data = re.sub(r", path: '[^']*'", '', data)
sourced = set(re.findall(r"^  '([^']+)': 'https", data_src, re.M))
local_ids = [g for g in re.findall(r"id: '([^']+)'", data_src) if g not in sourced]

# ---------- Built-in games: each page becomes one standalone HTML string ----------
ICON_NAMES = ['rewind', 'pause', 'next', 'audioOn', 'audioOff', 'larger', 'share1']
game_css = rd(GAME + 'css/site.css')
game_css = game_css.replace("url('../img/hero-arcade.jpg')", 'linear-gradient(transparent, transparent)')
game_css += '\n' + rd(GAME + 'css/games.css')
for n in ICON_NAMES:
    game_css = game_css.replace("url('../img/icons/%s.png')" % n, "url('%s')" % uri(GAME + 'icons/%s.png' % n, 'image/png'))
assert 'img/' not in game_css, re.findall(r'url\([^)]*img/[^)]*\)', game_css)[:3]


def card_map(prefix):
    out = {}
    for f in sorted(os.listdir(GAME + 'cards')):
        if f.startswith(prefix):
            out[f[:-5]] = uri(GAME + 'cards/' + f, 'image/webp')
    return out


def game_page(gid):
    h = rd(GAME + 'pages/%s/index.html' % gid)
    h = re.sub(r'<link\b[^>]*>', '', h)
    scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"[^>]*></script>', h)
    h = re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>', '', h)
    h = re.sub(r'\s(?:src|srcset|href)="(?:\.\./)+assets/[^"]*"', '', h)
    h = re.sub(r'<html\b([^>]*)>', r'<html\1 class="embed">', h, count=1)
    h = h.replace('</head>', '<style>@@GAMECSS@@</style></head>', 1)
    code = []
    if gid == 'blackjack':
        code.append('const __IMG = ' + json.dumps(card_map('deck-')) + ';')
    if gid == 'memory-match':
        code.append('const __IMG = ' + json.dumps(card_map('card')) + ';')
    for src in scripts:
        name = src.split('assets/js/', 1)[1]
        if name == 'site.js':
            continue
        if name == 'game-shell.js':
            code.append('@@SHELLJS@@')
            continue
        if name == 'game-page.js':
            code.append('@@PAGEJS@@')
            continue
        js_src = rd(GAME + 'js/' + name)
        js_src = js_src.replace('/assets/img/cards/deck/${card.suit}-${card.rank}.png', "${__IMG['deck-' + card.suit + '-' + card.rank]}")
        js_src = js_src.replace('/assets/img/cards/deck/back.png', "${__IMG['deck-back']}")
        js_src = re.sub(r"'/assets/img/cards/(\w+)\.png'", r"__IMG['\1']", js_src)
        assert '/assets/' not in js_src, (gid, name)
        code.append(js_src)
    body = '\n'.join('<script>\n' + c.replace('</script', '<\\/script') + '\n</script>' for c in code)
    return h.replace('</body>', body + '</body>', 1)


local_games = {gid: game_page(gid) for gid in local_ids}
game_lib = {'css': game_css, 'shell': rd(GAME + 'js/game-shell.js'), 'page': rd(GAME + 'js/game-page.js')}
data += '\n\nconst GAME_LIB = ' + json.dumps(game_lib, ensure_ascii=False).replace('</', '<\\/') + ';\nconst LOCAL_GAMES = ' + json.dumps(local_games, ensure_ascii=False).replace('</', '<\\/') + ';\n'

# ---------- The page ----------
template = rd(APP + 'template.html')
fill = lambda t: t.replace('{{FAVICON}}', favicon).replace('{{HEART}}', heart).replace('{{BUILD}}', BUILD_ID)
template = fill(template)
js = fill(js)
template = re.sub(r'\{\{ICON:([\w-]+):(\d+)\}\}', lambda m: icon_html(m.group(1), m.group(2)), template)

page = template.replace('{{CSS}}', css).replace('{{DATA}}', data).replace('{{JS}}', js)
assert '{{' not in page.replace('{ {', ''), re.findall(r'\{\{[^}]*\}\}', page)[:5]
with open(ROOT + '/index.html', 'w', encoding='utf-8') as f:
    f.write(page)
print('index.html', len(page), 'bytes')

# ---------- The same site as one SVG file: the markup lives in a foreignObject, no iframe ----------
from xml.etree import ElementTree as ET

head_script = re.search(r'<script>(.*?)</script>', template, re.S).group(1)
body = template.split('<body>', 1)[1].rsplit('<script>', 1)[0].replace('</body>', '')
ET.fromstring('<div xmlns="http://www.w3.org/1999/xhtml">' + body + '</div>')  # must be well-formed XML

svg_css = css.replace('html, body { height: 100%; }', ':root, #bgroot { height: 100%; }')
svg_css = re.sub(r'\nbody \{', '\n#bgroot {', svg_css, count=1)
svg_css += '\n#bgroot { position: relative; width: 100%; overflow: hidden; contain: layout; }\n'

shim = r"""(function () {
  // In an SVG document the page lives in a foreignObject: elements must be created in the XHTML namespace,
  // innerHTML text must be parsed as HTML, and there is no <body>.
  var XHTML = 'http://www.w3.org/1999/xhtml';
  Document.prototype.createElement = function (t) { return this.createElementNS(XHTML, String(t).toLowerCase()); };
  var d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    get: d.get,
    set: function (html) {
      html = String(html);
      while (this.firstChild) this.removeChild(this.firstChild);
      if (!html) return;
      var doc = new DOMParser().parseFromString('<!doctype html><html><body>' + html + '</body></html>', 'text/html');
      var kids = Array.prototype.slice.call(doc.body.childNodes);
      for (var i = 0; i < kids.length; i++) this.appendChild(document.importNode(kids[i], true));
    }
  });
  Object.defineProperty(document, 'body', { configurable: true, get: function () { return document.getElementById('bgroot'); } });
})();
"""

svg = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" lang="en" data-wall="horizon">\n'
    '<title>Bedrock Games</title>\n<desc>bgbuild=' + BUILD_ID + ';</desc>\n'
    '<style>' + cdata(svg_css) + '</style>\n'
    '<foreignObject x="0" y="0" width="100%" height="100%">\n'
    '<div xmlns="http://www.w3.org/1999/xhtml" id="bgroot">' + body + '</div>\n'
    '</foreignObject>\n'
    '<script>' + cdata(shim + head_script + '\n' + data + '\n' + js) + '</script>\n'
    '</svg>\n'
)
with open(ROOT + '/bedrock.svg', 'w', encoding='utf-8') as f:
    f.write(svg)
print('bedrock.svg', len(svg), 'bytes')
