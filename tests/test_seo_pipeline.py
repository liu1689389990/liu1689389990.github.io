import tempfile
import unittest
from pathlib import Path

from scripts.seo_pipeline import validate_site


class ValidateSiteTests(unittest.TestCase):
    def make_site(self, root: Path):
        (root / "en").mkdir()
        (root / "guides" / "test").mkdir(parents=True)
        (root / "en" / "guides" / "test").mkdir(parents=True)
        (root / "index.html").write_text(
            '<html><head><title>Home ZH</title>'
            '<meta name="description" content="Chinese home">'
            '<link rel="canonical" href="https://example.test/">'
            '</head><body>首页</body></html>', encoding="utf-8")
        (root / "en" / "index.html").write_text(
            '<html><head><title>Home EN</title>'
            '<meta name="description" content="English home">'
            '<link rel="canonical" href="https://example.test/en/">'
            '</head><body>Home</body></html>', encoding="utf-8")
        (root / "guides" / "test" / "index.html").write_text(
            '<html><head><title>Guide ZH</title>'
            '<meta name="description" content="Chinese guide">'
            '<link rel="canonical" href="https://example.test/guides/test/">'
            '</head><body>指南</body></html>', encoding="utf-8")
        (root / "en" / "guides" / "test" / "index.html").write_text(
            '<html><head><title>Guide EN</title>'
            '<meta name="description" content="English guide">'
            '<link rel="canonical" href="https://example.test/en/guides/test/">'
            '</head><body>Guide</body></html>', encoding="utf-8")
        (root / "robots.txt").write_text(
            "User-agent: *\nAllow: /\nSitemap: https://example.test/sitemap.xml\n",
            encoding="utf-8")
        (root / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>https://example.test/</loc></url>'
            '<url><loc>https://example.test/en/</loc></url>'
            '<url><loc>https://example.test/guides/test/</loc></url>'
            '<url><loc>https://example.test/en/guides/test/</loc></url>'
            '</urlset>', encoding="utf-8")
        (root / "feed-zh.xml").write_text(
            '<rss><channel><language>zh-cn</language><item><title>Guide ZH</title>'
            '<link>https://example.test/guides/test/</link></item></channel></rss>', encoding="utf-8")
        (root / "feed-en.xml").write_text(
            '<rss><channel><language>en</language><item><title>Guide EN</title>'
            '<link>https://example.test/en/guides/test/</link></item></channel></rss>', encoding="utf-8")

    def test_valid_site_has_no_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_site(root)
            self.assertEqual(validate_site(root), [])

    def test_missing_sitemap_page_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_site(root)
            (root / "sitemap.xml").write_text(
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<url><loc>https://example.test/</loc></url>'
                '<url><loc>https://example.test/missing/</loc></url>'
                '</urlset>', encoding="utf-8")
            errors = validate_site(root)
            self.assertTrue(any("missing sitemap target" in error for error in errors))

    def test_canonical_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_site(root)
            (root / "index.html").write_text(
                '<html><head><title>Home</title>'
                '<meta name="description" content="desc">'
                '<link rel="canonical" href="https://example.test/wrong/">'
                '</head></html>', encoding="utf-8")
            errors = validate_site(root)
            self.assertTrue(any("canonical mismatch" in error for error in errors))

    def test_language_feed_rejects_cross_language_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_site(root)
            (root / "feed-zh.xml").write_text(
                '<rss><channel><language>zh-cn</language><item><title>Wrong</title>'
                '<link>https://example.test/en/guides/test/</link></item></channel></rss>', encoding="utf-8")
            errors = validate_site(root)
            self.assertTrue(any("wrong language in feed-zh.xml" in error for error in errors))

    def test_language_feed_is_bounded_to_ten_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_site(root)
            item = '<item><title>Guide</title><link>https://example.test/guides/test/</link></item>'
            (root / "feed-zh.xml").write_text(
                '<rss><channel><language>zh-cn</language>' + item * 11 + '</channel></rss>', encoding="utf-8")
            errors = validate_site(root)
            self.assertTrue(any("more than 10 items in feed-zh.xml" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
