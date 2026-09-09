#!/usr/bin/env python3
"""Check shared site components and project naming. Standard library; no network."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

GAME_TITLE = 'The Legend of Zelda: The Minish Cap'
ORIGIN = 'https://raposomiguel50.github.io/'

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.styles, self.meta, self.canonical = [], {}, []
        self.title, self.visible = '', ''
        self.hidden = 0
        self.in_title = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'meta':
            self.meta[a.get('name', a.get('property', ''))] = a.get('content', '')
        if tag == 'link':
            rel = a.get('rel', '').split()
            if 'stylesheet' in rel:
                self.styles.append(a.get('href', ''))
            if 'canonical' in rel:
                self.canonical.append(a.get('href', ''))

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = max(0, self.hidden - 1)
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif not self.hidden:
            self.visible += data + ' '


def component(text, tag, class_name):
    pattern = r'<' + tag + r'\b[^>]*class="' + class_name + r'"[^>]*>.*?</' + tag + '>'
    matches = re.findall(pattern, text, flags=re.S)
    if len(matches) != 1:
        return ''
    value = re.sub(r'\s+aria-current="[^"]+"', '', matches[0])
    return re.sub(r'\s+', ' ', value).strip()


def check(root):
    root = root.resolve()
    errors, headers, footers, styles, tabs = [], set(), set(), set(), {}
    files = [p for p in sorted(root.rglob('*.html'))
             if not p.name.startswith('google')
             and not any(part.startswith('.') for part in p.relative_to(root).parts)]
    if not files:
        errors.append('No authored HTML pages found')
    for path in files:
        name = path.relative_to(root).as_posix()
        text = path.read_text(encoding='utf-8')
        doc = Document(text)
        for tag, cls, collection in [('header', 'site-header', headers), ('footer', 'site-footer', footers)]:
            value = component(text, tag, cls)
            if not value:
                errors.append(name + ': expected one shared ' + tag)
            collection.add(value)
        if len(doc.styles) != 1 or urlsplit(doc.styles[0]).path != '/assets/css/site.css':
            errors.append(name + ': use the shared site.css only')
        styles.add(tuple(doc.styles))
        for key in ('og:title', 'twitter:title'):
            if doc.meta.get(key) != doc.title:
                errors.append(name + ': ' + key + ' differs from page title')
        if name != '404.html':
            expected = ORIGIN + (name[:-10] if name.endswith('index.html') else name)
            if doc.canonical != [expected]:
                errors.append(name + ': canonical URL mismatch')
        elif 'noindex' not in doc.meta.get('robots', ''):
            errors.append(name + ': keep the 404 page out of the search index')
        if name.startswith('projects/'):
            key = '/'.join(name.split('/')[:2])
            value = component(text, 'nav', 'project-tabs')
            if not value:
                errors.append(name + ': missing project navigation')
            tabs.setdefault(key, set()).add(value)
        if 'minish-cap-rg34xx/' in name:
            for value, label in [(doc.visible, 'visible text'), (doc.title, 'title'),
                                 (doc.meta.get('description', ''), 'description')]:
                if GAME_TITLE not in value:
                    errors.append(name + ': full game title missing in ' + label)
        if name in ('index.html', '404.html', 'method/index.html') and GAME_TITLE not in doc.visible:
            errors.append(name + ': full game name missing from project reference')
    if len(headers) != 1:
        errors.append('Site headers are inconsistent')
    if len(footers) != 1:
        errors.append('Site footers are inconsistent')
    if len(styles) != 1:
        errors.append('Pages use different stylesheet versions')
    for project, values in tabs.items():
        if len(values) != 1:
            errors.append(project + ': project tabs are inconsistent')
    return {'pages': len(files), 'project_groups': len(tabs), 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = check(args.root)
    print(json.dumps(result, indent=2))
    return bool(result['errors'])

if __name__ == '__main__':
    raise SystemExit(main())
