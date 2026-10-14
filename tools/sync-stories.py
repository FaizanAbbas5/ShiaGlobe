"""Copy the children's stories into the site, each in its own folder, so they can be shared from GitHub Pages.

The stories are made in their own projects next to this repo. Their built pages are the same files that are
published as claude.ai artifacts: page fragments without <html> or <head>. This script copies the built page and
its files and puts a full HTML document around it, with the link-preview tags that WhatsApp and others read.
It never rebuilds a story; build it in its own project first. The 2D book's pictures (live SVG in the book itself)
are drawn to JPEGs for the site's copy, so its page turns stay smooth on phones (see prerender_pages).

    ../dua-faraj/film/index.html + recitation.mp3         ->  dua-al-faraj/
    ../jar-of-lights/dist/book.html                        ->  wrap-a-kindness/
    ../littlest-khadim/reader/dist/book.html + pages/      ->  littlest-khadim/

Usage:  python tools/sync-stories.py            copy the pages
        python tools/sync-stories.py --thumbs   also redraw the pictures in assets/img/stories/ (the landing page
                                                cards and the link previews), using the installed Edge
"""
import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
PROJECTS = SITE.parent
BASE_URL = 'https://faizanabbas5.github.io/ShiaGlobe/'
EDGE = Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
# The base styles claude.ai puts around every artifact. The stories were designed inside them (the film has no
# body margin of its own, for one), so the site pages carry the same rules.
HOST_BASE_CSS = (':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);'
                 'padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}'
                 'body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}'
                 'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}')

STORIES = [
    {
        'slug': 'dua-al-faraj',
        'page': PROJECTS / 'dua-faraj' / 'film' / 'index.html',
        'files': {'recitation.mp3': PROJECTS / 'dua-faraj' / 'film' / 'recitation.mp3'},
        'title': 'Dua al-Faraj for Children',
        'description': 'A learn-along animated film: a father recites Dua al-Faraj on a rooftop at night, '
                       'and his son and daughter join in. The Arabic, transliteration and meaning follow every word.',
        # the title card over the family on the rooftop (the film's ?t= still mode)
        'thumb': {'query': '?t=1.5', 'size': (1920, 1080)},
    },
    {
        'slug': 'wrap-a-kindness',
        'page': PROJECTS / 'jar-of-lights' / 'dist' / 'book.html',
        'files': {},
        'title': 'How Do You Wrap a Kindness?',
        'description': "A Kumayl & Fizza picture book for the 15th of Sha'ban. Fizza wants to give the hidden Imam "
                       'a birthday present. But how do you wrap a kindness?',
        # the cover, as the reader renders it for print (#sheet-<page>)
        'thumb': {'query': '#sheet-cover', 'size': (1600, 1131)},
        # its pictures are live SVG; the site's copy shows them as images (see prerender_pages)
        'prerender': True,
    },
    {
        'slug': 'littlest-khadim',
        'page': PROJECTS / 'littlest-khadim' / 'reader' / 'dist' / 'book.html',
        'files': {'pages': PROJECTS / 'littlest-khadim' / 'reader' / 'dist' / 'pages'},
        'title': 'The Littlest Khadim',
        'description': 'A Kumayl & Fizza picture book about the Arbaeen walk to Karbala. Fizza is too small for every '
                       'job at the mawkib, until she spots the one person everyone else walked past.',
        # the cover render itself
        'thumb': {'image': PROJECTS / 'littlest-khadim' / 'reader' / 'dist' / 'pages' / 'cover.jpg'},
    },
]


def head(story):
    """The document start, up to <body>. The fragment (its own <title>, links and styles first) goes inside the
    body, as on claude.ai. The explicit </body> after it matters: dev servers such as VS Code's Live Server
    insert their reload script before </body>, and without one they insert it before every </svg>, including
    the ones inside the stories' JavaScript strings, which cuts the scripts apart."""
    a = lambda s: html.escape(s, quote=True)
    url = BASE_URL + story['slug'] + '/'
    image = BASE_URL + 'assets/img/stories/' + story['slug'] + '.jpg'
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{a(story['description'])}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tārīkh al-Shi'a">
<meta property="og:title" content="{a(story['title'])}">
<meta property="og:description" content="{a(story['description'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<style>{HOST_BASE_CSS}</style>
</head>
<body>
'''


def copy_story(story):
    src = story['page'].read_text(encoding='utf-8')
    if not src.lstrip().startswith('<title>'):
        sys.exit(f"{story['page']}: expected a page fragment starting with <title>; has its build changed?")
    out = SITE / story['slug']
    out.mkdir(exist_ok=True)
    if '</body>' in src.lower():
        sys.exit(f"{story['page']}: the fragment has its own </body>; the wrapper would close the body twice")
    (out / 'index.html').write_text(head(story) + src.strip() + '\n</body>\n</html>\n', encoding='utf-8')
    for name, path in story['files'].items():
        if path.is_dir():
            shutil.copytree(path, out / name, dirs_exist_ok=True)
        else:
            shutil.copy2(path, out / name)
    print(f"{story['slug']}/  {len(src) // 1024} KB page, {len(story['files'])} supporting file(s)")


def prerender_pages(story):
    """Draws each page's picture once, as a JPEG, for a book whose pictures are live SVG (the 2D book): building and
    painting those SVGs (blurs, grain, textures) during a page turn made the turns stutter on phones. The site's copy
    then shows the pictures, and the reader still sets the text live. The book's own preview on claude.ai is untouched."""
    from PIL import Image
    out = SITE / story['slug']
    page = (out / 'index.html').read_text(encoding='utf-8')
    ids = re.findall(r"\{\s*id:\s*'([\w-]+)'", page[page.index('const PAGES'):])
    pages = out / 'pages'
    pages.mkdir(exist_ok=True)
    for old in pages.glob('*.jpg'):
        old.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        # the pictures only: the same page with its text panels hidden, rendered one page at a time (#sheet-<page>)
        art_only = Path(tmp) / 'art.html'
        art_only.write_text(page.replace('</head>', '<style>.page .text{display:none!important}</style></head>', 1), encoding='utf-8')
        for pid in ids:
            png = Path(tmp) / f'{pid}.png'
            screenshot(art_only, f'#sheet-{pid}', (1600, 1131), png)
            Image.open(png).convert('RGB').save(pages / f'{pid}.jpg', quality=86, optimize=True, progressive=True)
    # once the book's pages are defined, each page shows its picture instead of drawing itself
    marker = '<script>\n/* each page is drawn fresh wherever it appears'
    if page.count(marker) != 1:
        sys.exit(f"{story['slug']}: can't find where the reader starts; has the reader changed?")
    swap = ('<script>\n/* site copy: the pictures were drawn once by tools/sync-stories.py, so a page turn shows images */\n'
            'PAGES.forEach(p => { p.art = () => `<img src="pages/${p.id}.jpg" alt="${p.label}">`; });\n</script>\n')
    (out / 'index.html').write_text(page.replace(marker, swap + marker), encoding='utf-8')
    size = sum(f.stat().st_size for f in pages.glob('*.jpg')) // 1024
    print(f'  {len(ids)} page pictures in {story["slug"]}/pages/, {size} KB')


def screenshot(page, query, size, png):
    """Edge's headless screenshot (remote debugging is blocked by policy here, but the CLI works)."""
    url = page.resolve().as_uri() + query
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([str(EDGE), '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
                        f'--user-data-dir={profile}', '--virtual-time-budget=4000', f'--window-size={size[0]},{size[1]}',
                        f'--screenshot={png}', url], check=True, timeout=120, capture_output=True)


def make_thumb(story):
    from PIL import Image
    dest = SITE / 'assets' / 'img' / 'stories' / (story['slug'] + '.jpg')
    dest.parent.mkdir(parents=True, exist_ok=True)
    t = story['thumb']
    with tempfile.TemporaryDirectory() as tmp:
        src = t.get('image')
        if not src:
            src = Path(tmp) / 'shot.png'
            screenshot(SITE / story['slug'] / 'index.html', t['query'], t['size'], src)
        im = Image.open(src).convert('RGB')
        im = im.resize((1200, round(1200 * im.height / im.width)), Image.LANCZOS)
        im.save(dest, quality=84, optimize=True, progressive=True)
    print(f'  {dest.relative_to(SITE)}  {im.width}x{im.height}, {dest.stat().st_size // 1024} KB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--thumbs', action='store_true', help='also redraw assets/img/stories/*.jpg')
    args = ap.parse_args()
    for s in STORIES:
        copy_story(s)
        if s.get('prerender'):
            prerender_pages(s)
        if args.thumbs:
            make_thumb(s)
