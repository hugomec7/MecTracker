(function () {
"use strict";
var __nodeRequire = (typeof require === "function") ? require : null;
var __defs = {}, __cache = {};
function __req(n) {
  var k = n.replace(/^\.\//, "");
  if (__defs[k]) { if (!__cache[k]) { var m = { exports: {} }; __cache[k] = m; __defs[k](m, m.exports, __req); } return __cache[k].exports; }
  if (__nodeRequire) return __nodeRequire(n);
  throw new Error("módulo não encontrado: " + n);
}
__defs["inflate"] = function (module, exports, require) {
/* MecTracker V2 - inflate (zlib/deflate) em JS puro, sem dependências (o UXP não tem o zlib do Node). */

var LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
var LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
var DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
var DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
var ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

function build(lengths, n) {
  var count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16), i;
  for (i = 0; i < n; i++) count[lengths[i]]++;
  offs[1] = 0;
  for (i = 1; i < 15; i++) offs[i + 1] = offs[i] + count[i];
  for (i = 0; i < n; i++) if (lengths[i] !== 0) symbol[offs[lengths[i]]++] = i;
  return { count: count, symbol: symbol };
}

var FIXED = null;
function fixedTables() {
  if (FIXED) return FIXED;
  var l = new Uint8Array(288), i;
  for (i = 0; i < 144; i++) l[i] = 8;
  for (; i < 256; i++) l[i] = 9;
  for (; i < 280; i++) l[i] = 7;
  for (; i < 288; i++) l[i] = 8;
  var d = new Uint8Array(30);
  for (i = 0; i < 30; i++) d[i] = 5;
  FIXED = { lit: build(l, 288), dist: build(d, 30) };
  return FIXED;
}

/** Descompacta um fluxo zlib (2 bytes de cabeçalho + deflate). */
function inflate(src, sizeHint, start) {
  var pos = start === undefined ? 2 : start, bb = 0, bc = 0, out = new Uint8Array(Math.max(1024, sizeHint || src.length * 4)), o = 0;

  function bits(n) {
    while (bc < n) {
      if (pos >= src.length) throw new Error('dados comprimidos truncados');
      bb |= src[pos++] << bc; bc += 8;
    }
    var v = bb & ((1 << n) - 1);
    bb >>>= n; bc -= n;
    return v;
  }
  function decode(h) {
    var code = 0, first = 0, index = 0, len, c;
    for (len = 1; len <= 15; len++) {
      code |= bits(1);
      c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('código inválido');
  }
  function need(n) {
    if (o + n <= out.length) return;
    var s = out.length * 2;
    while (s < o + n) s *= 2;
    var b = new Uint8Array(s);
    b.set(out.subarray(0, o));
    out = b;
  }
  function codes(lit, dist) {
    for (;;) {
      var sym = decode(lit), len, d, k;
      if (sym < 256) { need(1); out[o++] = sym; }
      else if (sym === 256) return;
      else {
        sym -= 257;
        if (sym >= 29) throw new Error('símbolo inválido');
        len = LBASE[sym] + bits(LEXT[sym]);
        k = decode(dist);
        if (k >= 30) throw new Error('distância inválida');
        d = DBASE[k] + bits(DEXT[k]);
        if (d > o) throw new Error('distância além do início');
        need(len);
        while (len--) { out[o] = out[o - d]; o++; }
      }
    }
  }

  var last, type;
  do {
    last = bits(1); type = bits(2);
    if (type === 0) {
      bb = 0; bc = 0;
      if (pos + 4 > src.length) throw new Error('bloco truncado');
      var len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('bloco truncado');
      need(len);
      out.set(src.subarray(pos, pos + len), o);
      o += len; pos += len;
    } else if (type === 1) {
      var f = fixedTables();
      codes(f.lit, f.dist);
    } else if (type === 2) {
      var nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4, i;
      var lengths = new Uint8Array(320);
      for (i = 0; i < ncode; i++) lengths[ORDER[i]] = bits(3);
      var lencode = build(lengths.subarray(0, 19), 19);
      var idx = 0;
      lengths = new Uint8Array(320);
      while (idx < nlen + ndist) {
        var sym = decode(lencode), prev, rep;
        if (sym < 16) lengths[idx++] = sym;
        else {
          prev = 0;
          if (sym === 16) { if (idx === 0) throw new Error('repetição inválida'); prev = lengths[idx - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (idx + rep > nlen + ndist) throw new Error('repetição excede o limite');
          while (rep--) lengths[idx++] = prev;
        }
      }
      codes(build(lengths.subarray(0, nlen), nlen), build(lengths.subarray(nlen, nlen + ndist), ndist));
    } else throw new Error('tipo de bloco inválido');
  } while (!last);
  return out.subarray(0, o);
}

/** Descompacta um arquivo .gz (cabeçalho gzip + deflate), como o .prproj do Premiere. */
function gunzip(src, sizeHint) {
  if (src[0] !== 0x1f || src[1] !== 0x8b) throw new Error('não é gzip');
  var flg = src[3], pos = 10, len;
  if (flg & 4) { len = src[pos] | (src[pos + 1] << 8); pos += 2 + len; }
  if (flg & 8) { while (src[pos++] !== 0); }
  if (flg & 16) { while (src[pos++] !== 0); }
  if (flg & 2) pos += 2;
  return inflate(src, sizeHint || src.length * 12, pos);
}

module.exports = { inflate: inflate, gunzip: gunzip };

};
__defs["png"] = function (module, exports, require) {
/* MecTracker V2 - decodifica o PNG exportado pelo Premiere e devolve só o canal alfa. */
var inflate = require('./inflate').inflate;

var SIG = [137, 80, 78, 71, 13, 10, 26, 10];
var CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

function paeth(a, b, c) {
  var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(data, width, height, bpp8) {
  var bpp = Math.max(1, bpp8 >> 3), stride = Math.ceil(width * bpp8 / 8);
  if (data.length < (stride + 1) * height) throw new Error('PNG truncado');
  var out = new Uint8Array(stride * height), y, x, ft, inO, outO, prevO, a, b, c;
  for (y = 0; y < height; y++) {
    ft = data[y * (stride + 1)]; inO = y * (stride + 1) + 1; outO = y * stride; prevO = outO - stride;
    for (x = 0; x < stride; x++) {
      a = x >= bpp ? out[outO + x - bpp] : 0;
      b = y > 0 ? out[prevO + x] : 0;
      c = (x >= bpp && y > 0) ? out[prevO + x - bpp] : 0;
      switch (ft) {
        case 0: out[outO + x] = data[inO + x]; break;
        case 1: out[outO + x] = (data[inO + x] + a) & 255; break;
        case 2: out[outO + x] = (data[inO + x] + b) & 255; break;
        case 3: out[outO + x] = (data[inO + x] + ((a + b) >> 1)) & 255; break;
        case 4: out[outO + x] = (data[inO + x] + paeth(a, b, c)) & 255; break;
        default: throw new Error('PNG inválido (filtro ' + ft + ')');
      }
    }
  }
  return out;
}

/** @returns { width, height, hasAlpha, alpha: Uint8Array(w*h) } (alfa 0..255; sem alfa => tudo 255) */
function decodeAlpha(buf) {
  var i;
  for (i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error('o arquivo não é um PNG válido');
  var pos = 8, w = 0, h = 0, depth = 0, ct = 0, inter = 0, idat = [], total = 0, trns = null, ok = false;
  while (pos + 8 <= buf.length) {
    var len = u32(buf, pos), type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    var s = pos + 8, e = s + len;
    if (e + 4 > buf.length) throw new Error('PNG truncado');
    if (type === 'IHDR') { w = u32(buf, s); h = u32(buf, s + 4); depth = buf[s + 8]; ct = buf[s + 9]; inter = buf[s + 12]; ok = true; }
    else if (type === 'IDAT') { idat.push(buf.subarray(s, e)); total += len; }
    else if (type === 'tRNS') trns = buf.subarray(s, e);
    else if (type === 'IEND') break;
    pos = e + 4;
  }
  if (!ok || !w || !h) throw new Error('PNG sem cabeçalho');
  if (!CHANNELS[ct]) throw new Error('tipo de cor PNG não suportado: ' + ct);
  if (inter) throw new Error('PNG entrelaçado não suportado');
  if (depth !== 8 && depth !== 16) throw new Error('profundidade PNG não suportada: ' + depth);
  var z = new Uint8Array(total), o = 0;
  for (i = 0; i < idat.length; i++) { z.set(idat[i], o); o += idat[i].length; }
  var ch = CHANNELS[ct], bpp8 = ch * depth, bytes = depth >> 3;
  var raw = unfilter(inflate(z, (w * bpp8 / 8 + 1) * h), w, h, bpp8);
  var alpha = new Uint8Array(w * h), hasAlpha = (ct === 4 || ct === 6);
  if (hasAlpha) {
    var step = ch * bytes, aoff = (ch - 1) * bytes, n = w * h, p;
    for (p = 0; p < n; p++) alpha[p] = raw[p * step + aoff];
  } else alpha.fill(255);
  return { width: w, height: h, hasAlpha: hasAlpha, alpha: alpha };
}

module.exports = { decodeAlpha: decodeAlpha };

};
__defs["measure"] = function (module, exports, require) {
/* MecTracker V2 - mede a região visível (dentro da máscara) a partir do canal alfa. */

var MIN_ALPHA = 4;

/**
 * @param img { width, height, alpha }
 * @returns { area (fração 0..1 do quadro), cx, cy (0..1), angle (rad, -pi/2..pi/2), elong, coverage, touchesEdge, lost }
 */
function measure(img) {
  var w = img.width, h = img.height, a = img.alpha, n = w * h, i, maxA = 0;
  for (i = 0; i < n; i++) if (a[i] > maxA) maxA = a[i];
  var res = { area: 0, cx: 0, cy: 0, angle: 0, elong: 1, coverage: 0, touchesEdge: false, lost: true, maxAlpha: maxA };
  if (maxA < MIN_ALPHA) return res;
  var inv = 1 / maxA, S0 = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, full = 0;
  var x0 = w, y0 = h, x1 = -1, y1 = -1, x, y, v, px, py, o = 0;
  for (y = 0; y < h; y++) {
    py = y + 0.5;
    for (x = 0; x < w; x++, o++) {
      v = a[o];
      if (v < MIN_ALPHA) continue;
      if (v >= maxA - 1) full++;
      v *= inv; px = x + 0.5;
      S0 += v; Sx += v * px; Sy += v * py; Sxx += v * px * px; Syy += v * py * py; Sxy += v * px * py;
      if (v >= 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (S0 <= 0) return res;
  var cx = Sx / S0, cy = Sy / S0, vxx = Sxx / S0 - cx * cx, vyy = Syy / S0 - cy * cy, vxy = Sxy / S0 - cx * cy;
  var half = (vxx - vyy) / 2, rad = Math.sqrt(half * half + vxy * vxy), mean = (vxx + vyy) / 2;
  var l1 = mean + rad, l2 = mean - rad;
  res.area = S0 / n; res.cx = cx / w; res.cy = cy / h;
  res.angle = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
  res.elong = l2 > 1e-12 ? Math.sqrt(l1 / l2) : Infinity;
  res.coverage = full / n;
  res.touchesEdge = x1 >= 0 && (x0 <= 0 || y0 <= 0 || x1 >= w - 1 || y1 >= h - 1);
  res.lost = res.area < 0.00002;
  return res;
}

module.exports = { measure: measure };

};
__defs["solver"] = function (module, exports, require) {
/*
 * MecTracker V2 - série de rastreio e cálculo dos keyframes (funções puras, sem Premiere).
 * Coordenadas em pixels da sequência (origem no canto superior esquerdo, y para baixo);
 * ângulos em radianos, positivo = horário (igual ao Rotation do Premiere).
 */
var RAD2DEG = 180 / Math.PI;
var MIN_ELONG = 1.15; // abaixo disso a forma é "redonda": o ângulo não é confiável

function median(a) {
  var b = a.slice().sort(function (p, q) { return p - q; }), n = b.length;
  if (!n) return 0;
  return n % 2 ? b[(n - 1) >> 1] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

function wrapHalfPi(d) {
  while (d > Math.PI / 2) d -= Math.PI;
  while (d <= -Math.PI / 2) d += Math.PI;
  return d;
}

function movingAverage(arr, win) {
  win = Math.max(1, Math.round(win) | 1);
  if (win <= 1 || arr.length < 3) return arr.slice();
  var half = (win - 1) >> 1, out = new Array(arr.length), i, j, s, c, h;
  for (i = 0; i < arr.length; i++) {
    h = Math.min(half, i, arr.length - 1 - i);
    s = 0; c = 0;
    for (j = i - h; j <= i + h; j++) { s += arr[j]; c++; }
    out[i] = s / c;
  }
  return out;
}

/** Marca como perdidas as amostras isoladas que destoam muito da mediana dos vizinhos. */
function despike(S) {
  var n = S.length, i, j, pass, flagged = 0, half = 6;
  for (pass = 0; pass < 2; pass++) {
    var bad = [];
    for (i = 0; i < n; i++) {
      if (S[i].lost) continue;
      var xs = [], ys = [], ss = [];
      for (j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
        if (S[j].lost) continue;
        xs.push(S[j].cx); ys.push(S[j].cy); ss.push(Math.sqrt(Math.max(S[j].area, 0)));
      }
      if (xs.length < 5) continue;
      var mx = median(xs), my = median(ys), ms = median(ss);
      var madx = median(xs.map(function (v) { return Math.abs(v - mx); }));
      var mady = median(ys.map(function (v) { return Math.abs(v - my); }));
      var sc = Math.sqrt(Math.max(S[i].area, 0)), thr = Math.max(0.5 * ms, 1);
      if (Math.abs(S[i].cx - mx) > Math.max(5 * 1.4826 * madx, thr) ||
          Math.abs(S[i].cy - my) > Math.max(5 * 1.4826 * mady, thr) ||
          (ms > 0 && (sc > ms * 1.8 || sc < ms / 1.8))) bad.push(i);
    }
    if (!bad.length) break;
    for (i = 0; i < bad.length; i++) { S[bad[i]].lost = true; S[bad[i]].spike = true; }
    flagged += bad.length;
  }
  return flagged;
}

/**
 * samples: [{ cx, cy, area, angle, elong, lost }] (px da sequência; um por quadro do clipe)
 * opts: { smooth: janela da média móvel (1,3,5,9), despike: true }
 * @returns { cx[], cy[], s[], a[], valid, spikes, rotationReliable }
 */
function buildTrack(samples, opts) {
  opts = opts || {};
  var S = samples.map(function (o) { var c = {}, k; for (k in o) c[k] = o[k]; return c; });
  var n = S.length, i;
  var spikes = opts.despike === false ? 0 : despike(S);
  var first = -1, valid = 0;
  for (i = 0; i < n; i++) if (!S[i].lost) { valid++; if (first < 0) first = i; }
  if (first < 0) throw new Error('NO_MASK');
  var cx = [], cy = [], s = [], a = [], rel = 0;
  var lx = S[first].cx, ly = S[first].cy, ls = Math.sqrt(S[first].area), rawPrev = null, acc = 0;
  for (i = 0; i < n; i++) {
    var p = S[i];
    if (!p.lost) { lx = p.cx; ly = p.cy; ls = Math.sqrt(Math.max(p.area, 0)); }
    cx.push(lx); cy.push(ly); s.push(ls);
    if (!p.lost && p.elong >= MIN_ELONG) {
      acc = rawPrev === null ? p.angle : acc + wrapHalfPi(p.angle - rawPrev);
      rawPrev = p.angle; rel++;
    }
    a.push(rawPrev === null ? null : acc);
  }
  var a0 = 0;
  for (i = 0; i < n; i++) if (a[i] !== null) { a0 = a[i]; break; }
  for (i = 0; i < n; i++) if (a[i] === null) a[i] = a0;
  var w = opts.smooth || 1;
  return { cx: movingAverage(cx, w), cy: movingAverage(cy, w), s: movingAverage(s, w), a: movingAverage(a, w),
           valid: valid, spikes: spikes, total: n, rotationReliable: rel >= Math.max(2, n * 0.3) };
}

/** Quadros que viram keyframes: first, first+step, ... e sempre o último. */
function pickFrames(first, last, step) {
  var out = [], i;
  step = Math.max(1, Math.floor(step) || 1);
  for (i = first; i <= last; i += step) out.push(i);
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function rot(x, y, ang) {
  var c = Math.cos(ang), s = Math.sin(ang);
  return { x: c * x - s * y, y: s * x + c * y };
}

/**
 * track: resultado de buildTrack | ref: índice do quadro de referência | idx: quadros a gerar
 * base: { pos:{x,y} (px), scale, rot (graus) } do alvo no quadro de referência
 * o: { follow, pos, scale, rot }
 * @returns [{ i, pos:{x,y}, scale, rot }]
 */
function computeKeys(track, ref, idx, base, o) {
  var ox = track.cx[ref], oy = track.cy[ref], sr = Math.max(track.s[ref], 1e-9), ar = track.a[ref];
  return idx.map(function (i) {
    var sf = o.scale ? Math.max(track.s[i], 1e-9) / sr : 1;
    var da = o.rot ? track.a[i] - ar : 0;
    var cx = o.pos ? track.cx[i] : ox, cy = o.pos ? track.cy[i] : oy, p, k;
    if (o.follow) {
      k = rot((base.pos.x - ox) * sf, (base.pos.y - oy) * sf, da);
      p = { x: cx + k.x, y: cy + k.y };
      return { i: i, pos: p, scale: base.scale * sf, rot: base.rot + da * RAD2DEG };
    }
    k = rot((base.pos.x - cx) / sf, (base.pos.y - cy) / sf, -da);
    p = { x: ox + k.x, y: oy + k.y };
    return { i: i, pos: p, scale: base.scale / sf, rot: base.rot - da * RAD2DEG };
  });
}

/** De quanto em quanto tempo medir: clipes curtos quadro a quadro, longos 1 a cada 2 ou 3 (o resto é interpolado). */
function strideFor(total) { return total < 40 ? 1 : (total < 400 ? 2 : 3); }

/**
 * got: amostras medidas [{ i, cx, cy, area, angle, elong, lost, edge }] em ordem de i; count: quantos quadros devolver.
 * Os quadros não medidos são interpolados linearmente (marcados com interp:true; perdidos se um vizinho foi perdido).
 */
function fillSamples(got, count) {
  var out = [], g = 0, i, a, b, u, k;
  function strip(o, interp) { var c = {}; for (k in o) if (k !== 'i') c[k] = o[k]; if (interp) c.interp = true; return c; }
  if (!got.length) return out;
  for (i = 0; i < count; i++) {
    while (g + 1 < got.length && got[g + 1].i <= i) g++;
    a = got[g]; b = got[g + 1];
    if (a.i === i) out.push(strip(a, false));
    else if (i < a.i || !b) out.push(strip(a, true));
    else {
      u = (i - a.i) / (b.i - a.i);
      out.push({
        cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, area: a.area + (b.area - a.area) * u,
        angle: a.angle + wrapHalfPi(b.angle - a.angle) * u, elong: Math.min(a.elong, b.elong),
        lost: !!(a.lost || b.lost), edge: !!(a.edge || b.edge), interp: true
      });
    }
  }
  return out;
}

module.exports = { strideFor: strideFor, fillSamples: fillSamples, buildTrack: buildTrack, pickFrames: pickFrames, computeKeys: computeKeys, movingAverage: movingAverage, despike: despike, MIN_ELONG: MIN_ELONG };

};
__defs["prproj"] = function (module, exports, require) {
/*
 * MecTracker V2 - leitura das máscaras direto do arquivo de projeto (.prproj = XML com gzip).
 *
 * O Premiere não entrega os pontos da máscara pela API de scripts, então salvamos o projeto e lemos
 * os keyframes de máscara do arquivo (é assim que o Trackr também consegue ler "Unassigned Masks").
 * O formato interno não é documentado:
 *  - blocos <Keyframes> no formato "tempo,base64;tempo,base64;..." ;
 *  - detectamos automaticamente como os vértices estão gravados no blob (float32/64, deslocamento, passo);
 *  - as coordenadas são frações do quadro do clipe: convertemos para pixels da sequência usando o
 *    tamanho original do vídeo e o Motion (posição, escala, rotação, âncora) do clipe.
 */
var inflate = require('./inflate');

// ---------------------------------------------------------------- bytes -> texto
var B64 = (function () {
  var t = new Int16Array(128), i, s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (i = 0; i < 128; i++) t[i] = -1;
  for (i = 0; i < s.length; i++) t[s.charCodeAt(i)] = i;
  return t;
})();

function b64decode(str) {
  var n = str.length, out = new Uint8Array(Math.floor(n * 3 / 4) + 3), o = 0, acc = 0, bits = 0, i, v;
  for (i = 0; i < n; i++) {
    v = str.charCodeAt(i);
    if (v === 61) break;               // '='
    v = v < 128 ? B64[v] : -1;
    if (v < 0) continue;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; }
  }
  return out.subarray(0, o);
}

function bytesToText(b) {
  // latin1 em pedaços (o XML que nos interessa é ASCII; evita depender de TextDecoder)
  var parts = [], i, CH = 32768;
  for (i = 0; i < b.length; i += CH) parts.push(String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + CH))));
  return parts.join('');
}

function loadXml(bytes) {
  var raw = (bytes[0] === 0x1f && bytes[1] === 0x8b) ? inflate.gunzip(bytes) : bytes;
  return bytesToText(raw);
}

// ---------------------------------------------------------------- varredura de <Keyframes>
function scanKeyframes(xml) {
  var re = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g, m, stack = [], out = [], i, end;
  while ((m = re.exec(xml))) {
    var closing = m[1] === '/', name = m[2], selfClose = m[4] === '/';
    if (closing) {
      for (i = stack.length - 1; i >= 0; i--) if (stack[i] === name) { stack.length = i; break; }
      continue;
    }
    if (name === 'Keyframes' && !selfClose) {
      end = xml.indexOf('</Keyframes>', re.lastIndex);
      if (end < 0) continue;
      out.push({ path: stack.slice(-10).join('>'), body: xml.slice(re.lastIndex, end), at: m.index });
      re.lastIndex = end + 12;
      continue;
    }
    if (!selfClose) stack.push(name);
  }
  return out;
}

function parseKeys(body) {
  var parts = body.trim().split(';'), keys = [], i;
  for (i = 0; i < parts.length; i++) {
    var p = parts[i].trim(); if (!p) continue;
    var c = p.indexOf(','); if (c < 0) continue;
    var t = p.slice(0, c).trim(), payload = p.slice(c + 1).trim();
    if (!/^-?\d+$/.test(t) || payload.length < 24 || !/^[A-Za-z0-9+\/=\s]+$/.test(payload)) continue;
    keys.push({ t: Number(t), b64: payload.replace(/\s+/g, '') });
  }
  keys.sort(function (a, b) { return a.t - b.t; });
  return keys;
}

function findTracks(xml) {
  var blocks = scanKeyframes(xml), tracks = [], i;
  for (i = 0; i < blocks.length; i++) {
    var keys = parseKeys(blocks[i].body);
    if (keys.length >= 2) tracks.push({ id: tracks.length, path: blocks[i].path, at: blocks[i].at, keys: keys });
  }
  return tracks;
}

// ---------------------------------------------------------------- decodificação heurística dos vértices
function rd(dv, len, pos, dt) {
  if (dt === 'f64') return pos + 8 <= len ? dv.getFloat64(pos, true) : NaN;
  return pos + 4 <= len ? dv.getFloat32(pos, true) : NaN;
}
function plausible(v) { return isFinite(v) && Math.abs(v) < 1e5 && (v === 0 || Math.abs(v) > 1e-6); }
function extract(buf, L) {
  var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), len = buf.length;
  var size = L.dtype === 'f64' ? 8 : 4, pts = [], pos = L.offset, step = L.stride * size;
  while (pos + 2 * size <= len && pts.length < 4096) {
    var x = rd(dv, len, pos, L.dtype), y = rd(dv, len, pos + size, L.dtype);
    if (!plausible(x) || !plausible(y)) break;
    pts.push([x, y]); pos += step;
  }
  return pts;
}
function inBox(p) {
  for (var i = 0; i < p.length; i++) if (p[i][0] < -1 || p[i][0] > 2 || p[i][1] < -1 || p[i][1] > 2) return false;
  return true;
}
function autoLayout(bufs) {
  var best = null;
  ['f32', 'f64'].forEach(function (dtype) {
    var size = dtype === 'f64' ? 8 : 4, offset;
    for (offset = 0; offset <= 96; offset += 4) {
      [6, 8, 4, 3, 2].forEach(function (stride) {
        var L = { dtype: dtype, offset: offset, stride: stride }, counts = [], ok = 0, overflow = false, slackSum = 0, all = [], i;
        for (i = 0; i < bufs.length; i++) {
          var pts = extract(bufs[i], L); all.push(pts); counts.push(pts.length);
          var slack = bufs[i].length - (offset + pts.length * stride * size);
          if (slack < 0) overflow = true;
          slackSum += slack;
          if (pts.length >= 3 && inBox(pts)) ok++;
        }
        var n = counts[0];
        for (i = 1; i < counts.length; i++) if (counts[i] !== n) return;
        if (n < 3 || ok < bufs.length || overflow) return;
        var moved = 0, coords = 0, v, q;
        for (v = 0; v < n; v++) {
          var mx = false, my = false;
          for (q = 1; q < all.length; q++) {
            if (Math.abs(all[q][v][0] - all[0][v][0]) > 1e-6) mx = true;
            if (Math.abs(all[q][v][1] - all[0][v][1]) > 1e-6) my = true;
          }
          if (mx || my) moved++;
          coords += (mx ? 1 : 0) + (my ? 1 : 0);
        }
        if (moved / n < 0.8) return;
        var score = 1000 + (coords / (2 * n)) * 500 - (slackSum / bufs.length + offset) * 10 + stride;
        if (!best || score > best.score) best = { layout: L, score: score, vertices: n };
      });
    }
  });
  return best;
}

function decodeTrack(track) {
  // amostra no máximo ~24 keyframes para detectar o formato (rápido), depois lê todos
  var step = Math.max(1, Math.floor(track.keys.length / 24)), sample = [], i;
  for (i = 0; i < track.keys.length; i += step) sample.push(b64decode(track.keys[i].b64));
  var info = autoLayout(sample);
  if (!info) return null;
  var frames = [];
  for (i = 0; i < track.keys.length; i++) {
    var pts = extract(b64decode(track.keys[i].b64), info.layout);
    if (pts.length === info.vertices) frames.push({ t: track.keys[i].t, points: pts });
  }
  return frames.length >= 2 ? { layout: info.layout, vertices: info.vertices, frames: frames } : null;
}

// ---------------------------------------------------------------- formato real das máscaras (descoberto em um projeto do Premiere 2026)
// Máscara rastreada = dois parâmetros do componente (Opacity):
//   "Path"    (ParameterID 7): o desenho da máscara (poucos keyframes, iguais): int32 nº de vértices @17, vértices @25 a cada 28 bytes
//             (ponto, tangente de entrada, tangente de saída em float32 x,y; coordenadas = fração do quadro do clipe);
//   "Tracker" (ParameterID 6): 1 keyframe por quadro, 104 bytes: int32 versão=1 + matriz 3x3 (float32, linhas [a b 0][c d 0][tx ty 1])
//             que leva o desenho para a posição daquele quadro, + posição do ponto rastreado.
// O desenho NÃO se move sozinho: a posição em cada quadro é desenho × matriz do Tracker.
function parseTracker(buf) {
  if (buf.length < 100 || buf.length > 200) return null;
  var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getInt32(0, true) !== 1) return null;
  function f(i) { return dv.getFloat32(i * 4, true); }
  var m = [f(1), f(2), f(3), f(4), f(5), f(6), f(7), f(8), f(9)], i;
  for (i = 0; i < 9; i++) if (!isFinite(m[i]) || Math.abs(m[i]) > 1e4) return null;
  if (Math.abs(m[2]) > 1e-6 || Math.abs(m[5]) > 1e-6 || Math.abs(m[8] - 1) > 1e-6) return null;
  return { a: m[0], b: m[1], c: m[3], d: m[4], tx: m[6], ty: m[7], px: f(16), py: f(17) };
}

function parsePath(buf) {
  if (buf.length < 60) return null;
  var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), n = dv.getInt32(17, true), i, pts = [];
  if (n < 3 || n > 512 || 25 + n * 28 - 3 > buf.length) return null;
  for (i = 0; i < n; i++) {
    var x = dv.getFloat32(25 + i * 28, true), y = dv.getFloat32(29 + i * 28, true);
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 50 || Math.abs(y) > 50) return null;
    pts.push([x, y]);
  }
  return pts;
}

/** Blocos <ObjectID ...> do projeto, para saber a que clipe cada bloco de keyframes pertence. */
function objectSlices(xml) {
  var re = /<([A-Za-z_][\w.:-]*)\s[^>]*?\bObjectID="(\d+)"[^>]*>/g, list = [], m, i;
  while ((m = re.exec(xml))) list.push({ id: m[2], name: m[1], at: m.index, end: 0 });
  for (i = 0; i < list.length; i++) list[i].end = i + 1 < list.length ? list[i + 1].at : xml.length;
  return list;
}

/** Trechos do XML que pertencem ao(s) clipe(s) da timeline com este início e fim (ticks). null = não achei o clipe. */
function ownedRanges(xml, clip) {
  var re = /<VideoClipTrackItem ObjectID="(\d+)"[^>]*>/g, m, roots = [], objs = null, byId = {}, i;
  while ((m = re.exec(xml))) {
    var end = xml.indexOf('</VideoClipTrackItem>', m.index); if (end < 0) continue;
    var body = xml.slice(m.index, end), sm = /<Start>(-?\d+)<\/Start>/.exec(body), em = /<End>(-?\d+)<\/End>/.exec(body);
    if (em && Number(em[1]) === clip.end && (sm ? Number(sm[1]) : 0) === clip.start) roots.push(m[1]);
  }
  if (!roots.length) return null;
  objs = objectSlices(xml);
  for (i = 0; i < objs.length; i++) byId[objs[i].id] = objs[i];
  var skip = /(TrackItem|TrackGroup|Track$|Sequence|Project|Bin|Marker|MasterClip|Media|Stream)/, ranges = [], seen = {}, queue = [], n = 0;
  roots.forEach(function (id) {
    var o = byId[id]; if (!o) return;
    // Components = efeitos do clipe (máscaras do Opacity); SelectionComponents = "Unassigned Masks"
    var text = xml.slice(o.at, o.end), r = /<(?:Selection)?Components\b[^>]*?ObjectRef="(\d+)"/g, mm;
    while ((mm = r.exec(text))) queue.push({ id: mm[1], d: 1 });
  });
  while (queue.length && n < 1500) {
    var q = queue.shift(), o2 = byId[q.id];
    if (!o2 || seen[q.id]) continue;
    seen[q.id] = true;
    if (skip.test(o2.name)) continue;
    n++; ranges.push([o2.at, o2.end]);
    if (q.d >= 7) continue;
    var b2 = xml.slice(o2.at, o2.end), r2 = /ObjectRef="(\d+)"/g, m2;
    while ((m2 = r2.exec(b2))) if (!seen[m2[1]]) queue.push({ id: m2[1], d: q.d + 1 });
  }
  return ranges;
}
function inRanges(pos, ranges) {
  for (var i = 0; i < ranges.length; i++) if (pos >= ranges[i][0] && pos < ranges[i][1]) return true;
  return false;
}

/** Máscaras (já com os pontos de cada keyframe) encontradas nos blocos de keyframes. */
function buildMasks(tracks) {
  var masks = [], used = {}, i, j, k;
  for (i = 0; i < tracks.length; i++) {
    if (used[i]) continue;
    var t = tracks[i], first = b64decode(t.keys[0].b64), tk = parseTracker(first);
    if (tk) {
      // Tracker: o desenho (Path) vem logo depois
      var path = null;
      for (j = i + 1; j < Math.min(tracks.length, i + 4) && !path; j++) {
        var pp = parsePath(b64decode(tracks[j].keys[0].b64));
        if (pp) { path = pp; used[j] = true; }
      }
      if (!path) continue;
      used[i] = true;
      var frames = [];
      for (k = 0; k < t.keys.length; k++) {
        var m = parseTracker(b64decode(t.keys[k].b64));
        if (!m) continue;
        frames.push({ t: t.keys[k].t, points: path.map(function (p) { return [p[0] * m.a + p[1] * m.c + m.tx, p[0] * m.b + p[1] * m.d + m.ty]; }) });
      }
      if (frames.length >= 2) masks.push({ kind: 'tracker', at: t.at, path: t.path, vertices: path.length, keyCount: frames.length, frames: frames, layout: { dtype: 'f32', offset: 25, stride: 7 } });
      continue;
    }
    // desenho com keyframes próprios (máscara animada à mão)
    var p0 = parsePath(first);
    if (p0) {
      var fr = [];
      for (k = 0; k < t.keys.length; k++) { var pk = parsePath(b64decode(t.keys[k].b64)); if (pk && pk.length === p0.length) fr.push({ t: t.keys[k].t, points: pk }); }
      var moved = fr.length >= 2 && fr.some(function (f) { return f.points.some(function (p, q) { return Math.abs(p[0] - p0[q][0]) > 1e-6 || Math.abs(p[1] - p0[q][1]) > 1e-6; }); });
      if (moved) { used[i] = true; masks.push({ kind: 'path', at: t.at, path: t.path, vertices: p0.length, keyCount: fr.length, frames: fr, layout: { dtype: 'f32', offset: 25, stride: 7 } }); }
      continue;
    }
    // formato desconhecido: tenta a detecção automática dos vértices
    var dec = decodeTrack(t);
    if (dec) masks.push({ kind: 'auto', at: t.at, path: t.path, vertices: dec.vertices, keyCount: dec.frames.length, frames: dec.frames, layout: dec.layout });
  }
  return masks;
}

/**
 * Máscaras do projeto que cabem no clipe. clip = { start, end, inPoint, mediaStart, tpf } em ticks.
 * Retorna { masks: [{ frames:[{t (ticks na sequência), points}], fit, owned, kind, keyCount, vertices, layout, path }], info }
 * com as que pertencem ao clipe (e melhor cobrem o trecho) primeiro.
 */
function readMasks(xml, clip) {
  var tracks = findTracks(xml), all = buildMasks(tracks), masks = [], i, tol = clip.tpf * 2, dur = clip.end - clip.start, outPoint = clip.inPoint + dur;
  var own = null;
  try { own = ownedRanges(xml, clip); } catch (e) { own = null; }
  var info = { tracksFound: tracks.length, decoded: all.length, fitting: 0, owner: own ? own.length : 0, objectMask: false };
  // o clipe tem máscara mas sem keyframes salvos: Object Mask (IA, o projeto só guarda os cliques e referências ao cache) ou máscara não rastreada
  if (own && own.length) info.objectMask = own.some(function (r) { return xml.slice(r[0], r[1]).indexOf('AE.ADBE AEMask') >= 0; });
  for (i = 0; i < all.length; i++) {
    var mk = all[i], t0 = mk.frames[0].t, t1 = mk.frames[mk.frames.length - 1].t, map = null, fit = 0, ms = clip.mediaStart || 0;
    if (t0 >= clip.inPoint - tol && t1 <= outPoint + tol) { map = function (t) { return clip.start + (t - clip.inPoint); }; fit = Math.abs(t0 - clip.inPoint) + Math.abs(t1 - outPoint); }
    else if (ms && t0 >= clip.inPoint + ms - tol && t1 <= outPoint + ms + tol) { map = function (t) { return clip.start + (t - clip.inPoint - ms); }; fit = Math.abs(t0 - clip.inPoint - ms) + Math.abs(t1 - outPoint - ms); }
    else if (t0 >= -tol && t1 <= dur + tol) { map = function (t) { return clip.start + t; }; fit = Math.abs(t0) + Math.abs(t1 - dur); }
    if (!map) continue;
    info.fitting++;
    mk.fit = fit; mk.owned = !!(own && own.length && inRanges(mk.at, own));
    mk.frames = mk.frames.map(function (f) { return { t: map(f.t), points: f.points }; });
    masks.push(mk);
  }
  if (masks.some(function (m) { return m.owned; })) masks = masks.filter(function (m) { return m.owned; });
  masks.sort(function (a, b) { return a.fit - b.fit; });
  return { masks: masks, info: info };
}

// ---------------------------------------------------------------- conversão para pixels da sequência
//   pos_seq = Posição + R(rot) · escala · (ponto_no_clipe − Âncora)
function normPair(v, w, h) {
  if (!v || v.length < 2) return null;
  var big = Math.abs(v[0]) > 4 || Math.abs(v[1]) > 4;
  return big ? [v[0] / w, v[1] / h] : [Number(v[0]), Number(v[1])];
}

/** info = { dims: {w,h,par,src}|null, motion: {pos:[x,y], scale, scaleW, uniform, rot, anchor:[x,y]}|null } */
function makeGeometry(info, seq) {
  var W = seq.w, H = seq.h, mw = W, mh = H, known = false, d = info && info.dims, src = 'tamanho da sequência (tamanho do clipe desconhecido)';
  if (d && d.w > 0 && d.h > 0) { mw = d.w * (d.par > 0 ? d.par : 1); mh = d.h; known = true; src = 'tamanho do vídeo (' + d.src + ')'; }
  var m = info && info.motion, pos = [0.5, 0.5], sc = 100, scW = null, rot = 0, anc = null;
  if (m) {
    var p = normPair(m.pos, W, H); if (p) pos = p;
    if (m.scale > 0) sc = m.scale;
    if (m.uniform === false && m.scaleW > 0) scW = m.scaleW;
    rot = Number(m.rot) || 0;
    anc = normPair(m.anchor, mw, mh);
  }
  if (!anc) anc = [0.5, 0.5];
  return { mw: mw, mh: mh, sx: (scW !== null ? scW : sc) / 100, sy: sc / 100, rot: rot * Math.PI / 180,
           px: pos[0] * W, py: pos[1] * H, ax: anc[0] * mw, ay: anc[1] * mh, src: src, known: known, motion: !!m };
}

function mapperOf(geom, origin) {
  var c = Math.cos(geom.rot), s = Math.sin(geom.rot);
  return function (nx, ny) {
    var dx = ((nx + origin) * geom.mw - geom.ax) * geom.sx, dy = ((ny + origin) * geom.mh - geom.ay) * geom.sy;
    return [geom.px + dx * c - dy * s, geom.py + dx * s + dy * c];
  };
}

/** Escolhe a conversão (tamanho original ou da sequência × origem no canto ou no centro) pela que mantém a máscara na tela. */
function chooseMapping(frames, seq, geom) {
  var norm = true;
  frames.forEach(function (f) { f.points.forEach(function (p) { if (Math.abs(p[0]) > 2 || Math.abs(p[1]) > 2) norm = false; }); });
  if (!norm) return { pixels: true, label: 'pixels (sem conversão)', tested: [] };
  var seqGeom = {
    mw: seq.w, mh: seq.h, sx: geom.sx, sy: geom.sy, rot: geom.rot, px: geom.px, py: geom.py,
    ax: geom.ax / geom.mw * seq.w, ay: geom.ay / geom.mh * seq.h, known: false
  };
  var cands = [{ label: 'tamanho do vídeo + Motion, origem no canto', geom: geom, origin: 0 }];
  if (geom.known) cands.push({ label: 'tamanho da sequência + Motion, origem no canto', geom: seqGeom, origin: 0 });
  cands.push({ label: 'tamanho do vídeo + Motion, origem no centro', geom: geom, origin: 0.5 });
  if (geom.known) cands.push({ label: 'tamanho da sequência + Motion, origem no centro', geom: seqGeom, origin: 0.5 });
  var step = Math.max(1, Math.floor(frames.length / 40)), best = null, tested = [];
  cands.forEach(function (c) {
    var fn = mapperOf(c.geom, c.origin), inside = 0, total = 0, i, k;
    for (i = 0; i < frames.length; i += step) {
      var sx = 0, sy = 0, pts = frames[i].points;
      for (k = 0; k < pts.length; k++) { var q = fn(pts[k][0], pts[k][1]); sx += q[0]; sy += q[1]; }
      sx /= pts.length; sy /= pts.length; total++;
      if (sx >= -0.25 * seq.w && sx <= 1.25 * seq.w && sy >= -0.25 * seq.h && sy <= 1.25 * seq.h) inside++;
    }
    tested.push({ label: c.label, inside: inside, total: total });
    if (!best || inside > best.inside) best = { label: c.label, geom: c.geom, origin: c.origin, inside: inside };
  });
  return { pixels: false, geom: best.geom, origin: best.origin, label: best.label, tested: tested };
}

/**
 * Amostras por quadro do clipe no formato do rastreio: { cx, cy, area, angle, elong, lost, edge } (px da sequência).
 * frames: [{t (ticks da sequência), points}] | clip: { start, tpf, total } | map: resultado de chooseMapping
 */
function framesToSamples(frames, seq, clip, map) {
  var n = frames[0].points.length, i, k, j;
  var fn = map.pixels ? function (x, y) { return [x, y]; } : mapperOf(map.geom, map.origin);

  function at(T) {
    var lo = 0, hi = frames.length - 1;
    if (T <= frames[0].t) return { pts: frames[0].points, out: frames[0].t - T > clip.tpf * 1.5 };
    if (T >= frames[hi].t) return { pts: frames[hi].points, out: T - frames[hi].t > clip.tpf * 1.5 };
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (frames[mid].t <= T) lo = mid; else hi = mid; }
    var span = frames[hi].t - frames[lo].t, u = span > 0 ? (T - frames[lo].t) / span : 0, pts = [];
    for (k = 0; k < n; k++) {
      var a = frames[lo].points[k], b = frames[hi].points[k];
      pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return { pts: pts, out: false };
  }
  function px(pts) { return pts.map(function (p) { return fn(p[0], p[1]); }); }

  var ref = px(frames[0].points), rc = [0, 0];
  ref.forEach(function (p) { rc[0] += p[0]; rc[1] += p[1]; });
  rc[0] /= n; rc[1] /= n;

  var samples = [];
  for (i = 0; i < clip.total; i++) {
    var T = clip.start + i * clip.tpf, r = at(T), P = px(r.pts);
    var A = 0, cx = 0, cy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, mx0 = 0, my0 = 0;
    for (j = 0; j < n; j++) {
      var p0 = P[j], p1 = P[(j + 1) % n], cr = p0[0] * p1[1] - p1[0] * p0[1];
      A += cr; cx += (p0[0] + p1[0]) * cr; cy += (p0[1] + p1[1]) * cr;
      if (p0[0] < minX) minX = p0[0]; if (p0[0] > maxX) maxX = p0[0];
      if (p0[1] < minY) minY = p0[1]; if (p0[1] > maxY) maxY = p0[1];
      mx0 += p0[0]; my0 += p0[1];
    }
    A /= 2; mx0 /= n; my0 /= n;
    var box = Math.max((maxX - minX) * (maxY - minY), 1e-9);
    if (Math.abs(A) > 0.02 * box) { cx /= 6 * A; cy /= 6 * A; }
    else { cx = mx0; cy = my0; A = 0.02 * box; }
    // ângulo por correspondência de vértices (horário positivo, y para baixo)
    var dot = 0, cross = 0;
    for (j = 0; j < n; j++) {
      var ax = ref[j][0] - rc[0], ay = ref[j][1] - rc[1], bx = P[j][0] - mx0, by = P[j][1] - my0;
      dot += ax * bx + ay * by; cross += ax * by - ay * bx;
    }
    samples.push({
      cx: Math.round(cx * 100) / 100, cy: Math.round(cy * 100) / 100, area: Math.round(Math.abs(A)),
      angle: Math.atan2(cross, dot), elong: 99, lost: r.out, edge: false
    });
  }
  return samples;
}

/** Resumo curto (para o Registro) de uma máscara lida: serve para conferir a conversão com dados reais. */
function describe(mask, map, geom) {
  var f0 = mask.frames[0], f1 = mask.frames[mask.frames.length - 1], L = [];
  function cen(f) { var sx = 0, sy = 0; f.points.forEach(function (p) { sx += p[0]; sy += p[1]; }); return [sx / f.points.length, sy / f.points.length]; }
  var c0 = cen(f0), c1 = cen(f1);
  L.push('Máscara (' + (mask.kind || '?') + (mask.owned ? ', do clipe' : '') + '): ' + mask.keyCount + ' keyframes, ' + mask.vertices + ' vértices, ' + mask.layout.dtype + ' offset=' + mask.layout.offset + ' passo=' + mask.layout.stride);
  L.push('Centro cru: primeiro (' + c0[0].toFixed(4) + ', ' + c0[1].toFixed(4) + ') último (' + c1[0].toFixed(4) + ', ' + c1[1].toFixed(4) + ')');
  L.push('Geometria: vídeo ' + Math.round(geom.mw) + 'x' + Math.round(geom.mh) + ' (' + geom.src + ') escala ' + (geom.sy * 100).toFixed(2) + '% rot ' + (geom.rot * 180 / Math.PI).toFixed(2) + '° posição(px) ' + geom.px.toFixed(1) + ',' + geom.py.toFixed(1) + ' âncora(px) ' + geom.ax.toFixed(1) + ',' + geom.ay.toFixed(1));
  L.push('Conversão: ' + map.label + (map.tested || []).map(function (t) { return ' | ' + t.inside + '/' + t.total; }).join(''));
  return L;
}

module.exports = {
  parseTracker: parseTracker, parsePath: parsePath, b64decode: b64decode, loadXml: loadXml, findTracks: findTracks, decodeTrack: decodeTrack, readMasks: readMasks,
  makeGeometry: makeGeometry, chooseMapping: chooseMapping, framesToSamples: framesToSamples, describe: describe, normPair: normPair
};

};
__defs["host"] = function (module, exports, require) {
/*
 * MecTracker V2 - ponte com o Premiere Pro (API UXP "premierepro").
 *
 * Rastreio: esconde as outras trilhas, exporta cada quadro da sequência como PNG com transparência
 *           e mede a região visível da máscara (src/measure.js).
 * Aplicação: grava os keyframes no efeito TRANSFORM do clipe alvo (cria o efeito se não existir),
 *            mantém "Uniform Scale" ligado e ajusta o Shutter Angle.
 */
var png = require('./png'), measure = require('./measure'), solver = require('./solver'), prproj = require('./prproj');

var TICKS_PER_SEC = 254016000000;
var TRANSFORM_MATCH = ['AE.ADBE Geometry2', 'AE.ADBE Geometry'];
var TRANSFORM_NAMES = /^(transform|transformar|transformer|transformieren|trasforma|transformeren|变换|トランスフォーム)$/i;

function fail(code, detail) { var e = new Error(code + (detail ? ': ' + detail : '')); e.code = code; e.detail = detail || ''; return e; }
function msg(e) { return e instanceof Error ? e.message : String(e); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// valores do Premiere às vezes vêm embrulhados em { value: ... }
function unwrap(v) {
  // getStartValue()/getValueAtTime() devolvem um objeto de keyframe ({ value }); abre até chegar no valor
  var guard = 0;
  while (v && typeof v === 'object' && !Array.isArray(v) && !('x' in v && 'y' in v) && 'value' in v && guard++ < 5) v = v.value;
  return v;
}
function asPoint(v) {
  v = unwrap(v);
  if (Array.isArray(v) && v.length >= 2) return { x: Number(v[0]), y: Number(v[1]) };
  if (v && typeof v === 'object' && 'x' in v && 'y' in v) return { x: Number(v.x), y: Number(v.y) };
  throw fail('PARAMS', 'valor de ponto inesperado: ' + JSON.stringify(v));
}

function createHost(ppro, uxp, log) {
  log = log || function () {};
  var fs = uxp && uxp.storage && uxp.storage.localFileSystem;
  var tmpFolder = null;

  function TT(ticks) { return ppro.TickTime.createWithTicks(String(Math.round(ticks))); }

  async function context() {
    var project = await ppro.Project.getActiveProject();
    if (!project) throw fail('NO_PROJECT');
    var sequence = await project.getActiveSequence();
    if (!sequence) throw fail('NO_SEQ');
    return { project: project, sequence: sequence };
  }

  async function selectedClip(seq) {
    var sel = await seq.getSelection();
    var items = (await sel.getTrackItems()).filter(function (i) { return i instanceof ppro.VideoClipTrackItem; });
    if (items.length !== 1) throw fail('SEL_ONE', String(items.length));
    return items[0];
  }

  async function selectedClips(seq) {
    var sel = await seq.getSelection();
    return (await sel.getTrackItems()).filter(function (i) { return i instanceof ppro.VideoClipTrackItem; });
  }

  async function timing(item) {
    var mediaStart = 0;
    try { mediaStart = (await ppro.ClipProjectItem.cast(await item.getProjectItem()).getMedia()).getStart().ticksNumber; } catch (e) {}
    return {
      start: (await item.getStartTime()).ticksNumber, end: (await item.getEndTime()).ticksNumber,
      inPoint: (await item.getInPoint()).ticksNumber, mediaStart: mediaStart
    };
  }

  async function videoTracks(seq) {
    var n = await seq.getVideoTrackCount(), out = [], i;
    for (i = 0; i < n; i++) out.push(await seq.getVideoTrack(i));
    return out;
  }

  // clipes da trilha de vídeo mais próxima, acima do clipe dado, que coincidem no tempo com ele
  async function clipsAbove(seq, item) {
    var tracks = await videoTracks(seq), me = await timing(item), idx = -1, i, j, items, out, t;
    try { idx = Number(await item.getTrackIndex()); } catch (e) { idx = -1; }
    if (!(idx >= 0 && idx < tracks.length)) {
      var nm = await item.getName();
      for (i = 0; i < tracks.length && idx < 0; i++) {
        items = await tracks[i].getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
        for (j = 0; j < items.length; j++) if ((await items[j].getName()) === nm && (await timing(items[j])).start === me.start) { idx = i; break; }
      }
    }
    if (idx < 0) return [];
    for (i = idx + 1; i < tracks.length; i++) {
      items = await tracks[i].getTrackItems(ppro.Constants.TrackItemType.CLIP, false); out = [];
      for (j = 0; j < items.length; j++) {
        if (!(items[j] instanceof ppro.VideoClipTrackItem)) continue;
        t = await timing(items[j]);
        if (t.start < me.end && t.end > me.start) out.push({ item: items[j], start: t.start });
      }
      if (out.length) return out.sort(function (a, b) { return a.start - b.start; }).map(function (o) { return o.item; });
    }
    return [];
  }

  async function findByName(seq, name) {
    var out = [], tracks = await videoTracks(seq), i, j, items;
    for (i = 0; i < tracks.length; i++) {
      items = tracks[i].getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (j = 0; j < items.length; j++) if ((await items[j].getName()) === name) out.push(items[j]);
    }
    return out;
  }

  // ------------------------------------------------------------------ exportação de quadro
  async function tempFolder() { if (!tmpFolder) tmpFolder = await fs.getTemporaryFolder(); return tmpFolder; }
  function withSlash(p) { return (p.endsWith('/') || p.endsWith('\\')) ? p : p + (p.indexOf('\\') >= 0 ? '\\' : '/'); }
  async function entryOf(folder, names) {
    for (var i = 0; i < names.length; i++) { try { return await folder.getEntry(names[i]); } catch (e) {} }
    return null;
  }
  function isCompletePng(b) {
    if (b.length < 12) return false;
    var t = b.length - 8;
    return b[t] === 73 && b[t + 1] === 69 && b[t + 2] === 78 && b[t + 3] === 68;
  }
  // Cada quadro vai para um arquivo com nome próprio (sem apagar antes de exportar) e o arquivo é apagado sem esperar.
  async function exportFrame(seq, time, w, h, name) {
    var folder = await tempFolder();
    var base = name + '.png', names = [base, base + '.png'];
    var ok = await ppro.Exporter.exportSequenceFrame(seq, time, base, withSlash(folder.nativePath), w, h);
    if (!ok) throw fail('EXPORT_FAIL', String(time.seconds));
    var deadline = Date.now() + 20000, entry, bytes;
    while (Date.now() < deadline) {
      entry = await entryOf(folder, names);
      if (entry) {
        try {
          bytes = new Uint8Array(await entry.read({ format: uxp.storage.formats.binary }));
          if (isCompletePng(bytes)) { try { entry.delete().catch(function () {}); } catch (e) {} return bytes; }
        } catch (e) {}
      }
      await sleep(12);
    }
    throw fail('EXPORT_TIMEOUT');
  }

  // ------------------------------------------------------------------ ocultar/mostrar trilhas durante o render
  var MUTE_KEY = 'mectracker.muteRestore';
  async function restoreMuteList(tracks, list) {
    var k, a;
    for (a = 0; a < 3; a++) {
      for (k = 0; k < list.length; k++) { try { await tracks[list[k][0]].setMute(list[k][1]); } catch (e) {} }
      await sleep(150);
      var bad = 0;
      for (k = 0; k < list.length; k++) { try { if ((await tracks[list[k][0]].isMuted()) !== list[k][1]) bad++; } catch (e) {} }
      if (!bad) return true;
    }
    log('Aviso: não consegui devolver a visibilidade de todas as trilhas. Confira o olho das trilhas de vídeo.');
    return false;
  }
  // trilhas que ficaram ocultas porque o Premiere ou o painel fechou no meio de um rastreio
  async function restorePendingMutes() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(MUTE_KEY) || 'null'); } catch (e) {}
    if (!p || !p.list || !p.list.length) return;
    var c = await context();
    if (String(c.sequence.guid) !== p.seq) return;
    var tracks = await videoTracks(c.sequence), list = p.list.filter(function (x) { return x[0] < tracks.length; });
    await restoreMuteList(tracks, list);
    try { localStorage.removeItem(MUTE_KEY); } catch (e) {}
    log('Trilhas ocultas por um rastreio interrompido foram mostradas de novo.');
  }

  // ------------------------------------------------------------------ rastrear (render): só enxerga máscaras do Opacity
  /** cancel = { cancelled:false } ; onProgress({done,total,msPerFrame}) */
  async function trackClip(seq, item, scale, onProgress, cancel, mode) {
    mode = mode || {};
    var ft = (await seq.getTimebase()), frameTicks = Number(ft), size = await seq.getFrameSize();
    var tm = await timing(item), startT = await item.getStartTime();
    var total = Math.max(0, Math.ceil((tm.end - tm.start) / frameTicks));
    if (!total) throw fail('NO_FRAMES');
    var idx = await item.getTrackIndex(), tracks = await videoTracks(seq), muted = [], changed = [], i;
    for (i = 0; i < tracks.length; i++) muted.push(await tracks[i].isMuted());
    // mede 1 a cada "stride" quadros (o resto é interpolado): metade do tempo em clipes de 60 fps
    var stride = solver.strideFor(total), want = [];
    for (i = 0; i < total; i += stride) want.push(i);
    if (want[want.length - 1] !== total - 1) want.push(total - 1);
    var sc = Math.max(scale, Math.min(1, 96 / Math.max(1, Math.min(size.width, size.height))));
    var got = [], opaque = 0, t0 = Date.now(), K = 1, par = !mode.seek, jobs = {}, next = 0, j, run = Date.now().toString(36);
    var fw = Math.max(1, Math.round(size.width * sc)), fh = Math.max(1, Math.round(size.height * sc));
    var tDecode = 0, tMeasure = 0, tWait = 0, cancelled = false;
    var playhead = null;
    if (mode.seek) { try { playhead = await seq.getPlayerPosition(); } catch (e) {} }
    // modo seek: leva a agulha até o quadro antes de exportar (alguns Premiere exportam sempre o quadro da agulha)
    async function seekExport(t, name) { try { await seq.setPlayerPosition(t); } catch (e) {} await sleep(40); return exportFrame(seq, t, fw, fh, name); }
    function issue(n) {
      var t = TT(tm.start + want[n] * frameTicks), name = 'mectracker_' + run + '_' + want[n];
      jobs[n] = mode.seek ? seekExport(t, name) : exportFrame(seq, t, fw, fh, name); jobs[n].catch(function () {});
    }
    log('Clipe na timeline: ' + (tm.start / TICKS_PER_SEC).toFixed(3) + 's, ' + total + ' quadros, ' + fw + 'x' + fh + ' px' + (stride > 1 ? ', medindo 1 a cada ' + stride + ' quadros' : '') + (mode.seek ? ' (modo sequencial, movendo a agulha)' : ''));
    try {
      // guarda o que vai mudar antes de mudar: se o Premiere ou o painel fechar no meio, o painel desfaz na próxima vez
      for (i = 0; i < tracks.length; i++) if ((i !== idx && !muted[i]) || (i === idx && muted[idx])) changed.push([i, muted[i]]);
      try { localStorage.setItem(MUTE_KEY, JSON.stringify({ seq: String(seq.guid), list: changed })); } catch (e) {}
      for (j = 0; j < changed.length; j++) await tracks[changed[j][0]].setMute(changed[j][0] !== idx);
      while (next < want.length && next < K) issue(next++);
      for (i = 0; i < want.length; i++) {
        if (cancel && cancel.cancelled) { cancelled = true; break; }
        var bytes, tw = Date.now();
        try { bytes = await jobs[i]; }
        catch (e) {
          if (!par) throw e;
          log('Exportação em paralelo falhou (' + msg(e) + '); voltando ao modo sequencial.');
          for (j = i + 1; j < next; j++) { try { await jobs[j]; } catch (x) {} }
          K = 1; par = false; next = i + 1;
          bytes = await exportFrame(seq, TT(tm.start + want[i] * frameTicks), fw, fh, 'mectracker_' + run + '_' + want[i] + 'b');
        }
        delete jobs[i];
        tWait += Date.now() - tw;
        while (next < want.length && next < i + 1 + K) issue(next++);
        var t1 = Date.now(), img = png.decodeAlpha(bytes), t2 = Date.now();
        if (!img.hasAlpha) throw fail('NO_ALPHA');
        var m = measure.measure(img);
        tDecode += t2 - t1; tMeasure += Date.now() - t2;
        if (m.coverage > 0.999) opaque++;
        // 1º quadro com máscara recortando: libera 4 exportações em paralelo; se o clipe sai inteiro (máscara em Unassigned), segue 1 por vez até desistir
        else if (par && K === 1) { K = 4; while (next < want.length && next < i + 1 + K) issue(next++); }
        if (opaque >= 3 && opaque === i + 1) throw fail('OPAQUE');
        got.push({
          i: want[i], cx: Math.round(m.cx * size.width * 100) / 100, cy: Math.round(m.cy * size.height * 100) / 100,
          area: Math.round(m.area * size.width * size.height), angle: Math.round(m.angle * 1e5) / 1e5,
          elong: Math.round(Math.min(m.elong, 1e3) * 1e3) / 1e3, lost: m.lost, edge: m.touchesEdge
        });
        if (onProgress) onProgress({ done: i + 1, total: want.length, msPerFrame: (Date.now() - t0) / (i + 1) });
      }
      var n = Math.max(1, got.length);
      log('Tempo: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s para ' + got.length + ' quadros medidos | espera pelo Premiere ' + Math.round(tWait / n) + ' ms/quadro | decodificar ' + Math.round(tDecode / n) + ' ms | medir ' + Math.round(tMeasure / n) + ' ms | paralelismo ' + K);
    } finally {
      for (j in jobs) { try { await jobs[j]; } catch (x) {} }
      // antes conferia isMuted() e só desfazia o que parecia diferente; o Premiere às vezes ainda devolve o valor antigo e a trilha ficava oculta
      await restoreMuteList(tracks, changed);
      try { localStorage.removeItem(MUTE_KEY); } catch (e) {}
      if (playhead) { try { await seq.setPlayerPosition(playhead); } catch (e) {} }
    }
    var samples = solver.fillSamples(got, cancelled ? (got.length ? got[got.length - 1].i + 1 : 0) : total);
    return {
      version: 1, source: 'render', clipName: await item.getName(), sequenceName: seq.name, sequenceGuid: String(seq.guid),
      frameWidth: size.width, frameHeight: size.height, frameTicks: frameTicks,
      startTicks: startT.ticksNumber, sourceInPointTicks: tm.inPoint, renderScale: sc,
      complete: !cancelled && samples.length === total, seconds: (Date.now() - t0) / 1000, samples: samples
    };
  }

  // ------------------------------------------------------------------ rastrear (projeto): lê Unassigned Masks do arquivo .prproj
  async function projectEntry(path) {
    var p = String(path).replace(/\\/g, '/'), urls = ['file:' + p, 'file:/' + p, 'file:///' + p, String(path)], i, e;
    for (i = 0; i < urls.length; i++) {
      try { e = await fs.getEntryWithUrl(urls[i]); if (e) return e; } catch (x) {}
    }
    try { e = await fs.getFileForOpening({ types: ['prproj'] }); if (e) return e; } catch (x2) {}
    throw fail('PROJECT_READ', path);
  }

  var NAME_MOTION = {
    pos: /^(position|posi[cç]|posizione|positie)/i,
    rot: /^(rotation|rota[cç]|rotazione|drehung|rotatie)/i,
    anchor: /^(anchor|ponto de anc|punto de ancl|ancrage|ankerpunkt|punto di ancor|ankerpunt)/i,
    uni: /(uniform|uniforme|einheitlich)/i,
    scale: /^(scale|escala|[ée]chelle|skalierung|scala|schaal)/i,
    wide: /(width|largura|ancho|breite|larghezza|largeur|breedte)/i
  };

  async function motionGeom(project, item) {
    var l = await listComponents(project, item), c = null, i, mn, dn;
    for (i = 0; i < l.comps.length && !c; i++) {
      mn = ''; dn = '';
      try { mn = String(await l.comps[i].getMatchName()); } catch (e) {}
      try { dn = String(await l.comps[i].getDisplayName()); } catch (e) {}
      if (mn === 'AE.ADBE Motion' || /^(motion|movimento|mouvement|bewegung)$/i.test(dn)) c = l.comps[i];
    }
    if (!c) return null;
    var params = [];
    project.lockedAccess(function () { for (var k = 0; k < c.getParamCount(); k++) params.push(c.getParam(k)); });
    var P = {}, names = params.map(function (p) { return String(p.displayName || ''); }), g = { pos: null, scale: null, scaleW: null, uniform: true, rot: 0, anchor: null };
    for (i = 0; i < params.length; i++) {
      var n = names[i]; if (!n) continue;
      if (!P.pos && NAME_MOTION.pos.test(n)) P.pos = params[i];
      else if (!P.rot && NAME_MOTION.rot.test(n)) P.rot = params[i];
      else if (!P.anchor && NAME_MOTION.anchor.test(n)) P.anchor = params[i];
      else if (!P.uni && NAME_MOTION.uni.test(n)) P.uni = params[i];
      else if (!P.scale && NAME_MOTION.scale.test(n) && !NAME_MOTION.wide.test(n)) P.scale = params[i];
      else if (!P.scaleW && NAME_MOTION.wide.test(n)) P.scaleW = params[i];
    }
    async function get(p) { try { return unwrap(await p.getStartValue()); } catch (e) { return undefined; } }
    function pt(v) { try { var q = asPoint(v); return [q.x, q.y]; } catch (e) { return null; } }
    if (P.pos) g.pos = pt(await get(P.pos));
    if (P.anchor) g.anchor = pt(await get(P.anchor));
    if (P.scale) { var sv = Number(await get(P.scale)); if (isFinite(sv) && sv > 0) g.scale = sv; }
    if (P.scaleW) { var wv = Number(await get(P.scaleW)); if (isFinite(wv) && wv > 0) g.scaleW = wv; }
    if (P.uni) { var uv = await get(P.uni); g.uniform = !(uv === false || uv === 0); }
    if (P.rot) { var rv = Number(await get(P.rot)); if (isFinite(rv)) g.rot = rv; }
    g.names = names;
    return g;
  }

  function parseDimsString(str) {
    var m = /(\d{2,5})\s*[xX×]\s*(\d{2,5})(?:\s*\(\s*([\d.,]+)\s*\))?/.exec(String(str || '')), par = 1;
    if (!m) return null;
    if (m[3]) { par = parseFloat(String(m[3]).replace(',', '.')); if (!(par > 0.2 && par < 5)) par = 1; }
    return { w: parseInt(m[1], 10), h: parseInt(m[2], 10), par: par };
  }

  async function mediaDims(item) {
    var pi = ppro.ClipProjectItem.cast(await item.getProjectItem()), texts = [], i, m, d;
    try { if (await pi.isSequence()) return null; } catch (e) {}
    try { texts.push(String(await ppro.Metadata.getProjectMetadata(pi))); } catch (e) {}
    try { texts.push(String(await ppro.Metadata.getXMPMetadata(pi))); } catch (e) {}
    for (i = 0; i < texts.length; i++) {
      m = /Column\.Intrinsic\.VideoInfo[^>]*>([^<]+)</.exec(texts[i]) || /Column\.Intrinsic\.VideoInfo\s*=\s*"([^"]+)"/.exec(texts[i]);
      d = m ? parseDimsString(m[1]) : null;
      if (d) { d.src = 'metadados do projeto'; return d; }
      m = /stDim:w="(\d+)"[^>]*?stDim:h="(\d+)"/.exec(texts[i]) || /<stDim:w>(\d+)<\/stDim:w>\s*<stDim:h>(\d+)<\/stDim:h>/.exec(texts[i]);
      if (m) return { w: parseInt(m[1], 10), h: parseInt(m[2], 10), par: 1, src: 'XMP' };
    }
    return null;
  }

  async function trackFromProject(project, seq, item, onProgress, cache) {
    var t0 = Date.now(), ft = Number(await seq.getTimebase()), size = await seq.getFrameSize(), tm = await timing(item), startT = await item.getStartTime();
    var total = Math.max(0, Math.ceil((tm.end - tm.start) / ft));
    if (!total) throw fail('NO_FRAMES');
    if (onProgress) onProgress({ done: 0, total: 3, msPerFrame: 0 });
    var xml = cache && cache.xml;
    if (xml) log('Projeto já lido neste lote; reaproveitando.');
    else {
      var saved = false;
      try { saved = await project.save(); } catch (e) { log('Aviso: não consegui salvar o projeto (' + msg(e) + ').'); }
      if (!project.path) throw fail('PROJECT_READ', 'o projeto não tem arquivo (salve-o com Ctrl+S)');
      var entry = await projectEntry(project.path), bytes;
      try { bytes = new Uint8Array(await entry.read({ format: uxp.storage.formats.binary })); } catch (e) { throw fail('PROJECT_READ', msg(e)); }
      if (onProgress) onProgress({ done: 1, total: 3, msPerFrame: 0 });
      await sleep(20);
      try { xml = prproj.loadXml(bytes); } catch (e) { throw fail('PROJECT_READ', msg(e)); }
      log('Projeto lido: ' + (bytes.length / 1e6).toFixed(1) + ' MB' + (saved ? '' : ' (não confirmei o salvamento)') + ', XML ' + (xml.length / 1e6).toFixed(1) + ' MB');
      if (cache) cache.xml = xml;
    }
    var found = prproj.readMasks(xml, { start: tm.start, end: tm.end, inPoint: tm.inPoint, mediaStart: tm.mediaStart, tpf: ft });
    log('Blocos de keyframes: ' + found.info.tracksFound + ' | lidos como máscara: ' + found.info.decoded + ' | que cabem no clipe: ' + found.info.fitting);
    if (found.info.objectMask && !found.masks.length) log('O clipe tem máscara em Unassigned Masks, mas sem movimento salvo no projeto.');
    if (!found.masks.length) throw fail(found.info.objectMask ? 'OBJECT_MASK' : 'NO_PROJECT_MASK');
    if (found.masks.length > 1) log('Aviso: ' + found.masks.length + ' máscaras cabem no tempo do clipe; usei a que melhor cobre o trecho.');
    if (onProgress) onProgress({ done: 2, total: 3, msPerFrame: 0 });
    var dims = null, motion = null;
    try { dims = await mediaDims(item); } catch (e) { log('Tamanho do vídeo: ' + msg(e)); }
    try { motion = await motionGeom(project, item); } catch (e) { log('Motion: ' + msg(e)); }
    var geom = prproj.makeGeometry({ dims: dims, motion: motion }, { w: size.width, h: size.height });
    var mask = found.masks[0], map = prproj.chooseMapping(mask.frames, { w: size.width, h: size.height }, geom);
    prproj.describe(mask, map, geom).forEach(function (l) { log(l); });
    if (!dims) log('Aviso: não consegui ler o tamanho do vídeo; usei o da sequência (o movimento pode sair menor que o real).');
    var samples = prproj.framesToSamples(mask.frames, { w: size.width, h: size.height }, { start: tm.start, tpf: ft, total: total }, map), vis = 0, i;
    for (i = 0; i < samples.length; i++) if (!samples[i].lost) vis++;
    if (!vis) throw fail('NO_MASK');
    if (onProgress) onProgress({ done: 3, total: 3, msPerFrame: 0 });
    log('Tempo: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s (leitura do projeto)');
    return {
      version: 1, source: 'project', clipName: await item.getName(), sequenceName: seq.name, sequenceGuid: String(seq.guid),
      frameWidth: size.width, frameHeight: size.height, frameTicks: ft, startTicks: startT.ticksNumber, sourceInPointTicks: tm.inPoint,
      renderScale: 0, complete: true, seconds: (Date.now() - t0) / 1000, samples: samples
    };
  }

  /** Primeiro tenta o render (máscara do Opacity, mais exato); se o clipe aparece inteiro, lê as máscaras do projeto. */
  // quanto a máscara andou no rastreio (px da sequência); "static" = todos os quadros saíram iguais
  function motionOf(samples) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, a0 = Infinity, a1 = -Infinity, n = 0, i, s;
    for (i = 0; i < samples.length; i++) {
      s = samples[i]; if (s.lost) continue; n++;
      x0 = Math.min(x0, s.cx); x1 = Math.max(x1, s.cx); y0 = Math.min(y0, s.cy); y1 = Math.max(y1, s.cy); a0 = Math.min(a0, s.area); a1 = Math.max(a1, s.area);
    }
    if (!n) return { dx: 0, dy: 0, da: 0, static: false };
    var dx = x1 - x0, dy = y1 - y0, da = a1 > 0 ? (a1 - a0) / a1 : 0;
    return { dx: dx, dy: dy, da: da, static: n >= 3 && dx < 0.05 && dy < 0.05 && da < 1e-4 };
  }
  function logMotion(r) {
    var m = motionOf(r.samples);
    log('Movimento medido: ' + m.dx.toFixed(1) + ' px na horizontal, ' + m.dy.toFixed(1) + ' px na vertical, área varia ' + (m.da * 100).toFixed(1) + '%');
    return m;
  }

  async function track(project, seq, item, scale, onProgress, cancel, cache) {
    var r;
    try { r = await trackClip(seq, item, scale, onProgress, cancel); }
    catch (e) {
      if (!e || e.code !== 'OPAQUE') throw e;
      log('A máscara não recorta o clipe no render (provavelmente está em "Unassigned Masks"); lendo o arquivo do projeto…');
      r = await trackFromProject(project, seq, item, onProgress, cache);
      logMotion(r);
      return r;
    }
    if (!logMotion(r).static || !r.complete || (cancel && cancel.cancelled)) return r;
    // Todos os quadros exportados saíram idênticos: o Premiere devolveu o mesmo quadro várias vezes.
    log('Aviso: todos os quadros do render saíram iguais (a máscara parece parada). Tentando de novo, quadro a quadro…');
    try {
      var r2 = await trackClip(seq, item, scale, onProgress, cancel, { seek: true });
      if (!logMotion(r2).static) { log('Segunda tentativa com movimento; usando ela.'); return r2; }
      if (!r2.complete) return r2;
    } catch (e) { log('Segunda tentativa falhou: ' + msg(e)); }
    log('Ainda parada no render; lendo as máscaras do arquivo do projeto…');
    try {
      var r3 = await trackFromProject(project, seq, item, onProgress, cache);
      if (!logMotion(r3).static) { log('Máscara do projeto com movimento; usando ela.'); return r3; }
    } catch (e) { log('Leitura do projeto: ' + msg(e)); }
    log('Aviso: a máscara saiu parada em todas as tentativas. Se ela se mexe no Premiere, os keyframes vão sair sem movimento.');
    r.static = true;
    return r;
  }

  // ------------------------------------------------------------------ lote
  async function trackIndexOf(item) { try { var i = Number(await item.getTrackIndex()); return i >= 0 ? i : -1; } catch (e) { return -1; } }
  async function keyOf(item, t) { return (await trackIndexOf(item)) + ':' + t.start + ':' + (await item.getName()); }

  /**
   * Para cada clipe selecionado, os clipes da trilha acima que coincidem com ele no tempo.
   * Um clipe de cima fica só com o clipe de baixo que ele mais cobre (não cola duas vezes),
   * e clipes selecionados que são o "de cima" de outro selecionado saem da lista.
   */
  async function batchPlan(seq, items) {
    var rows = [], owner = {}, i, j, me, t, k, ov, above, list;
    for (i = 0; i < items.length; i++) {
      me = await timing(items[i]); above = await clipsAbove(seq, items[i]); list = [];
      for (j = 0; j < above.length; j++) {
        t = await timing(above[j]); k = await keyOf(above[j], t);
        ov = Math.min(me.end, t.end) - Math.max(me.start, t.start);
        list.push({ item: above[j], key: k, start: t.start });
        if (!owner[k] || ov > owner[k].overlap) owner[k] = { row: i, overlap: ov };
      }
      rows.push({ item: items[i], key: await keyOf(items[i], me), name: await items[i].getName(), start: me.start, end: me.end, targets: list });
    }
    var dropped = 0, out = [];
    rows.forEach(function (r, i) {
      if (owner[r.key]) { dropped++; return; }
      r.shared = r.targets.filter(function (x) { return owner[x.key].row !== i; }).length;
      r.targets = r.targets.filter(function (x) { return owner[x.key].row === i; });
      out.push(r);
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return { rows: out, dropped: dropped };
  }

  // ------------------------------------------------------------------ Transform
  async function listComponents(project, item) {
    var chain = await item.getComponentChain(), comps = [];
    project.lockedAccess(function () { for (var i = 0; i < chain.getComponentCount(); i++) comps.push(chain.getComponentAtIndex(i)); });
    return { chain: chain, comps: comps };
  }

  async function isTransform(c) {
    var mn = '', dn = '';
    try { mn = String(await c.getMatchName()); } catch (e) {}
    if (TRANSFORM_MATCH.indexOf(mn) >= 0) return true;
    try { dn = String(await c.getDisplayName()); } catch (e) {}
    return TRANSFORM_NAMES.test(dn) && mn.indexOf('Motion') < 0;
  }

  async function findTransform(project, item) {
    var l = await listComponents(project, item), found = null, i;
    for (i = 0; i < l.comps.length; i++) if (await isTransform(l.comps[i])) found = l.comps[i]; // o último
    return found;
  }

  async function transformCandidates() {
    var out = [], mn = [], dn = [], i;
    try { mn = await ppro.VideoFilterFactory.getMatchNames(); } catch (e) {}
    try { dn = await ppro.VideoFilterFactory.getDisplayNames(); } catch (e) {}
    for (i = 0; i < TRANSFORM_MATCH.length; i++) if (!mn.length || mn.indexOf(TRANSFORM_MATCH[i]) >= 0) out.push(TRANSFORM_MATCH[i]);
    if (dn.length && dn.length === mn.length) {
      for (i = 0; i < dn.length; i++) if (TRANSFORM_NAMES.test(String(dn[i])) && out.indexOf(mn[i]) < 0) out.unshift(mn[i]);
    }
    return out;
  }

  // Em clipes de gráfico/texto o Transform deve ficar logo depois de "Vector Motion" (acima do texto).
  async function insertIndex(project, item) {
    var l = await listComponents(project, item), idx = -1, i, mn, dn;
    for (i = 0; i < l.comps.length; i++) {
      mn = ''; dn = '';
      try { mn = String(await l.comps[i].getMatchName()); } catch (e) {}
      try { dn = String(await l.comps[i].getDisplayName()); } catch (e) {}
      if (/vector.?motion|movimento vetorial|mouvement vectoriel|vektor/i.test(mn + ' ' + dn)) idx = i + 1;
    }
    return idx;
  }

  async function addTransform(project, item) {
    var cands = await transformCandidates(), last = null, i, at = await insertIndex(project, item);
    for (i = 0; i < cands.length; i++) {
      try {
        var comp = await ppro.VideoFilterFactory.createComponent(cands[i]);
        var chain = await item.getComponentChain(), ok = false;
        project.lockedAccess(function () {
          ok = project.executeTransaction(function (ca) { ca.addAction(at >= 0 ? chain.createInsertComponentAction(comp, at) : chain.createAppendComponentAction(comp)); }, 'MecTracker: add Transform');
        });
        if (!ok) { last = 'rejeitado'; continue; }
        var t = await findTransform(project, item);
        if (t) { log('Efeito Transform adicionado (' + cands[i] + ')'); return t; }
      } catch (e) { last = msg(e); }
    }
    throw fail('NO_TRANSFORM', last || '');
  }

  var NAME = {
    pos: /^(position|posi[cç]|posizione|positie)/i,
    rot: /^(rotation|rota[cç]|rotazione|drehung|rotatie)/i,
    uni: /(uniform|uniforme|einheitlich|uniforme)/i,
    scaleW: /(width|largura|ancho|breite|larghezza|largeur|breedte)/i,
    scale: /^(scale|escala|[ée]chelle|skalierung|scala|schaal)/i,
    useComp: /(composition|composi|compos)/i,
    shutter: /(shutter|obturador|obturat|verschluss|ouverture)/i
  };
  var INDEX = { anchor: 0, pos: 1, uni: 2, scale: 3, scaleW: 4, rot: 7, useComp: 9, shutter: 10 };

  async function mapParams(project, comp) {
    var params = [];
    project.lockedAccess(function () { for (var i = 0; i < comp.getParamCount(); i++) params.push(comp.getParam(i)); });
    var names = params.map(function (p) { return String(p.displayName || ''); }), P = {}, i, n;
    for (i = 0; i < params.length; i++) {
      n = names[i];
      if (!n) continue;
      if (!P.useComp && NAME.shutter.test(n) && NAME.useComp.test(n)) P.useComp = params[i];
      else if (!P.shutter && NAME.shutter.test(n)) P.shutter = params[i];
      else if (!P.pos && NAME.pos.test(n)) P.pos = params[i];
      else if (!P.rot && NAME.rot.test(n)) P.rot = params[i];
      else if (!P.uni && NAME.uni.test(n)) P.uni = params[i];
      else if (!P.scaleW && NAME.scaleW.test(n) && NAME.scale.test(n)) P.scaleW = params[i];
      else if (!P.scale && NAME.scale.test(n) && !NAME.uni.test(n)) P.scale = params[i];
    }
    ['pos', 'uni', 'scale', 'rot', 'scaleW', 'useComp', 'shutter'].forEach(function (k) { if (!P[k] && params[INDEX[k]]) P[k] = params[INDEX[k]]; });
    P.names = names;
    var okPos = false, okUni = false;
    try { asPoint(await P.pos.getStartValue()); okPos = true; } catch (e) {}
    try { var uv = unwrap(await P.uni.getStartValue()); okUni = typeof uv === 'boolean' || uv === 0 || uv === 1; } catch (e) {}
    if (!okUni) log('Aviso: não consegui ler o valor do Uniform Scale; vou tentar ligar mesmo assim.');
    if (!P.pos || !P.scale || !P.rot || !okPos) throw fail('PARAMS', names.map(function (x) { return '"' + x + '"'; }).join(', ') + ' [pos:' + okPos + ' uni:' + okUni + ']');
    return P;
  }

  async function transaction(project, name, fn) {
    var ok = false;
    project.lockedAccess(function () { ok = project.executeTransaction(fn, name); });
    return ok;
  }

  async function setStatic(project, param, value, name) {
    try { if (param.isTimeVarying()) await transaction(project, name, function (ca) { ca.addAction(param.createSetTimeVaryingAction(false)); }); } catch (e) {}
    var tries = [
      function () { return param.createSetValueAction(param.createKeyframe(value), true); },
      function () { return param.createSetValueAction(param.createKeyframe(value)); },
      function () { return param.createSetValueAction(value, true); }
    ], i;
    if (typeof value === 'boolean') tries.push(function () { return param.createSetValueAction(value ? 1 : 0); });
    for (i = 0; i < tries.length; i++) {
      try {
        var ok = await transaction(project, name, function (ca) { ca.addAction(tries[i]()); });
        if (ok) return true;
      } catch (e) { log('setValue tentativa ' + (i + 1) + ': ' + msg(e)); }
    }
    return false;
  }

  async function valueAt(param, time) { return unwrap(await param.getValueAtTime(time)); }

  // ------------------------------------------------------------------ colar
  /**
   * track: registro de trackClip | ref: TickTime do cursor
   * opts: { pos, scale, rot, follow, step, smooth, shutter }
   */
  async function pasteKeys(project, seq, target, refTime, track, opts) {
    if (!opts.pos && !opts.scale && !opts.rot) throw fail('NO_PROPS');
    var speed = await target.getSpeed();
    if (Math.abs(speed - 1) > 1e-6) throw fail('SPEED', String(speed * 100));
    if (String(seq.guid) !== track.sequenceGuid) throw fail('WRONG_SEQ', track.sequenceName);
    var tt = await timing(target), ft = track.frameTicks, n = track.samples.length;

    // onde o clipe rastreado está agora (pode ter sido movido/aparado desde o rastreio)
    var rec = { start: track.startTicks, inPoint: track.sourceInPointTicks }, same = await findByName(seq, track.clipName);
    if (same.length === 1) {
      var cur = await timing(same[0]);
      if (Math.abs((await same[0].getSpeed()) - 1) < 1e-6) {
        if (cur.start !== rec.start || cur.inPoint !== rec.inPoint) log('"' + track.clipName + '" mudou desde o rastreio; os keyframes acompanham a posição atual.');
        rec = { start: cur.start, inPoint: cur.inPoint, moved: true };
      }
    } else if (same.length > 1) log('Há vários clipes chamados "' + track.clipName + '": usei a posição gravada.');
    function seqTime(i) { return rec.moved ? rec.start + (track.sourceInPointTicks + i * ft - rec.inPoint) : rec.start + i * ft; }
    function keyTime(i) { return tt.inPoint + (seqTime(i) - tt.start); }

    var first = Math.max(0, Math.ceil((tt.start - seqTime(0)) / ft)), last = Math.min(n - 1, Math.floor((tt.end - 1 - seqTime(0)) / ft));
    if (first > last) throw fail('NO_OVERLAP', target.name);
    var refIdx = Math.max(first, Math.min(last, Math.round((refTime.ticksNumber - seqTime(0)) / ft)));

    var trk = solver.buildTrack(track.samples, { smooth: [1, 3, 5, 9][opts.smooth || 0] });
    log('Quadros: ' + n + ' | válidos ' + trk.valid + ' | picos corrigidos ' + trk.spikes + ' | referência: quadro ' + refIdx);
    if (opts.rot && !trk.rotationReliable) log('Aviso: a forma é quase redonda, a rotação medida não é confiável.');

    var comp = await findTransform(project, target), added = false;
    if (!comp) { comp = await addTransform(project, target); added = true; }
    var P = await mapParams(project, comp);
    log('Parâmetros do Transform: ' + P.names.join(' | '));

    // Uniform Scale sempre ligado
    var uniNow = unwrap(await P.uni.getStartValue());
    if (uniNow !== true && uniNow !== 1) {
      var okU = await setStatic(project, P.uni, true, 'MecTracker: Uniform Scale');
      log(okU ? 'Uniform Scale ligado.' : 'Não consegui ligar o Uniform Scale; ligue manualmente.');
    }

    var refKT = TT(keyTime(refIdx)), size = await seq.getFrameSize();
    var p0 = asPoint(await valueAt(P.pos, refKT));
    var base = { pos: { x: p0.x * size.width, y: p0.y * size.height }, scale: Number(await valueAt(P.scale, refKT)), rot: Number(await valueAt(P.rot, refKT)) };
    log('Referência: posição (' + base.pos.x.toFixed(1) + ', ' + base.pos.y.toFixed(1) + ') px, escala ' + base.scale + ', rotação ' + base.rot + '°');

    var idx = solver.pickFrames(first, last, opts.step || 1);
    var keys = solver.computeKeys(trk, refIdx, idx, base, { follow: opts.follow !== false, pos: opts.pos, scale: opts.scale, rot: opts.rot });

    var keyed = [];
    if (opts.pos || opts.scale || opts.rot) keyed.push(P.pos);
    if (opts.scale) keyed.push(P.scale);
    if (opts.rot) keyed.push(P.rot);
    var from = TT(Math.max(0, keyTime(first) - tt.inPoint)), to = TT(keyTime(last) + ft * 0.5);
    var ok = await transaction(project, 'MecTracker: prepare keyframes', function (ca) {
      keyed.forEach(function (p) {
        if (!p.isTimeVarying()) ca.addAction(p.createSetTimeVaryingAction(true));
        ca.addAction(p.createRemoveKeyframeRangeAction(from, to, false));
      });
    });
    if (!ok) throw fail('REJECT_PREP');
    ok = await transaction(project, 'MecTracker: paste keyframes', function (ca) {
      keys.forEach(function (k) {
        var time = TT(keyTime(k.i));
        function add(param, value) { var kf = param.createKeyframe(value); kf.position = time; ca.addAction(param.createAddKeyframeAction(kf)); }
        add(P.pos, new ppro.PointF(k.pos.x / size.width, k.pos.y / size.height));
        if (opts.scale) add(P.scale, k.scale);
        if (opts.rot) add(P.rot, k.rot);
      });
    });
    if (!ok) throw fail('REJECT_KEYS');
    if (keys.length > 1) {
      var kx = keys.map(function (k) { return k.pos.x; }), ky = keys.map(function (k) { return k.pos.y; });
      log('Keyframes de posição: x de ' + Math.min.apply(null, kx).toFixed(1) + ' a ' + Math.max.apply(null, kx).toFixed(1) + ' px, y de ' + Math.min.apply(null, ky).toFixed(1) + ' a ' + Math.max.apply(null, ky).toFixed(1) + ' px');
      try {
        var kA = keys[0], kB = keys[keys.length - 1];
        var rA = asPoint(await valueAt(P.pos, TT(keyTime(kA.i)))), rB = asPoint(await valueAt(P.pos, TT(keyTime(kB.i))));
        var want = Math.hypot(kB.pos.x - kA.pos.x, kB.pos.y - kA.pos.y), got = Math.hypot((rB.x - rA.x) * size.width, (rB.y - rA.y) * size.height);
        log('Lido de volta: primeiro (' + (rA.x * size.width).toFixed(1) + ', ' + (rA.y * size.height).toFixed(1) + ') · último (' + (rB.x * size.width).toFixed(1) + ', ' + (rB.y * size.height).toFixed(1) + ') px');
        if (want > 1 && got < want * 0.1) log('Aviso: o Premiere guardou os keyframes sem o movimento calculado.');
      } catch (e) { log('Não consegui ler os keyframes de volta: ' + msg(e)); }
    }

    // Shutter Angle (0 = não mexer)
    var shutterDone = null;
    if (opts.shutter > 0 && P.useComp && P.shutter) {
      var a = await setStatic(project, P.useComp, false, 'MecTracker: shutter');
      var b = await setStatic(project, P.shutter, opts.shutter, 'MecTracker: shutter angle');
      shutterDone = a && b;
      try { log('Shutter lido de volta: usar comp.=' + JSON.stringify(unwrap(await P.useComp.getStartValue())) + ', ângulo=' + JSON.stringify(unwrap(await P.shutter.getStartValue()))); } catch (e) {}
      log(shutterDone ? 'Shutter Angle = ' + opts.shutter + '°' : 'Não consegui ajustar o Shutter Angle; ajuste manualmente.');
    }
    return { keyframes: keys.length, added: added, name: await target.getName(), shutter: shutterDone };
  }

  return {
    context: context, batchPlan: batchPlan, ticks: TT, selectedClip: selectedClip, selectedClips: selectedClips, clipsAbove: clipsAbove, track: track, trackClip: trackClip, trackFromProject: trackFromProject, pasteKeys: pasteKeys,
    restorePendingMutes: restorePendingMutes, timing: timing, findTransform: findTransform, mapParams: mapParams, exportFrame: exportFrame
  };
}

module.exports = { createHost: createHost, fail: fail, msg: msg, TICKS_PER_SEC: TICKS_PER_SEC };

};
__defs["app"] = function (module, exports, require) {
/* Mec Tracker - interface do painel (UXP). */
var H = require('./host');

var ppro = require('premierepro');
var uxp = require('uxp');

var DICT = {
  pt: {
    tabMain: 'Rastrear', tabHelp: 'Ajuda',
    h1t: 'Prepare a Máscara', h1: 'No clipe que tem o objeto, crie uma máscara (retângulo, caneta ou Object Mask) e use o rastreio do próprio Premiere (seta de “Track selected mask forward”) até o fim do clipe.',
    h2t: 'Rastreie', h2: 'Selecione na timeline o clipe que tem a máscara e aperte <b>Rastrear</b>. Pode selecionar vários clipes de uma vez. Espere a barra terminar: só depois aparece o botão Colar.',
    h3t: 'Escolha o Alvo', h3: 'Selecione o texto, imagem ou gráfico que deve seguir o objeto (pode ser mais de um). Deixe a agulha da timeline no ponto em que ele já está bem posicionado.',
    h4t: 'Ajuste', h4: '<b>Seguir</b>: o alvo acompanha o objeto.<br><b>Estabilizar</b>: o alvo faz o contrário, para deixar o objeto parado. Marque o que quer copiar: Posição, Rotação e/ou Escala.',
    h5t: 'Cole', h5: 'Aperte <b>Colar</b>. O Mec Tracker cria o efeito Transform com os keyframes sozinho. Se você rastreou vários clipes, cada alvo recebe o rastreio do clipe com que ele mais coincide no tempo.',
    tutT: 'Tutoriais em vídeo', tut: 'Vídeos curtos de cada passo: abrir o painel, fazer a máscara (à mão ou com Object Mask), Rastrear e Colar, Colar Direto, vários clipes e Estabilizar. Os vídeos também vêm na pasta <b>Tutoriais</b> do download.', tutOpen: 'Ver os tutoriais',
    tipsT: 'Dicas', tips: '• O botão azul é sempre o próximo passo.<br>• Depois de rastrear, a faixa verde em cima mostra o rastreio copiado. <b>Descartar</b> apaga ele.<br>• <b>Ocultar opções</b> recolhe Posição, Rotação, Escala e o intervalo, e deixa só um resumo.<br>• Um keyframe a cada 1 frame é o mais fiel. Números maiores deixam o movimento mais suave, com menos keyframes.<br>• Se a máscara estiver em Unassigned Masks, salve o projeto (Ctrl+S) antes de rastrear. Máscaras do <b>Object Mask</b> precisam ficar dentro do Opacity.<br>• <b>Colar Direto no Clipe de Cima</b>: o botão vira <b>Rastrear e Colar</b> e o plugin já cola os keyframes no clipe da trilha logo acima (por exemplo, o texto em cima do vídeo). Com vários clipes selecionados, ele faz isso com cada um, um por vez, usando o primeiro quadro de cada clipe como referência.<br>• Algo deu errado? Abra o Registro abaixo, clique em Copiar e envie para o Hugo.',
    idle: 'Selecione o clipe que tem a máscara (ou vários) e clique em Rastrear.',
    idle2: 'Agora selecione o alvo, deixe a agulha onde ele está bem posicionado e clique em Colar.',
    s1: 'Rastrear a máscara', s1hint: 'Selecione o clipe que tem a máscara.',
    track: 'Rastrear Clipe Selecionado', cancel: 'Cancelar',
    updText: 'Nova versão {0} disponível (você tem a {1})', updNotes: 'Ver novidades', updHide: 'Esconder novidades', updGet: 'Baixar', updNoNotes: 'Sem notas nesta versão.', updCheck: 'Verificar atualizações', updChecking: 'Verificando…', updLatest: 'Você está na versão mais recente ({0}).', updFound: 'Versão {0} disponível: veja o aviso no topo.', updFail: 'Não consegui verificar agora (sem internet ou ainda sem versões publicadas no GitHub).',
    chipOne: 'Rastreio copiado: "{0}"', chipMany: '{0} rastreios copiados', discard: 'Descartar', optsHide: 'Ocultar opções', optsShow: 'Mostrar opções', sumEvery: 'a cada {0} frame(s)',
    bTrack: 'Rastrear', bTrackAuto: 'Rastrear e Colar', bTrackN: 'Rastrear {0} Clipes', bTrackAutoN: 'Rastrear e Colar {0} Clipes', bPasteN: 'Colar em {0} Clipes',
    manyDone: '{0} clipes rastreados. Agora selecione os alvos e clique em Colar.', manyDoneSkip: '{0} de {1} clipes rastreados ({2} com erro, veja o Registro na Ajuda). Agora selecione os alvos e clique em Colar.',
    pasteMany: 'Colado em {0} de {1} alvos.', pasteNoMatch: 'Pulado: "{0}" não coincide no tempo com nenhum clipe rastreado.', pasteMatch: '"{0}" recebe o rastreio de "{1}".',
    s2: 'Colar como keyframes', s2hint: 'Selecione o alvo e deixe o cursor onde ele está bem posicionado.',
    mode: 'Modo', follow: 'Seguir', stabilize: 'Estabilizar',
    props: 'Propriedades', pos: 'Posição', scale: 'Escala', rot: 'Rotação',
    every: 'Um Keyframe a Cada', frames: 'Frame(s)', everyhint: 'Quanto maior o número, menos keyframes e mais suave o movimento.',
    batch: 'Rastrear e Colar em Lote', batchClip: 'Clipe {0} de {1}', batchDone: 'Lote concluído: {0} de {1} clipes colados.', batchSkipped: ' {0} pulado(s), veja o Registro na Ajuda.', batchCancelled: 'Lote cancelado: {0} de {1} clipes colados.',
    batchNoAbove: 'Pulado: não há clipe acima dele.', batchShared: '{0} clipe(s) acima ficaram com o clipe vizinho, que eles cobrem mais.', batchDropped: '{0} clipe(s) selecionado(s) estão acima de outro selecionado e foram tratados como alvo.',
    E_BATCH_NONE: 'Selecione os clipes que têm as máscaras e clique em Rastrear e Colar.',
    apply: 'Colar', auto: 'Colar Direto no Clipe de Cima', log: 'Registro', copy: 'Copiar', clear: 'Limpar', by: 'Criado por',
    tracking: 'Rastreando…', cancelling: 'Cancelando…', progress: '{0}/{1} · faltam ~{2} s',
    tracked: 'Rastreado com Sucesso!', trackedPasted: 'Rastreado e Colado com Sucesso!', E_NO_ABOVE: 'Rastreado, mas não há nenhum clipe acima do clipe rastreado na timeline. Para colar em outro clipe, desmarque Colar Direto no Clipe de Cima.', trackedCancel: 'Cancelado: {0} quadros mantidos', noTrack: 'Ainda não há rastreio.',
    loaded: '✓ "{0}" · {2} quadros ({3} s) · rastreado em {5} s · {6}', hidden: ' · máscara visível em {0}', edge: ' · toca a borda em {0} quadros (a posição pode derivar)', static: ' · ⚠ a máscara não se mexeu no rastreio (veja o Registro)',
    srcRender: 'máscara do Opacity', srcProject: 'máscara do projeto (Unassigned)', reading: 'Lendo o projeto…', copied: 'Copiado!', cancelled: 'Cancelado.',
    count: '≈ <b>{1}</b> keyframes',
    applying: 'Colando…', done: 'Colado com Sucesso!', doneLog: '✓ {0} keyframes colados em "{1}" (a cada {2} frame(s)).', transformAdded: ' Transform adicionado.',
    shutterOk: ' Shutter Angle {0}°.', shutterFail: ' (Shutter Angle: ajuste manualmente)',
    E_NO_PROJECT: 'Nenhum projeto aberto.', E_NO_SEQ: 'Nenhuma sequência ativa. Abra a sequência na timeline.',
    E_SEL_ONE: 'Selecione exatamente um clipe de vídeo na timeline (encontrei {0}).',
    E_NO_FRAMES: 'O clipe selecionado não tem quadros.',
    E_NO_ALPHA: 'Os quadros renderizados não têm canal alfa, então não dá para medir a máscara.',
    E_OPAQUE: 'O clipe aparece inteiro, então não há máscara recortando ele.',
    E_NO_PROJECT_MASK: 'Não achei a máscara nem no render (Opacity) nem no arquivo do projeto. Confira se o clipe selecionado tem a máscara rastreada e tente de novo.',
    E_OBJECT_MASK: 'Achei a máscara em Unassigned Masks, mas o Premiere não salvou o movimento dela no projeto. Isso acontece com o Object Mask (ou com máscara que ainda não foi rastreada). Arraste a máscara para dentro do Opacity do clipe e clique em Rastrear de novo.',
    E_PROJECT_READ: 'Não consegui ler o arquivo do projeto ({0}). Salve o projeto (Ctrl+S) e tente de novo.',
    E_EXPORT_FAIL: 'O Premiere recusou exportar o quadro em {0} s.', E_EXPORT_TIMEOUT: 'O Premiere não gerou o quadro a tempo.',
    E_NO_PROPS: 'Escolha ao menos uma propriedade (Posição, Escala ou Rotação).',
    E_SPEED: 'Clipes com velocidade alterada ({0}%) ainda não são suportados.',
    E_WRONG_SEQ: 'O rastreio foi feito na sequência "{0}". Abra essa sequência para colar.',
    E_NO_OVERLAP: '"{0}" não coincide no tempo com o clipe rastreado.',
    E_NO_TRANSFORM: 'Não consegui adicionar o efeito Transform ({0}). Adicione o efeito Transform manualmente ao clipe e tente de novo.',
    E_PARAMS: 'Não reconheci os parâmetros do Transform: {0}', E_REJECT_PREP: 'O Premiere recusou preparar os parâmetros do Transform.',
    E_REJECT_KEYS: 'O Premiere recusou os keyframes.', E_NO_MASK: 'A máscara não apareceu em nenhum quadro.',
    E_NO_TRACK: 'Rastreie um clipe primeiro.', E_BUSY: 'Já existe uma operação em andamento.'
  },
  en: {
    tabMain: 'Track', tabHelp: 'Help',
    h1t: 'Prepare The Mask', h1: 'On the clip that has the object, create a mask (rectangle, pen or Object Mask) and use Premiere\'s own tracking (“Track selected mask forward”) until the end of the clip.',
    h2t: 'Track', h2: 'Select the clip that has the mask on the timeline and press <b>Track</b>. You can select several clips at once. Wait for the bar to finish: only then the Paste button shows up.',
    h3t: 'Pick The Target', h3: 'Select the text, image or graphic that should follow the object (it can be more than one). Park the timeline playhead where it is already placed correctly.',
    h4t: 'Adjust', h4: '<b>Follow</b>: the target follows the object.<br><b>Stabilize</b>: the target does the opposite, to hold the object still. Tick what to copy: Position, Rotation and/or Scale.',
    h5t: 'Paste', h5: 'Press <b>Paste</b>. Mec Tracker creates the Transform effect with the keyframes for you. If you tracked several clips, each target gets the track of the clip it overlaps most in time.',
    tutT: 'Video tutorials', tut: 'Short videos for each step: opening the panel, making the mask (by hand or with Object Mask), Track and Paste, Paste Straight, several clips and Stabilize. The videos also come in the <b>Tutoriais</b> folder of the download.', tutOpen: 'Watch the tutorials',
    tipsT: 'Tips', tips: '• The blue button is always the next step.<br>• After tracking, the green strip on top shows the copied track. <b>Discard</b> clears it.<br>• <b>Hide options</b> folds Position, Rotation, Scale and the interval, leaving just a summary.<br>• One keyframe every 1 frame is the most accurate. Higher numbers give smoother motion with fewer keyframes.<br>• If the mask is in Unassigned Masks, save the project (Ctrl+S) before tracking. <b>Object Mask</b> masks must be inside Opacity.<br>• <b>Paste Straight to Clip Above</b>: the button becomes <b>Track &amp; Paste</b> and the plugin pastes the keyframes onto the clip on the track right above (for example, the text over the video). With several clips selected, it does that for each one, one at a time, using each clip\'s first frame as the reference.<br>• Something went wrong? Open the Log below, click Copy and send it to Hugo.',
    idle: 'Select the clip that has the mask (or several) and click Track.',
    idle2: 'Now select the target, park the playhead where it is placed correctly and click Paste.',
    s1: 'Track the mask', s1hint: 'Select the clip that has the mask.',
    track: 'Track Selected Clip', cancel: 'Cancel',
    updText: 'New version {0} available (you have {1})', updNotes: "What's new", updHide: 'Hide notes', updGet: 'Download', updNoNotes: 'No notes for this version.', updCheck: 'Check for updates', updChecking: 'Checking…', updLatest: 'You have the latest version ({0}).', updFound: 'Version {0} available: see the notice at the top.', updFail: 'Could not check right now (no internet or no versions published on GitHub yet).',
    chipOne: 'Track copied: "{0}"', chipMany: '{0} tracks copied', discard: 'Discard', optsHide: 'Hide options', optsShow: 'Show options', sumEvery: 'every {0} frame(s)',
    bTrack: 'Track', bTrackAuto: 'Track & Paste', bTrackN: 'Track {0} Clips', bTrackAutoN: 'Track & Paste {0} Clips', bPasteN: 'Paste to {0} Clips',
    manyDone: '{0} clips tracked. Now select the targets and click Paste.', manyDoneSkip: '{0} of {1} clips tracked ({2} failed, see the Log in Help). Now select the targets and click Paste.',
    pasteMany: 'Pasted onto {0} of {1} targets.', pasteNoMatch: 'Skipped: "{0}" does not overlap any tracked clip in time.', pasteMatch: '"{0}" gets the track of "{1}".',
    s2: 'Paste as keyframes', s2hint: 'Select the target and park the playhead where it is placed correctly.',
    mode: 'Mode', follow: 'Follow', stabilize: 'Stabilize',
    props: 'Properties', pos: 'Position', scale: 'Scale', rot: 'Rotation',
    every: 'One Keyframe Every', frames: 'Frame(s)', everyhint: 'The higher the number, the fewer keyframes and the smoother the motion.',
    batch: 'Batch Track & Paste', batchClip: 'Clip {0} of {1}', batchDone: 'Batch done: pasted {0} of {1} clips.', batchSkipped: ' {0} skipped, see the Log in Help.', batchCancelled: 'Batch cancelled: pasted {0} of {1} clips.',
    batchNoAbove: 'Skipped: there is no clip above it.', batchShared: '{0} clip(s) above went to the neighbouring clip, which they cover more.', batchDropped: '{0} selected clip(s) sit above another selected clip and were used as targets.',
    E_BATCH_NONE: 'Select the clips that have the masks and click Track & Paste.',
    apply: 'Paste', auto: 'Paste Straight to Clip Above', log: 'Log', copy: 'Copy', clear: 'Clear', by: 'Created By',
    tracking: 'Tracking…', cancelling: 'Cancelling…', progress: '{0}/{1} · ~{2} s left',
    tracked: 'Tracked Successfully!', trackedPasted: 'Tracked and Pasted Successfully!', E_NO_ABOVE: 'Tracked, but there is no clip above the tracked clip on the timeline. To paste onto another clip, untick Paste Straight to Clip Above.', trackedCancel: 'Cancelled: kept {0} frames', noTrack: 'No track yet.',
    loaded: '✓ "{0}" · {2} frames ({3} s) · tracked in {5} s · {6}', hidden: ' · mask visible in {0}', edge: ' · touches the frame edge in {0} frames (position may drift)', static: ' · ⚠ the mask did not move while tracking (see the Log)',
    srcRender: 'Opacity mask', srcProject: 'project mask (Unassigned)', reading: 'Reading the project…', copied: 'Copied!', cancelled: 'Cancelled.',
    count: '≈ <b>{1}</b> keyframes',
    applying: 'Pasting…', done: 'Pasted Successfully!', doneLog: '✓ {0} keyframes pasted onto "{1}" (every {2} frame(s)).', transformAdded: ' Transform added.',
    shutterOk: ' Shutter Angle {0}°.', shutterFail: ' (Shutter Angle: set it manually)',
    E_NO_PROJECT: 'No project open.', E_NO_SEQ: 'No active sequence. Open the sequence on the timeline.',
    E_SEL_ONE: 'Select exactly one video clip on the timeline (found {0}).',
    E_NO_FRAMES: 'The selected clip has no frames.',
    E_NO_ALPHA: 'Rendered frames have no alpha channel, so the mask cannot be measured.',
    E_OPAQUE: 'The whole clip is visible, so no mask is cutting it out.',
    E_NO_PROJECT_MASK: 'I found the mask neither in the render (Opacity) nor in the project file. Check that the selected clip has the tracked mask and try again.',
    E_OBJECT_MASK: 'I found the mask in Unassigned Masks, but Premiere did not save its motion in the project. This happens with Object Mask (or with a mask that was not tracked yet). Drag the mask into the clip\'s Opacity and click Track again.',
    E_PROJECT_READ: 'Could not read the project file ({0}). Save the project (Ctrl+S) and try again.',
    E_EXPORT_FAIL: 'Premiere refused to export the frame at {0} s.', E_EXPORT_TIMEOUT: 'Premiere did not produce the frame in time.',
    E_NO_PROPS: 'Choose at least one property (Position, Scale or Rotation).',
    E_SPEED: 'Clips with changed speed ({0}%) are not supported yet.',
    E_WRONG_SEQ: 'The track was recorded in sequence "{0}". Open that sequence to paste.',
    E_NO_OVERLAP: '"{0}" does not overlap the tracked clip in time.',
    E_NO_TRANSFORM: 'Could not add the Transform effect ({0}). Add the Transform effect to the clip manually and try again.',
    E_PARAMS: 'Could not recognise the Transform parameters: {0}', E_REJECT_PREP: 'Premiere rejected preparing the Transform parameters.',
    E_REJECT_KEYS: 'Premiere rejected the keyframes.', E_NO_MASK: 'The mask did not appear in any frame.',
    E_NO_TRACK: 'Track a clip first.', E_BUSY: 'An operation is already running.'
  }
};

var LS = { lang: 'mectracker.lang', prefs: 'mectracker.prefs', upd: 'mectracker.update', updSkip: 'mectracker.updateSkip' };
// aviso de atualização: confere a última release do GitHub (no máximo a cada 30 min; o resultado fica guardado)
var VERSION = '3.3.8', REPO = 'hugomec7/MecTracker', UPD_EVERY = 30 * 6e4;
var SCALE = 0.125, SHUTTER = 360; // rastreio em 1/8 da resolução; Shutter Angle sempre 360
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

var $ = function (id) { return document.getElementById(id); };
var lang = 'en', busy = false, cancelTok = null, track = null, tracks = [], selCount = 0;
// track = último rastreio (para o resumo); tracks = todos os rastreios guardados (1 ou vários clipes)
function setTracks(list) { tracks = list || []; track = tracks.length ? tracks[tracks.length - 1] : null; }
var st = { auto: false, action: 'follow', pos: true, scale: false, rot: false, step: 1, compact: false };
var logLines = [];

function tr(k) { var s = (DICT[lang] && DICT[lang][k]) || DICT.pt[k] || k, i; for (i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(arguments[i]); return s; }
function showLog() { var el = $('log'); if (el) { el.value = logLines.join('\n'); try { el.scrollTop = el.scrollHeight; } catch (e) {} } }
function log(m) { logLines.push(m); showLog(); try { console.log(m); } catch (e) {} }
var statusIdle = true;
function setStatus(text, cls) { var s = $('status'); statusIdle = !text; s.textContent = text || tr(track ? 'idle2' : 'idle'); s.className = 'status copyable' + (cls ? ' ' + cls : ''); }
function errText(e) {
  if (e && e.code && DICT.pt['E_' + e.code]) return tr('E_' + e.code, e.detail);
  return H.msg(e);
}
function cls(el, name, on) {
  var parts = (el.className || '').split(' ').filter(function (x) { return x && x !== name; });
  if (on) parts.push(name);
  el.className = parts.join(' ');
}
function has(el, name) { return (' ' + el.className + ' ').indexOf(' ' + name + ' ') >= 0; }
function click(id, fn) { $(id).addEventListener('click', function (ev) { if (has($(id), 'disabled')) return; fn(ev); }); }

var host = H.createHost(ppro, uxp, log);

function applyLang() {
  var els = document.querySelectorAll('[data-i]'), i;
  for (i = 0; i < els.length; i++) els[i].innerHTML = tr(els[i].getAttribute('data-i'));
  cls($('langPT'), 'on', lang === 'pt'); cls($('langEN'), 'on', lang === 'en');
  renderTrack(); renderCount(); renderUpdate();
  if (statusIdle) setStatus('');
}

function seg(id, key) {
  var btns = $(id).querySelectorAll('.opt'), i;
  for (i = 0; i < btns.length; i++) btns[i].addEventListener('click', function (ev) { st[key] = ev.currentTarget.getAttribute('data-v'); refreshPrefs(); save(); });
}
function chip(id, key) { $(id).addEventListener('click', function () { st[key] = !st[key]; refreshPrefs(); save(); }); }
function refreshPrefs() {
  var btns = $('seg-action').querySelectorAll('.opt'), i;
  for (i = 0; i < btns.length; i++) cls(btns[i], 'on', btns[i].getAttribute('data-v') === String(st.action));
  cls($('chip-auto'), 'on', !!st.auto); cls($('chip-pos'), 'on', !!st.pos); cls($('chip-rot'), 'on', !!st.rot); cls($('chip-scale'), 'on', !!st.scale);
  $('step-val').textContent = String(st.step);
  renderCount(); renderTrack();
}
function showTab(t) {
  cls($('page-main'), 'hidden', t !== 'main'); cls($('page-help'), 'hidden', t !== 'help');
  cls($('tab-main'), 'on', t === 'main'); cls($('tab-help'), 'on', t === 'help');
}
// as configurações ficam em um arquivo na pasta de dados do plugin (e no localStorage como reserva)
function allPrefs() { var o = { lang: lang }, k; for (k in st) o[k] = st[k]; return JSON.stringify(o); }
async function fileSave(txt) {
  try { var f = await uxp.storage.localFileSystem.getDataFolder(), e = await f.createFile('settings.json', { overwrite: true }); await e.write(txt); } catch (e2) { /* sem arquivo: fica só o localStorage */ }
}
async function fileLoad() {
  try { var f = await uxp.storage.localFileSystem.getDataFolder(), e = await f.getEntry('settings.json'); return JSON.parse(await e.read()); } catch (e2) { return null; }
}
function applyPrefs(p) {
  if (!p) return;
  if (p.lang === 'en' || p.lang === 'pt') lang = p.lang;
  for (var k in st) if (typeof p[k] === typeof st[k]) st[k] = p[k];
}
function save() { var t = allPrefs(); lsSet(LS.prefs, t); fileSave(t); }
function setStep(v) {
  st.step = Math.max(1, Math.min(240, parseInt(v, 10) || 1));
  refreshPrefs(); save();
}
function renderCount() {
  var c = $('count');
  if (!tracks.length) { c.innerHTML = ''; return; }
  var k = 0; tracks.forEach(function (t) { k += Math.ceil(t.samples.length / st.step) + 1; });
  c.innerHTML = tr('count', 0, k);
}
function trackInfo() {
  var vis = 0, edge = 0, i, n = track.samples.length;
  for (i = 0; i < n; i++) { if (!track.samples[i].lost) vis++; if (track.samples[i].edge) edge++; }
  var secs = (n * track.frameTicks / H.TICKS_PER_SEC).toFixed(2), took = (track.seconds || 0).toFixed(1);
  return tr('loaded', track.clipName, track.sequenceName, n, secs, vis, took, tr(track.source === 'project' ? 'srcProject' : 'srcRender')) +
    (vis < n ? tr('hidden', vis + '/' + n) : '') + (edge ? tr('edge', edge) : '') + (track.static ? tr('static') : '') + (track.complete ? '' : ' ✂');
}
// o que cada botão faz agora: depende do rastreio, do Colar Direto e de quantos clipes estão selecionados
// vários clipes: com o Colar Direto ligado rastreia e cola em cima de cada um (lote); desligado só rastreia todos
function trackAction() { return selCount >= 2 ? (st.auto ? 'batch' : 'many') : 'track'; }
// com 2 ou mais clipes selecionados o nome mostra quantos, para confirmar o que vai acontecer
function trackLabel() { return selCount >= 2 ? tr(st.auto ? 'bTrackAutoN' : 'bTrackN', selCount) : tr(st.auto ? 'bTrackAuto' : 'bTrack'); }
// com o Colar Direto ligado só existe Rastrear e Colar; para colar à mão é só desmarcar a caixa
function pasteReady() { return tracks.length > 0 && !st.auto; }
function mainAction() { return pasteReady() ? 'paste' : trackAction(); }
function renderTrack() {
  var paste = pasteReady(), m = $('btn-main'), a = $('btn-alt');
  m.textContent = paste ? (selCount >= 2 ? tr('bPasteN', selCount) : tr('apply')) : trackLabel();
  a.textContent = trackLabel();
  cls(m, 'disabled', busy); cls(a, 'disabled', busy);
  cls(a, 'hidden', !paste || busy);
  cls($('opts'), 'hidden', !(track || st.auto || selCount >= 2));
  // aviso de rastreio guardado (some com o ✕ ou com um novo rastreio)
  cls($('trk-chip'), 'hidden', !tracks.length || busy);
  if (tracks.length) $('trk-chip-text').textContent = tracks.length > 1 ? tr('chipMany', tracks.length) : tr('chipOne', track.clipName.length > 24 ? track.clipName.slice(0, 22) + '…' : track.clipName);
  // opções recolhidas: mostra só um resumo do que está escolhido
  cls($('opts-more'), 'hidden', !!st.compact);
  $('opts-toggle').textContent = tr(st.compact ? 'optsShow' : 'optsHide');
  var props = []; if (st.pos) props.push(tr('pos')); if (st.rot) props.push(tr('rot')); if (st.scale) props.push(tr('scale'));
  $('opts-sum').textContent = st.compact ? (props.join(', ') || '—') + ' · ' + tr('sumEvery', st.step) : '';
}
function doAction(kind) { return kind === 'paste' ? onApply() : kind === 'batch' ? onBatch() : kind === 'many' ? onTrackMany() : onTrack(); }
// acompanha quantos clipes de vídeo estão selecionados na timeline para trocar o nome dos botões
var selPolling = false;
async function pollSelection() {
  if (selPolling || busy) return;
  selPolling = true;
  try {
    var n = 0, project = await ppro.Project.getActiveProject(), seq = project && await project.getActiveSequence();
    if (seq) n = (await host.selectedClips(seq)).length;
    if (n !== selCount) { selCount = n; renderTrack(); }
  } catch (e) {} finally { selPolling = false; }
}
async function refreshSelection() { try { var c = await host.context(); selCount = (await host.selectedClips(c.sequence)).length; } catch (e) {} }

function setBusy(b) {
  busy = b;
  renderTrack();
}

async function run(fn) {
  if (busy) { setStatus(tr('E_BUSY'), 'err'); return; }
  setBusy(true);
  for (var w = 0; selPolling && w < 50; w++) await new Promise(function (r) { setTimeout(r, 20); });
  try { await host.restorePendingMutes(); } catch (e) {}
  try { await fn(); }
  catch (e) { var m = errText(e); setStatus(m, 'err'); log('✗ ' + m + (e && e.stack ? '\n' + String(e.stack).split('\n').slice(0, 3).join('\n') : '')); }
  finally { setBusy(false); }
}

function onProgress(prefix) {
  return function (p) {
    $('trk-bar').style.width = Math.round(p.done / p.total * 100) + '%';
    cls($('trk-text'), 'hidden', false);
    $('trk-text').textContent = (prefix ? prefix + ' · ' : '') + (p.msPerFrame ? tr('progress', p.done, p.total, Math.max(0, Math.round((p.total - p.done) * p.msPerFrame / 1000))) : tr('reading'));
  };
}
function showProgress(on) {
  cls($('trk-progress'), 'hidden', !on); cls($('btn-cancel'), 'hidden', !on);
  if (!on) { $('trk-text').textContent = ''; cls($('trk-text'), 'hidden', true); $('trk-bar').style.width = '0%'; }
}
function pasteOpts() { return { pos: st.pos, scale: st.scale, rot: st.rot, follow: st.action !== 'stabilize', step: st.step, smooth: 0, shutter: SHUTTER }; }
function pasteLine(r) { return tr('doneLog', r.keyframes, r.name, st.step) + (r.added ? tr('transformAdded') : '') + (r.shutter === false ? tr('shutterFail') : tr('shutterOk', SHUTTER)); }

async function onTrack() {
  var c = await host.context(), item = await host.selectedClip(c.sequence);
  cancelTok = { cancelled: false };
  setTracks([]); renderTrack(); renderCount();
  setStatus(tr('tracking'), '');
  showProgress(true);
  try {
    var rec = await host.track(c.project, c.sequence, item, SCALE, onProgress(''), cancelTok);
    if (!rec.samples.length) { setStatus(tr('cancelled'), 'err'); return; }
    var any = false, i; for (i = 0; i < rec.samples.length; i++) if (!rec.samples[i].lost) { any = true; break; }
    if (!any) throw H.fail('NO_MASK');
    setTracks([rec]); renderTrack(); renderCount();
    setStatus(rec.complete ? tr('tracked', rec.samples.length) : tr('trackedCancel', rec.samples.length), rec.complete ? 'ok' : 'err');
    if (st.auto && rec.complete) {
      var above = await host.clipsAbove(c.sequence, item);
      if (!above.length) { setStatus(tr('E_NO_ABOVE'), 'err'); log(tr('E_NO_ABOVE')); }
      else {
        var tm = await host.timing(item), ph = await c.sequence.getPlayerPosition(), pt = ph.ticksNumber;
        var ref = (pt >= tm.start && pt < tm.end) ? ph : await above[0].getStartTime();
        if (!(pt >= tm.start && pt < tm.end) && (await above[0].getStartTime()).ticksNumber < tm.start) ref = await item.getStartTime();
        setStatus(tr('applying'), '');
        await pasteTo(c, above, ref);
        rec.pasted = true; renderTrack();
        setStatus(tr('trackedPasted'), 'ok');
      }
    }
    log(trackInfo());
    log(rec.complete ? 'Rastreio concluído: ' + rec.samples.length + ' quadros' : 'Rastreio cancelado: ' + rec.samples.length + ' quadros');
  } finally {
    cancelTok = null; showProgress(false);
  }
}

// lote: rastreia cada clipe selecionado e cola no(s) clipe(s) acima dele, um por vez
async function onBatch() {
  var c = await host.context(), sel = await host.selectedClips(c.sequence);
  if (!st.pos && !st.scale && !st.rot) throw H.fail('NO_PROPS');
  var plan = await host.batchPlan(c.sequence, sel), rows = plan.rows, n = rows.length;
  if (!n) throw H.fail('BATCH_NONE');
  cancelTok = { cancelled: false };
  setTracks([]); renderTrack(); renderCount();
  showProgress(true);
  var ok = 0, skipped = 0, stopped = false, cache = {}, i, j, row, rec, head, pasted, got = [];
  log('Lote: ' + n + ' clipe(s).');
  if (plan.dropped) log(tr('batchDropped', plan.dropped));
  try {
    for (i = 0; i < n; i++) {
      if (cancelTok.cancelled) { stopped = true; break; }
      row = rows[i]; head = tr('batchClip', i + 1, n);
      log('— ' + head + ': "' + row.name + '"');
      if (row.shared) log(tr('batchShared', row.shared));
      if (!row.targets.length) { skipped++; log(tr('batchNoAbove')); continue; }
      setStatus(head + ' · ' + tr('tracking'), '');
      $('trk-bar').style.width = '0%';
      try {
        rec = await host.track(c.project, c.sequence, row.item, SCALE, onProgress(head), cancelTok, cache);
        if (!rec.complete) { stopped = true; log(tr('cancelled')); break; }
        if (!rec.samples.some(function (s) { return !s.lost; })) throw H.fail('NO_MASK');
        rec.pasted = true; got.push(rec); track = rec; log(trackInfo());
        setStatus(head + ' · ' + tr('applying'), '');
        for (pasted = 0, j = 0; j < row.targets.length; j++) {
          try {
            log(pasteLine(await host.pasteKeys(c.project, c.sequence, row.targets[j].item, host.ticks(Math.max(row.start, row.targets[j].start)), rec, pasteOpts())));
            pasted++;
          } catch (e) { log('✗ ' + errText(e)); }
        }
        if (pasted) ok++; else skipped++;
      } catch (e) { skipped++; log('✗ ' + errText(e)); }
    }
  } finally {
    cancelTok = null; showProgress(false);
    setTracks(got); renderTrack(); renderCount();
  }
  var text = tr(stopped ? 'batchCancelled' : 'batchDone', ok, n) + (skipped ? tr('batchSkipped', skipped) : '');
  log(text);
  setStatus(text, ok === n ? 'ok' : 'err');
}

async function pasteTo(c, clips, refTime) {
  var i, okCount = 0, lastErr = null;
  for (i = 0; i < clips.length; i++) {
    try {
      log(pasteLine(await host.pasteKeys(c.project, c.sequence, clips[i], refTime, track, pasteOpts())));
      okCount++;
    } catch (e) { lastErr = e; if (clips.length === 1) throw e; log('✗ ' + errText(e)); }
  }
  if (!okCount && lastErr) throw lastErr;
  return okCount;
}

// vários clipes com o Colar Direto desligado: rastreia todos e guarda; o usuário escolhe os alvos e cola depois
async function onTrackMany() {
  var c = await host.context(), sel = await host.selectedClips(c.sequence), rows = [], i, rec, head, n, got = [], failed = 0, stopped = false, cache = {};
  if (sel.length < 2) return onTrack();
  for (i = 0; i < sel.length; i++) rows.push({ item: sel[i], start: (await host.timing(sel[i])).start, name: await sel[i].getName() });
  rows.sort(function (a, b) { return a.start - b.start; }); n = rows.length;
  cancelTok = { cancelled: false };
  setTracks([]); renderTrack(); renderCount();
  showProgress(true);
  log('Rastrear ' + n + ' clipe(s).');
  try {
    for (i = 0; i < n; i++) {
      if (cancelTok.cancelled) { stopped = true; break; }
      head = tr('batchClip', i + 1, n);
      log('— ' + head + ': "' + rows[i].name + '"');
      setStatus(head + ' · ' + tr('tracking'), '');
      $('trk-bar').style.width = '0%';
      try {
        rec = await host.track(c.project, c.sequence, rows[i].item, SCALE, onProgress(head), cancelTok, cache);
        if (!rec.complete) { stopped = true; log(tr('cancelled')); break; }
        if (!rec.samples.some(function (s) { return !s.lost; })) throw H.fail('NO_MASK');
        got.push(rec); track = rec; log(trackInfo());
      } catch (e) { failed++; log('✗ ' + errText(e)); }
    }
  } finally {
    cancelTok = null; showProgress(false);
    setTracks(got); renderTrack(); renderCount();
  }
  if (!got.length) { setStatus(stopped ? tr('cancelled') : tr('E_NO_MASK'), 'err'); return; }
  var text = (got.length === n && !stopped) ? tr('manyDone', n) : tr('manyDoneSkip', got.length, n, n - got.length);
  log(text); setStatus(text, got.length === n ? 'ok' : 'err');
}

// com vários rastreios, cada alvo fica com o rastreio do clipe com que ele mais coincide no tempo
function trackRange(t) { return { start: t.startTicks, end: t.startTicks + t.samples.length * t.frameTicks }; }
async function onApply() {
  if (!tracks.length) throw H.fail('NO_TRACK');
  var c = await host.context(), clips = await host.selectedClips(c.sequence);
  if (!clips.length) throw H.fail('SEL_ONE', '0');
  var refTime = await c.sequence.getPlayerPosition();
  setStatus(tr('applying'), '');
  if (tracks.length === 1) { track = tracks[0]; await pasteTo(c, clips, refTime); setStatus(tr('done'), 'ok'); return; }
  var ok = 0, i, j, tm, best, bestOv, ov, r, s0, e0, ph = refTime.ticksNumber, name;
  for (i = 0; i < clips.length; i++) {
    tm = await host.timing(clips[i]); name = await clips[i].getName(); best = null; bestOv = 0;
    for (j = 0; j < tracks.length; j++) { r = trackRange(tracks[j]); ov = Math.min(r.end, tm.end) - Math.max(r.start, tm.start); if (ov > bestOv) { bestOv = ov; best = tracks[j]; } }
    if (!best) { log(tr('pasteNoMatch', name)); continue; }
    r = trackRange(best); s0 = Math.max(r.start, tm.start); e0 = Math.min(r.end, tm.end);
    log(tr('pasteMatch', name, best.clipName));
    try {
      log(pasteLine(await host.pasteKeys(c.project, c.sequence, clips[i], (ph >= s0 && ph < e0) ? refTime : host.ticks(s0), best, pasteOpts())));
      ok++;
    } catch (e) { log('✗ ' + errText(e)); }
  }
  var text = tr('pasteMany', ok, clips.length) + (ok < clips.length ? tr('batchSkipped', clips.length - ok) : '');
  log(text); setStatus(ok === clips.length ? tr('done') : text, ok === clips.length ? 'ok' : 'err');
}

// efeito de mouse por cima (o :hover do CSS pode não funcionar em <div> no UXP, então também marcamos por JS)
function hover() {
  var els = document.querySelectorAll('.btn, .opt, .check, .sbtn, .link, .ytlink, .tab, .lg, .x'), i;
  for (i = 0; i < els.length; i++) {
    els[i].addEventListener('mouseenter', function (ev) { cls(ev.currentTarget, 'hov', true); });
    els[i].addEventListener('mouseleave', function (ev) { cls(ev.currentTarget, 'hov', false); });
  }
}

var toastTimer = null;
async function copyText(txt) {
  try {
    var cb = navigator.clipboard;
    if (cb && cb.writeText) await cb.writeText(txt); else if (cb && cb.setContent) await cb.setContent({ 'text/plain': txt }); else return;
    var t = $('toast'); t.textContent = tr('copied');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.textContent = ''; }, 1400);
  } catch (e) { log('Copy: ' + H.msg(e)); }
}

function verParts(v) { return String(v || '').replace(/^[^0-9]*/, '').split(/[.\-+]/).slice(0, 3).map(function (x) { return parseInt(x, 10) || 0; }); }
function newer(a, b) { var x = verParts(a), y = verParts(b), i; for (i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
function myVersion() { return (uxp.versions && uxp.versions.plugin) || VERSION; }
var upd = null;
function renderUpdate() {
  var show = !!(upd && newer(upd.tag, myVersion()) && lsGet(LS.updSkip) !== upd.tag);
  cls($('upd'), 'hidden', !show);
  if (!show) return;
  $('upd-text').textContent = tr('updText', String(upd.tag).replace(/^v/i, ''), myVersion());
  $('upd-notes').textContent = upd.notes || tr('updNoNotes');
  $('upd-notes-btn').textContent = tr(has($('upd-notes'), 'hidden') ? 'updNotes' : 'updHide');
}
// force = botão "Verificar atualizações": ignora o intervalo de 30 min e o "✕" e devolve 'new' | 'latest' | 'fail'
async function checkUpdate(force) {
  if (!force) try { var c = JSON.parse(lsGet(LS.upd) || 'null'); if (c && c.tag) { upd = c; renderUpdate(); } if (c && Date.now() - c.at < UPD_EVERY) return; } catch (e) {}
  try {
    var r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) { log('Atualização: o GitHub respondeu ' + r.status + (r.status === 404 ? ' (ainda não há release publicada)' : '') + '.'); return 'fail'; }
    var j = await r.json();
    if (!j || !j.tag_name) return 'fail';
    upd = { tag: String(j.tag_name), notes: String(j.body || '').trim(), url: String(j.html_url || ('https://github.com/' + REPO + '/releases/latest')), at: Date.now() };
    lsSet(LS.upd, JSON.stringify(upd));
    if (force) lsDel(LS.updSkip);
    renderUpdate();
    return newer(upd.tag, myVersion()) ? 'new' : 'latest';
  } catch (e) { log('Atualização: ' + H.msg(e)); return 'fail'; }
}

function smoothScroll() {
  var el = $('app'), target = null, raf = null;
  if (typeof requestAnimationFrame !== 'function') return;
  function step() {
    var d = target - el.scrollTop;
    if (Math.abs(d) < 0.6) { el.scrollTop = target; target = null; raf = null; return; }
    el.scrollTop = el.scrollTop + d * 0.16;
    raf = requestAnimationFrame(step);
  }
  el.addEventListener('wheel', function (ev) {
    var max = el.scrollHeight - el.clientHeight, dy = ev.deltaY;
    if (max <= 0 || !dy) return;
    if (ev.deltaMode === 1) dy *= 32;
    ev.preventDefault();
    target = Math.max(0, Math.min(max, (target === null ? el.scrollTop : target) + dy));
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: false });
}

function init() {
  try { smoothScroll(); } catch (e) {}
  var l = lsGet(LS.lang); if (l === 'en' || l === 'pt') lang = l;
  try { applyPrefs(JSON.parse(lsGet(LS.prefs) || 'null')); } catch (e) {}
  seg('seg-action', 'action');
  chip('chip-auto', 'auto'); chip('chip-pos', 'pos'); chip('chip-rot', 'rot'); chip('chip-scale', 'scale');
  $('step-minus').addEventListener('click', function () { setStep(st.step - 1); });
  $('step-plus').addEventListener('click', function () { setStep(st.step + 1); });
  click('tab-main', function () { showTab('main'); });
  click('tab-help', function () { showTab('help'); });
  click('langPT', function () { lang = 'pt'; lsSet(LS.lang, lang); applyLang(); save(); });
  click('langEN', function () { lang = 'en'; lsSet(LS.lang, lang); applyLang(); save(); });
  // o clique confere a seleção de novo antes de decidir (o nome do botão pode estar meio segundo atrasado)
  click('btn-main', function () { run(async function () { await refreshSelection(); renderTrack(); await doAction(mainAction()); }); });
  click('btn-alt', function () { run(async function () { await refreshSelection(); renderTrack(); await doAction(trackAction()); }); });
  click('btn-cancel', function () { if (cancelTok) { cancelTok.cancelled = true; setStatus(tr('cancelling'), ''); } });
  click('log-toggle', function () { cls($('log'), 'hidden', !has($('log'), 'hidden')); });
  click('log-clear', function () { logLines = []; showLog(); setTracks([]); renderTrack(); renderCount(); setStatus(''); });
  click('upd-check', async function () {
    var m = $('upd-msg'); m.textContent = tr('updChecking');
    var r = await checkUpdate(true);
    m.textContent = r === 'new' ? tr('updFound', String(upd.tag).replace(/^v/i, '')) : r === 'latest' ? tr('updLatest', myVersion()) : tr('updFail');
  });
  click('upd-x', function () { if (upd) lsSet(LS.updSkip, upd.tag); renderUpdate(); });
  click('upd-notes-btn', function () { cls($('upd-notes'), 'hidden', !has($('upd-notes'), 'hidden')); renderUpdate(); });
  click('upd-get', function () { try { uxp.shell.openExternal(upd && upd.url || ('https://github.com/' + REPO + '/releases/latest')); } catch (e) {} });
  click('trk-chip-x', function () { setTracks([]); renderTrack(); renderCount(); setStatus(''); });
  click('opts-toggle', function () { st.compact = !st.compact; renderTrack(); save(); });
  click('log-copy', function () { copyText(logLines.join('\n')); });
  // clicar em um texto (resultado, aviso, erro) copia ele; o Registro também pode ser selecionado com o mouse
  ['status'].forEach(function (id) { $(id).addEventListener('click', function () { var t = $(id).textContent; if (t) copyText(t); }); });
  click('tut-open', function () { try { uxp.shell.openExternal('https://github.com/' + REPO + (lang === 'pt' ? '/blob/main/README.pt-BR.md#tutoriais' : '#tutorials')); } catch (e) {} });
  click('yt', function () { try { uxp.shell.openExternal('https://x.com/hugoeditor_'); } catch (e) {} });
  hover();
  refreshPrefs();
  applyLang();
  setStatus('');
  fileLoad().then(function (p) { if (p) { applyPrefs(p); refreshPrefs(); applyLang(); } });
  // antes: consultava a seleção do Premiere a cada 600 ms, o tempo todo (pesava e podia derrubar o Premiere)
  var lastPoll = 0;
  function pollSoon() { if (busy || Date.now() - lastPoll < 700) return; lastPoll = Date.now(); pollSelection(); }
  $('app').addEventListener('mouseenter', pollSoon);
  window.addEventListener('focus', pollSoon);
  pollSoon();
  host.restorePendingMutes().catch(function () {});
  checkUpdate(); setInterval(checkUpdate, UPD_EVERY);
  log('Mec Tracker ' + ((uxp.versions && uxp.versions.plugin) || '') + ' pronto.');
}

init();
if (typeof window !== 'undefined' && window.__MT_TEST__) window.__MT_TEST__.setTrack = function (t) { setTracks(t ? (Array.isArray(t) ? t : [t]) : []); renderTrack(); renderCount(); setStatus(''); };
if (typeof window !== 'undefined' && window.__MT_TEST__) window.__MT_TEST__.setSel = function (n) { selCount = n; renderTrack(); };
if (typeof window !== 'undefined' && window.__MT_TEST__) window.__MT_TEST__.host = host;

};
__req("app");
})();
