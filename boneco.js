'use strict';
/* =========================================================
   BONECO ARTICULADO DA GEADA (desenhado por código, sem sprites)
   Esqueleto: quadril → tronco → cabeça; braços (ombro/cotovelo);
   pernas (quadril/joelho/pé); cauda e cachecol com física (verlet).
   Ângulos em radianos. Coordenadas locais: x para frente, y para baixo,
   origem nos pés. Tudo é desenhado num canvas pequeno e ampliado 2x
   (pixel art na mesma escala do cenário).
   ========================================================= */

const PAL_GEADA = {
  contorno: '#121836', azul: '#2f7cf0', azulClaro: '#74b8ff', azulEsc: '#1e58c4',
  branco: '#f6faff', brancoEsc: '#c3d0ea', vermelho: '#ec2a35', vermelhoEsc: '#a3151d',
  iris: '#47b4ff', cristal: '#d4f6ff', nariz: '#1a1f3d',
};
const PAL_BRANCA = Object.fromEntries(Object.keys(PAL_GEADA).map((k) => [k, k === 'contorno' ? '#dfe9ff' : '#ffffff']));

const RIG_ESC = 0.5;                 // 1 pixel do boneco = 2 pixels do mundo
const RIG_W = 260, RIG_H = 250, RIG_OX = 130, RIG_OY = 205;
const rigCanvas = document.createElement('canvas');
rigCanvas.width = RIG_W; rigCanvas.height = RIG_H;
const rg = rigCanvas.getContext('2d');

// MODO_RECORTE = usa pedaços do desenho original da Geada presos nos ossos (cutout).
// Nesse modo as medidas dos ossos vêm do próprio sprite (em pixels do sprite).
const MODO_RECORTE = false;
const RIG_K = MODO_RECORTE ? 0.82 : 1;  // pixels do mundo por unidade do boneco
/*
 * Esqueleto (articulações principais):
 *  coluna em 2 partes (lombo + peito, com curvatura) → pescoço → cabeça
 *  ombros → cotovelos → pulsos → mãos/garras (abrem e fecham)
 *  quadris → joelhos → tornozelos (alto, pernas de bicho) → patas/dedos
 *  cauda (corrente com física)
 */
// (let: quando as peças desenhadas são carregadas, as medidas dos ossos passam a vir delas)
let COXA = MODO_RECORTE ? 24 : 21, CANELA = MODO_RECORTE ? 20 : 19, PATA = 13, DEDOS = 9, PE = 14;
let BRACO = MODO_RECORTE ? 16 : 16, ANTEBRACO = MODO_RECORTE ? 18 : 14;
let LOMBO = 15, PEITO = 17, PESC_LEN = 9;
let TRONCO = MODO_RECORTE ? 62 : LOMBO + PEITO, ALTURA_QUADRIL = MODO_RECORTE ? 44 : 50;
const ESC_CABECA = 1.75, PESCOCO = MODO_RECORTE ? 40 : 34;
const OMBRO_ALT = MODO_RECORTE ? 20 : 4;           // ombro fica X abaixo da base do pescoço
const OMBRO_F = MODO_RECORTE ? 22 : 5, OMBRO_T = MODO_RECORTE ? -16 : -5;
const QUADRIL_DX = MODO_RECORTE ? 13 : 2;          // pernas saem do quadril

// pose base (guarda de luta leve)
const RIG_BASE = {
  tronco: 0.1, cabeca: 0, qF: 0.25, jF: 0.3, qT: -0.22, jT: 0.25,
  uF: 0.55, cF: 1.75, uT: 0.35, cT: 1.6, corpoX: 0, corpoY: 0, salto: 0,
  giro: 0, ex: 1, ey: 1, orelha: 0, cauda: 0, pe: 0,
  curva: 0, pescoco: 0, pulsoF: 0, pulsoT: 0, garra: 0,   // coluna, pescoço, pulsos e garras
};
const CHAVES_RIG = Object.keys(RIG_BASE);

const misturar = (a, b, t) => { const o = {}; for (const k of CHAVES_RIG) o[k] = (a[k] ?? RIG_BASE[k]) + ((b[k] ?? RIG_BASE[k]) - (a[k] ?? RIG_BASE[k])) * t; return o; };
const comBase = (p) => ({ ...RIG_BASE, ...p });
const normAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/* ---------------- Poses de golpe (preparação → impacto) ---------------- */
const GOLPES_RIG = {
  soco1: {
    prep: { uF: 0.3, cF: 2.3, tronco: 0.0, qF: 0.35, jF: 0.5 },
    hit: { uF: 1.55, cF: 0.05, uT: 0.6, cT: 1.9, tronco: 0.32, cabeca: -0.1, qF: 0.55, jF: 0.35, qT: -0.45, jT: 0.2 },
  },
  soco2: { // chute frontal
    prep: { qF: 1.3, jF: 1.9, tronco: -0.05, uF: 0.9, cF: 1.6, uT: 0.2, cT: 1.4 },
    hit: { qF: 1.6, jF: 0.05, tronco: -0.28, cabeca: 0.1, uF: -0.5, cF: 1.1, uT: 1.3, cT: 1.0, qT: -0.1, jT: 0.3 },
  },
  soco3: { // chute giratório
    prep: { qF: 0.7, jF: 1.6, tronco: 0.2, uF: -0.6, cF: 1.2 },
    hit: { qF: 1.55, jF: 0.0, qT: 0.3, jT: 1.0, uF: -1.1, cF: 0.6, uT: 1.2, cT: 0.6, tronco: -0.1 },
    giro: 1,
  },
  aereo: { // voadora
    prep: { qF: 1.2, jF: 2.0, qT: 0.7, jT: 2.0, uF: 1.0, cF: 1.5 },
    hit: { qF: 1.4, jF: 0.05, qT: 0.7, jT: 2.1, tronco: -0.35, uF: -0.9, cF: 1.0, uT: 1.4, cT: 1.0, cabeca: 0.2 },
  },
  corridaAtq: { // carrinho
    prep: { tronco: 0.4, qF: 0.8, jF: 1.2 },
    hit: { tronco: -0.55, qF: 1.55, jF: 0.0, qT: 0.35, jT: 2.0, uF: -1.0, cF: 0.4, uT: -0.7, cT: 0.5, cabeca: 0.3 },
  },
  especial: { // giro glacial
    prep: { qF: 0.8, jF: 1.5, qT: -0.4, jT: 1.2, uF: -1.2, cF: 0.8, uT: -1.4, cT: 0.8, tronco: 0.35 },
    hit: { qF: 1.6, jF: 0.0, qT: 0.2, jT: 0.8, uF: 1.55, cF: 0.0, uT: -1.55, cT: 0.0, tronco: 0.0 },
    giro: 1,
  },
  projetil: { // lança de cristal (empurra com as duas mãos)
    prep: { uF: -0.5, cF: 2.1, uT: -0.7, cT: 2.1, tronco: -0.15, qF: 0.5, jF: 0.6 },
    hit: { uF: 1.55, cF: 0.0, uT: 1.45, cT: 0.1, tronco: 0.32, qF: 0.75, jF: 0.45, qT: -0.55, jT: 0.3, cabeca: -0.1 },
  },
  final: {
    prep: { tronco: 0.7, uF: -1.3, cF: 0.3, uT: -1.5, cT: 0.2, qF: 1.1, jF: 0.4, qT: -0.9, jT: 0.8 },
    hit: { tronco: 0.7, uF: 1.5, cF: 0.0, uT: -1.5, cT: 0.2, qF: 1.1, jF: 0.4, qT: -0.9, jT: 0.8 },
  },
};

/* ---------------- Alvo de pose para cada estado ---------------- */
function alvoRig(f) {
  let R = { ...RIG_BASE };
  let snapGiro = false, trava = true, rate = 16;
  const t = G.t, fase = f.faseRig || 0;
  const s = Math.sin(fase), c = Math.cos(fase);
  switch (f.est) {
    case 'idle': {
      const r = Math.sin(t * 3.2);
      Object.assign(R, {
        corpoY: r * 1.6, tronco: 0.1 + r * 0.025, cabeca: Math.sin(t * 1.1) * 0.06 - r * 0.02,
        uF: 0.55 + r * 0.05, cF: 1.75 - r * 0.05, uT: 0.35 - r * 0.04, cT: 1.6,
        orelha: Math.sin(t * 0.7) * 0.06, cauda: Math.sin(t * 1.6) * 0.08,
      });
      break;
    }
    case 'walk': {
      const v = Math.min(1, Math.abs(f.vx) / f.p.vel);
      Object.assign(R, {
        qF: 0.55 * s, jF: 0.12 + 1.0 * Math.max(0, c),
        qT: -0.55 * s, jT: 0.12 + 1.0 * Math.max(0, -c),
        uF: 0.15 - 0.55 * s, cF: 0.75, uT: 0.15 + 0.55 * s, cT: 0.75,
        tronco: 0.14 + 0.04 * Math.abs(c), cabeca: -0.06 * Math.abs(s),
        salto: -4 * Math.abs(c) * v, orelha: -0.1 + 0.08 * Math.abs(c), cauda: 0.05 * s,
      });
      R = misturar(RIG_BASE, R, v);
      rate = 22;
      break;
    }
    case 'corrida': {
      Object.assign(R, {
        qF: 1.0 * s, jF: 0.35 + 1.6 * Math.max(0, c),
        qT: -1.0 * s, jT: 0.35 + 1.6 * Math.max(0, -c),
        uF: -1.05 * s, cF: 1.55, uT: 1.05 * s, cT: 1.55,
        tronco: 0.45, cabeca: -0.3, salto: -11 * Math.abs(c),
        orelha: -0.55, cauda: -0.35 + 0.1 * s,
      });
      rate = 24;
      break;
    }
    case 'dash':
      Object.assign(R, { tronco: 0.68, cabeca: -0.4, qF: 1.15, jF: 0.35, qT: -0.95, jT: 0.9, uF: -1.35, cF: 0.3, uT: -1.55, cT: 0.2, orelha: -0.75, cauda: -0.5, ex: 1.12, ey: 0.93 });
      trava = f.solo; rate = 30;
      break;
    case 'freio': {
      const w = Math.sin(t * 26);
      Object.assign(R, { tronco: -0.38, cabeca: 0.18, qF: 0.9, jF: 0.05, qT: -0.1, jT: 1.15, uF: 1.5 + w * 0.25, cF: 0.35, uT: -0.6 - w * 0.25, cT: 0.5, orelha: 0.35, cauda: 0.3, corpoX: -4 });
      rate = 26;
      break;
    }
    case 'air': {
      trava = false; rate = 14;
      if (f.puloDuplo && f.vy > -250) {
        // cambalhota no pulo duplo
        const total = f.p.pulo * f.p.puloDuplo + 250;
        const k = clamp((f.p.pulo * f.p.puloDuplo - f.vy) / total, 0, 1);
        Object.assign(R, { qF: 1.4, jF: 2.2, qT: 1.2, jT: 2.2, uF: 1.2, cF: 2.0, uT: 1.0, cT: 2.0, tronco: 0.5, cabeca: 0.3, giro: -easeOut(k) * Math.PI * 2, corpoY: 12 });
        snapGiro = true;
      } else if (f.vy > 180) {
        Object.assign(R, { qF: 1.0, jF: 1.5, qT: -0.25, jT: 0.7, uF: 2.6, cF: 0.4, uT: -0.6, cT: 0.9, tronco: 0.12, cabeca: -0.2, orelha: -0.45, cauda: -0.2 });
      } else if (f.vy > -220) {
        Object.assign(R, { qF: 0.85, jF: 1.3, qT: 0.35, jT: 1.1, uF: 0.9, cF: 1.4, uT: 0.4, cT: 1.2, tronco: 0.22, orelha: 0.1 });
      } else {
        Object.assign(R, { qF: 0.4, jF: 0.35, qT: -0.2, jT: 0.55, uF: 1.35, cF: 0.6, uT: 1.7, cT: 0.5, tronco: 0.05, cabeca: 0.1, orelha: 0.55, cauda: 0.45 });
      }
      break;
    }
    case 'pouso': {
      const k = 1 - clamp(f.t / f.pousoDur, 0, 1);
      R = misturar(RIG_BASE, comBase({ qF: 0.75, jF: 1.5, qT: -0.25, jT: 1.4, tronco: 0.4, uF: 1.0, cF: 1.0, uT: 0.8, cT: 1.0, orelha: 0.4, ex: 1.06, ey: 0.94 }), k);
      rate = 30;
      break;
    }
    case 'defesa':
      Object.assign(R, { qF: 0.6, jF: 1.0, qT: -0.3, jT: 0.9, tronco: 0.28, cabeca: 0.22, uF: 1.25, cF: 1.95, uT: 1.15, cT: 2.05, orelha: -0.3 });
      rate = 26;
      break;
    case 'carga':
      Object.assign(R, { qF: 0.55, jF: 1.15, qT: -0.45, jT: 1.05, tronco: 0.3, cabeca: 0.1, uF: -0.55, cF: 0.9, uT: -0.75, cT: 0.8, corpoX: (Math.random() - 0.5) * 2, orelha: -0.35, cauda: 0.3 + Math.sin(t * 20) * 0.1 });
      break;
    case 'atk': {
      const a = f.atq, d = a.def, gp = GOLPES_RIG[a.nome] || GOLPES_RIG.soco1;
      const ini = d.ativo ? d.ativo[0] : (d.spawn || 0.1);
      const fim = d.ativo ? d.ativo[1] + 0.04 : ini + 0.12;
      const prep = comBase(gp.prep), hit = comBase(gp.hit);
      if (a.t < ini) R = misturar(RIG_BASE, prep, easeOut(a.t / ini));
      else if (a.t < fim) R = misturar(prep, hit, easeOut(clamp((a.t - ini) / Math.max(0.03, (fim - ini) * 0.4), 0, 1)));
      else R = misturar(hit, RIG_BASE, clamp((a.t - fim) / Math.max(0.05, d.dur - fim), 0, 1));
      if (gp.giro) {
        const k = clamp(a.t / (d.dur * 0.75), 0, 1);
        R.giro = -easeOut(k) * Math.PI * 2 * gp.giro; snapGiro = true;
        R.salto = -Math.sin(k * Math.PI) * 26;
      }
      if (d.aereo || !f.solo) trava = false;
      rate = 40;
      break;
    }
    case 'hurt':
      if (f.derrubado && !f.solo) {
        Object.assign(R, { giro: f.t * 12, qF: 0.8, jF: 1.0, qT: -0.5, jT: 1.2, uF: 2.4, cF: 0.5, uT: 2.0, cT: 0.5, orelha: 0.7, cauda: 0.6 });
        snapGiro = true; trava = false;
      } else {
        const k = Math.max(0, 1 - f.t / 0.35);
        Object.assign(R, { tronco: -0.5 * k, cabeca: -0.45 * k, uF: 2.2 * k + 0.5 * (1 - k), cF: 0.6, uT: 1.9 * k, cT: 0.5, qF: 0.35, jF: 0.6, qT: -0.3, jT: 0.55, orelha: 0.6 * k, corpoX: -6 * k });
        rate = 30;
      }
      break;
    case 'caido': case 'ko':
      if (f.solo) {
        Object.assign(R, { giro: 1.5708, corpoY: 36, qF: 0.5, jF: 0.6, qT: 0.2, jT: 0.4, uF: 2.0, cF: 0.4, uT: 1.6, cT: 0.6, tronco: 0, cabeca: 0.2, orelha: 0.5 });
        if (f.t < 0.3) R.salto = -Math.sin(f.t / 0.3 * Math.PI) * 12;
      } else {
        Object.assign(R, { giro: f.t * 10, uF: 2.4, cF: 0.4, uT: 2.0, cT: 0.4, qF: 0.6, jF: 1.0 });
        snapGiro = true;
      }
      trava = false;
      break;
    case 'levantar': {
      const k = easeOut(clamp(f.t / 0.25, 0, 1));
      R = misturar(comBase({ giro: 1.5708, corpoY: 36, qF: 0.5, jF: 0.6, uF: 2.0, cF: 0.4 }), comBase({ qF: 0.7, jF: 1.4, qT: -0.3, jT: 1.3, tronco: 0.4 }), k);
      R.salto = -Math.sin(k * Math.PI) * 16;
      trava = k > 0.6; rate = 30;
      break;
    }
    case 'provocar': {
      const w = Math.sin(f.t * 14);
      Object.assign(R, { uF: 1.35, cF: 1.0 + w * 0.6, uT: -0.25, cT: 2.4, tronco: -0.08, cabeca: 0.15 + w * 0.03, orelha: w * 0.15, qF: 0.35, jF: 0.15, qT: -0.25, jT: 0.2, cauda: 0.3 + w * 0.15 });
      break;
    }
    case 'vitoria': {
      const h = Math.abs(Math.sin(f.t * 7));
      Object.assign(R, { uF: 2.9, cF: 0.2, uT: 0.3, cT: 1.9, tronco: -0.1, cabeca: -0.25, salto: -h * 26, qF: 0.4 + h * 0.5, jF: 0.6 + h * 0.8, qT: -0.1, jT: 0.4 + h * 0.6, orelha: 0.2, cauda: 0.5 });
      break;
    }
  }
  // coluna (curvatura), pescoço e garras: somados à pose conforme o estado
  const a = f.atq;
  const extra = {
    idle: { curva: 0.04 + Math.sin(t * 3.2) * 0.03, pescoco: -0.05 },
    walk: { curva: 0.08, pescoco: -0.12, garra: 0.15 },
    corrida: { curva: 0.3, pescoco: -0.5, garra: 0.55 },
    dash: { curva: 0.38, pescoco: -0.55, garra: 1 },
    freio: { curva: -0.28, pescoco: 0.3, garra: 1 },
    defesa: { curva: 0.32, pescoco: 0.2 },
    carga: { curva: 0.38, pescoco: 0.25, garra: 1, pulsoF: 0.6, pulsoT: 0.6 },
    hurt: { curva: -0.38, pescoco: -0.45, garra: 1 },
    pouso: { curva: 0.32, pescoco: 0.15, garra: 0.6 },
    provocar: { curva: -0.12, pescoco: 0.1, garra: 0.5 + Math.sin(f.t * 14) * 0.5 },
    vitoria: { curva: -0.18, pescoco: -0.25 },
    air: { curva: f.vy > 0 ? -0.12 : 0.18, pescoco: f.vy > 0 ? -0.2 : 0.1, garra: f.vy < -200 ? 0.9 : 0.25 },
    atk: a ? {
      curva: 0.15, pescoco: -0.12,
      garra: a.nome === 'projetil' || a.nome === 'especial' || a.nome === 'aereo' ? 1 : 0,
      pulsoF: a.nome === 'projetil' ? -0.5 : 0, pulsoT: a.nome === 'projetil' ? -0.5 : 0,
    } : null,
  }[f.est];
  if (extra) for (const k in extra) R[k] = (R[k] || 0) + extra[k];
  R.garra = clamp(R.garra, 0, 1);
  return { R, snapGiro, trava, rate };
}

/* ---------------- Esqueleto → posições das juntas ---------------- */
function juntasRig(r) {
  const add = (p, d, l) => ({ x: p.x + d.x * l, y: p.y + d.y * l });
  const dirCima = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });   // "para cima", inclinado a
  const dirBaixo = (a) => ({ x: Math.sin(a), y: Math.cos(a) });   // "para baixo", a para frente
  const H = { x: r.corpoX, y: -ALTURA_QUADRIL + r.corpoY };       // quadril
  const curva = r.curva || 0, pesc = r.pescoco || 0;
  const a1 = r.tronco, a2 = r.tronco + curva, a3 = a2 + pesc;
  if (MODO_RECORTE) {
    // modo recorte usa a coluna reta antiga
    const up0 = dirCima(a1), fr0 = { x: Math.cos(a1), y: Math.sin(a1) };
    const C0 = add(H, up0, TRONCO);
    const S0 = add(H, up0, TRONCO - OMBRO_ALT);
    const ah0 = a1 * 0.45 + r.cabeca;
    const cab0 = { x: C0.x + Math.sin(ah0) * PESCOCO + fr0.x * 4, y: C0.y - Math.cos(ah0) * PESCOCO + fr0.y * 4, a: ah0 };
    const perna0 = (q, j, dx) => {
      const Q = add(H, fr0, dx), K = add(Q, dirBaixo(q), COXA), s = q - j, A = add(K, dirBaixo(s), CANELA);
      const pa = clamp(-s * 0.35 + r.pe, -0.7, 0.7);
      const T = add(A, { x: Math.cos(pa), y: Math.sin(pa) }, PE);
      return { Q, K, A, B: A, T };
    };
    const braco0 = (u, cc, dx) => { const O = add(S0, fr0, dx), E = add(O, dirBaixo(u), BRACO), W = add(E, dirBaixo(u + cc), ANTEBRACO); return { O, E, W, M: W, h: u + cc }; };
    return { H, M: H, C: C0, N: C0, S: S0, up: up0, fr: fr0, cab: cab0, pF: perna0(r.qF, r.jF, QUADRIL_DX), pT: perna0(r.qT, r.jT, -QUADRIL_DX), bF: braco0(r.uF, r.cF, OMBRO_F), bT: braco0(r.uT, r.cT, OMBRO_T) };
  }
  // coluna em 2 partes: lombo (quadril→meio) e peito (meio→base do pescoço), com curvatura
  const M = add(H, dirCima(a1), LOMBO);
  const C = add(M, dirCima(a2), PEITO);
  const N = add(C, dirCima(a3), PESC_LEN);                         // topo do pescoço
  const up = dirCima(a2), fr = { x: Math.cos(a2), y: Math.sin(a2) };
  const frH = { x: Math.cos(a1), y: Math.sin(a1) };
  const ah = a3 + r.cabeca;
  const cab = { ...add(N, dirCima(ah), 17), a: ah };               // centro da cabeça
  const S = add(M, up, PEITO - OMBRO_ALT);                         // altura dos ombros
  // pernas de bicho: coxa → joelho → canela → tornozelo alto → pata → dedos
  const perna = (q, j, t, dx) => {
    const Q = add(H, frH, dx);
    const K = add(Q, dirBaixo(q), COXA);
    const s = q - j;                       // canela vai para trás
    const A = add(K, dirBaixo(s), CANELA); // tornozelo (calcanhar alto)
    const m = s + t;                       // pata vai para frente
    const B = add(A, dirBaixo(m), PATA);
    const pa = clamp(-m * 0.3 + r.pe, -0.6, 0.6);
    const T = add(B, { x: Math.cos(pa), y: Math.sin(pa) }, DEDOS);
    return { Q, K, A, B, T };
  };
  // braços: ombro → cotovelo → pulso → mão (pulso dobra; garras abrem/fecham)
  const braco = (u, cc, p, dx) => {
    const O = add(S, fr, dx);
    const E = add(O, dirBaixo(u), BRACO);
    const v = u + cc;
    const W = add(E, dirBaixo(v), ANTEBRACO);
    const h = v + (p || 0);
    return { O, E, W, M: add(W, dirBaixo(h), 6), h };
  };
  // as poses antigas continuam valendo: o joelho dobra um pouco mais e o tornozelo compensa
  const jF = r.jF + 0.55, jT = r.jT + 0.55;
  return {
    H, M, C, N, S, up, fr, cab,
    pF: perna(r.qF, jF, 0.35 + jF * 0.75, QUADRIL_DX), pT: perna(r.qT, jT, 0.35 + jT * 0.75, -QUADRIL_DX),
    bF: braco(r.uF, r.cF, r.pulsoF, OMBRO_F), bT: braco(r.uT, r.cT, r.pulsoT, OMBRO_T),
  };
}

function deslocarJuntas(J, dy) {
  const vistos = new Set([J.up, J.fr]);
  const mover = (o) => {
    if (!o || typeof o !== 'object' || vistos.has(o)) return;
    vistos.add(o);
    if (typeof o.x === 'number' && typeof o.y === 'number') o.y += dy;
    for (const k in o) if (o[k] && typeof o[k] === 'object') mover(o[k]);
  };
  mover(J);
}

/* ---------------- Atualização (pose com mola + física) ---------------- */
function atualizarBoneco(f, dt) {
  dt = clamp(dt || 0.016, 0.001, 0.05);
  // fase da passada acompanha a distância percorrida (pés não patinam)
  if (f.est === 'walk' || f.est === 'corrida') {
    const passada = f.est === 'corrida' ? 250 : 125;
    f.faseRig = (f.faseRig || 0) + Math.abs(f.vx) * dt / passada * Math.PI * 2;
  }
  const { R, snapGiro, trava, rate } = alvoRig(f);
  if (!f.rig) f.rig = { ...R };
  const k = 1 - Math.exp(-rate * dt);
  for (const ch of CHAVES_RIG) {
    if (ch === 'giro') {
      if (snapGiro) f.rig.giro = R.giro;
      else { f.rig.giro = normAng(f.rig.giro); f.rig.giro += normAng(R.giro - f.rig.giro) * k; }
    } else f.rig[ch] += (R[ch] - f.rig[ch]) * k;
  }
  // trava os pés no chão: desce o corpo até o pé mais baixo encostar
  const J = juntasRig(f.rig);
  const pe = Math.max(J.pF.B.y, J.pF.T.y, J.pT.B.y, J.pT.T.y) + 5;
  const alvoShift = trava ? -pe : 0;
  f.rigShift = f.rigShift === undefined ? alvoShift : f.rigShift + (alvoShift - f.rigShift) * (1 - Math.exp(-28 * dt));
  deslocarJuntas(J, f.rigShift + f.rig.salto);
  f.rigJ = J;
  simularCorrentes(f, J, dt);
}

// converte ponto local do boneco → mundo (mesma ordem de transformação do desenho)
function localParaMundo(f, p, J) {
  const r = f.rig;
  const cx = J.H.x, cy = J.H.y;
  const cs = Math.cos(r.giro), sn = Math.sin(r.giro);
  const dx = p.x - cx, dy = p.y - cy;
  const rx = cx + dx * cs - dy * sn, ry = cy + dx * sn + dy * cs;
  return { x: f.x + f.face * rx * r.ex * RIG_K, y: CHAO - f.y + ry * r.ey * RIG_K };
}

// inverso: ponto do mundo → local do boneco
function mundoParaLocal(f, p, J) {
  const r = f.rig;
  const rx = (p.x - f.x) / (f.face * r.ex * RIG_K), ry = (p.y - (CHAO - f.y)) / (r.ey * RIG_K);
  const cx = J.H.x, cy = J.H.y;
  const cs = Math.cos(-r.giro), sn = Math.sin(-r.giro);
  const dx = rx - cx, dy = ry - cy;
  return { x: cx + dx * cs - dy * sn, y: cy + dx * sn + dy * cs };
}

function novaCorrente(n, x, y) { return Array.from({ length: n }, () => ({ x, y, ox: x, oy: y })); }

function simular(cad, ax, ay, alvos, rigidez, grav, seg, dt, amort) {
  const d2 = dt * dt;
  cad[0].x = ax; cad[0].y = ay; cad[0].ox = ax; cad[0].oy = ay;
  for (let i = 1; i < cad.length; i++) {
    const p = cad[i];
    const vx = (p.x - p.ox) * amort, vy = (p.y - p.oy) * amort;
    p.ox = p.x; p.oy = p.y;
    p.x += vx; p.y += vy + grav * d2;
    if (alvos) { p.x += (alvos[i].x - p.x) * rigidez; p.y += (alvos[i].y - p.y) * rigidez; }
  }
  for (let it = 0; it < 4; it++) {
    for (let i = 1; i < cad.length; i++) {
      const a = cad[i - 1], b = cad[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const e = (d - seg) / d;
      b.x -= dx * e; b.y -= dy * e;
    }
  }
}

function simularCorrentes(f, J, dt) {
  const r = f.rig;
  // ---- cauda: volta sempre para a forma curvada (rígida), mas balança com o movimento
  const base = MODO_RECORTE
    ? { x: J.H.x - J.fr.x * 32, y: J.H.y - J.fr.y * 32 + 2 }
    : { x: J.H.x - 18, y: J.H.y + 4 };
  const alvosL = [base];
  let p = base;
  for (let i = 1; i < 8; i++) {
    const th = (MODO_RECORTE ? 0.1 + i * 0.04 : 0.15 + i * 0.2) + r.cauda + Math.sin(G.t * 2.2 + i * 0.6) * 0.06;
    p = { x: p.x - Math.cos(th) * 8.5, y: p.y - Math.sin(th) * 8.5 };
    alvosL.push(p);
  }
  const alvosC = alvosL.map((q) => localParaMundo(f, q, J));
  if (!f.cauda || Math.hypot(f.cauda[0].x - alvosC[0].x, f.cauda[0].y - alvosC[0].y) > 120) {
    f.cauda = alvosC.map((q) => ({ x: q.x, y: q.y, ox: q.x, oy: q.y }));
  }
  simular(f.cauda, alvosC[0].x, alvosC[0].y, alvosC, 0.22, 500, 8.5 * RIG_K, dt, 0.9);

  // ---- cachecol: duas pontas soltas, quase sem rigidez, voam com o movimento
  if (!f.cachecol) f.cachecol = [null, null];
  for (let s = 0; s < 2; s++) {
    const ancL = MODO_RECORTE
      ? { x: J.C.x - J.fr.x * 34, y: J.C.y - J.fr.y * 34 + 4 + s * 3 }
      : { x: J.C.x - J.fr.x * 8 - J.up.x * 2, y: J.C.y - J.fr.y * 8 + 5 + s * 4 };
    const anc = localParaMundo(f, ancL, J);
    const alvos = [];
    for (let i = 0; i < 9; i++) {
      const fl = Math.sin(G.t * 9 + i * 0.8 + s * 2) * 2.5 * (i / 8);
      alvos.push(localParaMundo(f, { x: ancL.x - i * 6.5, y: ancL.y + i * 2.2 + fl }, J));
    }
    if (!f.cachecol[s] || Math.hypot(f.cachecol[s][0].x - anc.x, f.cachecol[s][0].y - anc.y) > 120) {
      f.cachecol[s] = alvos.map((q) => ({ x: q.x, y: q.y, ox: q.x, oy: q.y }));
    }
    simular(f.cachecol[s], anc.x, anc.y, alvos, 0.035, 1300, (s ? 5.6 : 6.5) * RIG_K, dt, 0.93);
  }
}

/* ---------------- Desenho ---------------- */
function linha(g, a, b, w, cor) {
  g.strokeStyle = cor; g.lineWidth = w;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
}
function bola(g, p, r, cor) { g.fillStyle = cor; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); }

// desenha um membro (contorno primeiro, depois a cor) → juntas lisas, sem costura
function membro(g, pts, larguras, cores, pal, extras) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) linha(g, pts[i], pts[i + 1], larguras[i] + 5, pal.contorno);
  if (extras) extras(true);
  for (let i = 0; i < pts.length - 1; i++) linha(g, pts[i], pts[i + 1], larguras[i], cores[i]);
  if (extras) extras(false);
}

function desenharPerna(g, P, H, pal, atras) {
  const az = atras ? pal.azulEsc : pal.azul, br = atras ? pal.brancoEsc : pal.branco;
  // coxa grossa → canela → pata (tornozelo alto, perna de bicho)
  membro(g, [P.Q || H, P.K, P.A, P.B], [21, 15, 12], [az, az, br], pal, (contorno) => {
    // dedos/pata branca
    if (contorno) { linha(g, P.B, P.T, 17, pal.contorno); bola(g, P.T, 9, pal.contorno); }
    else { linha(g, P.B, P.T, 12, br); bola(g, P.T, 6.5, br); }
  });
  // garrinhas do pé
  if (!atras) {
    g.strokeStyle = pal.contorno; g.lineWidth = 1.6;
    for (const d of [-3, 0, 3]) { g.beginPath(); g.moveTo(P.T.x + 4, P.T.y + d); g.lineTo(P.T.x + 8, P.T.y + d + 1); g.stroke(); }
  }
}

function desenharBraco(g, B, pal, atras, garra) {
  const az = atras ? pal.azulEsc : pal.azul, br = atras ? pal.brancoEsc : pal.branco;
  const ab = clamp(garra || 0, 0, 1);
  membro(g, [B.O, B.E, B.W], [14, 12], [az, az], pal, (contorno) => {
    // mão: luva branca. Fechada = punho redondo; aberta = palma menor + garras abertas
    const raio = 9.5 - ab * 2.5;
    const centro = { x: B.W.x + Math.sin(B.h) * 3, y: B.W.y + Math.cos(B.h) * 3 };
    if (contorno) bola(g, centro, raio + 2.5, pal.contorno); else bola(g, centro, raio, br);
    if (ab > 0.05) {
      for (const s of [-0.55, 0, 0.55]) {
        const a = B.h + s * ab;
        const ponta = { x: centro.x + Math.sin(a) * (raio + 7 * ab), y: centro.y + Math.cos(a) * (raio + 7 * ab) };
        linha(g, centro, ponta, contorno ? 6.5 : 3.5, contorno ? pal.contorno : br);
        if (!contorno) bola(g, ponta, 1.4, pal.contorno);
      }
    }
  });
}

function desenharTronco(g, J, pal) {
  const { H, C, fr, up } = J;
  const M = J.M || H, N = J.N || C;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // pescoço + coluna em 2 partes (lombo fino, peito largo)
  const caminho = () => { g.beginPath(); g.moveTo(H.x, H.y); g.lineTo(M.x, M.y); g.lineTo(C.x, C.y); g.stroke(); };
  g.strokeStyle = pal.contorno; g.lineWidth = 20; g.beginPath(); g.moveTo(C.x, C.y); g.lineTo(N.x, N.y); g.stroke();
  g.lineWidth = 42; caminho();
  bola(g, H, 20, pal.contorno); bola(g, C, 21, pal.contorno);
  g.strokeStyle = pal.azul; g.lineWidth = 15; g.beginPath(); g.moveTo(C.x, C.y); g.lineTo(N.x, N.y); g.stroke();
  g.lineWidth = 37; caminho();
  bola(g, H, 17.5, pal.azul); bola(g, C, 18.5, pal.azul);
  // peito/barriga brancos (acompanham a curva da coluna)
  const frH = { x: Math.cos(Math.atan2(M.y - H.y, M.x - H.x) + Math.PI / 2), y: Math.sin(Math.atan2(M.y - H.y, M.x - H.x) + Math.PI / 2) };
  const fH = { x: -frH.x, y: -frH.y };
  const b0 = { x: H.x + fH.x * 8, y: H.y + fH.y * 8 };
  const bm = { x: M.x + (fH.x + fr.x) * 4.5, y: M.y + (fH.y + fr.y) * 4.5 };
  const b1 = { x: C.x + fr.x * 9 - up.x * 2, y: C.y + fr.y * 9 - up.y * 2 };
  g.strokeStyle = pal.branco; g.lineWidth = 19;
  g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(bm.x, bm.y); g.lineTo(b1.x, b1.y); g.stroke();
  // brilho nas costas
  const c0 = { x: H.x - fr.x * 12 + up.x * 8, y: H.y - fr.y * 12 + up.y * 8 };
  const c1 = { x: C.x - fr.x * 12 - up.x * 6, y: C.y - fr.y * 12 - up.y * 6 };
  linha(g, c0, c1, 6, pal.azulClaro);
  // tufo de pelo branco no peito (espetado para baixo)
  const p0 = { x: C.x + fr.x * 4, y: C.y + fr.y * 4 };
  g.beginPath();
  g.moveTo(p0.x - fr.x * 10, p0.y - fr.y * 10);
  [[14, 6], [6, 10], [12, 16], [2, 15], [6, 22], [-4, 14], [-8, 6]].forEach(([a, b]) => g.lineTo(p0.x + fr.x * a - up.x * b, p0.y + fr.y * a - up.y * b));
  g.closePath();
  g.fillStyle = pal.branco; g.fill(); g.lineWidth = 2.4; g.strokeStyle = pal.contorno; g.stroke();
}

function orelhaPath(g, bx, by, ang, comp, cor, corIn, pal) {
  g.save();
  g.translate(bx, by); g.rotate(ang);
  // orelha larga e pontuda, com pelo branco espetado por dentro
  g.beginPath(); g.moveTo(-11, 4); g.quadraticCurveTo(-9, -comp * 0.6, 1, -comp); g.quadraticCurveTo(9, -comp * 0.5, 11, 4); g.closePath();
  g.fillStyle = cor; g.fill(); g.lineWidth = 2.6; g.strokeStyle = pal.contorno; g.stroke();
  g.beginPath(); g.moveTo(-6, 2); g.lineTo(-3, -comp * 0.35); g.lineTo(-1, -comp * 0.25); g.lineTo(1, -comp * 0.7); g.lineTo(3, -comp * 0.3); g.lineTo(5, -comp * 0.38); g.lineTo(6, 2); g.closePath();
  g.fillStyle = corIn; g.fill();
  g.restore();
}

function desenharCabeca(g, x, y, ang, pal, orelha, expr, escala = ESC_CABECA) {
  g.save();
  g.translate(x, y); g.rotate(ang); g.scale(escala, escala);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const forma = (fn, cor, lw = 2.6) => { g.beginPath(); fn(); g.fillStyle = cor; g.fill(); g.lineWidth = lw; g.strokeStyle = pal.contorno; g.stroke(); };
  const ex = expr || 'neutro';

  // orelha de trás (grande, inclinada para trás)
  orelhaPath(g, -11, -11, -0.6 + orelha * 0.7, 34, pal.azulEsc, pal.brancoEsc, pal);
  // tufos espetados atrás da cabeça
  forma(() => { g.moveTo(-12, -12); g.lineTo(-28, -15); g.lineTo(-19, -5); g.lineTo(-30, -1); g.lineTo(-17, 4); g.lineTo(-8, 4); g.closePath(); }, pal.azul);
  // cabeça redonda e grande
  forma(() => g.ellipse(0, -1, 21, 19.5, 0, 0, Math.PI * 2), pal.azul);
  // brilho na cabeça
  g.fillStyle = pal.azulClaro; g.beginPath(); g.ellipse(-9, -10, 6, 3.5, -0.5, 0, Math.PI * 2); g.fill();
  // tufos brancos das bochechas, espetados para trás
  forma(() => { g.moveTo(0, 5); g.lineTo(-23, 4); g.lineTo(-13, 10); g.lineTo(-26, 14); g.lineTo(-12, 17); g.lineTo(-19, 23); g.lineTo(2, 18); g.lineTo(7, 10); g.closePath(); }, pal.branco);
  // focinho curtinho e fofo (branco embaixo, ponte azul em cima)
  forma(() => { g.moveTo(8, -1); g.quadraticCurveTo(23, -3, 28, 4); g.quadraticCurveTo(26, 12, 13, 13); g.quadraticCurveTo(5, 10, 8, -1); g.closePath(); }, pal.branco);
  forma(() => { g.moveTo(8, -6); g.quadraticCurveTo(21, -7, 27.5, 1.5); g.quadraticCurveTo(18, 0, 9, 2); g.closePath(); }, pal.azul, 2);
  g.fillStyle = pal.nariz; g.beginPath(); g.ellipse(27.5, 2.5, 3.3, 2.6, 0, 0, Math.PI * 2); g.fill();
  bola(g, { x: 26.5, y: 1.6 }, 0.9, '#ffffff');
  // franjinha espetada na testa
  forma(() => { g.moveTo(-9, -16); g.lineTo(0, -27); g.lineTo(-1, -18); g.lineTo(10, -24); g.lineTo(6, -14); g.closePath(); }, pal.azul, 2);
  // marca de cristal
  forma(() => { g.moveTo(-6, -15); g.lineTo(-2, -10); g.lineTo(-6, -5); g.lineTo(-10, -10); g.closePath(); }, pal.cristal, 1.5);

  // olho grande estilo anime
  const fechado = ex === 'cansado' || ex === 'piscar';
  if (fechado) {
    g.strokeStyle = pal.contorno; g.lineWidth = 3;
    g.beginPath(); g.arc(6, ex === 'cansado' ? -1 : -3, 6, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
  } else {
    const grande = ex === 'surpreso';
    forma(() => g.ellipse(6, -3, grande ? 8.5 : 7.5, grande ? 10.5 : 9.5, 0, 0, Math.PI * 2), '#ffffff', 2);
    g.save();
    g.beginPath(); g.ellipse(6, -3, grande ? 8.5 : 7.5, grande ? 10.5 : 9.5, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = pal.iris; g.beginPath(); g.ellipse(8.5, -2, grande ? 4 : 5.4, grande ? 5.5 : 7.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.azulEsc; g.beginPath(); g.ellipse(8.5, -6.5, 5.6, 3.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.contorno; g.beginPath(); g.ellipse(9.2, -1.5, grande ? 1.6 : 2.6, grande ? 2.6 : 4, 0, 0, Math.PI * 2); g.fill();
    bola(g, { x: 6.2, y: -6.5 }, 2.3, '#ffffff');
    bola(g, { x: 11, y: 2 }, 1.2, '#ffffff');
    // pálpebra: confiante = meio fechado; determinado/bravo = um pouco fechado
    const palp = ex === 'confiante' ? 7 : ex === 'bravo' ? 4.5 : ex === 'determinado' ? 3 : 0;
    if (palp) { g.fillStyle = pal.azul; g.fillRect(-3, -14, 20, palp + 1.5); }
    g.restore();
    // cílio/contorno de cima, grosso, com pontinha
    const yl = (ex === 'confiante' ? 7 : ex === 'bravo' ? 4.5 : ex === 'determinado' ? 3 : 0);
    g.strokeStyle = pal.contorno; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(-1.5, -10 + yl); g.quadraticCurveTo(6, -14 + yl, 13.5, -10 + yl * 0.8); g.lineTo(16, -12.5 + yl * 0.8); g.stroke();
  }
  // sobrancelha curtinha
  const sob = {
    neutro: [[0, -16], [11, -16.5]], piscar: [[0, -16], [11, -16.5]], determinado: [[0, -17], [12, -13.5]],
    bravo: [[-1, -19], [12, -12.5]], confiante: [[0, -15], [11, -16.5]], surpreso: [[1, -21], [12, -20]], cansado: [[0, -13], [11, -15.5]],
  }[ex] || [[0, -16], [11, -16.5]];
  linha(g, { x: sob[0][0], y: sob[0][1] }, { x: sob[1][0], y: sob[1][1] }, 2.6, pal.contorno);
  // bochecha rosada
  g.fillStyle = 'rgba(255,120,160,.45)'; g.beginPath(); g.ellipse(14, 7.5, 4, 2.2, 0, 0, Math.PI * 2); g.fill();
  // boca (embaixo do focinho)
  g.strokeStyle = pal.contorno; g.lineWidth = 1.8;
  if (ex === 'bravo' || ex === 'cansado' || ex === 'surpreso') {
    g.fillStyle = '#5a1020';
    g.beginPath();
    if (ex === 'surpreso') g.ellipse(20, 12, 2.6, 3, 0, 0, Math.PI * 2);
    else { g.moveTo(14, 10.5); g.lineTo(25, 9); g.quadraticCurveTo(22, ex === 'bravo' ? 17 : 15, 15, 14); g.closePath(); }
    g.fill(); g.stroke();
    if (ex === 'bravo') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(21.5, 9.6); g.lineTo(23.8, 9.3); g.lineTo(22.5, 12.3); g.closePath(); g.fill(); }
  } else if (ex === 'confiante') {
    g.beginPath(); g.moveTo(15, 11.5); g.quadraticCurveTo(20, 13.5, 25, 9); g.stroke(); // sorrisinho de lado
  } else {
    g.beginPath(); g.moveTo(16, 11.5); g.quadraticCurveTo(19, 13.5, 21, 11.5); g.quadraticCurveTo(23, 13.5, 25.5, 11); g.stroke(); // boquinha "w"
  }
  // orelha da frente (grande)
  orelhaPath(g, 3, -13, -0.3 + orelha * 0.7, 37, pal.azul, pal.branco, pal);
  // sinais da expressão (como nas fichas): faíscas = bravo, "!" = surpreso, gota = cansado
  if (ex === 'bravo') {
    g.strokeStyle = '#ffcf4a'; g.lineWidth = 2.4;
    for (const [a, b] of [[[20, -26], [25, -33]], [[26, -22], [33, -26]], [[14, -29], [16, -36]]]) { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  } else if (ex === 'surpreso') {
    g.fillStyle = '#ffcf4a'; g.strokeStyle = pal.contorno; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(20, -42); g.lineTo(26, -42); g.lineTo(24, -28); g.lineTo(22, -28); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(23, -24, 2.2, 0, Math.PI * 2); g.fill(); g.stroke();
  } else if (ex === 'cansado') {
    g.fillStyle = '#bfe8ff'; g.strokeStyle = pal.contorno; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-14, -12); g.quadraticCurveTo(-10, -4, -14, -2); g.quadraticCurveTo(-18, -4, -14, -12); g.fill(); g.stroke();
  }
  g.restore();
}

// expressão do rosto conforme o que ela está fazendo (baseado na ficha de expressões)
function expressaoDe(obj) {
  switch (obj.est) {
    case 'atk': return 'bravo';
    case 'corrida': case 'dash': case 'freio': case 'carga': case 'defesa': return 'determinado';
    case 'provocar': case 'vitoria': return 'confiante';
    case 'hurt': return 'surpreso';
    case 'caido': case 'ko': case 'levantar': return 'cansado';
    case 'idle': {
      // pisca de vez em quando
      const t = (G.t + (obj.x || 0) * 0.01) % 3.4;
      return t < 0.12 ? 'piscar' : 'neutro';
    }
    default: return obj.est === 'walk' || obj.est === 'air' ? 'determinado' : 'neutro';
  }
}

function desenharCauda(g, pts, pal) {
  // cauda fofa: bolinhas ao longo da curva, ponta branca
  const n = pts.length;
  const raio = (i) => 6 + Math.sin((i / (n - 1)) * Math.PI) * 6 + (i < 2 ? 0 : 1);
  for (let i = 0; i < n; i++) bola(g, pts[i], raio(i) + 2.6, pal.contorno);
  for (let i = 0; i < n; i++) bola(g, pts[i], raio(i), i >= n - 3 ? pal.branco : pal.azul);
  for (let i = 2; i < n - 3; i++) bola(g, { x: pts[i].x, y: pts[i].y - 2 }, raio(i) * 0.4, pal.azulClaro);
}

function desenharFita(g, pts, pal) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const tracar = () => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.stroke(); };
  g.strokeStyle = pal.contorno; g.lineWidth = 10; tracar();
  g.strokeStyle = pal.vermelho; g.lineWidth = 6.5; tracar();
  g.strokeStyle = pal.vermelhoEsc; g.lineWidth = 2;
  g.beginPath(); g.moveTo(pts[1].x, pts[1].y + 2); for (let i = 2; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y + 2); g.stroke();
}

/**
 * Desenha o boneco no contexto principal (já com a câmera aplicada).
 * obj: { x, y, face, rig, rigJ, cauda, cachecol }   opts: { branco, alpha, escala, semCorrentes }
 */
/* ---------------- Modo recorte: pedaços do desenho original presos nos ossos ----------------
 * Coordenadas em pixels do quadro 0 (parada) da folha da Geada (151x216).
 * Cada peça: polígono que recorta a parte, pivô (junta) e ponta (para medir o ângulo de repouso).
 */
const PECAS_GEADA = {
  cachecol: { piv: [56, 112], ponta: [4, 116], poly: [[0, 96], [60, 100], [62, 126], [0, 132]] },
  cauda:    { piv: [50, 172], ponta: [14, 166], poly: [[0, 140], [46, 150], [58, 170], [50, 188], [0, 190]] },
  bracoT:   { piv: [74, 128], ponta: [66, 140], poly: [[62, 120], [84, 122], [80, 142], [60, 142]] },
  antebT:   { piv: [66, 140], ponta: [61, 150], poly: [[44, 134], [80, 136], [78, 164], [46, 166]] },
  coxaT:    { piv: [72, 172], ponta: [54, 190], poly: [[50, 164], [86, 166], [76, 188], [58, 196], [46, 184]] },
  canelaT:  { piv: [54, 190], ponta: [38, 204], poly: [[36, 182], [66, 184], [60, 200], [58, 216], [10, 216], [14, 198]] },
  tronco:   { piv: [85, 170], ponta: [92, 108], poly: [[56, 96], [130, 96], [126, 122], [112, 124], [108, 178], [78, 178], [76, 128], [58, 126]] },
  coxaF:    { piv: [98, 172], ponta: [112, 190], poly: [[90, 164], [114, 164], [122, 186], [106, 196], [92, 182]] },
  canelaF:  { piv: [112, 190], ponta: [124, 204], poly: [[100, 182], [124, 180], [151, 198], [151, 216], [106, 216], [100, 200]] },
  cabeca:   { piv: [92, 104], ponta: [95, 64], poly: [[18, 0], [151, 0], [151, 98], [128, 100], [100, 108], [66, 104], [40, 100], [18, 94]] },
  bracoF:   { piv: [114, 128], ponta: [124, 142], poly: [[106, 118], [132, 120], [134, 148], [116, 150], [106, 136]] },
  antebF:   { piv: [124, 142], ponta: [140, 157], poly: [[112, 138], [138, 136], [151, 148], [151, 172], [126, 172], [112, 154]] },
};
const angBaixo = (dx, dy) => Math.atan2(dx, dy); // ângulo a partir de "para baixo", positivo = para frente

function renderRecorte(obj, opts) {
  const fr = FOLHAS.geada.frames[0];
  const img = opts.branco ? frameBranco(fr) : fr.c;
  const r = obj.rig, J = obj.rigJ;
  const esc = opts.escala || 1;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  const base = ctx.getTransform();
  const local = () => {
    ctx.setTransform(base);
    ctx.translate(obj.x, CHAO - obj.y);
    ctx.scale(obj.face * r.ex * RIG_K * esc, r.ey * RIG_K * esc);
    ctx.translate(J.H.x, J.H.y); ctx.rotate(r.giro); ctx.translate(-J.H.x, -J.H.y);
  };
  // desenha a peça com o pivô em P e a direção pivô→ponta apontando para "alvo" (pontos locais)
  const peca = (nome, P, alvo) => {
    const pc = PECAS_GEADA[nome];
    const angS = angBaixo(pc.ponta[0] - pc.piv[0], pc.ponta[1] - pc.piv[1]);
    const angT = angBaixo(alvo.x - P.x, alvo.y - P.y);
    ctx.save();
    local();
    ctx.translate(P.x, P.y);
    ctx.rotate(angS - angT);
    ctx.beginPath();
    pc.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x - pc.piv[0], y - pc.piv[1]) : ctx.moveTo(x - pc.piv[0], y - pc.piv[1])));
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, -pc.piv[0], -pc.piv[1]);
    ctx.restore();
  };
  // cachecol e cauda seguem as correntes de física (convertidas para o espaço local)
  const corrente = (cad, i0, i1, nomeFallback) => {
    if (cad && !opts.semCorrentes && obj.rig === r && obj.cauda) {
      const a = mundoParaLocal(obj, cad[i0], J), b = mundoParaLocal(obj, cad[i1], J);
      return [a, b];
    }
    // sem física (rastro): usa a direção de repouso da peça
    const pc = PECAS_GEADA[nomeFallback];
    const P = nomeFallback === 'cauda' ? { x: J.H.x - J.fr.x * 32, y: J.H.y - J.fr.y * 32 + 2 } : { x: J.C.x - J.fr.x * 34, y: J.C.y + 4 };
    return [P, { x: P.x + (pc.ponta[0] - pc.piv[0]), y: P.y + (pc.ponta[1] - pc.piv[1]) }];
  };
  const [ca, cb] = corrente(obj.cachecol && obj.cachecol[0], 0, 7, 'cachecol');
  peca('cachecol', ca, cb);
  const [ta, tb] = corrente(obj.cauda, 0, 4, 'cauda');
  peca('cauda', ta, tb);
  peca('bracoT', J.bT.O, J.bT.E);
  peca('antebT', J.bT.E, J.bT.W);
  peca('coxaT', J.pT.Q, J.pT.K);
  peca('canelaT', J.pT.K, J.pT.A);
  peca('tronco', J.H, J.C);
  peca('coxaF', J.pF.Q, J.pF.K);
  peca('canelaF', J.pF.K, J.pF.A);
  peca('cabeca', J.C, J.cab);
  peca('bracoF', J.bF.O, J.bF.E);
  peca('antebF', J.bF.E, J.bF.W);
  ctx.restore();
}

/* =========================================================
   PEÇAS DESENHADAS (imagem com as 11 partes da Geada em fundo magenta)
   ========================================================= */
let PARTES = null;

// onde cada peça fica na imagem (fração da largura/altura) e onde ficam as juntas
// dentro de cada peça (fração da caixa da peça): piv = junta de cima, ponta = junta de baixo
const MAPA_PARTES = {
  cabeca:   { c: [0.16, 0.18], piv: [0.62, 0.90], ponta: [0.47, 0.42] },
  tronco:   { c: [0.45, 0.21], piv: [0.50, 0.93], ponta: [0.62, 0.10] },
  braco:    { c: [0.69, 0.22], piv: [0.40, 0.10], ponta: [0.68, 0.86] },
  antebraco:{ c: [0.90, 0.24], piv: [0.38, 0.07], ponta: [0.58, 0.66], corteY: 0.70 },
  punho:    { c: [0.13, 0.55], piv: [0.22, 0.22], ponta: [0.75, 0.72] },
  garra:    { c: [0.37, 0.56], piv: [0.18, 0.18], ponta: [0.70, 0.85] },
  coxa:     { c: [0.64, 0.55], piv: [0.45, 0.07], ponta: [0.52, 0.90] },
  canela:   { c: [0.86, 0.56], piv: [0.35, 0.07], ponta: [0.62, 0.86] },
  pe:       { c: [0.15, 0.85], piv: [0.40, 0.08], ponta: [0.86, 0.88] },
  cauda:    { c: [0.45, 0.84], piv: [0.96, 0.50], ponta: [0.05, 0.75] },
  cachecol: { c: [0.84, 0.85], piv: [0.97, 0.30], ponta: [0.03, 0.75] },
};
const ESC_PARTES = 0.13; // unidades do boneco por pixel da imagem das peças
// tamanho de cada peça (proporção "chibi" como na ficha: cabeça grande, pernas curtas)
const MULT_PARTES = { cabeca: 1.55, tronco: 1.1, braco: 0.82, antebraco: 0.82, punho: 1.05, garra: 1.05, coxa: 0.78, canela: 0.72, pe: 0.85, cauda: 1.15, cachecol: 0.9 };

function prepararPartes(img) {
  const w = img.naturalWidth, h = img.naturalHeight, N = w * h;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const dados = g.getImageData(0, 0, w, h), p = dados.data;
  // 1) tira o fundo magenta (e a franja roxa nas bordas)
  const solido = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 4, r = p[o], gg = p[o + 1], b = p[o + 2];
    const mag = Math.min(r, b) - gg;
    if (mag > 95) { p[o + 3] = 0; continue; }
    if (mag > 45) {
      // borda misturada com magenta: vira contorno escuro semitransparente
      p[o + 3] = Math.round(255 * (1 - (mag - 45) / 50));
      p[o] = 16; p[o + 1] = 18; p[o + 2] = 46;
    }
    solido[i] = p[o + 3] > 60 ? 1 : 0;
  }
  g.putImageData(dados, 0, 0);
  // 2) acha os pedaços (componentes) e junta cada um na peça mais próxima
  const lab = new Int32Array(N).fill(-1), pilha = new Int32Array(N);
  const grupos = {};
  for (const nome in MAPA_PARTES) grupos[nome] = null;
  for (let i = 0; i < N; i++) {
    if (!solido[i] || lab[i] >= 0) continue;
    let sp = 0; pilha[sp++] = i; lab[i] = i;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0, sx = 0, sy = 0;
    while (sp) {
      const j = pilha[--sp], x = j % w, y = (j / w) | 0;
      area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && solido[j - 1] && lab[j - 1] < 0) { lab[j - 1] = i; pilha[sp++] = j - 1; }
      if (x < w - 1 && solido[j + 1] && lab[j + 1] < 0) { lab[j + 1] = i; pilha[sp++] = j + 1; }
      if (j >= w && solido[j - w] && lab[j - w] < 0) { lab[j - w] = i; pilha[sp++] = j - w; }
      if (j < N - w && solido[j + w] && lab[j + w] < 0) { lab[j + w] = i; pilha[sp++] = j + w; }
    }
    if (area < 200) continue;
    const cx = sx / area / w, cy = sy / area / h;
    let melhor = null, dist = Infinity;
    for (const nome in MAPA_PARTES) {
      const [ex, ey] = MAPA_PARTES[nome].c;
      const d = Math.hypot(cx - ex, (cy - ey) * 1.3);
      if (d < dist) { dist = d; melhor = nome; }
    }
    const gr = grupos[melhor];
    grupos[melhor] = gr ? { x0: Math.min(gr.x0, x0), y0: Math.min(gr.y0, y0), x1: Math.max(gr.x1, x1), y1: Math.max(gr.y1, y1) } : { x0, y0, x1, y1 };
  }
  // 3) recorta cada peça e calcula as juntas
  const pecas = {};
  for (const nome in MAPA_PARTES) {
    const b = grupos[nome];
    if (!b) { console.warn('peça não encontrada:', nome); return false; }
    const m = MAPA_PARTES[nome];
    const bw = b.x1 - b.x0 + 1;
    let bh = b.y1 - b.y0 + 1;
    if (m.corteY) bh = Math.round(bh * m.corteY); // antebraço: tira o punho que veio junto
    const pc = document.createElement('canvas'); pc.width = bw; pc.height = bh;
    pc.getContext('2d').drawImage(c, b.x0, b.y0, bw, bh, 0, 0, bw, bh);
    const alturaTotal = b.y1 - b.y0 + 1;
    const piv = { x: m.piv[0] * bw, y: m.piv[1] * alturaTotal };
    const ponta = { x: m.ponta[0] * bw, y: m.ponta[1] * alturaTotal };
    // versão branca (para o piscar ao levar dano)
    const br = document.createElement('canvas'); br.width = bw; br.height = bh;
    const gb = br.getContext('2d'); gb.drawImage(pc, 0, 0); gb.globalCompositeOperation = 'source-atop'; gb.fillStyle = '#fff'; gb.fillRect(0, 0, bw, bh);
    pecas[nome] = { c: pc, branco: br, piv, ponta, comp: Math.hypot(ponta.x - piv.x, ponta.y - piv.y), ang: Math.atan2(ponta.x - piv.x, ponta.y - piv.y) };
  }
  // 4) os ossos do boneco passam a ter o tamanho das peças
  const k = ESC_PARTES, mp = MULT_PARTES;
  COXA = pecas.coxa.comp * k * mp.coxa;
  CANELA = pecas.canela.comp * k * mp.canela;
  PATA = pecas.pe.comp * k * mp.pe * 0.65; DEDOS = pecas.pe.comp * k * mp.pe * 0.35;
  BRACO = pecas.braco.comp * k * mp.braco;
  ANTEBRACO = pecas.antebraco.comp * k * mp.antebraco;
  const tronco = pecas.tronco.comp * k * mp.tronco;
  LOMBO = tronco * 0.45; PEITO = tronco * 0.55; PESC_LEN = 2; TRONCO = tronco;
  ALTURA_QUADRIL = COXA + CANELA + PATA;
  PARTES = pecas;
  return true;
}

function renderPartes(obj, opts) {
  const r = obj.rig, J = obj.rigJ;
  const k = ESC_PARTES;
  const esc = opts.escala || 1;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.imageSmoothingEnabled = true;
  const base = ctx.getTransform();
  const local = () => {
    ctx.setTransform(base);
    ctx.translate(obj.x, CHAO - obj.y);
    ctx.scale(obj.face * r.ex * RIG_K * esc, r.ey * RIG_K * esc);
    ctx.translate(J.H.x, J.H.y); ctx.rotate(r.giro); ctx.translate(-J.H.x, -J.H.y);
  };
  // peça com a junta de cima em P, apontando para "alvo"; atras = um pouco mais escura (profundidade)
  const peca = (nome, P, alvo, atras) => {
    const pc = PARTES[nome];
    const angT = Math.atan2(alvo.x - P.x, alvo.y - P.y);
    ctx.save();
    local();
    if (atras) ctx.filter = 'brightness(0.72) saturate(1.1)';
    ctx.translate(P.x, P.y);
    ctx.rotate(pc.ang - angT);
    const kk = k * (MULT_PARTES[nome] || 1);
    ctx.scale(kk, kk);
    ctx.drawImage(opts.branco ? pc.branco : pc.c, -pc.piv.x, -pc.piv.y);
    ctx.restore();
  };
  // cauda e ponta do cachecol seguem as correntes de física
  const corrente = (cad, i1, nome) => {
    if (cad && !opts.semCorrentes) return [mundoParaLocal(obj, cad[0], J), mundoParaLocal(obj, cad[i1], J)];
    const P = nome === 'cauda' ? { x: J.H.x - J.fr.x * 6, y: J.H.y + 2 } : { x: J.C.x - J.fr.x * 6, y: J.C.y + 2 };
    return [P, { x: P.x - 10, y: P.y + 1 }];
  };
  const mao = (r.garra || 0) > 0.5 ? 'garra' : 'punho';
  const [ca, cb] = corrente(obj.cachecol && obj.cachecol[0], 7, 'cachecol');
  peca('cachecol', ca, cb);
  const [ta, tb] = corrente(obj.cauda, 5, 'cauda');
  peca('cauda', ta, tb);
  // braço e perna de trás
  peca('braco', J.bT.O, J.bT.E, true);
  peca('antebraco', J.bT.E, J.bT.W, true);
  peca(mao, J.bT.W, J.bT.M, true);
  peca('coxa', J.pT.Q, J.pT.K, true);
  peca('canela', J.pT.K, J.pT.A, true);
  peca('pe', J.pT.A, J.pT.T, true);
  // corpo
  peca('tronco', J.H, J.N || J.C);
  peca('coxa', J.pF.Q, J.pF.K);
  peca('canela', J.pF.K, J.pF.A);
  peca('pe', J.pF.A, J.pF.T);
  peca('cabeca', J.N || J.C, J.cab);
  // braço da frente
  peca('braco', J.bF.O, J.bF.E);
  peca('antebraco', J.bF.E, J.bF.W);
  peca(mao, J.bF.W, J.bF.M);
  ctx.restore();
}

function renderBoneco(obj, opts = {}) {
  if (PARTES && obj.rigJ) { renderPartes(obj, opts); return; }
  if (MODO_RECORTE && typeof FOLHAS !== 'undefined' && FOLHAS.geada) { renderRecorte(obj, opts); return; }
  const pal = opts.branco ? PAL_BRANCA : PAL_GEADA;
  const r = obj.rig, J = obj.rigJ || (() => { const j = juntasRig(r); return j; })();
  const g = rg;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, RIG_W, RIG_H);
  g.imageSmoothingEnabled = false;

  // correntes (coordenadas do mundo) → atrás do corpo
  const mundo = () => g.setTransform(RIG_ESC, 0, 0, RIG_ESC, RIG_OX - obj.x * RIG_ESC, RIG_OY - (CHAO - obj.y) * RIG_ESC);
  if (!opts.semCorrentes && obj.cachecol) { mundo(); obj.cachecol.forEach((c) => c && desenharFita(g, c, pal)); }
  if (!opts.semCorrentes && obj.cauda) { mundo(); desenharCauda(g, obj.cauda, pal); }

  // corpo (coordenadas locais)
  g.setTransform(RIG_ESC * obj.face * r.ex, 0, 0, RIG_ESC * r.ey, RIG_OX, RIG_OY);
  g.translate(J.H.x, J.H.y); g.rotate(r.giro); g.translate(-J.H.x, -J.H.y);
  desenharBraco(g, J.bT, pal, true, r.garra);
  desenharPerna(g, J.pT, J.H, pal, true);
  desenharTronco(g, J, pal);
  desenharPerna(g, J.pF, J.H, pal, false);
  // gola do cachecol (em volta do pescoço)
  g.lineCap = 'round';
  const gN = J.N || J.C;
  const gc = { x: (J.C.x + gN.x) / 2, y: (J.C.y + gN.y) / 2 };
  const n0 = { x: gc.x - J.fr.x * 12, y: gc.y - J.fr.y * 12 + 4 }, n1 = { x: gc.x + J.fr.x * 11, y: gc.y + J.fr.y * 11 + 6 };
  linha(g, n0, n1, 15, pal.contorno);
  linha(g, n0, n1, 10.5, pal.vermelho);
  desenharCabeca(g, J.cab.x, J.cab.y, J.cab.a, pal, r.orelha, opts.expr || (obj.est ? expressaoDe(obj) : 'neutro'));
  desenharBraco(g, J.bF, pal, false, r.garra);

  // articulações brilhando (tecla H), como no diagrama
  if (typeof G !== 'undefined' && G.mostrarJuntas && !opts.branco) {
    const brilho = (p, raio) => {
      g.fillStyle = 'rgba(80,230,255,.35)'; g.beginPath(); g.arc(p.x, p.y, raio + 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7ff4ff'; g.beginPath(); g.arc(p.x, p.y, raio, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(p.x - 1, p.y - 1, raio * 0.35, 0, Math.PI * 2); g.fill();
    };
    const osso = (pts) => { g.strokeStyle = 'rgba(127,244,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); };
    [J.pT, J.pF].forEach((P) => osso([P.Q, P.K, P.A, P.B, P.T]));
    [J.bT, J.bF].forEach((B) => osso([J.C, B.O, B.E, B.W, B.M]));
    osso([J.H, J.M, J.C, J.N, J.cab]);
    [J.H, J.M, J.C, J.N].forEach((p) => brilho(p, 4.5));
    [J.pT, J.pF].forEach((P) => [P.Q, P.K, P.A, P.B].forEach((p) => brilho(p, 4)));
    [J.bT, J.bF].forEach((B) => [B.O, B.E, B.W].forEach((p) => brilho(p, 4)));
    if (obj.cauda && !opts.semCorrentes) {
      g.save(); mundo();
      g.strokeStyle = 'rgba(127,244,255,.7)'; g.lineWidth = 2;
      g.beginPath(); obj.cauda.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
      obj.cauda.forEach((p, i) => i % 2 === 0 && brilho(p, 3.5));
      g.restore();
    }
  }

  // amplia 2x, pixelado
  const esc = (opts.escala || 1) / RIG_ESC;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.drawImage(rigCanvas, obj.x - RIG_OX * esc, CHAO - obj.y - RIG_OY * esc, RIG_W * esc, RIG_H * esc);
  ctx.restore();
}

// retrato do HUD desenhado a partir da cabeça do boneco
function retratoBoneco() {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const g = c.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = 60; tmp.height = 60;
  const t = tmp.getContext('2d');
  t.translate(26, 36); t.scale(0.95, 0.95);
  desenharCabeca(t, 0, 0, 0, PAL_GEADA, 0, 'determinado', 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(tmp, 0, 0, 120, 120);
  return c;
}
