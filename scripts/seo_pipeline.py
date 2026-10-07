"""SEO site validation and unattended publishing gates."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException

SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML_NS = "http://www.w3.org/1999/xhtml"


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.canonicals: list[str] = []
        self.titles: list[str] = []
        self.descriptions: list[str] = []
        self._in_title = False
        self._title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag.lower() == "title":
            self._in_title = True
        elif tag.lower() == "link" and "canonical" in (values.get("rel") or "").lower().split():
            self.canonicals.append(values.get("href") or "")
        elif tag.lower() == "meta" and (values.get("name") or "").lower() == "description":
            self.descriptions.append(values.get("content") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title" and self._in_title:
            self.titles.append(" ".join("".join(self._title_parts).split()))
            self._title_parts.clear()
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)


def _local_file(root: Path, url: str) -> Path | None:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        return None
    path = parsed.path
    if path in ("", "/"):
        candidate = root / "index.html"
    elif path.endswith("/"):
        candidate = root / path.lstrip("/") / "index.html"
    else:
        candidate = root / path.lstrip("/")
    try:
        candidate.resolve().relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def _validate_language_feeds(root: Path, sitemap_urls: set[str]) -> list[str]:
    errors: list[str] = []
    base = urlsplit(next(iter(sitemap_urls)))
    for language, filename, expected_language in (
        ("zh", "feed-zh.xml", "zh-cn"),
        ("en", "feed-en.xml", "en"),
    ):
        path = root / filename
        if not path.is_file():
            errors.append(f"missing {filename}")
            continue
        try:
            channel = ET.parse(path).getroot().find("./channel")
        except (ET.ParseError, OSError, DefusedXmlException) as exc:
            errors.append(f"invalid {filename}: {exc}")
            continue
        if channel is None:
            errors.append(f"missing channel in {filename}")
            continue
        feed_language = (channel.findtext("language") or "").strip().lower()
        if feed_language != expected_language:
            errors.append(f"wrong language declaration in {filename}: {feed_language}")
        items = channel.findall("./item")
        if not items:
            errors.append(f"no items in {filename}")
        if len(items) > 10:
            errors.append(f"more than 10 items in {filename}")
        seen: set[str] = set()
        for item in items:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not title or not link:
                errors.append(f"missing title or link in {filename}")
                continue
            parsed = urlsplit(link)
            parts = parsed.path.strip("/").split("/")
            is_guide = (
                len(parts) == 2 and parts[0] == "guides" if language == "zh"
                else len(parts) == 3 and parts[0] == "en" and parts[1] == "guides"
            )
            if (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc) or not is_guide:
                errors.append(f"wrong language in {filename}: {link}")
            if link not in sitemap_urls:
                errors.append(f"feed URL not in sitemap in {filename}: {link}")
            if link in seen:
                errors.append(f"duplicate feed URL in {filename}: {link}")
            seen.add(link)
    return errors


def validate_site(root: Path) -> list[str]:
    """Return deterministic build-blocking validation errors for a static site."""
    root = Path(root)
    errors: list[str] = []
    sitemap_path = root / "sitemap.xml"
    robots_path = root / "robots.txt"
    if not sitemap_path.is_file():
        return ["missing sitemap.xml"]
    if not robots_path.is_file():
        errors.append("missing robots.txt")

    try:
        tree = ET.parse(sitemap_path)
    except (ET.ParseError, OSError, DefusedXmlException) as exc:
        return errors + [f"invalid sitemap XML: {exc}"]

    url_nodes = tree.findall(f".//{{{SITEMAP_NS}}}loc")
    urls = [(node.text or "").strip() for node in url_nodes]
    if not urls:
        return errors + ["sitemap has no loc entries"]
    if len(urls) != len(set(urls)):
        errors.append("duplicate sitemap loc")
    url_set = set(urls)
    first = urlsplit(urls[0])
    expected_sitemap = f"{first.scheme}://{first.netloc}/sitemap.xml" if first.netloc else ""
    if robots_path.is_file() and expected_sitemap not in robots_path.read_text(encoding="utf-8", errors="replace"):
        errors.append(f"robots.txt missing Sitemap directive for {expected_sitemap}")

    for entry in tree.findall(f".//{{{SITEMAP_NS}}}url"):
        loc_node = entry.find(f"{{{SITEMAP_NS}}}loc")
        url = (loc_node.text or "").strip() if loc_node is not None else ""
        page = _local_file(root, url)
        if page is None:
            errors.append(f"invalid sitemap URL: {url}")
            continue
        if not page.is_file():
            errors.append(f"missing sitemap target: {url}")
            continue
        parser = _MetadataParser()
        try:
            parser.feed(page.read_text(encoding="utf-8"))
        except (OSError, UnicodeError) as exc:
            errors.append(f"cannot read {url}: {exc}")
            continue
        if len(parser.canonicals) != 1 or parser.canonicals[0] != url:
            errors.append(f"canonical mismatch: {url}")
        if len(parser.titles) != 1 or not parser.titles[0]:
            errors.append(f"missing or duplicate title: {url}")
        if len(parser.descriptions) != 1 or not parser.descriptions[0].strip():
            errors.append(f"missing or duplicate description: {url}")
        for alt in entry.findall(f"{{{XHTML_NS}}}link"):
            href = (alt.attrib.get("href") or "").strip()
            hreflang = (alt.attrib.get("hreflang") or "").strip()
            if not href or not hreflang:
                errors.append(f"incomplete hreflang alternate: {url}")
            elif href not in url_set:
                errors.append(f"hreflang target not in sitemap: {url} -> {href}")

    errors.extend(_validate_language_feeds(root, url_set))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate static-site SEO and publishing invariants")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate_site(args.root)
    if errors:
        print(f"SEO validation failed: {len(errors)} issue(s)")
        for error in errors:
            print(f"- {error}")
        return 1
    print("SEO validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
