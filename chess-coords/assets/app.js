/* Coordonnées — interface, exercices et statistiques */
(function (global) {
  'use strict';

  var store = global.CC.store;
  var B = global.CC.board;

  var MODE_LABEL = { find: 'Trouver la case', name: 'Nommer la case', color: 'Couleur de la case' };
  var MODES = ['find', 'name', 'color'];
  var MODE_SHORT = { find: 'Trouver', name: 'Nommer', color: 'Couleur' };
  var DURATIONS = [30, 60, 90, 120];
  var PENALTIES = [0, 1, 2, 3, 5];

  var S = {
    screen: 'home',
    statsFilter: 'all',
    viewSel: null,
    wakeLock: null
  };

  /* Série en cours */
  var D = null;

  /* ------------------------------------------------------------------ utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fr(n, d) { return n.toFixed(d === undefined ? 0 : d).replace('.', ','); }
  function secs(ms) { return fr(ms / 1000, 1) + ' s'; }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  function modal(title, bodyHtml, actions) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    var box = $('#modal-actions');
    box.innerHTML = '';
    (actions || [{ label: 'Fermer' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'ghost');
      b.textContent = a.label;
      b.onclick = function () {
        if (a.onClick && a.onClick() === false) return;
        closeModal();
      };
      box.appendChild(b);
    });
    $('#modal').classList.add('open');
  }
  function closeModal() { $('#modal').classList.remove('open'); }

  var audioCtx = null;
  function beep(freq, dur, type) {
    if (!store.settings.sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur || 0.12) + 0.02);
    } catch (e) { /* audio indisponible */ }
  }
  function buzz(ms) {
    if (!store.settings.vibration) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
  }

  function requestWake() {
    if (!store.settings.keepAwake || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { S.wakeLock = l; }).catch(function () {});
  }
  function releaseWake() {
    if (S.wakeLock) { try { S.wakeLock.release(); } catch (e) {} S.wakeLock = null; }
  }

  /* ---------------------------------------------------------------- écrans */
  function show(name) {
    S.screen = name;
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 's-' + name); });
    document.body.dataset.screen = name;
    global.scrollTo(0, 0);
  }

  /* Groupe de puces (choix unique). */
  function chips(el, options, current, onPick) {
    el.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (o.v === current ? ' on' : '');
      b.textContent = o.l;
      b.onclick = function () { onPick(o.v); };
      el.appendChild(b);
    });
  }

  /* =================================================================== ACCUEIL */
  function renderHome() {
    var st = store.settings;
    chips($('#home-duration'), DURATIONS.map(function (d) {
      return { v: d, l: d < 60 ? d + ' s' : fr(d / 60, d % 60 ? 1 : 0) + ' min' };
    }), st.duration, function (v) { st.duration = v; store.save(); renderHome(); });

    $('#home-weak').checked = st.weakMode;

    var seen = countSeen(MODES);
    $('#weak-hint').textContent = seen < 8
      ? 'Encore peu de données : jouez quelques séries pour que le ciblage soit pertinent.'
      : 'Tire en priorité les cases les moins maîtrisées.';

    var bits = [];
    bits.push(st.penalty ? 'erreur : −' + st.penalty + ' s' + (st.penaltyPoint ? ' et −1 point' : '') : 'aucune pénalité');
    bits.push(st.flip === 'off' ? 'échiquier fixe'
      : (st.flip === 'random' ? 'retournement aléatoire' : 'retournement toutes les ' + st.flip + ' cases'));
    bits.push(st.orientation === 'random' ? 'côté tiré au sort'
      : (st.orientation === 'white' ? 'côté blancs' : 'côté noirs'));
    $('#home-recap').textContent = bits.join(' · ');
  }

  function countSeen(modes) {
    var sq = store.stats.squares, n = 0;
    B.ALL.forEach(function (s) {
      if (B.attempts(B.record(sq, modes, s)) > 0) n++;
    });
    return n;
  }

  /* ================================================================= EXERCICE */
  var boardEl, boardMap, fitBoard = function () {};

  function initBoard() {
    boardEl = $('#board');
    boardMap = B.build(boardEl);
    boardEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.sq') : null;
      if (b) onSquare(b.dataset.sq);
    });
    // L'échiquier prend la plus grande taille carrée qui tient dans la zone
    // disponible : jamais de défilement pendant un exercice.
    var wrap = boardEl.parentNode;
    function fit() {
      var r = wrap.getBoundingClientRect();
      var size = Math.max(160, Math.floor(Math.min(r.width, r.height)));
      boardEl.style.width = size + 'px';
      boardEl.style.height = size + 'px';
      boardEl.style.setProperty('--cell', (size / 8) + 'px');
    }
    fitBoard = fit;
    if (global.ResizeObserver) new ResizeObserver(fit).observe(wrap);
    global.addEventListener('resize', fit);
    global.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
    fit();
  }

  function startDrill(mode) {
    var st = store.settings;
    D = {
      mode: mode,
      weak: st.weakMode,
      duration: st.duration,
      orientation: st.orientation === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : st.orientation,
      score: 0, ok: 0, err: 0, streak: 0, bestStreak: 0,
      target: null, next: null, tStart: 0, sinceFlip: 0,
      times: [], missed: {},
      input: '', running: false, endsAt: 0, tick: null, locked: true
    };

    // « couleur de la case » se joue de tête : pas d'échiquier à l'écran
    var noBoard = mode === 'color';
    $('.board-wrap').hidden = noBoard;
    $('#s-drill').classList.toggle('drill-color', noBoard);
    if (!noBoard) {
      B.setPieces(boardEl, st.pieces);
      B.clearMarks(boardEl);
      B.layout(boardEl, D.orientation);
      requestAnimationFrame(fitBoard);
    }
    boardEl.classList.toggle('naming', mode === 'name');

    $('#colorpad').hidden = !noBoard;
    $('#keypad').hidden = !(mode === 'name' && st.keypad);
    $('#hud-score').textContent = '0';
    $('#hud-streak').textContent = 'série 0';
    $('#prompt-target').textContent = '—';
    $('#prompt-target').className = 'prompt-target';
    $('#prompt-next').hidden = mode === 'name';   // en « nommer », l'annonce est sur l'échiquier
    $('#prompt-next-sq').textContent = '';
    $('#prompt-sub').textContent = mode === 'find' ? 'touchez la case'
      : (mode === 'name' ? 'quelle est cette case ?' : 'blanche ou noire ?');
    setClock(D.duration * 1000);
    show('drill');
    requestWake();
    countdown(3);
  }

  function countdown(n) {
    var box = $('#countdown'), num = $('#countdown-n');
    box.hidden = false;
    (function step(k) {
      if (k === 0) {
        box.hidden = true;
        beep(880, 0.16);
        D.running = true;
        D.locked = false;
        D.endsAt = performance.now() + D.duration * 1000;
        D.tick = setInterval(onTick, 80);
        nextTarget();
        return;
      }
      num.textContent = k;
      num.classList.remove('pop');
      void num.offsetWidth;
      num.classList.add('pop');
      beep(440, 0.09);
      setTimeout(function () { if (S.screen === 'drill') step(k - 1); }, 700);
    })(n);
  }

  function onTick() {
    if (!D || !D.running) return;
    var left = D.endsAt - performance.now();
    if (left <= 0) { setClock(0); endDrill(); return; }
    setClock(left);
  }

  function setClock(ms) {
    $('#hud-clock').textContent = fr(Math.max(0, ms) / 1000, 1);
    var ratio = D ? Math.max(0, Math.min(1, ms / (D.duration * 1000))) : 1;
    $('#timebar-fill').style.width = (ratio * 100) + '%';
    $('#hud-clock').classList.toggle('low', ms < 10000);
  }

  /* Retournement de l'échiquier : rotation de 180°, puis nouvel ordre des cases. */
  function flipBoard(after) {
    var next = boardEl.dataset.orientation === 'white' ? 'black' : 'white';
    D.locked = true;
    boardEl.classList.add('spin');
    var flag = $('#flip-flag');
    flag.classList.add('show');
    setTimeout(function () { flag.classList.remove('show'); }, 1100);
    setTimeout(function () {
      boardEl.classList.add('nofx');
      boardEl.classList.remove('spin');
      B.layout(boardEl, next);
      void boardEl.offsetWidth;
      boardEl.classList.remove('nofx');
      // l'animation ne doit pas coûter de temps au joueur
      D.endsAt += 480;
      D.locked = false;
      if (after) after();
    }, 460);
  }

  function shouldFlip() {
    var f = store.settings.flip;
    if (D.mode === 'color') return false;            // pas d'échiquier à retourner
    if (f === 'off' || !D.target) return false;      // jamais avant la 1re case
    if (f === 'random') return Math.random() < 0.28;
    return D.sinceFlip >= parseInt(f, 10);
  }

  function nextTarget() {
    if (!D || !D.running) return;
    if (shouldFlip()) {
      D.sinceFlip = 0;
      D.target = null;
      B.clearMarks(boardEl);
      $('#prompt-target').textContent = '↻';   // pas de consigne pendant la rotation
      flipBoard(function () { placeTarget(); });
      return;
    }
    placeTarget();
  }

  function draw(avoid) {
    return B.pick({
      weak: D.weak, avoid: avoid,
      squares: store.stats.squares, modes: [D.mode]
    });
  }

  function placeTarget() {
    if (!D || !D.running) return;
    // la case annoncée au tour précédent devient la consigne, et une nouvelle
    // est annoncée dans la foulée : il y a toujours un coup d'avance à préparer
    var sq = D.next || draw(D.target);
    D.target = sq;
    D.next = draw(sq);
    D.sinceFlip++;
    D.input = '';
    B.clearMarks(boardEl);

    if (D.mode === 'name') {
      $('#prompt-target').textContent = '?';
      boardMap[sq].classList.add('target');
      boardMap[D.next].classList.add('next');
      renderEcho();
    } else {
      $('#prompt-target').textContent = sq;
      $('#prompt-target').classList.add('pop');
      setTimeout(function () { $('#prompt-target').classList.remove('pop'); }, 200);
      $('#prompt-next-sq').textContent = D.next;
    }
    D.tStart = performance.now();
  }

  function onSquare(sq) {
    if (!D || !D.running || D.locked || D.mode !== 'find') return;
    if (sq === D.target) {
      boardMap[sq].classList.add('good');
      success();
    } else {
      var el = boardMap[sq];
      el.classList.add('bad');
      setTimeout(function () { el.classList.remove('bad'); }, 320);
      fail(sq);
    }
  }

  function answerColor(light) {
    if (!D || !D.running || D.locked || D.mode !== 'color') return;
    var btn = $(light ? '#ans-light' : '#ans-dark');
    if (light === B.isLight(D.target)) {
      btn.classList.add('good');
      setTimeout(function () { btn.classList.remove('good'); }, 260);
      success();
    } else {
      btn.classList.add('bad');
      setTimeout(function () { btn.classList.remove('bad'); }, 320);
      fail();
    }
  }

  function success() {
    var ms = performance.now() - D.tStart;
    var rec = store.square(D.mode, D.target);
    rec.ok++;
    rec.ms += ms;
    if (!rec.best || ms < rec.best) rec.best = Math.round(ms);

    D.ok++;
    D.score++;
    D.times.push(ms);
    D.streak++;
    if (D.streak > D.bestStreak) D.bestStreak = D.streak;

    $('#hud-score').textContent = D.score;
    $('#hud-streak').textContent = 'série ' + D.streak + ' · ' + fr(ms / 1000, 1) + ' s';
    beep(660 + Math.min(D.streak, 8) * 40, 0.09, 'triangle');
    buzz(12);

    D.locked = true;
    setTimeout(function () {
      if (!D || !D.running) return;
      D.locked = false;
      nextTarget();
    }, 130);
  }

  /* `wrong` : la case effectivement désignée, quand il y en a une. Elle est
     pénalisée elle aussi — confondre deux cases, c'est mal connaître les deux. */
  function fail(wrong) {
    var st = store.settings;
    var rec = store.square(D.mode, D.target);
    rec.err++;
    if (wrong && wrong !== D.target) {
      var other = store.square(D.mode, wrong);
      other.conf = (other.conf || 0) + 1;
    }
    D.err++;
    var m = D.missed[D.target] || (D.missed[D.target] = { n: 0, others: {} });
    m.n++;
    if (wrong && wrong !== D.target) m.others[wrong] = (m.others[wrong] || 0) + 1;
    D.streak = 0;
    $('#hud-streak').textContent = 'série 0';

    if (st.penaltyPoint) {
      D.score--;
      $('#hud-score').textContent = D.score;
    }
    if (st.penalty) {
      D.endsAt -= st.penalty * 1000;
      var p = $('#penalty');
      p.textContent = '−' + st.penalty + ' s' + (st.penaltyPoint ? ' · −1' : '');
      p.classList.remove('show');
      void p.offsetWidth;
      p.classList.add('show');
    }
    beep(150, 0.2, 'sawtooth');
    buzz([18, 40, 18]);
    var pr = $('#prompt');
    pr.classList.remove('shake');
    void pr.offsetWidth;
    pr.classList.add('shake');
    if (D.endsAt <= performance.now()) { setClock(0); endDrill(); }
  }

  /* --------------------------------------------------------- saisie « nommer » */
  function renderEcho() {
    var f = D && D.input[0] ? D.input[0] : '';
    var r = D && D.input[1] ? D.input[1] : '';
    $('#echo-file').textContent = f || '·';
    $('#echo-rank').textContent = r || '·';
    // le grand libellé reprend la saisie en cours, sinon le point d'interrogation
    if (D && D.mode === 'name') $('#prompt-target').textContent = (f + r) || '?';
  }

  function typeChar(c) {
    if (!D || !D.running || D.locked || D.mode !== 'name') return;
    if (c === 'back') { D.input = D.input.slice(0, -1); renderEcho(); return; }
    var isFile = c >= 'a' && c <= 'h';
    var isRank = c >= '1' && c <= '8';
    if (!isFile && !isRank) return;
    if (isFile) D.input = c + (D.input[1] || '');
    else D.input = (D.input[0] || '') + c;
    renderEcho();
    if (D.input.length === 2 && D.input[0] && D.input[1]) checkTyped();
  }

  function checkTyped() {
    var guess = D.input;
    if (guess === D.target) {
      boardMap[D.target].classList.add('good');
      $('#echo-file').parentNode.classList.add('ok');
      setTimeout(function () { $('#echo-file').parentNode.classList.remove('ok'); }, 200);
      success();
      D.input = '';
      renderEcho();
    } else {
      var echo = $('#echo-file').parentNode;
      echo.classList.add('ko');
      setTimeout(function () { echo.classList.remove('ko'); }, 320);
      fail(guess);   // la case nommée à tort est pénalisée comme un clic à côté
      D.input = '';
      renderEcho();
    }
  }

  function buildKeypad() {
    var f = $('#keys-files'), r = $('#keys-ranks');
    f.innerHTML = ''; r.innerHTML = '';
    B.FILES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'key'; b.textContent = c;
      b.onclick = function () { typeChar(c); };
      f.appendChild(b);
    });
    B.RANKS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'key'; b.textContent = c;
      b.onclick = function () { typeChar(c); };
      r.appendChild(b);
    });
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'key back'; back.textContent = '⌫';
    back.onclick = function () { typeChar('back'); };
    r.appendChild(back);
  }

  document.addEventListener('keydown', function (e) {
    if (S.screen !== 'drill') return;
    if (e.key === 'Escape') { quitDrill(); return; }
    if (!D) return;
    if (D.mode === 'color') {
      var k2 = e.key.toLowerCase();
      if (k2 === 'b' || e.key === 'ArrowLeft') answerColor(true);
      else if (k2 === 'n' || e.key === 'ArrowRight') answerColor(false);
      return;
    }
    if (D.mode !== 'name') return;
    if (e.key === 'Backspace') { e.preventDefault(); typeChar('back'); return; }
    var k = e.key.toLowerCase();
    if (k.length === 1) typeChar(k);
  });

  /* ------------------------------------------------------------ fin de série */
  function stopTimers() {
    if (D && D.tick) { clearInterval(D.tick); D.tick = null; }
  }

  function quitDrill() {
    if (!D) { show('home'); return; }
    if (!D.running) { stopTimers(); D = null; releaseWake(); show('home'); return; }
    modal('Arrêter la série ?', '<p>Le score ne sera pas enregistré. Les cases déjà jouées, elles, restent dans les statistiques par case.</p>', [
      { label: 'Continuer' },
      { label: 'Arrêter', cls: 'danger', onClick: function () {
        stopTimers();
        D.running = false;
        store.save();          // les cases déjà jouées restent dans les statistiques
        D = null;
        releaseWake();
        show('home');
      } }
    ]);
  }

  function endDrill() {
    D.running = false;
    stopTimers();
    releaseWake();
    beep(320, 0.3, 'triangle');
    buzz([30, 60, 30]);

    var stats = store.stats;
    stats.series++;
    stats.solved += D.ok;
    stats.errors += D.err;
    stats.playedMs += D.duration * 1000;
    if (D.score > (stats.bestScore[D.mode] || 0)) stats.bestScore[D.mode] = D.score;
    if (D.bestStreak > stats.bestStreak) stats.bestStreak = D.bestStreak;

    var avg = D.times.length ? D.times.reduce(function (a, b) { return a + b; }, 0) / D.times.length : 0;
    store.pushHistory({
      t: Date.now(), mode: D.mode, score: D.score, ok: D.ok, errors: D.err,
      duration: D.duration, weak: D.weak, avgMs: Math.round(avg)
    });
    store.save();
    renderResult(avg);
    show('result');
  }

  function renderResult(avg) {
    $('#result-title').textContent = MODE_LABEL[D.mode];
    $('#result-score').textContent = D.score;
    $('#result-sub').textContent = D.score === 1 ? 'case validée' : 'cases validées';

    var attempts = D.ok + D.err;
    var acc = attempts ? Math.round(100 * D.ok / attempts) : 0;
    var perMin = D.duration ? (D.ok * 60 / D.duration) : 0;
    var best = store.stats.bestScore[D.mode] || 0;

    $('#result-tiles').innerHTML = [
      tile('Précision', acc + ' %'),
      tile('Temps moyen', D.times.length ? secs(avg) : '—'),
      tile('Cadence', fr(perMin, 1) + ' /min'),
      tile('Meilleure série', D.bestStreak),
      tile('Erreurs', D.err),
      tile('Record « ' + MODE_SHORT[D.mode].toLowerCase() + ' »', best)
    ].join('');

    var missed = Object.keys(D.missed).sort(function (a, b) { return D.missed[b].n - D.missed[a].n; });
    $('#result-missed-box').hidden = missed.length === 0;
    $('#result-missed').innerHTML = missed.map(function (sq) {
      var m = D.missed[sq];
      var others = Object.keys(m.others).sort(function (a, b) { return m.others[b] - m.others[a]; });
      return '<span class="sq-pill bad">' + sq +
        (m.n > 1 ? '<i>×' + m.n + '</i>' : '') +
        (others.length ? '<em>→ ' + others.slice(0, 3).join(' ') + '</em>' : '') +
        '</span>';
    }).join('');
  }

  function tile(label, value) {
    return '<div class="tile"><b>' + esc(String(value)) + '</b><span class="mono">' + esc(label) + '</span></div>';
  }

  /* ============================================================= STATISTIQUES */
  function filterModes() {
    return S.statsFilter === 'all' ? MODES.slice() : [S.statsFilter];
  }

  function level(m) {
    if (m === null) return 'lvx';
    if (m < 0.38) return 'lv0';
    if (m < 0.52) return 'lv1';
    if (m < 0.66) return 'lv2';
    if (m < 0.8) return 'lv3';
    return 'lv4';
  }

  function renderStats() {
    var modes = filterModes();
    var sq = store.stats.squares;

    chips($('#stats-filter'), [
      { v: 'all', l: 'Tout' }, { v: 'find', l: 'Trouver' },
      { v: 'name', l: 'Nommer' }, { v: 'color', l: 'Couleur' }
    ], S.statsFilter, function (v) { S.statsFilter = v; renderStats(); });

    var rows = B.ALL.map(function (s) {
      var rec = B.record(sq, modes, s);
      return { sq: s, rec: rec, m: B.mastery(rec), n: B.attempts(rec) };
    });

    var totOk = 0, totErr = 0, totMs = 0, unseen = 0;
    rows.forEach(function (r) {
      totOk += r.rec.ok; totErr += r.rec.err; totMs += r.rec.ms;
      if (!r.n) unseen++;
    });
    var acc = (totOk + totErr) ? Math.round(100 * totOk / (totOk + totErr)) : 0;

    $('#stats-tiles').innerHTML = [
      tile('Cases validées', totOk),
      tile('Précision', (totOk + totErr) ? acc + ' %' : '—'),
      tile('Temps moyen', totOk ? secs(totMs / totOk) : '—'),
      tile('Meilleure série', store.stats.bestStreak),
      tile('Séries jouées', store.stats.series),
      tile('Jamais vues', unseen)
    ].join('');

    // Damier de maîtrise, vu des blancs
    var heat = $('#heat');
    heat.innerHTML = '';
    B.orderFor('white').forEach(function (s) {
      var r = rows[B.ALL.indexOf(s)];
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'hc ' + level(r.m) + (B.isLight(s) ? ' light' : ' dark');
      d.innerHTML = '<b>' + s + '</b><i>' + (r.m === null ? '—' : Math.round(r.m * 100) + '%') + '</i>';
      d.onclick = function () { squareDetail(s); };
      heat.appendChild(d);
    });

    var seen = rows.filter(function (r) { return r.n > 0; });
    var byWeak = seen.slice().sort(function (a, b) { return a.m - b.m; });
    var byStrong = byWeak.slice().reverse();

    $('#stats-weak').innerHTML = seen.length
      ? byWeak.slice(0, 8).map(pill).join('') + (unseen ? '<span class="sq-pill ghost">' + unseen + ' jamais vues</span>' : '')
      : '<span class="note">Jouez une première série pour voir apparaître les cases à travailler.</span>';
    $('#stats-strong').innerHTML = seen.length
      ? byStrong.slice(0, 8).map(pill).join('')
      : '<span class="note">—</span>';

    var hist = store.data.history.filter(function (h) {
      return S.statsFilter === 'all' || h.mode === S.statsFilter;
    });
    $('#stats-history-box').hidden = hist.length === 0;
    $('#stats-history').innerHTML = hist.slice(0, 8).map(function (h) {
      var d = new Date(h.t);
      return '<div class="hist">' +
        '<span class="mono">' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
        ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '<span>' + MODE_SHORT[h.mode] + (h.weak ? ' · faibles' : '') + '</span>' +
        '<b>' + h.score + '</b>' +
        '<span class="mono">' + h.errors + ' err.</span>' +
        '</div>';
    }).join('');
  }

  function pill(r) {
    return '<span class="sq-pill ' + level(r.m) + '">' + r.sq +
      '<i>' + Math.round(r.m * 100) + '%</i></span>';
  }

  function squareDetail(s) {
    var modes = filterModes();
    var rec = B.record(store.stats.squares, modes, s);
    var m = B.mastery(rec);
    var n = B.attempts(rec);
    var html;
    if (!n) {
      html = '<p>Cette case n\'a encore jamais été proposée' +
        (S.statsFilter === 'all' ? '.' : ' dans cet exercice.') + '</p>';
    } else {
      html = '<div class="tiles">' +
        tile('Maîtrise', Math.round(m * 100) + ' %') +
        tile('Réussites', rec.ok) +
        tile('Précision', Math.round(100 * rec.ok / n) + ' %') +
        tile('Ratée', rec.err) +
        tile('Cliquée à tort', rec.conf || 0) +
        tile('Temps moyen', rec.ok ? secs(B.avgMs(rec)) : '—') +
        '</div>' +
        '<p class="note mt">« Ratée » : la case était demandée et n\'a pas été trouvée. ' +
        '« Cliquée à tort » : elle a été désignée à la place d\'une autre. ' +
        'Les deux pèsent sur la maîtrise.</p>';
    }
    modal('Case ' + s, html, [{ label: 'Fermer' }]);
  }

  /* ================================================== ÉCHIQUIER DE RÉFÉRENCE */
  var viewEl, viewMap, fitView = function () {};

  function initView() {
    viewEl = $('#view-board');
    viewMap = B.build(viewEl);
    viewEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.sq') : null;
      if (!b) return;
      S.viewSel = (S.viewSel === b.dataset.sq) ? null : b.dataset.sq;   // seconde touche = désélection
      renderView();
    });

    var wrap = viewEl.parentNode;
    function fit() {
      var r = wrap.getBoundingClientRect();
      var size = Math.max(180, Math.floor(Math.min(r.width, r.height)));
      viewEl.style.width = size + 'px';
      viewEl.style.height = size + 'px';
      viewEl.style.setProperty('--cell', (size / 8) + 'px');
    }
    fitView = fit;
    if (global.ResizeObserver) new ResizeObserver(fit).observe(wrap);
    global.addEventListener('resize', fit);
  }

  var VIEW_OPTS = [
    { k: 'coords', l: 'Coordonnées' },
    { k: 'pieces', l: 'Pièces' },
    { k: 'guides', l: 'Guides' },
    { k: 'heat', l: 'Maîtrise' }
  ];

  function renderView() {
    var V = store.settings.view;
    B.layout(viewEl, V.orientation);
    B.setPieces(viewEl, V.pieces);
    viewEl.classList.toggle('heat', V.heat);

    // les lettres bordent la rangée du bas, les chiffres la colonne de gauche,
    // des deux côtés de l'échiquier
    var bottom = V.orientation === 'white' ? '1' : '8';
    var left = V.orientation === 'white' ? 'a' : 'h';
    var sel = S.viewSel;

    B.ALL.forEach(function (sq) {
      var el = viewMap[sq];
      el.dataset.cf = (V.coords && sq[1] === bottom) ? sq[0] : '';
      el.dataset.cr = (V.coords && sq[0] === left) ? sq[1] : '';
      var cls = 'sq ' + (B.isLight(sq) ? 'light' : 'dark');
      if (V.heat) cls += ' ' + level(B.mastery(B.record(store.stats.squares, MODES, sq)));
      if (sel === sq) cls += ' sel';
      else if (sel && V.guides && (sq[0] === sel[0] || sq[1] === sel[1])) cls += ' guide';
      el.className = cls;
      el.setAttribute('aria-label', 'case ' + sq);   // ici, la coordonnée est le sujet
    });

    chipsToggle($('#view-opts'), VIEW_OPTS, V, function (k) {
      V[k] = !V[k];
      store.save();
      renderView();
    });

    $('#view-side').textContent = 'Vu du côté des ' + (V.orientation === 'white' ? 'blancs' : 'noirs') +
      (V.heat ? ' · teintes de maîtrise, tous exercices confondus' : '') +
      (V.coords ? '' : ' · coordonnées masquées, comme pendant les exercices');

    if (!sel) {
      $('#view-sq').textContent = '—';
      $('#view-desc').textContent = 'Touchez une case pour la détailler.';
      return;
    }
    var rec = B.record(store.stats.squares, MODES, sel);
    var n = B.attempts(rec);
    var bits = ['case ' + (B.isLight(sel) ? 'blanche' : 'noire')];
    if (n) {
      bits.push('maîtrise ' + Math.round(B.mastery(rec) * 100) + ' %');
      bits.push(rec.ok + (rec.ok > 1 ? ' réussites' : ' réussite'));
      if (rec.err) bits.push(rec.err + (rec.err > 1 ? ' ratées' : ' ratée'));
      if (rec.conf) bits.push(rec.conf + ' fois désignée à tort');
      if (rec.ok) bits.push(secs(B.avgMs(rec)) + ' de moyenne');
    } else {
      bits.push('jamais rencontrée dans les exercices');
    }
    $('#view-sq').textContent = sel;
    $('#view-desc').textContent = bits.join(' · ');
  }

  /* Puces à bascule : plusieurs peuvent être actives à la fois. */
  function chipsToggle(el, options, state, onPick) {
    el.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (state[o.k] ? ' on' : '');
      b.textContent = o.l;
      b.setAttribute('aria-pressed', state[o.k] ? 'true' : 'false');
      b.onclick = function () { onPick(o.k); };
      el.appendChild(b);
    });
  }

  function flipView() {
    var V = store.settings.view;
    viewEl.classList.add('spin');
    setTimeout(function () {
      viewEl.classList.add('nofx');
      viewEl.classList.remove('spin');
      V.orientation = V.orientation === 'white' ? 'black' : 'white';
      store.save();
      renderView();
      void viewEl.offsetWidth;
      viewEl.classList.remove('nofx');
    }, 460);
  }

  /* ================================================================= RÉGLAGES */
  function renderSettings() {
    var st = store.settings;

    chips($('#set-duration'), DURATIONS.map(function (d) {
      return { v: d, l: d < 60 ? d + ' s' : fr(d / 60, d % 60 ? 1 : 0) + ' min' };
    }), st.duration, function (v) { st.duration = v; save(); });

    chips($('#set-penalty'), PENALTIES.map(function (p) {
      return { v: p, l: p ? '−' + p + ' s' : 'aucune' };
    }), st.penalty, function (v) { st.penalty = v; save(); });

    chips($('#set-orientation'), [
      { v: 'random', l: 'Au hasard' }, { v: 'white', l: 'Blancs' }, { v: 'black', l: 'Noirs' }
    ], st.orientation, function (v) { st.orientation = v; save(); });

    chips($('#set-flip'), [
      { v: 'off', l: 'Jamais' }, { v: '10', l: '10 cases' }, { v: '5', l: '5 cases' },
      { v: '3', l: '3 cases' }, { v: 'random', l: 'Au hasard' }
    ], st.flip, function (v) { st.flip = v; save(); });

    $('#set-penalty-point').checked = st.penaltyPoint;
    $('#set-pieces').checked = st.pieces;
    $('#set-keypad').checked = st.keypad;
    $('#set-sound').checked = st.sound;
    $('#set-vibration').checked = st.vibration;
    $('#set-dark').checked = st.theme === 'dark';
    $('#set-awake').checked = st.keepAwake;

    function save() { store.save(); renderSettings(); renderHome(); }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = store.settings.theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', store.settings.theme === 'dark' ? '#141416' : '#efebe1');
  }

  /* ===================================================================== INIT */
  function bind() {
    $('#play-find').onclick = function () { startDrill('find'); };
    $('#play-name').onclick = function () { startDrill('name'); };
    $('#play-color').onclick = function () { startDrill('color'); };
    $('#ans-light').onclick = function () { answerColor(true); };
    $('#ans-dark').onclick = function () { answerColor(false); };
    $('#go-stats').onclick = function () { renderStats(); show('stats'); };
    $('#go-board').onclick = function () {
      show('board');
      renderView();
      requestAnimationFrame(fitView);
    };
    $('#view-flip').onclick = flipView;
    $('#go-settings').onclick = function () { renderSettings(); show('settings'); };
    $('#home-weak').onchange = function () {
      store.settings.weakMode = this.checked;
      store.save();
      toast(this.checked ? 'Mode cases faibles activé' : 'Tirage uniforme');
    };

    $$('[data-back]').forEach(function (b) {
      b.onclick = function () { show(b.dataset.back); renderHome(); };
    });

    $('#drill-quit').onclick = quitDrill;
    $('#result-again').onclick = function () { startDrill(D ? D.mode : 'find'); };
    // trois exercices : on renvoie au choix plutôt que d'en imposer un
    $('#result-other').onclick = function () { renderHome(); show('home'); };
    $('#result-stats').onclick = function () { renderStats(); show('stats'); };

    $('#stats-reset').onclick = function () {
      modal('Effacer les statistiques ?', '<p>Toutes les mesures par case et l\'historique seront perdus. Les réglages sont conservés.</p>', [
        { label: 'Annuler' },
        { label: 'Effacer', cls: 'danger', onClick: function () {
          store.resetStats(); renderStats(); renderHome(); toast('Statistiques effacées');
        } }
      ]);
    };

    $('#set-reset').onclick = function () {
      modal('Tout réinitialiser ?', '<p>Réglages, statistiques et historique reviennent à zéro.</p>', [
        { label: 'Annuler' },
        { label: 'Réinitialiser', cls: 'danger', onClick: function () {
          store.resetAll(); applyTheme(); renderSettings(); renderHome(); toast('Application réinitialisée');
        } }
      ]);
    };

    [['#set-penalty-point', 'penaltyPoint'], ['#set-pieces', 'pieces'], ['#set-keypad', 'keypad'],
     ['#set-sound', 'sound'], ['#set-vibration', 'vibration'], ['#set-awake', 'keepAwake']
    ].forEach(function (pair) {
      $(pair[0]).onchange = function () {
        store.settings[pair[1]] = this.checked;
        store.save();
        renderHome();
      };
    });

    $('#set-dark').onchange = function () {
      store.settings.theme = this.checked ? 'dark' : 'light';
      store.save();
      applyTheme();
    };

    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && D && D.running) {
        // la série s'arrête net : on ne compte pas un chrono qui tourne en poche
        stopTimers();
        D.running = false;
        store.save();
        releaseWake();
        show('home');
        toast('Série interrompue');
      }
    });
  }

  function init() {
    store.load();
    applyTheme();
    initBoard();
    initView();
    buildKeypad();
    bind();
    renderHome();
    renderView();
    B.setPieces(boardEl, store.settings.pieces);
    B.layout(boardEl, 'white');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
