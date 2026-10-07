# liu1689389990.github.io

Crypto daily editorial site. Auto-generated from Telegram channels @CryptoWeb3NewsDaily (EN) and @CryptoDailyZH (ZH).

## Unattended SEO editorial pipeline

See [`AUTOPILOT.md`](AUTOPILOT.md) for scope and publishing gates. The weekly editorial automation uses `content/editorial-backlog.json`; only independently written, sourced Chinese/English evergreen guides may pass through the site publishing workflow. RSS digests remain distinct from original guides.

Run the static-site checks before publishing:

```bash
python -m pip install -r requirements-validation.txt
python -m unittest discover -s tests -v
python scripts/seo_pipeline.py
```

GitHub Actions runs these checks on pushes and pull requests to `main`. Passing CI validates technical consistency only; it does not prove ranking, traffic, or factual correctness beyond the editorial source gate.
