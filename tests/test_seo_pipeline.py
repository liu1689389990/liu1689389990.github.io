import tempfile
import unittest
from pathlib import Path

from scripts.seo_pipeline import validate_site


class ValidateSiteTests(unittest.TestCase):
    def make_site(self, root: Path):
        (root / "en").mkdir()
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
        (root / "robots.txt").write_text(
            "User-agent: *\nAllow: /\nSitemap: https://example.test/sitemap.xml\n",
            encoding="utf-8")
        (root / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>https://example.test/</loc></url>'
            '<url><loc>https://example.test/en/</loc></url>'
            '</urlset>', encoding="utf-8")

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


if __name__ == "__main__":
    unittest.main()
