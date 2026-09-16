/* 加密货币每日资讯 · 站点脚本
   1) 主题切换（localStorage 记忆，四主题 + 特效档位联动）
   2) 滚动浮现（IntersectionObserver，无则直接显示）
   3) 行情实时刷新：CoinGecko 免费接口，失败自动退回构建时快照并标 stale
   4) 互动层：可拖拽浮窗 / 猜涨跌（真实币价判定）/ 币雨彩蛋 / 3D 立方体拖转
   所有面板数字与游戏判定均来自 API 快照或实时接口，脚本不产生任何假数据。 */
(function () {
  'use strict';
  var root = document.documentElement;

  /* 页面语言：<html lang="en"> 即英文站，互动层文案跟随 */
  var IS_EN = document.documentElement.lang === 'en';

  /* ── 1. 主题 ── */
  var FX = { terminal: 'full', dash: 'subtle', dim: 'full', paper: 'none' };
  var BG = { terminal: '#04070a', dash: '#080b12', dim: '#06040d', paper: '#faf8f3' };
  var NAME = IS_EN
    ? { terminal: 'Dark Terminal', dash: 'Data Dash', dim: 'Cyber 3D', paper: 'Newsprint' }
    : { terminal: '暗黑终端', dash: '数据面板', dim: '三维赛博', paper: '纸媒刊物' };
  var KEY = 'cdd-theme';
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

  var savedTheme = null;
  try { savedTheme = localStorage.getItem(KEY); } catch (e) {}
  setTheme(savedTheme || root.getAttribute('data-theme') || 'terminal', false);

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
  var livePrices = {};   /* 最近一次成功实时拉取的价格 {BTC: 77467, ...} */
  var CG_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=';
  (function () {
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
        if (lbl) lbl.textContent = (IS_EN ? 'Snapshot ' : '快照 ') + (mkt.fetched_at_str || '').slice(5);
      } else {
        box.classList.remove('stale');
        if (lbl) lbl.textContent = 'LIVE';
      }
    }
    function paint() {
      mkt.coins.forEach(function (c) {
        var oldPx = document.querySelector('[data-px="' + c.sym + '"]');
        var oldChgs = document.querySelectorAll('[data-chg="' + c.sym + '"]');
        setText('[data-px="' + c.sym + '"]', fmtUsd(c.usd));
        var chgs = document.querySelectorAll('[data-chg="' + c.sym + '"]');
        for (var i = 0; i < chgs.length; i++) {
          chgs[i].textContent = fmtChg(c.chg24h);
          chgs[i].classList.remove('u', 'd');
          chgs[i].classList.add(c.chg24h >= 0 ? 'u' : 'd');
        }
        /* 价格变动闪光 */
        if (oldPx && oldPx.textContent !== fmtUsd(c.usd)) {
          oldPx.classList.remove('flash');
          void oldPx.offsetWidth; /* force reflow */
          oldPx.classList.add('flash');
        }
        for (var j = 0; j < chgs.length; j++) {
          chgs[j].classList.remove('bump');
          void chgs[j].offsetWidth;
          chgs[j].classList.add('bump');
        }
      });
    }
    setLive(true); /* 初始按快照显示，实时拉到了再转 LIVE */

    /* 恐惧贪婪仪表盘指针动画 */
    (function animGauge() {
      var needle = document.querySelector('.gauge line');
      if (!needle) return;
      var cx = 100, cy = 92, R = 55;
      function needlePos(v) {
        var rad = Math.PI * (1 - v / 100);
        return { x: (cx + R * Math.cos(rad)).toFixed(1), y: (cy - R * Math.sin(rad)).toFixed(1) };
      }
      var cur = parseInt(needle.getAttribute('x2'));
      if (!isNaN(cur)) {
        var pos = needlePos(cur);
        needle.setAttribute('x2', pos.x);
        needle.setAttribute('y2', pos.y);
      }
      needle.style.transition = 'x2 .6s ease, y2 .6s ease';
      var lastV = cur;
      new MutationObserver(function () {
        var val = parseInt(document.querySelector('.gauge .val').textContent);
        if (!isNaN(val) && val !== lastV) {
          lastV = val;
          var p = needlePos(val);
          needle.setAttribute('x2', p.x);
          needle.setAttribute('y2', p.y);
        }
      }).observe(document.querySelector('.gauge .val'), { childList: true, characterData: true, subtree: true });
    })();

    var ids = mkt.coins.map(function (c) { return c.id; }).join(',');
    var URL = CG_PRICE + ids + '&vs_currencies=usd&include_24hr_change=true';

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
            livePrices[c.sym] = c.usd;
            got++;
          });
          if (got) { paint(); setLive(false); }
        })
        .catch(function () { setLive(true); });
    }
    setTimeout(refresh, 2500);
    setInterval(refresh, 90000);
  })();

  /* ─── 5. 语言记忆：.langsw 是真实链接（中文 / ↔ 英文 /en/），这里只做记忆。
     首次进站若记忆语言与当前页不符且停在首页，则自动跳到对应语言首页。 ─── */
  (function langMemory() {
    var KEY = 'cdd-lang';
    var box = document.querySelector('.langsw');
    if (box) {
      box.addEventListener('click', function (ev) {
        var a = ev.target.closest('a');
        if (!a) return;
        localStorage.setItem(KEY, a.getAttribute('hreflang') === 'en' ? 'en' : 'zh');
      });
    }
    var pageLang = document.documentElement.lang === 'en' ? 'en' : 'zh';
    var saved = localStorage.getItem(KEY);
    var isHome = location.pathname === '/' || location.pathname === '/en/' ||
                 location.pathname === '/index.html' || location.pathname === '/en/index.html';
    if (saved && saved !== pageLang && isHome) {
      location.replace(saved === 'en' ? '/en/' : '/');
    }
  })();

  /* ─── 6. 互动层 ─── */
  var LS_FAB = 'fabpos', LS_FG = 'fgstats';

  function loadLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch (e) { return d } }
  function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  /* 通用拖拽：按住 handle 拖动 target（鼠标+触屏 Pointer Events） */
  function makeDraggable(target, handle, opts) {
    opts = opts || {};
    var sx = 0, sy = 0, ox = 0, oy = 0, moved = false, pid = null;

    function pos() {
      var r = target.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    function clamp(x, y, w, h) {
      x = Math.max(4, Math.min(x, innerWidth - w - 4));
      y = Math.max(4, Math.min(y, innerHeight - h - 4));
      return [x, y];
    }

    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,a')) return;
      pid = e.pointerId;
      try { handle.setPointerCapture(pid) } catch (err) {}
      var p = pos();
      sx = e.clientX; sy = e.clientY; ox = p.x; oy = p.y;
      moved = false;
      target.classList.add('dragging');
      target.classList.remove('snapping');
      if (opts.onStart) opts.onStart();
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (pid === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      var p = pos();
      var c = clamp(ox + dx, oy + dy, p.w, p.h);
      target.style.left = c[0] + 'px';
      target.style.top = c[1] + 'px';
      target.style.right = 'auto';
      target.style.bottom = 'auto';
    });
    function end() {
      if (pid === null) return;
      pid = null;
      target.classList.remove('dragging');
      if (moved && opts.onEnd) opts.onEnd(pos());
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    return { wasMoved: function () { return moved } };
  }

  /* 币雨彩蛋 */
  var rainBusy = false;
  function coinRain(n) {
    if (rainBusy) return;
    rainBusy = true;
    n = n || 46;
    var box = document.createElement('div');
    box.className = 'coin-rain';
    document.body.appendChild(box);
    var glyphs = ['₿', 'Ξ', '◎', '✕', '🪙', '$'];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.fontSize = (13 + Math.random() * 24) + 'px';
      s.style.animationDuration = (2.1 + Math.random() * 2.4) + 's';
      s.style.animationDelay = (Math.random() * 1.1) + 's';
      s.style.color = i % 2 ? 'var(--accent)' : 'var(--up)';
      s.style.opacity = String(0.55 + Math.random() * 0.45);
      frag.appendChild(s);
    }
    box.appendChild(frag);
    setTimeout(function () { box.remove(); rainBusy = false }, 6200);
  }

  /* 频道推广浮窗：可拖拽 + 记忆位置 + 收起成小圆点 + 猜涨跌游戏 */
  function buildFab() {
    var tgCn = 'https://t.me/CryptoDailyZH', tgEn = 'https://t.me/CryptoWeb3NewsDaily';
    var fab = document.createElement('div');
    fab.className = 'fab';
    fab.innerHTML =
      '<div class="fab-head"><span class="fab-grip">⠿</span><span class="fab-title">' + (IS_EN ? '🎮 Play Zone' : '🎮 互动中心') + '</span><button class="fab-x" title="' + (IS_EN ? 'Collapse' : '收起') + '">✕</button></div>' +
      '<div class="fab-body">' +
        '<div class="fg">' +
          '<div class="fg-label">' + (IS_EN ? 'Up or Down · BTC in 60s' : '猜涨跌 · BTC 未来 60 秒') + '</div>' +
          '<div class="fg-q" id="fg-q">' + (IS_EN ? 'Now $-- — higher or lower in 60 seconds?' : '现在 $--，60 秒后更高还是更低？') + '</div>' +
          '<div class="fg-btns"><button class="fg-up" id="fg-up">' + (IS_EN ? '▲ Up' : '▲ 涨') + '</button><button class="fg-dn" id="fg-dn">' + (IS_EN ? '▼ Down' : '▼ 跌') + '</button></div>' +
          '<div class="fg-out" id="fg-out"></div>' +
        '</div>' +
        (IS_EN
          ? '<a class="fab-tg" href="' + tgEn + '" target="_blank" rel="noopener"><span class="tg-badge">🌐</span><span class="tg-txt"><b>English Channel</b><small>@CryptoWeb3NewsDaily</small></span></a>' +
            '<a class="fab-tg" href="' + tgCn + '" target="_blank" rel="noopener"><span class="tg-badge">📢</span><span class="tg-txt"><b>中文频道 · 每日三档</b><small>@CryptoDailyZH</small></span></a>'
          : '<a class="fab-tg" href="' + tgCn + '" target="_blank" rel="noopener"><span class="tg-badge">📢</span><span class="tg-txt"><b>中文频道 · 每日三档</b><small>@CryptoDailyZH</small></span></a>' +
            '<a class="fab-tg" href="' + tgEn + '" target="_blank" rel="noopener"><span class="tg-badge">🌐</span><span class="tg-txt"><b>English Channel</b><small>@CryptoWeb3NewsDaily</small></span></a>') +
        '<div class="fab-acts"><button id="fab-rain">' + (IS_EN ? '🪙 Coin Rain' : '🪙 币雨') + '</button><button id="fab-top">' + (IS_EN ? '⬆ Top' : '⬆ 回顶部') + '</button></div>' +
        /* 迷你转换器 */
        '<div class="fab-conv">' +
          '<div class="fab-conv-h">' + (IS_EN ? '⚡ Converter' : '⚡ 转换器') + '</div>' +
          '<div class="fab-conv-row">' +
            '<select class="fab-conv-from" id="fc-from">' +
              '<option value="BTC">BTC</option><option value="ETH">ETH</option>' +
              '<option value="SOL">SOL</option><option value="XRP">XRP</option>' +
            '</select>' +
            '<input class="fab-conv-in" id="fc-amt" type="number" value="1" min="0" step="any">' +
          '</div>' +
          '<div class="fab-conv-row">' +
            '<select class="fab-conv-to" id="fc-to">' +
              '<option value="ETH">ETH</option><option value="BTC">BTC</option>' +
              '<option value="SOL">SOL</option><option value="XRP">XRP</option>' +
            '</select>' +
            '<span class="fab-conv-res" id="fc-res">—</span>' +
          '</div>' +
        '</div>' +
        /* 持仓模拟器 */
        '<div class="fab-port">' +
          '<div class="fab-conv-h">' + (IS_EN ? '📊 Portfolio' : '📊 持仓') + '</div>' +
          '<div class="fab-conv-row">' +
            '<span style="font-size:10.5px;color:var(--ink-3)">' + (IS_EN ? 'Hold' : '持有') + '</span>' +
            '<input class="fab-conv-in" id="fp-amt" type="number" value="1000" min="0" step="any" style="width:72px">' +
            '<span style="font-size:10.5px;color:var(--ink-3)">$</span>' +
          '</div>' +
          '<div class="fab-port-res" id="fp-res"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fab);

    var dot = document.createElement('div');
    dot.className = 'fab-dot';
    dot.title = IS_EN ? 'Open Play Zone (draggable)' : '展开互动中心（可拖动）';
    dot.textContent = '🎮';
    dot.hidden = true;
    document.body.appendChild(dot);

    var savedFab = loadLS(LS_FAB, null);
    function place() {
      var w = fab.offsetWidth || 262, h = fab.offsetHeight || 200;
      if (savedFab && !savedFab.min && typeof savedFab.x === 'number') {
        fab.style.left = Math.max(4, Math.min(savedFab.x, innerWidth - w - 4)) + 'px';
        fab.style.top = Math.max(4, Math.min(savedFab.y, innerHeight - h - 4)) + 'px';
        fab.style.right = 'auto'; fab.style.bottom = 'auto';
      } else {
        fab.style.left = 'auto'; fab.style.top = 'auto';
        fab.style.right = '18px'; fab.style.bottom = '18px';
      }
      dot.style.right = '18px'; dot.style.bottom = '18px'; dot.style.left = 'auto'; dot.style.top = 'auto';
    }
    place();

    var dragFab = makeDraggable(fab, fab.querySelector('.fab-head'), {
      onEnd: function (p) { savedFab = { x: p.x, y: p.y }; saveLS(LS_FAB, savedFab); }
    });
    var dragDot = makeDraggable(dot, dot, {});

    fab.querySelector('.fab-x').addEventListener('click', function () {
      fab.hidden = true; dot.hidden = false;
      savedFab = savedFab || {}; savedFab.min = true; saveLS(LS_FAB, savedFab);
    });
    dot.addEventListener('click', function () {
      if (dragDot.wasMoved()) return;   /* 刚拖完小圆点，不触发展开 */
      dot.hidden = true; fab.hidden = false;
      if (savedFab) savedFab.min = false; else savedFab = {};
      saveLS(LS_FAB, savedFab);
      place();
    });
    if (savedFab && savedFab.min) { fab.hidden = true; dot.hidden = false; }

    fab.querySelector('#fab-top').addEventListener('click', function () {
      scrollTo({ top: 0, behavior: 'smooth' });
    });
    fab.querySelector('#fab-rain').addEventListener('click', function () { coinRain() });

    /* 猜涨跌：以 60 秒后的真实 BTC 价判定，战绩存本地 */
    var fgState = { base: null, t0: 0, pick: null, timer: null };
    var fgQ = fab.querySelector('#fg-q'), fgOut = fab.querySelector('#fg-out');
    var fgUp = fab.querySelector('#fg-up'), fgDn = fab.querySelector('#fg-dn');
    var stats = loadLS(LS_FG, { win: 0, lose: 0 });

    function showStats() {
      var n = stats.win + stats.lose;
      fgOut.className = 'fg-out';
      fgOut.textContent = n
        ? (IS_EN ? 'Record: ' + stats.win + 'W ' + stats.lose + 'L (' + Math.round(stats.win * 100 / n) + '% win rate)' : ('战绩 ' + stats.win + ' 胜 ' + stats.lose + ' 负（胜率 ' + Math.round(stats.win * 100 / n) + '%）'))
        : (IS_EN ? 'Settled by the real BTC price 60s later — no cheating' : '答案用 60 秒后的真实币价判定，绝无作弊');
    }
    showStats();

    function lockBtns(on) { fgUp.disabled = on; fgDn.disabled = on; }

    function currentBtc() {
      if (livePrices.BTC) return livePrices.BTC;
      var e2 = document.querySelector('[data-px="BTC"]');
      if (e2) {
        var v = parseFloat(e2.textContent.replace(/[^0-9.]/g, ''));
        if (!isNaN(v) && v > 0) return v;
      }
      return null;
    }

    function pick(dir) {
      if (fgState.pick) return;
      var base = currentBtc();
      if (!base) { fgOut.textContent = IS_EN ? 'No baseline price — try again shortly' : '拿不到基线价，稍后再试'; return }
      fgState.pick = dir; fgState.base = base; fgState.t0 = Date.now();
      lockBtns(true);
      fgQ.textContent = IS_EN ? 'Bet: ' + (dir > 0 ? 'UP ▲' : 'DOWN ▼') + ' · baseline $' + base.toLocaleString('en-US') + ' · 60s left…' : '已押【' + (dir > 0 ? '涨 ▲' : '跌 ▼') + '】基线 $' + base.toLocaleString('en-US') + '，倒计时 60s…';
      fgOut.textContent = '';
      fgState.timer = setInterval(function () {
        var left = 60 - Math.round((Date.now() - fgState.t0) / 1000);
        if (left > 0) {
          fgQ.textContent = IS_EN ? 'Bet: ' + (dir > 0 ? 'UP ▲' : 'DOWN ▼') + ' · baseline $' + base.toLocaleString('en-US') + ' · ' + left + 's left…' : '已押【' + (dir > 0 ? '涨 ▲' : '跌 ▼') + '】基线 $' + base.toLocaleString('en-US') + '，倒计时 ' + left + 's…';
        } else {
          clearInterval(fgState.timer);
          settle();
        }
      }, 500);
    }

    function judge(px) {
      if (!px) {
        fgQ.textContent = IS_EN ? 'Settlement failed: no live price — bet again later' : '结算失败：拿不到当前价，稍后再押';
        lockBtns(false); fgState.pick = null;
        return;
      }
      var up = px >= fgState.base;
      var win = (up && fgState.pick > 0) || (!up && fgState.pick < 0);
      if (win) { stats.win++; fgOut.className = 'fg-out win'; }
      else { stats.lose++; fgOut.className = 'fg-out lose'; }
      saveLS(LS_FG, stats);
      var pct = (px - fgState.base) / fgState.base * 100;
      fgQ.textContent = (win ? (IS_EN ? '🎉 You got it!' : '🎉 猜对了！') : (IS_EN ? '💀 Wrong…' : '💀 猜错了…')) +
        ' BTC ' + (IS_EN ? (up ? 'rose' : 'fell') : (up ? '涨' : '跌')) + (IS_EN ? ' to $' : '至 $') + px.toLocaleString('en-US') +
        '（' + (pct >= 0 ? '+' : '') + pct.toFixed(3) + '%）';
      var n = stats.win + stats.lose;
      fgOut.textContent = IS_EN ? 'Record: ' + stats.win + 'W ' + stats.lose + 'L (' + Math.round(stats.win * 100 / n) + '% win rate)' : '战绩 ' + stats.win + ' 胜 ' + stats.lose + ' 负（胜率 ' + Math.round(stats.win * 100 / n) + '%）';
      if (win) coinRain(26);
      setTimeout(function () {
        fgState.pick = null; lockBtns(false);
        var cur = currentBtc();
        fgQ.textContent = cur ? (IS_EN ? 'Now $' + cur.toLocaleString('en-US') + ' — higher or lower in 60 seconds?' : '现在 $' + cur.toLocaleString('en-US') + '，60 秒后更高还是更低？') : (IS_EN ? 'Another round: higher or lower in 60 seconds?' : '再押一轮：60 秒后 BTC 更高还是更低？');
        showStats();
      }, 5000);
    }

    function settle() {
      var now = livePrices.BTC;
      if (now) return judge(now);
      try {
        var x = new XMLHttpRequest();
        x.timeout = 8000;
        x.open('GET', CG_PRICE + 'bitcoin&vs_currencies=usd');
        x.onload = function () { try { judge(JSON.parse(x.responseText).bitcoin.usd) } catch (e) { judge(null) } };
        x.onerror = function () { judge(null) };
        x.ontimeout = function () { judge(null) };
        x.send();
      } catch (e) { judge(null) }
    }

    fgUp.addEventListener('click', function () { pick(1); this.blur() });
    fgDn.addEventListener('click', function () { pick(-1); this.blur() });

    /* ── 迷你币币转换器 ── */
    var fcFrom = fab.querySelector('#fc-from');
    var fcTo = fab.querySelector('#fc-to');
    var fcAmt = fab.querySelector('#fc-amt');
    var fcRes = fab.querySelector('#fc-res');
    function updateConv() {
      var from = fcFrom.value, to = fcTo.value, amt = parseFloat(fcAmt.value);
      if (!amt || amt <= 0 || !livePrices[from] || !livePrices[to]) {
        fcRes.textContent = '—'; return;
      }
      var val = amt * livePrices[from] / livePrices[to];
      fcRes.textContent = val.toFixed(val < 0.01 ? 6 : val < 1 ? 4 : 2) + ' ' + to;
    }
    fcFrom.addEventListener('change', updateConv);
    fcTo.addEventListener('change', updateConv);
    fcAmt.addEventListener('input', updateConv);

    /* ── 持仓模拟器 ── */
    var fpAmt = fab.querySelector('#fp-amt');
    var fpRes = fab.querySelector('#fp-res');
    function updatePort() {
      var amt = parseFloat(fpAmt.value);
      if (!amt || amt <= 0 || !livePrices.BTC) { fpRes.textContent = ''; return; }
      var btc = amt / livePrices.BTC;
      var eth = btc * livePrices.ETH;
      var sol = btc * livePrices.SOL;
      fpRes.innerHTML =
        '<div style="font-size:10.5px;color:var(--ink-3);margin-top:5px">' +
          (IS_EN ? 'BTC' : 'BTC') + ': $' + amt.toLocaleString('en-US') +
          ' → ' + (IS_EN ? 'ETH' : 'ETH') + ' ' + eth.toFixed(4) +
          ' · ' + (IS_EN ? 'SOL' : 'SOL') + ' ' + sol.toFixed(1) +
        '</div>';
    }
    fpAmt.addEventListener('input', updatePort);
  }

  /* 3D 立方体：拖拽旋转（轨道层包在自动旋转的 .cube 外面，两种旋转叠加） */
  function cubeDrag() {
    var stage = document.querySelector('.cube-stage');
    if (!stage || stage.querySelector('.cube-orbit')) return;
    stage.id = 'hero-cube';
    var orbit = document.createElement('div');
    orbit.className = 'cube-orbit';
    while (stage.firstChild) orbit.appendChild(stage.firstChild);
    stage.appendChild(orbit);
    var hint = document.createElement('div');
    hint.className = 'cube-hint';
    hint.textContent = IS_EN ? 'drag me' : 'drag me · 拖我';
    stage.appendChild(hint);

    var ox = 14, oy = -18, pid = null, lx = 0, ly = 0;
    function apply() {
      orbit.style.setProperty('--ox', ox + 'deg');
      orbit.style.setProperty('--oy', oy + 'deg');
    }
    apply();
    stage.addEventListener('pointerdown', function (e) {
      pid = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { stage.setPointerCapture(pid) } catch (err) {}
      stage.classList.add('grabbing');
      hint.style.opacity = '0';
    });
    stage.addEventListener('pointermove', function (e) {
      if (pid === null) return;
      ox += (e.clientX - lx) * 0.55;
      oy -= (e.clientY - ly) * 0.45;
      oy = Math.max(-85, Math.min(85, oy));
      lx = e.clientX; ly = e.clientY;
      apply();
    });
    function up() { pid = null; stage.classList.remove('grabbing') }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  }

  function initInteractive() { buildFab(); cubeDrag(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractive);
  } else { initInteractive(); }
})();
