#!/usr/bin/env python3
"""Read-only checks for the authored HTML pages. No network or dependencies."""
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ORIGIN = 'https://raposomiguel50.github.io/'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.errors = [], [], []
        self.main = self.h1 = 0
        self.skip = False
        self.title = ''
        self.in_title = False
        self.in_json = False
        self.json_text = ''
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'main':
            self.main += 1
        if tag == 'h1':
            self.h1 += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'img' and 'alt' not in a:
            self.errors.append('image missing alt attribute')
        if tag == 'a' and 'skip-link' in a.get('class', '').split():
            self.skip = bool(a.get('href', '').startswith('#'))
        for key in ('href', 'src'):
            if a.get(key):
                self.links.append(a[key])
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.in_json, self.json_text = True, ''

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_json:
            self.json_text += data

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag == 'script' and self.in_json:
            try:
                json.loads(self.json_text)
            except ValueError:
                self.errors.append('invalid JSON-LD')
            self.in_json = False


def check(root):
    root = root.resolve()
    pages = {}
    for p in sorted(root.rglob('*.html')):
        if any(part.startswith('.') for part in p.relative_to(root).parts):
            continue
        if p.name.startswith('google'):
            continue  # Search Console verification token, not a document.
        pages[p] = Page(p.read_text(encoding='utf-8'))
    errors, checked = [], 0
    if not pages:
        errors.append('no authored HTML pages found')
    titles = Counter(p.title.strip() for p in pages.values())
    for path, page in pages.items():
        label = path.relative_to(root).as_posix()
        problems = list(page.errors)
        if page.main != 1 or page.h1 != 1:
            problems.append('expected one main and one h1')
        if not page.skip:
            problems.append('missing skip-to-content link')
        if not page.title.strip() or titles[page.title.strip()] != 1:
            problems.append('missing or duplicate page title')
        if len(page.ids) != len(set(page.ids)):
            problems.append('duplicate HTML id')
        for link in page.links:
            resolved = urlsplit(urljoin(ORIGIN + label, link))
            if resolved.scheme not in ('http', 'https') or resolved.netloc != urlsplit(ORIGIN).netloc:
                continue
            target = (root / unquote(resolved.path).lstrip('/')).resolve()
            if not target.is_relative_to(root):
                problems.append('local link escapes site root: ' + link)
                continue
            if target.is_dir():
                target /= 'index.html'
            checked += 1
            if not target.is_file():
                problems.append('missing local target: ' + link)
            elif resolved.fragment and target in pages and unquote(resolved.fragment) not in pages[target].ids:
                problems.append('missing anchor: ' + link)
        errors.extend(label + ': ' + p for p in problems)
    return {'pages': len(pages), 'local_links_checked': checked, 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = check(args.root)
    print(json.dumps(result, indent=2))
    return bool(result['errors'])

if __name__ == '__main__':
    raise SystemExit(main())
