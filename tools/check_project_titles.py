#!/usr/bin/env python3
"""Require page titles to identify the port's target and purpose."""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys

class Titles(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.fields = {'h1': '', 'title': '', 'og:title': '', 'twitter:title': ''}
        self.current = None
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        if tag in ('h1', 'title'):
            self.current = tag
        if tag == 'meta':
            attrs = dict(attrs)
            key = attrs.get('name', attrs.get('property'))
            if key in self.fields:
                self.fields[key] = attrs.get('content', '')
    def handle_data(self, data):
        if self.current:
            self.fields[self.current] += data
    def handle_endtag(self, tag):
        if tag == self.current:
            self.current = None

def check(root):
    errors, checked = [], 0
    for folder, target in [('minish-cap-rg34xx', 'RG34XX'), ('system-shock-android', 'Android')]:
        for page in ['index.html', 'knowledge/index.html', 'reproduce/index.html']:
            path = root / 'projects' / folder / page
            if not path.is_file():
                errors.append(str(path.relative_to(root)) + ': missing page')
                continue
            for field, text in Titles(path.read_text(encoding='utf-8')).fields.items():
                checked += 1
                words = text.lower().replace(':', ' ').replace('—', ' ').split()
                if target.lower() not in words or 'port' not in words:
                    errors.append(str(path.relative_to(root)) + ': ' + field + ' must identify the port and its target')
    return {'title_fields_checked': checked, 'errors': errors}

if __name__ == '__main__':
    result = check(Path(__file__).resolve().parents[1])
    print(json.dumps(result, indent=2))
    sys.exit(bool(result['errors']))
