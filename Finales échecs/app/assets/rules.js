/* Finales — règles du jeu : position, coups légaux, FEN, notation algébrique.

   Représentation 0x88 : un tableau de 128 cases dont seules 64 sont sur
   l'échiquier ((sq & 0x88) === 0). L'index 0 est a8, l'index 119 est h1, si
   bien que rang = sq >> 4 (0 = huitième rangée) et colonne = sq & 15.

   Le roque n'est pas implémenté : aucune position de finales.json n'en porte
   les droits, et `parseFen` refuse une FEN qui en déclarerait. La prise en
   passant, elle, l'est — elle ne coûte rien et évite une classe de bugs
   silencieux si un exercice futur en contient une.

   Le générateur est vérifié coup par coup contre la liste renvoyée par la
   tablebase Lichess (voir verifier-regles.js) : c'est un oracle indépendant,
   plus utile ici qu'un perft sur la position initiale. */
(function (global) {
  'use strict';

  var WHITE = 'w';
  var BLACK = 'b';

  var PAWN_OFFSETS = { w: [-16, -32], b: [16, 32] };
  var PAWN_ATTACKS = { w: [-17, -15], b: [17, 15] };
  var OFFSETS = {
    n: [-33, -31, -18, -14, 14, 18, 31, 33],
    b: [-17, -15, 15, 17],
    r: [-16, -1, 1, 16],
    q: [-17, -16, -15, -1, 1, 15, 16, 17],
    k: [-17, -16, -15, -1, 1, 15, 16, 17]
  };
  var SLIDING = { b: true, r: true, q: true };

  var FILES = 'abcdefgh';

  function rank(sq) { return sq >> 4; }
  function file(sq) { return sq & 15; }
  function onBoard(sq) { return (sq & 0x88) === 0; }
  function algebraic(sq) { return FILES[file(sq)] + (8 - rank(sq)); }
  function fromAlgebraic(s) {
    var f = FILES.indexOf(s[0]);
    var r = 8 - parseInt(s[1], 10);
    if (f < 0 || r < 0 || r > 7) return -1;
    return r * 16 + f;
  }
  function colorOf(p) { return p === p.toUpperCase() ? WHITE : BLACK; }
  function typeOf(p) { return p.toLowerCase(); }
  function swap(c) { return c === WHITE ? BLACK : WHITE; }

  /* ------------------------------------------------------------------ FEN */

  function parseFen(fen) {
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('FEN incomplète : ' + fen);
    if (parts[2] !== '-') throw new Error('droits de roque non gérés : ' + fen);

    var board = new Array(128).fill(null);
    var sq = 0;
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('FEN : 8 rangées attendues');
    for (var r = 0; r < 8; r++) {
      sq = r * 16;
      var row = rows[r];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '1' && ch <= '8') {
          sq += parseInt(ch, 10);
        } else {
          if (!onBoard(sq)) throw new Error('FEN : rangée trop longue');
          board[sq] = ch;
          sq++;
        }
      }
    }
    return {
      board: board,
      turn: parts[1] === 'b' ? BLACK : WHITE,
      ep: parts[3] === '-' ? -1 : fromAlgebraic(parts[3]),
      half: parts.length > 4 ? parseInt(parts[4], 10) || 0 : 0,
      full: parts.length > 5 ? parseInt(parts[5], 10) || 1 : 1
    };
  }

  function toFen(pos) {
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var row = '';
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = pos.board[r * 16 + f];
        if (p) {
          if (empty) { row += empty; empty = 0; }
          row += p;
        } else {
          empty++;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/') + ' ' + pos.turn + ' - ' +
      (pos.ep >= 0 ? algebraic(pos.ep) : '-') + ' ' + pos.half + ' ' + pos.full;
  }

  function clone(pos) {
    return {
      board: pos.board.slice(),
      turn: pos.turn,
      ep: pos.ep,
      half: pos.half,
      full: pos.full
    };
  }

  /* ------------------------------------------------------------- attaques */

  function kingSquare(pos, color) {
    var want = color === WHITE ? 'K' : 'k';
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (pos.board[sq] === want) return sq;
    }
    return -1;
  }

  /* `color` attaque-t-elle `target` ? */
  function attacked(pos, color, target) {
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = pos.board[sq];
      if (!p || colorOf(p) !== color) continue;
      var t = typeOf(p);

      if (t === 'p') {
        var atk = PAWN_ATTACKS[color];
        if (sq + atk[0] === target || sq + atk[1] === target) return true;
        continue;
      }
      var offs = OFFSETS[t];
      for (var i = 0; i < offs.length; i++) {
        var to = sq + offs[i];
        while (onBoard(to)) {
          if (to === target) return true;
          if (pos.board[to]) break;
          if (!SLIDING[t]) break;
          to += offs[i];
        }
      }
    }
    return false;
  }

  function inCheck(pos, color) {
    var k = kingSquare(pos, color);
    return k >= 0 && attacked(pos, swap(color), k);
  }

  /* --------------------------------------------------------------- coups */

  function addPawnMove(out, pos, from, to, captured, epFlag) {
    var color = colorOf(pos.board[from]);
    var promoRank = color === WHITE ? 0 : 7;
    if (rank(to) === promoRank) {
      ['q', 'r', 'b', 'n'].forEach(function (pr) {
        out.push({ from: from, to: to, piece: 'p', captured: captured, promo: pr, ep: !!epFlag });
      });
    } else {
      out.push({ from: from, to: to, piece: 'p', captured: captured, promo: null, ep: !!epFlag });
    }
  }

  /* Coups pseudo-légaux (sans filtrer l'échec). */
  function pseudoMoves(pos) {
    var out = [];
    var color = pos.turn;
    var them = swap(color);

    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = pos.board[sq];
      if (!p || colorOf(p) !== color) continue;
      var t = typeOf(p);

      if (t === 'p') {
        var one = sq + PAWN_OFFSETS[color][0];
        if (onBoard(one) && !pos.board[one]) {
          addPawnMove(out, pos, sq, one, null, false);
          var startRank = color === WHITE ? 6 : 1;
          var two = sq + PAWN_OFFSETS[color][1];
          if (rank(sq) === startRank && !pos.board[two]) {
            out.push({ from: sq, to: two, piece: 'p', captured: null, promo: null, ep: false, big: true });
          }
        }
        var atk = PAWN_ATTACKS[color];
        for (var a = 0; a < 2; a++) {
          var to = sq + atk[a];
          if (!onBoard(to)) continue;
          var tgt = pos.board[to];
          if (tgt && colorOf(tgt) === them) {
            addPawnMove(out, pos, sq, to, typeOf(tgt), false);
          } else if (!tgt && to === pos.ep) {
            addPawnMove(out, pos, sq, to, 'p', true);
          }
        }
        continue;
      }

      var offs = OFFSETS[t];
      for (var i = 0; i < offs.length; i++) {
        var dst = sq + offs[i];
        while (onBoard(dst)) {
          var occ = pos.board[dst];
          if (!occ) {
            out.push({ from: sq, to: dst, piece: t, captured: null, promo: null, ep: false });
          } else {
            if (colorOf(occ) === them) {
              out.push({ from: sq, to: dst, piece: t, captured: typeOf(occ), promo: null, ep: false });
            }
            break;
          }
          if (!SLIDING[t]) break;
          dst += offs[i];
        }
      }
    }
    return out;
  }

  /* Applique un coup sans vérifier sa légalité. Retourne une nouvelle position. */
  function apply(pos, mv) {
    var next = clone(pos);
    var color = pos.turn;
    var piece = next.board[mv.from];

    next.board[mv.from] = null;
    if (mv.ep) {
      next.board[mv.to + (color === WHITE ? 16 : -16)] = null;
    }
    if (mv.promo) {
      next.board[mv.to] = color === WHITE ? mv.promo.toUpperCase() : mv.promo;
    } else {
      next.board[mv.to] = piece;
    }

    next.ep = mv.big ? (mv.from + (color === WHITE ? -16 : 16)) : -1;
    next.half = (mv.piece === 'p' || mv.captured) ? 0 : pos.half + 1;
    next.full = color === BLACK ? pos.full + 1 : pos.full;
    next.turn = swap(color);
    return next;
  }

  /* Coups légaux, avec notation algébrique et position résultante. */
  function moves(pos) {
    var color = pos.turn;
    var out = [];
    var pseudo = pseudoMoves(pos);

    for (var i = 0; i < pseudo.length; i++) {
      var after = apply(pos, pseudo[i]);
      if (inCheck(after, color)) continue;
      pseudo[i].after = after;
      out.push(pseudo[i]);
    }
    for (var j = 0; j < out.length; j++) {
      out[j].uci = algebraic(out[j].from) + algebraic(out[j].to) + (out[j].promo || '');
      out[j].san = san(pos, out[j], out);
    }
    return out;
  }

  /* Notation algébrique abrégée, avec désambiguïsation minimale. */
  function san(pos, mv, all) {
    var s;
    if (mv.piece === 'p') {
      s = mv.captured ? FILES[file(mv.from)] + 'x' + algebraic(mv.to) : algebraic(mv.to);
      if (mv.promo) s += '=' + mv.promo.toUpperCase();
    } else {
      var letter = mv.piece.toUpperCase();
      var same = all.filter(function (m) {
        return m.piece === mv.piece && m.to === mv.to && m.from !== mv.from;
      });
      var dis = '';
      if (same.length) {
        var sameFile = same.some(function (m) { return file(m.from) === file(mv.from); });
        var sameRank = same.some(function (m) { return rank(m.from) === rank(mv.from); });
        if (!sameFile) dis = FILES[file(mv.from)];
        else if (!sameRank) dis = String(8 - rank(mv.from));
        else dis = algebraic(mv.from);
      }
      s = letter + dis + (mv.captured ? 'x' : '') + algebraic(mv.to);
    }
    var after = mv.after || apply(pos, mv);
    if (inCheck(after, after.turn)) {
      s += moves(after).length ? '+' : '#';
    }
    return s;
  }

  /* ------------------------------------------------------------- terminal */

  function pieceList(pos) {
    var list = [];
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = pos.board[sq];
      if (p) list.push({ sq: sq, type: typeOf(p), color: colorOf(p) });
    }
    return list;
  }

  /* Matériel insuffisant au sens de la FIDE : Rois seuls, Roi+Cavalier,
     Roi+Fou, ou deux Fous de même couleur de case. */
  function insufficientMaterial(pos) {
    var list = pieceList(pos);
    var others = list.filter(function (p) { return p.type !== 'k'; });
    if (!others.length) return true;
    if (others.length === 1) return others[0].type === 'n' || others[0].type === 'b';
    if (others.length === 2 && others[0].type === 'b' && others[1].type === 'b') {
      var c0 = (file(others[0].sq) + rank(others[0].sq)) % 2;
      var c1 = (file(others[1].sq) + rank(others[1].sq)) % 2;
      return c0 === c1;
    }
    return false;
  }

  /* Le camp `color` n'a plus que son Roi. */
  function bareKing(pos, color) {
    return !pieceList(pos).some(function (p) { return p.color === color && p.type !== 'k'; });
  }

  function status(pos) {
    var legal = moves(pos);
    if (!legal.length) return inCheck(pos, pos.turn) ? 'mat' : 'pat';
    if (insufficientMaterial(pos)) return 'materiel';
    if (pos.half >= 100) return 'cinquante';
    return 'encours';
  }

  /* Clé de répétition : position sans les compteurs. */
  function repetitionKey(pos) {
    return toFen(pos).split(' ').slice(0, 4).join(' ');
  }

  var API = {
    WHITE: WHITE,
    BLACK: BLACK,
    parseFen: parseFen,
    toFen: toFen,
    clone: clone,
    moves: moves,
    apply: apply,
    inCheck: inCheck,
    status: status,
    insufficientMaterial: insufficientMaterial,
    bareKing: bareKing,
    pieceList: pieceList,
    repetitionKey: repetitionKey,
    algebraic: algebraic,
    fromAlgebraic: fromAlgebraic,
    colorOf: colorOf,
    typeOf: typeOf,
    swap: swap,
    file: file,
    rank: rank
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.Rules = API;
}(typeof globalThis !== 'undefined' ? globalThis : this));
