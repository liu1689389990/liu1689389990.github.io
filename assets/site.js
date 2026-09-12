/* 加密货币每日资讯 · 站点脚本
   1) 主题切换（localStorage 记忆，四主题 + 特效档位联动）
   2) 行情实时刷新：CoinGecko 免费接口，失败自动退回构建时快照并标 stale
   3) 滚动浮现（IntersectionObserver，无则直接显示）
   所有面板数字均来自 API 快照或实时接口，脚本不产生任何假数据。 */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ── 1. 主题 ── */
  var FX = { terminal: 'full', dash: 'subtle', dim: 'full', paper: 'none' };
  var BG = { terminal: '#04070a', dash: '#080b12', dim: '#06040d', paper: '#faf8f3' };
  var NAME = { terminal: '暗黑终端', dash: '数据面板', dim: '三维赛博', paper: '纸媒刊物' };
  var KEY = '***';
  root.classList.add('js');

  function setTheme(t, save) {
    if (!FX[t]) t = 'terminal';
    root.setAttribute('data-theme', t);
    root.setAttribute('data-fx', FX[t]);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', BG[t]);
    var bs = document.querySelectorAll('.themesw button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-pressed', String(bs[i].getAttribute('data-t') === t));
      bs[i].title = NAME[bs[i].getAttribute('data-t')] || '';
    }
    if (save) { try { localStorage.setItem(KEY, t); } catch (e) {} }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  setTheme(saved || root.getAttribute('data-theme') || 'terminal', false);

  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.themesw button') : null;
    if (b) setTheme(b.getAttribute('data-t'), true);
  });

  /* ── 2. 滚动浮现 ── */
  var revs = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revs.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    for (var i = 0; i < revs.length; i++) io.observe(revs[i]);
  } else {
    for (var j = 0; j < revs.length; j++) revs[j].classList.add('in');
  }

  /* ── 3. 行情实时刷新 ── */
  var el = document.getElementById('mkt-data');
  if (!el) return;
  var mkt;
  try { mkt = JSON.parse(el.textContent); } catch (e) { return; }
  if (!mkt || !mkt.coins || !mkt.coins.length) return;

  function fmtUsd(v) {
    if (v == null || isNaN(v)) return '—';
    if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
    if (v >= 1) return '$' + v.toFixed(2);
    return '$' + v.toPrecision(3);
  }
  function fmtChg(c) {
    if (c == null || isNaN(c)) return '—';
    return (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
  }
  function setText(sel, txt) {
    var ns = document.querySelectorAll(sel);
    for (var i = 0; i < ns.length; i++) ns[i].textContent = txt;
  }
  function setLive(stale) {
    var box = document.querySelector('.tick-live');
    if (!box) return;
    var lbl = box.querySelector('[data-live]');
    if (stale) {
      box.classList.add('stale');
      if (lbl) lbl.textContent = '快照 ' + (mkt.fetched_at_str || '').slice(5);
    } else {
      box.classList.remove('stale');
      if (lbl) lbl.textContent = 'LIVE';
    }
  }
  function paint() {
    mkt.coins.forEach(function (c) {
      setText('[data-px="' + c.sym + '"]', fmtUsd(c.usd));
      var chgs = document.querySelectorAll('[data-chg="' + c.sym + '"]');
      for (var i = 0; i < chgs.length; i++) {
        chgs[i].textContent = fmtChg(c.chg24h);
        chgs[i].classList.remove('u', 'd');
        chgs[i].classList.add(c.chg24h >= 0 ? 'u' : 'd');
      }
    });
  }
  setLive(true); /* 初始按快照显示，实时拉到了再转 LIVE */

  var ids = mkt.coins.map(function (c) { return c.id; }).join(',');
  var URL = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids +
            '&vs_currencies=usd&include_24hr_change=true';

  function refresh() {
    fetch(URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var got = 0;
        mkt.coins.forEach(function (c) {
          var d = j[c.id];
          if (!d || d.usd == null) return;
          c.usd = d.usd;
          c.chg24h = Math.round((d.usd_24h_change || 0) * 100) / 100;
          got++;
        });
        if (got) { paint(); setLive(false); }
      })
      .catch(function () { setLive(true); });
  }
  setTimeout(refresh, 2500);
  setInterval(refresh, 90000);
})();
