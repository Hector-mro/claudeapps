/* Undercover — interface et enchaînement des écrans */
(function (global) {
  'use strict';

  var UC = global.UC;
  var store = UC.store;
  var util = UC.util;
  var ROLE = UC.ROLE;

  var EMOJIS = ['🦊', '🐼', '🐧', '🦁', '🐨', '🐸', '🐵', '🦄', '🐙', '🦖',
                '🐝', '🦉', '🐺', '🐯', '🐰', '🦋', '🐳', '🦩', '🐢', '🦔',
                '🐷', '🐮', '🦝', '🦥', '🐴', '🦕', '🐬', '🦜'];

  var ROLE_LABEL = { civil: 'Civil', undercover: 'Undercover', white: 'Mr White' };
  var ROLE_CLASS = { civil: 'role-civil', undercover: 'role-undercover', white: 'role-white' };

  var game = new UC.Game();
  var nav = [];
  var S = {
    screen: 'home',
    revealIdx: 0, revealShown: false, revealSeen: false,
    speakIdx: 0, phase: 'speak',
    timerId: null, timerLeft: 0,
    voterIdx: 0, selected: null, tallyShown: false, revoteAmong: null,
    inGame: false, lastGameScreen: null,
    wakeLock: null
  };

  /* ---------------------------------------------------------------- utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function modal(title, bodyHtml, actions) {
    var m = $('#modal');
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
    m.classList.add('open');
    return m;
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
      g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.15));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur || 0.15) + 0.02);
    } catch (e) { /* audio indisponible */ }
  }
  function buzz(pattern) {
    if (store.settings.vibration && global.navigator && navigator.vibrate) navigator.vibrate(pattern || 20);
  }

  function requestWakeLock() {
    if (!store.settings.keepAwake || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { S.wakeLock = l; }).catch(function () {});
  }
  function releaseWakeLock() {
    if (S.wakeLock) { try { S.wakeLock.release(); } catch (e) {} S.wakeLock = null; }
  }

  /* ----------------------------------------------------------- navigation */
  var GAME_SCREENS = ['reveal', 'order', 'discussion', 'vote', 'elimination', 'white', 'roundend'];

  function go(name, skipHistory) {
    if (!skipHistory && S.screen !== name) nav.push(S.screen);
    stopTimer();
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    var target = $('#screen-' + name);
    if (target) target.classList.add('active');
    S.screen = name;
    if (GAME_SCREENS.indexOf(name) !== -1) S.lastGameScreen = name;
    global.scrollTo(0, 0);
    if (name === 'home') refreshHome();
    if (name === 'setup') { renderPlayers(); renderSettings(); }
    if (name === 'options') renderSettings();
    if (name === 'words') renderWords();
    if (name === 'stats') renderStats();
  }
  function back() {
    var prev = nav.pop() || 'home';
    go(prev, true);
  }

  /* -------------------------------------------------------------- réglages */
  function applyTheme() {
    var dark = store.settings.theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#141416' : '#efebe1');
  }

  function renderSettings() {
    var s = store.settings;
    $$('[data-setting]').forEach(function (elm) {
      var key = elm.getAttribute('data-setting');
      if (elm.type === 'checkbox') elm.checked = !!s[key];
      else elm.value = String(s[key]);
    });
    $$('[data-stepper]').forEach(function (elm) {
      var key = elm.getAttribute('data-stepper');
      var v = $('.val', elm);
      if (v) v.textContent = s[key];
    });
    $('#theme-switch input').checked = s.theme === 'dark';
    $$('#diff-chips .chip').forEach(function (c) {
      var d = parseInt(c.getAttribute('data-diff'), 10);
      c.classList.toggle('on', s.difficulties.indexOf(d) !== -1);
    });
    $('#cat-summary').textContent = catSummary();
    updateCivilCount();
  }

  function catSummary() {
    var cats = store.settings.categories;
    if (!cats || !cats.length) return 'Toutes les catégories';
    return cats.length + ' catégorie' + (cats.length > 1 ? 's' : '') + ' sélectionnée' + (cats.length > 1 ? 's' : '');
  }

  function poolInfo() {
    return util.buildPool(store.settings, store.data.customPairs, store.data.usedPairs);
  }

  function bindSettings() {
    $$('[data-setting]').forEach(function (elm) {
      var key = elm.getAttribute('data-setting');
      elm.addEventListener('change', function () {
        var v;
        if (elm.type === 'checkbox') v = elm.checked;
        else v = elm.getAttribute('data-type') === 'number' ? parseInt(elm.value, 10) : elm.value;
        store.settings[key] = v;
        store.save();
        if (key === 'autoRoles' && v) autoRoles();
        if (key === 'undercoverCount' || key === 'mrWhiteCount') store.settings.autoRoles = false;
        renderSettings();
        refreshHome();
      });
    });

    $$('[data-stepper]').forEach(function (elm) {
      var key = elm.getAttribute('data-stepper');
      var min = parseInt(elm.getAttribute('data-min') || '0', 10);
      var max = parseInt(elm.getAttribute('data-max') || '99', 10);
      $$('button', elm).forEach(function (b) {
        b.addEventListener('click', function () {
          var step = parseInt(b.getAttribute('data-step'), 10);
          var v = Math.max(min, Math.min(max, (store.settings[key] || 0) + step));
          store.settings[key] = v;
          if (key === 'undercoverCount' || key === 'mrWhiteCount') store.settings.autoRoles = false;
          store.save();
          buzz(10);
          renderSettings();
        });
      });
    });

    $('#theme-switch input').addEventListener('change', function () {
      store.settings.theme = this.checked ? 'dark' : 'light';
      store.save();
      applyTheme();
    });

    $$('#diff-chips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var d = parseInt(c.getAttribute('data-diff'), 10);
        var arr = store.settings.difficulties.slice();
        var i = arr.indexOf(d);
        if (i === -1) arr.push(d); else arr.splice(i, 1);
        if (!arr.length) { toast('Gardez au moins une difficulté'); return; }
        store.settings.difficulties = arr;
        store.save();
        renderSettings();
        refreshHome();
      });
    });

    $('#btn-cats').addEventListener('click', openCategories);

    $('#btn-reset-options').addEventListener('click', function () {
      modal('Réinitialiser les options ?', '<p class="note">Les joueurs, mots perso et statistiques sont conservés.</p>', [
        { label: 'Annuler' },
        { label: 'Réinitialiser', cls: 'danger', onClick: function () {
            var theme = store.settings.theme;
            Object.keys(store.DEFAULT_SETTINGS).forEach(function (k) {
              store.settings[k] = JSON.parse(JSON.stringify(store.DEFAULT_SETTINGS[k]));
            });
            store.settings.theme = theme;
            store.save(); renderSettings(); toast('Options réinitialisées');
          } }
      ]);
    });

    $('#btn-wipe').addEventListener('click', function () {
      modal('Tout effacer ?', '<p class="note">Options, joueurs, mots personnalisés et statistiques seront supprimés.</p>', [
        { label: 'Annuler' },
        { label: 'Tout effacer', cls: 'danger', onClick: function () {
            store.reset(); applyTheme(); renderPlayers(); renderSettings(); renderWords(); toast('Données effacées');
          } }
      ]);
    });
  }

  function openCategories() {
    var sel = store.settings.categories ? store.settings.categories.slice() : null;
    var html = '<div class="chips" id="cat-chips">' + UC.CATEGORIES.map(function (c) {
      var n = countPairs(c.id);
      var on = !sel || sel.indexOf(c.id) !== -1;
      return '<button class="chip ' + (on ? 'on' : '') + '" data-cat="' + c.id + '">' +
             esc(c.name) + ' · ' + n + '</button>';
    }).join('') + '</div>';

    modal('Catégories', html, [
      { label: 'Toutes', onClick: function () {
          store.settings.categories = null; store.save(); renderSettings(); refreshHome();
        } },
      { label: 'OK', cls: 'primary' }
    ]);

    $$('#cat-chips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var id = c.getAttribute('data-cat');
        var cur = store.settings.categories;
        if (!cur) cur = UC.CATEGORIES.map(function (x) { return x.id; });
        var i = cur.indexOf(id);
        if (i === -1) cur.push(id); else cur.splice(i, 1);
        if (!cur.length) { toast('Gardez au moins une catégorie'); return; }
        store.settings.categories = cur;
        store.save();
        c.classList.toggle('on', cur.indexOf(id) !== -1);
        renderSettings();
        refreshHome();
      });
    });
  }

  function countPairs(catId) {
    var all = UC.PAIRS.concat(store.data.customPairs);
    return all.filter(function (p) { return p.cat === catId; }).length;
  }

  /* --------------------------------------------------------------- joueurs */
  function randomEmoji(used) {
    var free = EMOJIS.filter(function (e) { return used.indexOf(e) === -1; });
    return util.pick(free.length ? free : EMOJIS);
  }

  function ensurePlayers() {
    var p = store.data.players;
    while (p.length < 4) addPlayer(true);
    store.save();
  }

  function addPlayer(silent) {
    var p = store.data.players;
    if (p.length >= 20) { toast('20 joueurs maximum'); return; }
    var used = p.map(function (x) { return x.emoji; });
    p.push({ id: uid(), name: 'Joueur ' + (p.length + 1), emoji: randomEmoji(used) });
    store.save();
    if (!silent) { renderPlayers(); buzz(10); }
  }

  function renderPlayers() {
    var list = $('#player-list');
    var p = store.data.players;
    list.innerHTML = p.map(function (pl, i) {
      return '<div class="player-item" data-id="' + pl.id + '">' +
        '<button class="ava" data-act="emoji">' + pl.emoji + '</button>' +
        '<input type="text" value="' + esc(pl.name) + '" maxlength="14" data-act="name" placeholder="Joueur ' + (i + 1) + '">' +
        '<button class="del" data-act="del">✕</button></div>';
    }).join('');
    $('#player-count-label').textContent = '(' + p.length + ')';
    if (store.settings.autoRoles) autoRoles();
    updateCivilCount();
  }

  function autoRoles() {
    var n = store.data.players.length;
    var r = util.suggestRoles(n);
    store.settings.undercoverCount = r.undercover;
    store.settings.mrWhiteCount = r.white;
    store.save();
    $$('[data-stepper]').forEach(function (elm) {
      var key = elm.getAttribute('data-stepper');
      var v = $('.val', elm);
      if (v && store.settings[key] !== undefined) v.textContent = store.settings[key];
    });
  }

  function updateCivilCount() {
    var n = store.data.players.length;
    var s = store.settings;
    var civils = n - s.undercoverCount - s.mrWhiteCount;
    var lbl = $('#civil-count');
    if (lbl) lbl.textContent = Math.max(0, civils);
    var err = util.validateSetup(n, s.undercoverCount, s.mrWhiteCount);
    var warn = $('#setup-warning');
    if (warn) warn.textContent = err || '';
    var btn = $('#btn-start');
    if (btn) btn.disabled = !!err;
  }

  function bindPlayers() {
    $('#player-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var item = b.closest('.player-item');
      var id = item.getAttribute('data-id');
      var idx = store.data.players.findIndex(function (x) { return x.id === id; });
      if (idx === -1) return;
      var act = b.getAttribute('data-act');
      if (act === 'emoji') {
        var used = store.data.players.map(function (x) { return x.emoji; });
        store.data.players[idx].emoji = randomEmoji(used);
        b.textContent = store.data.players[idx].emoji;
        store.save(); buzz(10);
      } else if (act === 'del') {
        if (store.data.players.length <= 3) { toast('Il faut au moins 3 joueurs'); return; }
        store.data.players.splice(idx, 1);
        store.save(); renderPlayers(); buzz(10);
      }
    });

    $('#player-list').addEventListener('input', function (e) {
      if (e.target.getAttribute('data-act') !== 'name') return;
      var id = e.target.closest('.player-item').getAttribute('data-id');
      var pl = store.data.players.filter(function (x) { return x.id === id; })[0];
      if (pl) { pl.name = e.target.value; store.save(); }
    });

    $('#btn-add-player').addEventListener('click', function () { addPlayer(); });

    $('#btn-clear-players').addEventListener('click', function () {
      modal('Vider la liste ?', '<p class="note">Quatre joueurs par défaut seront recréés.</p>', [
        { label: 'Annuler' },
        { label: 'Vider', cls: 'danger', onClick: function () {
            store.data.players = []; ensurePlayers(); renderPlayers();
          } }
      ]);
    });

    $('#btn-shuffle-names').addEventListener('click', function () {
      store.data.players = util.shuffle(store.data.players);
      store.save(); renderPlayers(); buzz(10); toast('Joueurs mélangés');
    });
  }

  /* ------------------------------------------------------------ mots perso */
  function renderWords() {
    var custom = store.data.customPairs;
    $('#custom-count').textContent = custom.length;
    $('#custom-list').innerHTML = custom.length
      ? custom.map(function (p) {
          return '<div class="row"><div class="label">' + esc(p.a) + ' <span class="note">·</span> ' + esc(p.b) + '</div>' +
                 '<button class="btn sm ghost danger" data-del="' + p.id + '">✕</button></div>';
        }).join('')
      : '<p class="note">Aucune paire personnalisée pour l’instant.</p>';

    $('#builtin-count').textContent = UC.PAIRS.length;
    var byCat = {};
    UC.PAIRS.forEach(function (p) { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
    $('#builtin-list').innerHTML = UC.CATEGORIES.filter(function (c) { return byCat[c.id]; }).map(function (c) {
      return '<div class="row"><div class="label">' + esc(c.name) +
             '<small>' + byCat[c.id].slice(0, 3).map(function (p) { return esc(p.a) + ' / ' + esc(p.b); }).join(' · ') + '…</small></div>' +
             '<span class="note">' + byCat[c.id].length + '</span></div>';
    }).join('');
  }

  function bindWords() {
    $('#btn-add-pair').addEventListener('click', function () {
      var a = $('#new-a').value.trim(), b = $('#new-b').value.trim();
      if (!a || !b) { toast('Renseignez les deux mots'); return; }
      if (util.normalize(a) === util.normalize(b)) { toast('Les deux mots doivent être différents'); return; }
      store.data.customPairs.push({ id: 'c' + uid(), a: a, b: b, cat: 'custom', diff: 2 });
      store.save();
      $('#new-a').value = ''; $('#new-b').value = '';
      renderWords(); refreshHome(); buzz(15); toast('Paire ajoutée');
    });

    $('#custom-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      var id = b.getAttribute('data-del');
      store.data.customPairs = store.data.customPairs.filter(function (p) { return p.id !== id; });
      store.save(); renderWords(); refreshHome();
    });

    $('#btn-clear-custom').addEventListener('click', function () {
      if (!store.data.customPairs.length) return;
      modal('Supprimer mes mots ?', '<p class="note">Toutes vos paires personnalisées seront perdues.</p>', [
        { label: 'Annuler' },
        { label: 'Supprimer', cls: 'danger', onClick: function () {
            store.data.customPairs = []; store.save(); renderWords(); refreshHome();
          } }
      ]);
    });

    $('#btn-export').addEventListener('click', function () {
      var json = JSON.stringify(store.data.customPairs.map(function (p) { return [p.a, p.b]; }));
      modal('Exporter mes mots',
        '<p class="note">Copiez ce texte pour le réutiliser sur un autre téléphone.</p>' +
        '<textarea readonly style="width:100%;min-height:140px;user-select:text" id="export-box">' + esc(json) + '</textarea>',
        [{ label: 'Copier', cls: 'primary', onClick: function () {
            var box = $('#export-box'); box.select();
            try { document.execCommand('copy'); toast('Copié'); } catch (e) { toast('Copie impossible'); }
            return false;
          } }, { label: 'Fermer' }]);
    });

    $('#btn-import').addEventListener('click', function () {
      modal('Importer des mots',
        '<p class="note">Collez un export, ou une liste au format <code>mot1, mot2</code> (une paire par ligne).</p>' +
        '<textarea style="width:100%;min-height:140px;user-select:text" id="import-box" placeholder="Fraise, Framboise&#10;Chat, Chien"></textarea>',
        [{ label: 'Annuler' }, { label: 'Importer', cls: 'primary', onClick: function () {
            var txt = $('#import-box').value.trim();
            if (!txt) return;
            var pairs = [];
            try {
              var parsed = JSON.parse(txt);
              if (Array.isArray(parsed)) {
                parsed.forEach(function (row) {
                  if (Array.isArray(row) && row.length >= 2) pairs.push([String(row[0]), String(row[1])]);
                  else if (row && row.a && row.b) pairs.push([String(row.a), String(row.b)]);
                });
              }
            } catch (e) {
              txt.split('\n').forEach(function (line) {
                var parts = line.split(/[,;\/|]/);
                if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) pairs.push([parts[0].trim(), parts[1].trim()]);
              });
            }
            if (!pairs.length) { toast('Rien à importer'); return false; }
            pairs.forEach(function (p) {
              store.data.customPairs.push({ id: 'c' + uid(), a: p[0], b: p[1], cat: 'custom', diff: 2 });
            });
            store.save(); renderWords(); refreshHome();
            toast(pairs.length + ' paire(s) importée(s)');
          } }]);
    });
  }

  /* ------------------------------------------------------------ statistiques */
  function renderStats() {
    var st = store.data.stats;
    var total = st.civilWins + st.undercoverWins + st.whiteWins;
    function pct(n) { return total ? Math.round(n * 100 / total) + '%' : '—'; }
    $('#stats-global').innerHTML =
      '<h3>Global</h3>' +
      '<div class="row"><div class="label">Parties jouées</div><b>' + st.games + '</b></div>' +
      '<div class="row"><div class="label">Manches jouées</div><b>' + st.rounds + '</b></div>' +
      '<div class="row"><div class="label">Victoires civils</div><b>' + st.civilWins + ' <span class="note">' + pct(st.civilWins) + '</span></b></div>' +
      '<div class="row"><div class="label">Victoires undercover</div><b>' + st.undercoverWins + ' <span class="note">' + pct(st.undercoverWins) + '</span></b></div>' +
      '<div class="row"><div class="label">Victoires Mr White</div><b>' + st.whiteWins + ' <span class="note">' + pct(st.whiteWins) + '</span></b></div>';

    var names = Object.keys(st.byPlayer);
    names.sort(function (a, b) { return st.byPlayer[b].wins - st.byPlayer[a].wins; });
    $('#stats-players').innerHTML = names.length ? names.map(function (n) {
      var p = st.byPlayer[n];
      var ratio = p.rounds ? Math.round(p.wins * 100 / p.rounds) + '%' : '—';
      return '<div class="row"><div class="label">' + esc(n) +
        '<small>' + p.rounds + ' manches · undercover ' + p.asUndercover + ' · mr white ' + p.asWhite + '</small></div>' +
        '<b>' + ratio + '</b></div>';
    }).join('') : '<p class="note">Aucune partie enregistrée.</p>';
  }

  function bumpPlayerStat(name, key) {
    var bp = store.data.stats.byPlayer;
    bp[name] = bp[name] || { rounds: 0, wins: 0, asUndercover: 0, asWhite: 0 };
    bp[name][key]++;
  }

  /* ------------------------------------------------------------- chronomètre */
  function stopTimer() {
    if (S.timerId) { clearInterval(S.timerId); S.timerId = null; }
  }
  function startTimer(seconds, display, onEnd) {
    stopTimer();
    S.timerLeft = seconds;
    function paint() {
      var m = Math.floor(S.timerLeft / 60), s = S.timerLeft % 60;
      display.textContent = m > 0 ? m + ':' + (s < 10 ? '0' : '') + s : String(s);
      display.classList.toggle('low', S.timerLeft <= 5);
    }
    display.hidden = false;
    paint();
    S.timerId = setInterval(function () {
      S.timerLeft--;
      if (S.timerLeft <= 5 && S.timerLeft > 0) beep(660, 0.08);
      paint();
      if (S.timerLeft <= 0) {
        stopTimer(); beep(330, 0.4, 'square'); buzz([60, 40, 60]);
        if (onEnd) onEnd();
      }
    }, 1000);
  }

  /* --------------------------------------------------------------- la partie */
  function startGame() {
    var s = store.settings;
    var players = store.data.players.map(function (p, i) {
      return { id: p.id, name: (p.name || '').trim() || ('Joueur ' + (i + 1)), emoji: p.emoji };
    });
    var err = util.validateSetup(players.length, s.undercoverCount, s.mrWhiteCount);
    if (err) { toast(err); return; }
    if (!poolInfo().pool.length) { toast('Aucune paire disponible avec ces filtres'); return; }

    game.start(players, s);
    store.data.stats.games++;
    store.save();
    S.inGame = true;
    requestWakeLock();
    startRound();
  }

  function startRound() {
    var r = game.newRound(poolInfo, function (pairId, exhausted) {
      if (exhausted) store.data.usedPairs = [];
      if (pairId) {
        store.data.usedPairs.push(pairId);
        if (store.data.usedPairs.length > 500) store.data.usedPairs.splice(0, 200);
      }
      store.save();
    });
    if (!r) { toast('Aucune paire disponible'); go('setup'); return; }
    store.data.stats.rounds++;
    r.members.forEach(function (m) {
      bumpPlayerStat(m.name, 'rounds');
      if (m.role === ROLE.UNDERCOVER) bumpPlayerStat(m.name, 'asUndercover');
      if (m.role === ROLE.WHITE) bumpPlayerStat(m.name, 'asWhite');
    });
    store.save();

    S.revealIdx = 0; S.revealShown = false; S.revealSeen = false;
    go('reveal');
    renderReveal();
  }

  /* --- distribution des rôles --- */
  function renderReveal() {
    var r = game.round;
    var order = r.revealOrder;
    if (S.revealIdx >= order.length) { showOrder(); return; }
    var m = game.member(order[S.revealIdx]);
    var card = $('#reveal-card');
    var s = store.settings;

    $('#reveal-progress').textContent = (S.revealIdx + 1) + '/' + order.length;
    $('#reveal-dots').innerHTML = order.map(function (_, i) {
      return '<i class="' + (i < S.revealIdx ? 'done' : (i === S.revealIdx ? 'now' : '')) + '"></i>';
    }).join('');

    if (!S.revealShown) {
      card.innerHTML =
        '<div class="emo" style="font-size:2rem">' + m.emoji + '</div>' +
        '<div class="who">' + esc(m.name) + '</div>' +
        '<div class="hint">Prends le téléphone, puis ' +
        (s.holdToReveal ? 'maintiens appuyé' : 'appuie') + ' pour découvrir ton mot</div>';
    } else {
      var showRole = m.role === ROLE.WHITE || (m.role === ROLE.UNDERCOVER && s.undercoverKnows);
      card.innerHTML =
        (showRole ? '<div class="stamp ' + ROLE_CLASS[m.role] + '">' + ROLE_LABEL[m.role] + '</div>' : '') +
        (m.word
          ? '<div class="big-word">' + esc(m.word) + '</div>'
          : '<div class="big-word">Aucun mot</div><div class="hint">Tu es Mr White : écoute, puis bluffe</div>') +
        (s.showCategory && m.word ? '<div class="hint">Catégorie : ' + UC.categoryById(r.pair.cat).name + '</div>' : '') +
        '<div class="hint">' + esc(m.name) + '</div>';
    }
    $('#btn-reveal-next').hidden = !S.revealSeen || (s.holdToReveal && S.revealShown);
    $('#btn-reveal-next').textContent = (S.revealIdx === order.length - 1) ? 'Terminer la distribution' : 'Joueur suivant →';
  }

  function bindReveal() {
    var card = $('#reveal-card');

    card.addEventListener('pointerdown', function () {
      if (store.settings.holdToReveal) {
        S.revealShown = true; S.revealSeen = true; buzz(12); renderReveal();
      }
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      card.addEventListener(ev, function () {
        if (store.settings.holdToReveal && S.revealShown) { S.revealShown = false; renderReveal(); }
      });
    });
    card.addEventListener('click', function () {
      if (store.settings.holdToReveal) return;
      if (!S.revealShown) { S.revealShown = true; S.revealSeen = true; beep(880, 0.1); buzz(12); renderReveal(); }
    });

    $('#btn-reveal-next').addEventListener('click', function () {
      S.revealIdx++; S.revealShown = false; S.revealSeen = false;
      renderReveal();
    });
  }

  /* --- ordre de parole --- */
  function showOrder() {
    var r = game.round;
    var order = game.speakingOrder();
    $('#order-round').textContent = 'Manche ' + r.index + ' · tour ' + r.turn;
    $('#order-hint').textContent = store.settings.showCategory
      ? 'Catégorie : ' + UC.categoryById(r.pair.cat).name + ' — décrivez votre mot sans le dire'
      : 'Décrivez votre mot en une phrase, sans jamais le dire';
    $('#order-list').innerHTML = order.map(function (m, i) {
      return '<div class="speaker ' + (i === 0 ? 'first' : '') + '"><span class="num">' + (i + 1) + '</span>' +
             '<span class="emo">' + m.emoji + '</span><b>' + esc(m.name) + '</b>' +
             (i === 0 ? '<span class="spacer"></span><span class="badge">commence</span>' : '') + '</div>';
    }).join('');
    go('order');
    beep(520, 0.12);
  }

  /* --- description / débat --- */
  function showDiscussion() {
    S.speakIdx = 0; S.phase = 'speak';
    go('discussion');
    renderDiscussion();
  }

  function renderDiscussion() {
    var r = game.round;
    var order = game.speakingOrder();
    var s = store.settings;
    $('#discussion-round').textContent = 'Manche ' + r.index + ' · tour ' + r.turn;
    $('#btn-peek').hidden = !s.allowPeek;

    $('#discussion-list').innerHTML = order.map(function (m, i) {
      return '<div class="speaker ' + (i === S.speakIdx && S.phase === 'speak' ? 'first' : '') + '">' +
             '<span class="num">' + (i + 1) + '</span><span class="emo">' + m.emoji + '</span>' +
             '<b>' + esc(m.name) + '</b></div>';
    }).join('');

    var timerEl = $('#turn-timer');
    if (S.phase === 'debate') {
      $('#discussion-title').textContent = 'Débat';
      $('#turn-box').querySelector('.turn-label').textContent = 'Discussion libre';
      $('#turn-avatar').textContent = '';
      $('#turn-name').textContent = 'Qui est suspect ?';
      $('#btn-next-speaker').textContent = 'Passer au vote';
      if (s.discussionTimer > 0) startTimer(s.discussionTimer, timerEl, goVote);
      else timerEl.hidden = true;
      return;
    }

    var m = order[S.speakIdx];
    $('#discussion-title').textContent = 'Description';
    $('#turn-box').querySelector('.turn-label').textContent = 'Au tour de';
    $('#turn-avatar').textContent = m.emoji;
    $('#turn-name').textContent = m.name;
    $('#btn-next-speaker').textContent = (S.speakIdx === order.length - 1)
      ? (s.discussionTimer > 0 ? 'Ouvrir le débat' : 'Passer au vote') : 'Suivant →';

    if (s.turnTimer > 0) startTimer(s.turnTimer, timerEl, function () { nextSpeaker(); });
    else { stopTimer(); timerEl.hidden = true; }
  }

  function nextSpeaker() {
    var order = game.speakingOrder();
    if (S.phase === 'debate') { goVote(); return; }
    if (S.speakIdx < order.length - 1) {
      S.speakIdx++;
      beep(700, 0.08);
      renderDiscussion();
    } else if (store.settings.discussionTimer > 0) {
      S.phase = 'debate';
      renderDiscussion();
    } else {
      goVote();
    }
  }

  function openPeek() {
    var alive = game.alive();
    var html = '<p class="note mb">Choisis ton nom, puis maintiens appuyé sur la carte</p><div class="grid">' +
      alive.map(function (m) {
        return '<button class="pcard" data-peek="' + m.id + '"><span class="ava">' + m.emoji + '</span>' +
               '<span class="nm">' + esc(m.name) + '</span></button>';
      }).join('') + '</div>';
    modal('Revoir mon mot', html, [{ label: 'Fermer' }]);
    $$('#modal-body [data-peek]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = game.member(b.getAttribute('data-peek'));
        var body = '<div class="reveal-card" id="peek-card"><div class="hint">Maintiens appuyé</div></div>';
        modal(m.name, body, [{ label: 'Fermer' }]);
        var card = $('#peek-card');
        card.addEventListener('pointerdown', function () {
          card.innerHTML = m.word ? '<div class="big-word">' + esc(m.word) + '</div>'
                                  : '<div class="big-word">Aucun mot</div>';
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
          card.addEventListener(ev, function () { card.innerHTML = '<div class="hint">Maintiens appuyé</div>'; });
        });
      });
    });
  }

  /* --- vote --- */
  function goVote() {
    stopTimer();
    game.round.votes = {};
    S.selected = null;
    S.voterIdx = 0;
    S.tallyShown = false;
    S.revoteAmong = null;
    go('vote');
    renderVote();
  }

  function voteCandidates() {
    var alive = game.alive();
    if (S.revoteAmong) {
      alive = alive.filter(function (m) { return S.revoteAmong.indexOf(m.id) !== -1; });
    }
    return alive;
  }

  function renderVote() {
    var s = store.settings;
    var sequential = s.voteMode === 'sequential';
    var candidates = voteCandidates();
    var grid = $('#vote-grid');

    if (S.tallyShown) {
      var t = game.tally();
      $('#vote-title').textContent = 'Résultat du vote';
      $('#vote-hint').textContent = t.tie ? 'Égalité' : 'Les votes sont tombés';
      $('#vote-progress').textContent = '';
      grid.innerHTML = game.alive().map(function (m) {
        var n = t.counts[m.id] || 0;
        return '<div class="pcard ' + (t.top.indexOf(m.id) !== -1 && t.max > 0 ? 'sel' : '') + '">' +
               '<span class="ava">' + m.emoji + '</span><span class="nm">' + esc(m.name) + '</span>' +
               '<span class="votes">' + n + ' vote' + (n > 1 ? 's' : '') + '</span></div>';
      }).join('');
      $('#btn-skip-vote').hidden = true;
      $('#btn-confirm-vote').textContent = 'Continuer';
      return;
    }

    $('#btn-skip-vote').hidden = false;
    $('#btn-skip-vote').textContent = sequential ? 'S’abstenir' : 'Personne';
    $('#btn-confirm-vote').textContent = 'Valider';

    if (sequential) {
      var voters = game.alive();
      var voter = voters[S.voterIdx];
      $('#vote-title').textContent = 'Vote secret';
      $('#vote-progress').textContent = (S.voterIdx + 1) + '/' + voters.length;
      $('#vote-hint').textContent = 'Téléphone à ' + voter.name + ' — qui soupçonnes-tu ?';
      grid.innerHTML = candidates.filter(function (m) { return m.id !== voter.id; }).map(cardHtml).join('');
    } else {
      $('#vote-title').textContent = S.revoteAmong ? 'Second vote' : 'Vote';
      $('#vote-progress').textContent = 'Tour ' + game.round.turn;
      $('#vote-hint').textContent = S.revoteAmong
        ? 'Égalité : départagez les joueurs concernés'
        : 'À main levée : qui la majorité veut-elle éliminer ?';
      grid.innerHTML = candidates.map(cardHtml).join('');
    }

    function cardHtml(m) {
      return '<button class="pcard ' + (S.selected === m.id ? 'sel' : '') + '" data-vote="' + m.id + '">' +
             '<span class="ava">' + m.emoji + '</span><span class="nm">' + esc(m.name) + '</span></button>';
    }
  }

  function bindVote() {
    $('#vote-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vote]');
      if (!b || S.tallyShown) return;
      S.selected = b.getAttribute('data-vote');
      buzz(10);
      renderVote();
    });

    $('#btn-skip-vote').addEventListener('click', function () {
      if (store.settings.voteMode === 'sequential') {
        S.selected = null;
        advanceVoter();
      } else {
        toast('Personne n’est éliminé ce tour');
        afterElimination(null);
      }
    });

    $('#btn-confirm-vote').addEventListener('click', function () {
      if (S.tallyShown) { resolveVote(); return; }
      if (!S.selected) { toast('Choisissez un joueur'); return; }
      if (store.settings.voteMode === 'sequential') {
        var voters = game.alive();
        game.round.votes[voters[S.voterIdx].id] = S.selected;
        advanceVoter();
      } else {
        // vote rapide : la sélection vaut décision collective
        game.round.votes = {};
        game.round.votes['_group'] = S.selected;
        eliminateAndShow(S.selected);
      }
    });
  }

  function advanceVoter() {
    var voters = game.alive();
    S.selected = null;
    if (S.voterIdx < voters.length - 1) {
      S.voterIdx++;
      beep(600, 0.06);
      renderVote();
    } else {
      S.tallyShown = true;
      beep(880, 0.15);
      renderVote();
    }
  }

  function resolveVote() {
    var t = game.tally();
    if (t.max === 0) { afterElimination(null); return; }
    if (t.tie) {
      var mode = store.settings.tieMode;
      if (mode === 'nobody') { toast('Égalité : personne n’est éliminé'); afterElimination(null); return; }
      if (mode === 'random' || S.revoteAmong) {
        // tirage au sort, ou seconde égalité de suite : on tranche
        var chosen = util.pick(t.top);
        eliminateAndShow(chosen, 'Départagé par le sort');
        return;
      }
      // revote entre les joueurs à égalité
      S.revoteAmong = t.top.slice();
      game.round.votes = {};
      S.voterIdx = 0; S.selected = null; S.tallyShown = false;
      toast('Égalité : on revote');
      renderVote();
      return;
    }
    eliminateAndShow(t.top[0]);
  }

  function eliminateAndShow(id, note) {
    var m = game.eliminate(id);
    beep(220, 0.35, 'sawtooth'); buzz([40, 30, 80]);
    var reveal = store.settings.revealEliminatedRole;
    $('#elim-hero').innerHTML =
      '<div class="kicker">Verdict du vote</div>' +
      '<div class="emo" style="font-size:2.2rem">' + m.emoji + '</div>' +
      '<h2>' + esc(m.name) + ' est éliminé</h2>' +
      (note ? '<p>' + esc(note) + '</p>' : '');
    $('#elim-detail').innerHTML = reveal
      ? '<div class="center" style="padding:22px 0"><span class="stamp big ' + ROLE_CLASS[m.role] + '">' +
        ROLE_LABEL[m.role] + '</span>' +
        (m.word ? '<p class="note mt">Son mot : ' + esc(m.word) + '</p>' : '<p class="note mt">Il n’avait aucun mot</p>') + '</div>'
      : '<p class="note center" style="padding:22px 0">Son rôle reste secret jusqu’à la fin de la manche</p>';
    go('elimination');
  }

  function afterElimination(eliminated) {
    // Appelé quand personne n'est éliminé
    var end = game.checkEnd();
    if (end) { finishRound(end); return; }
    game.nextTurn();
    showOrder();
  }

  function continueAfterElimination() {
    var m = game.round.lastElimination;
    var s = store.settings;
    if (m && m.role === ROLE.WHITE && s.whiteCanGuess) {
      var c = game.counts();
      var otherImposters = c.undercover + c.white;
      if (!s.whiteGuessOnlyIfLast || otherImposters === 0) {
        $('#white-name').textContent = m.name;
        $('#white-guess').value = '';
        go('white');
        return;
      }
    }
    var end = game.checkEnd();
    if (end) { finishRound(end); return; }
    game.nextTurn();
    showOrder();
  }

  function bindWhite() {
    $('#btn-white-submit').addEventListener('click', function () {
      var txt = $('#white-guess').value.trim();
      if (!txt) { toast('Proposez un mot'); return; }
      var ok = game.submitWhiteGuess(txt);
      if (ok) { beep(1050, 0.3); buzz([30, 30, 30, 30, 120]); finishRound('white'); }
      else {
        beep(180, 0.4, 'square');
        toast('Raté ! Ce n’était pas le mot.');
        var end = game.checkEnd();
        if (end) { finishRound(end); return; }
        game.nextTurn();
        showOrder();
      }
    });
    $('#btn-white-skip').addEventListener('click', function () {
      var end = game.checkEnd();
      if (end) { finishRound(end); return; }
      game.nextTurn();
      showOrder();
    });
  }

  /* --- fin de manche --- */
  function finishRound(winner) {
    var awarded = game.endRound(winner);
    var r = game.round;
    var st = store.data.stats;
    if (winner === 'civils') st.civilWins++;
    else if (winner === 'white') st.whiteWins++;
    else st.undercoverWins++;

    r.members.forEach(function (m) {
      var won = (winner === 'civils' && m.role === ROLE.CIVIL) ||
                (winner === 'imposteurs' && m.role !== ROLE.CIVIL) ||
                (winner === 'white' && m.role === ROLE.WHITE);
      if (won) bumpPlayerStat(m.name, 'wins');
    });
    store.save();

    var hero = {
      civils: { title: 'Les civils gagnent', sub: 'Tous les imposteurs ont été démasqués' },
      imposteurs: { title: 'Les imposteurs gagnent', sub: 'Ils sont désormais trop nombreux' },
      white: { title: 'Mr White gagne', sub: 'Il a deviné le mot des civils' }
    }[winner];

    $('#end-hero').innerHTML = '<div class="kicker">Manche ' + r.index + ' · verdict</div>' +
      '<h2>' + hero.title + '</h2><p>' + hero.sub + '</p>';
    $('#end-words').innerHTML =
      '<div><small>Mot des civils</small><b>' + esc(r.civilWord) + '</b></div>' +
      '<div><small>Mot undercover</small><b>' + esc(r.undercoverWord) + '</b></div>';

    var rank = { undercover: 0, white: 1, civil: 2 };
    var ordered = r.members.slice().sort(function (a, b) { return rank[a.role] - rank[b.role]; });
    $('#end-roles').innerHTML = ordered.map(function (m) {
      return '<div class="row"><span class="emo">' + m.emoji + '</span>' +
        '<div class="label">' + esc(m.name) + '<small>' + (m.alive ? 'a survécu' : 'éliminé au tour ' + m.eliminatedTurn) + '</small></div>' +
        '<span class="badge ' + ROLE_CLASS[m.role] + '">' + ROLE_LABEL[m.role] + '</span></div>';
    }).join('');

    var scoring = store.settings.scoring;
    $('#end-scores-card').hidden = !scoring;
    if (scoring) {
      $('#end-scores').innerHTML = game.leaderboard().map(function (p, i) {
        var d = awarded[p.id] || 0;
        return '<div class="score-row"><span class="rank">' + (i + 1) + '</span>' +
          '<span class="emo">' + p.emoji + '</span>' +
          '<span class="label">' + esc(p.name) + '</span>' +
          (d ? '<span class="delta">+' + d + '</span>' : '') +
          '<span class="pts">' + p.score + '</span></div>';
      }).join('');
    }

    var reached = game.targetReached();
    $('#btn-next-round').textContent = reached ? 'Voir le vainqueur' : 'Manche suivante';
    $('#btn-next-round').setAttribute('data-final', reached ? '1' : '');
    beep(winner === 'civils' ? 880 : 520, 0.25);
    go('roundend');
  }

  function showChampion() {
    var lb = game.leaderboard();
    var html = lb.map(function (p, i) {
      return '<div class="score-row"><span class="rank">' + (i + 1) + '</span>' +
        '<span class="emo">' + p.emoji + '</span><span class="label">' + esc(p.name) + '</span>' +
        '<span class="pts">' + p.score + '</span></div>';
    }).join('');
    modal(lb[0].name + ' remporte la partie', html, [
      { label: 'Rejouer', cls: 'primary', onClick: function () { S.inGame = false; go('setup'); } },
      { label: 'Accueil', onClick: function () { quitGame(true); } }
    ]);
  }

  function quitGame(silent) {
    function doQuit() {
      S.inGame = false;
      S.lastGameScreen = null;
      stopTimer();
      releaseWakeLock();
      nav = [];
      go('home', true);
    }
    if (silent) { doQuit(); return; }
    modal('Quitter la partie ?', '<p class="note">La manche en cours sera perdue.</p>', [
      { label: 'Continuer à jouer' },
      { label: 'Quitter', cls: 'danger', onClick: doQuit }
    ]);
  }

  /* -------------------------------------------------------------- accueil */
  function refreshHome() {
    var info = poolInfo();
    var custom = store.data.customPairs.length;
    $('#home-note').textContent = info.pool.length + ' paires disponibles' +
      (custom ? ' · ' + custom + ' perso' : '') + ' · ' + store.data.players.length + ' joueurs';
    var btn = $('#btn-resume');
    btn.hidden = !(S.inGame && S.lastGameScreen);
  }

  /* --------------------------------------------------------------- démarrage */
  function bindGlobal() {
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-go')); });
    });
    $$('[data-back]').forEach(function (b) {
      b.addEventListener('click', back);
    });
    $('#modal').addEventListener('click', function (e) {
      if (e.target === $('#modal')) closeModal();
    });

    $('#btn-start').addEventListener('click', startGame);
    $('#btn-resume').addEventListener('click', function () { go(S.lastGameScreen); });
    $('#btn-start-discussion').addEventListener('click', showDiscussion);
    $('#btn-next-speaker').addEventListener('click', nextSpeaker);
    $('#btn-prev-speaker').addEventListener('click', function () {
      if (S.phase === 'debate') { S.phase = 'speak'; S.speakIdx = game.speakingOrder().length - 1; renderDiscussion(); return; }
      if (S.speakIdx > 0) { S.speakIdx--; renderDiscussion(); }
    });
    $('#btn-go-vote').addEventListener('click', goVote);
    $('#btn-peek').addEventListener('click', openPeek);
    $('#btn-elim-continue').addEventListener('click', continueAfterElimination);
    $('#btn-next-round').addEventListener('click', function () {
      if (this.getAttribute('data-final')) { showChampion(); return; }
      startRound();
    });
    $('#btn-end-quit').addEventListener('click', function () {
      if (store.settings.scoring && game.leaderboard().length) showChampion();
      else quitGame(true);
    });
    ['#btn-quit-1', '#btn-quit-2', '#btn-quit-3', '#btn-quit-4'].forEach(function (sel) {
      $(sel).addEventListener('click', function () { quitGame(); });
    });
    $('#btn-reset-stats').addEventListener('click', function () {
      modal('Réinitialiser les stats ?', '<p class="note">Les compteurs repartent à zéro.</p>', [
        { label: 'Annuler' },
        { label: 'Réinitialiser', cls: 'danger', onClick: function () {
            store.data.stats = { games: 0, rounds: 0, civilWins: 0, undercoverWins: 0, whiteWins: 0, byPlayer: {} };
            store.save(); renderStats();
          } }
      ]);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTimer();
      else if (S.inGame) requestWakeLock();
    });
  }

  function init() {
    store.load();
    applyTheme();
    ensurePlayers();
    bindGlobal();
    bindSettings();
    bindPlayers();
    bindWords();
    bindReveal();
    bindVote();
    bindWhite();
    renderSettings();
    renderPlayers();
    refreshHome();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
