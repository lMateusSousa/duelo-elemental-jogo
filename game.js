'use strict';
/* =========================================================
   DUELO ELEMENTAL: jogo de luta 2D com Brasa e Geada
   Arena larga com câmera, plataformas, pulo duplo e investida.
   ========================================================= */
const cv = document.getElementById('tela');
const ctx = cv.getContext('2d');
const W = 960, H = 540, CHAO = 470;
const LH = 270;                 // altura do cenário em baixa resolução (desenhado 2x, pixelado)
const LWA = 700;                // largura da camada distante (céu, montanhas, cachoeiras)
const LWB = 1000;               // largura da camada próxima (ruínas, chão)
const ARENA_W = LWB * 2;        // largura da arena em pixels do mundo
const GRAV = 2900; // gravidade mais alta = pulos rápidos e secos
const FONTE = '"Press Start 2P", monospace';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const escolha = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerpN = (a, b, t) => a + (b - a) * t;
const aproximar = (v, alvo, passo) => (v < alvo ? Math.min(alvo, v + passo) : Math.max(alvo, v - passo));

/* ---------------- Personagens ---------------- */
const PERS = {
  brasa: {
    id: 'brasa', nome: 'BRASA', titulo: 'Dragão da Chama Viva', elem: 'fogo',
    // TANQUE: pesado, lento para andar e arrancar, mas bate forte e aguenta muito
    // peso = resiste a ser arremessado (voa menos e se recupera mais rápido do golpe)
    cor: '#ff5a3c', cor2: '#ffd166', vel: 200, pulo: 860, forca: 0.95, defesa: 1.05, peso: 1.25, projY: 118, // balanceado (CPU x CPU ~50%): era 1.2 / 1.35 / 1.45
    corrida: 1.8, dashVel: 740, puloDuplo: 0.65, pulosAr: 0, provocacao: 'Só isso?!', // pesado: sem pulo duplo
    // movimento: arranca devagar, demora a frear (embalo de peso), pouco controle no ar, cai pesado
    mov: { acel: 1500, freio: 2100, acelAr: 1200, queda: 1.5, derrapagem: 0.24, coyote: 0.08, buffer: 0.13 },
    especial: 'Corte Crescente', projetil: 'Sopro de Fogo', final: 'Explosão do Dragão Solar',
    mecanica: 'calor', // golpes dados/levados esquentam; cheio = FÚRIA
    stats: { forca: 4, vel: 2, defesa: 5, alcance: 4 },
  },
  geada: {
    id: 'geada', nome: 'GEADA', titulo: 'Raposa do Gelo Eterno', elem: 'gelo',
    // NINJA: muito rápida, pula alto, 2 pulos no ar, vira na hora; em troca, é frágil e leve
    cor: '#4fb6ff', cor2: '#d6f3ff', vel: 365, pulo: 1090, gravMult: 0.74, flutua: 0.4, forca: 1.05, defesa: 1.0, peso: 0.95, projY: 98, // balanceado: era 0.95 / 0.85 / 0.8
    corrida: 2.7, dashVel: 1280, puloDuplo: 0.95, pulosAr: 2, provocacao: 'Lento demais.',
    // movimento: arranca e para quase na hora, controle total no ar, quase sem derrapar
    mov: { acel: 5600, freio: 6000, acelAr: 4000, queda: 1.05, derrapagem: 0.05, coyote: 0.13, buffer: 0.15 },
    especial: 'Giro Glacial', projetil: 'Lança de Cristal', final: 'Nevasca Absoluta',
    mecanica: 'gelo', // golpes deixam poças de gelo; o final congela quem estiver nelas
    stats: { forca: 4, vel: 5, defesa: 3, alcance: 5 },
  },
  ventokami: {
    id: 'ventokami', nome: 'VENTOKAMI', titulo: 'Espírito do Vento Celeste', elem: 'vento',
    // VELOCISTA LEVE: o mais rápido (VEL 95), flutua no ar, bate pouco e aguenta pouco (ATQ 70, DEF 60)
    cor: '#ff6fc8', cor2: '#d9c8ff', vel: 385, pulo: 1060, gravMult: 0.7, flutua: 0.5, forca: 1.0, defesa: 0.95, peso: 0.9, projY: 92, // balanceado: era 0.9 / 0.8 / 0.7
    corrida: 2.8, dashVel: 1350, puloDuplo: 0.95, pulosAr: 2, provocacao: 'Leve como o vento!',
    mov: { acel: 5800, freio: 5600, acelAr: 4300, queda: 1.0, derrapagem: 0.06, coyote: 0.14, buffer: 0.15 },
    especial: 'Mini Tornado', projetil: 'Rajada Celestial', final: 'Passo Veloz',
    stats: { forca: 3, vel: 5, defesa: 3, alcance: 4 },
    // sem folha 4x4: o jogo monta tudo a partir das animações dele (assets/ventokami_anim)
    soAnim: true, pixelNitido: true,
    estilo: { sat: 1.35, con: 1.2, gama: 1.18 }, // contorno + cor mais forte para combinar com Brasa/Geada
  },
};
const ORDEM_PERS = ['brasa', 'geada', 'ventokami'];

/*
 * Quadros da folha de sprites (4x4, da esquerda p/ direita, de cima p/ baixo):
 * 0-1 parado · 2-5 andando · 6 investida · 7 defesa · 8 pulo subindo · 9 caindo
 * 10 chute · 11 carregar · 12 soco · 13 especial · 14 projétil · 15 dano
 */
const ATQ = {
  soco1:   { frame: 12, dur: 0.24, ativo: [0.05, 0.13], dano: 38, alc: [10, 115], alt: [50, 145], kb: 90,  stun: 0.34, avanco: 70,  prox: 'soco2' },
  soco2:   { frame: 10, dur: 0.28, ativo: [0.07, 0.16], dano: 42, alc: [10, 120], alt: [25, 140], kb: 110, stun: 0.36, avanco: 90,  prox: 'soco3' },
  soco3:   { frame: 10, giro: true, dur: 0.40, ativo: [0.10, 0.20], dano: 70, alc: [10, 125], alt: [40, 150], kb: 430, stun: 0.55, avanco: 160, derruba: true },
  corridaAtq: { frame: 10, dur: 0.36, ativo: [0.04, 0.2], dano: 65, alc: [0, 125], alt: [20, 140], kb: 380, stun: 0.5, avanco: 260, derruba: true },
  aereo:   { frame: 10, dur: 0.38, ativo: [0.05, 0.28], dano: 55, alc: [0, 110],  alt: [-10, 120], kb: 200, stun: 0.4, aereo: true },
  especial:{ frame: 13, dur: 0.50, ativo: [0.12, 0.30], dano: 125, alc: [-20, 150], alt: [10, 190], kb: 520, stun: 0.6, avanco: 120, derruba: true, custo: 20 },
  projetil:{ frame: 14, dur: 0.50, spawn: 0.14, custo: 15 },
  final:   { frame: 6,  dur: 0.45, ativo: [0.04, 0.40], dano: 0, alc: [0, 120], alt: [0, 160], kb: 0, stun: 0, avanco: 0, final: true, custo: 100 },
};
const PROJ_HIT = { dano: 100, kb: 300, stun: 0.45 };

// Plataformas de pedra (y = altura acima do chão). Dá para subir pulando e descer com baixo + pulo.
const PLATAFORMAS = [
  { x0: 470, x1: 730, y: 165 },
  { x0: 1270, x1: 1530, y: 165 },
  { x0: 860, x1: 1140, y: 300 },
];

/* ---------------- Processamento das folhas de sprites ---------------- */
const FOLHAS = {};

function carregarImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function processarFolha(img) {
  const w = img.naturalWidth, h = img.naturalHeight, N = w * h;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const dados = g.getImageData(0, 0, w, h);
  const p = dados.data;

  // 1) remove o fundo escuro a partir das bordas (flood fill)
  const fundo = new Uint8Array(N);
  const LIM = 58;
  const escuro = (i) => { const o = i * 4; return p[o] < LIM && p[o + 1] < LIM && p[o + 2] < LIM; };
  const pilha = new Int32Array(N);
  let sp = 0;
  const semear = (i) => { if (!fundo[i] && escuro(i)) { fundo[i] = 1; pilha[sp++] = i; } };
  for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
  while (sp) {
    const i = pilha[--sp], x = i % w;
    if (x > 0) semear(i - 1);
    if (x < w - 1) semear(i + 1);
    if (i >= w) semear(i - w);
    if (i < N - w) semear(i + w);
  }

  // 2) separa as figuras em componentes. As linhas internas escuras também somem
  //    no passo 1, então junta pedaços próximos usando uma máscara "engordada".
  const R = 3;
  const linhaD = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    let cont = 0;
    for (let x = 0; x < Math.min(w, R); x++) if (!fundo[y * w + x]) cont++;
    for (let x = 0; x < w; x++) {
      if (x + R < w && !fundo[y * w + x + R]) cont++;
      if (x - R - 1 >= 0 && !fundo[y * w + x - R - 1]) cont--;
      linhaD[y * w + x] = cont > 0 ? 1 : 0;
    }
  }
  const masc = new Uint8Array(N);
  for (let x = 0; x < w; x++) {
    let cont = 0;
    for (let y = 0; y < Math.min(h, R); y++) cont += linhaD[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + R < h) cont += linhaD[(y + R) * w + x];
      if (y - R - 1 >= 0) cont -= linhaD[(y - R - 1) * w + x];
      masc[y * w + x] = cont > 0 ? 1 : 0;
    }
  }
  const lab = new Int32Array(N).fill(-1);
  const comps = [];
  for (let i = 0; i < N; i++) {
    if (!masc[i] || lab[i] >= 0) continue;
    const id = comps.length;
    const cp = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    lab[i] = id; pilha[0] = i; sp = 1;
    while (sp) {
      const j = pilha[--sp], x = j % w, y = (j / w) | 0;
      if (!fundo[j]) {
        cp.area++;
        if (x < cp.x0) cp.x0 = x; if (x > cp.x1) cp.x1 = x;
        if (y < cp.y0) cp.y0 = y; if (y > cp.y1) cp.y1 = y;
      }
      const viz = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j >= w ? j - w : -1, j < N - w ? j + w : -1];
      for (const k of viz) if (k >= 0 && masc[k] && lab[k] < 0) { lab[k] = id; pilha[sp++] = k; }
    }
    if (cp.area > 0) comps.push(cp);
  }
  // descarta sujeirinhas
  const validos = [];
  for (const cp of comps) {
    if (cp.area >= 150) { validos.push(cp); continue; }
    for (let y = cp.y0; y <= cp.y1; y++) for (let x = cp.x0; x <= cp.x1; x++) { const i = y * w + x; if (lab[i] === cp.id) { fundo[i] = 1; lab[i] = -1; } }
  }

  // 3) recria um contorno escuro limpo (2 px)
  for (let passo = 0; passo < 2; passo++) {
    const add = [];
    for (let i = 0; i < N; i++) {
      if (!fundo[i]) continue;
      const x = i % w;
      if ((x > 0 && !fundo[i - 1]) || (x < w - 1 && !fundo[i + 1]) || (i >= w && !fundo[i - w]) || (i < N - w && !fundo[i + w])) add.push(i);
    }
    for (const i of add) { fundo[i] = 0; const o = i * 4; p[o] = 16; p[o + 1] = 12; p[o + 2] = 28; p[o + 3] = 255; }
  }
  for (let i = 0; i < N; i++) if (fundo[i]) p[i * 4 + 3] = 0;
  g.putImageData(dados, 0, 0);

  // 4) agrupa em 4 linhas x 4 quadros (o maior blob de cada quadro é o corpo)
  const banda = h / 4;
  const frames = [];
  for (let r = 0; r < 4; r++) {
    const linha = validos.filter((cp) => Math.min(3, Math.floor(((cp.y0 + cp.y1) / 2) / banda)) === r);
    linha.sort((a, b) => b.area - a.area);
    const corpos = linha.slice(0, 4).sort((a, b) => a.x0 - b.x0);
    const grupos = corpos.map((b) => ({ corpo: b, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));
    for (const cp of linha.slice(4)) {
      let melhor = null, dist = Infinity;
      for (const gr of grupos) {
        const d = Math.max(0, gr.corpo.x0 - cp.x1, cp.x0 - gr.corpo.x1);
        if (d < dist) { dist = d; melhor = gr; }
      }
      if (melhor) {
        melhor.x0 = Math.min(melhor.x0, cp.x0); melhor.y0 = Math.min(melhor.y0, cp.y0);
        melhor.x1 = Math.max(melhor.x1, cp.x1); melhor.y1 = Math.max(melhor.y1, cp.y1);
      }
    }
    for (const gr of grupos) {
      const b = gr.corpo;
      // âncora = média x dos pés (10% de baixo do corpo)
      const yIni = b.y1 - Math.floor((b.y1 - b.y0) * 0.1);
      let sx = 0, n = 0;
      for (let y = yIni; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (lab[y * w + x] === b.id && p[(y * w + x) * 4 + 3]) { sx += x; n++; }
      const ax = n ? sx / n : (b.x0 + b.x1) / 2;
      const pad = 3;
      const x0 = Math.max(0, gr.x0 - pad), y0 = Math.max(0, gr.y0 - pad);
      const x1 = Math.min(w - 1, gr.x1 + pad), y1 = Math.min(h - 1, gr.y1 + pad);
      const fc = document.createElement('canvas');
      fc.width = x1 - x0 + 1; fc.height = y1 - y0 + 1;
      fc.getContext('2d').drawImage(c, x0, y0, fc.width, fc.height, 0, 0, fc.width, fc.height);
      frames.push({ c: fc, ax: ax - x0, ay: b.y1 + 2 - y0, alturaCorpo: b.y1 - b.y0, topoCorpo: b.y0 - y0, branco: null });
    }
    while (frames.length < (r + 1) * 4) frames.push(frames[frames.length - 1] || null);
  }
  return { frames, alturaBase: frames[0].alturaCorpo };
}

/* ---------------- Animações quadro a quadro (arte do PixelLab) ----------------
 * ANIM_DATA (<personagem>-anim-data.js, gerados por assets/embutir-anim.js) traz os quadros 128x128 de cada animação.
 * Cada quadro é ampliado 3x sem suavizar (pixel nítido) e ancorado nos pés,
 * no mesmo ponto para todos os quadros (o corpo não "treme" entre quadros).
 * Estados sem animação própria continuam usando a folha antiga (FOLHAS).
 */
// altura dos personagens no cenário, em pixels do mundo (antes era 175)
const ALTURA_PERS = 120;
const ANIMS = {};
const ANIM_AMPLIA = 3;
// apaga pontinhos soltos que a geração às vezes deixa (grupos com poucos pixels)
function limparSujeira(img, minimo = 4) {
  const w = img.width, h = img.height, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, vis = new Uint8Array(w * h), pilha = [];
  for (let s = 0; s < w * h; s++) {
    if (vis[s] || !p[s * 4 + 3]) continue;
    const grupo = [];
    vis[s] = 1; pilha.push(s);
    while (pilha.length) {
      const j = pilha.pop(), x = j % w, y = (j / w) | 0;
      grupo.push(j);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !vis[k] && p[k * 4 + 3]) { vis[k] = 1; pilha.push(k); }
      }
    }
    if (grupo.length < minimo) for (const j of grupo) p[j * 4 + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  return c;
}
/* Pulo ninja da Geada: tira de 11 quadros (fundo magenta, JPG) desenhada à parte.
 * 0 guarda · 1 agacha · 2 impulso · 3 estica · 4 encolhe · 5 bola · 6 de cabeça p/ baixo
 * 7 fim do mortal · 8 abre descendo · 9 pouso agachado · 10 levanta para a guarda */
const USAR_PULOS_EXTRAS = false;
async function carregarPuloNinja() {
  if (typeof ANIM_EXTRA === 'undefined' || !ANIM_EXTRA.geadaPuloNinja || !ANIMS.geada || !ANIMS.geada.idle) return;
  const img = await carregarImg(ANIM_EXTRA.geadaPuloNinja);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const colN = new Array(w).fill(0); // pixels que não são fundo, por coluna (para separar os quadros)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, r = p[o], gg = p[o + 1], b = p[o + 2], m = Math.min(r, b) - gg;
    if (!(m > 85 && r > 140 && b > 140)) colN[i % w]++;
    if (m > 85 && r > 140 && b > 140) p[o + 3] = 0;                         // fundo magenta
    else if (m > 45 && r > 110 && b > 110) {                                 // borda rosada (JPG) → contorno escuro
      p[o + 3] = Math.round(255 * clamp(1 - (m - 45) / 40, 0, 1)); p[o] = 18; p[o + 1] = 20; p[o + 2] = 50;
    }
  }
  g.putImageData(d, 0, 0);
  const limpo = limparSujeira(c, 30);
  const lg = limpo.getContext('2d', { willReadFrequently: true });
  const a = lg.getImageData(0, 0, w, h).data;
  // separa os quadros pelas colunas vazias entre eles
  const ocupada = colN.map((n) => n > 0);
  let seg = [];
  for (let x = 0; x < w; x++) {
    if (ocupada[x] && (x === 0 || !ocupada[x - 1])) seg.push([x, x]);
    if (ocupada[x]) seg[seg.length - 1][1] = x;
  }
  // junta pedacinhos (ponta do cachecol etc.) ao quadro vizinho mais perto
  seg = seg.filter((s2) => s2[1] - s2[0] >= 3);
  while (seg.length > 11) {
    let iMenor = 0;
    seg.forEach((s2, i) => { if (s2[1] - s2[0] < seg[iMenor][1] - seg[iMenor][0]) iMenor = i; });
    const s2 = seg[iMenor], esq = seg[iMenor - 1], dir = seg[iMenor + 1];
    const alvo = !dir || (esq && s2[0] - esq[1] < dir[0] - s2[1]) ? iMenor - 1 : iMenor + 1;
    seg[alvo] = [Math.min(seg[alvo][0], s2[0]), Math.max(seg[alvo][1], s2[1])];
    seg.splice(iMenor, 1);
  }
  if (seg.length !== 11) { const lw = w / 11; seg = Array.from({ length: 11 }, (_, i) => [Math.floor(i * lw), Math.floor((i + 1) * lw) - 1]); }
  const ref = ANIMS.geada.idle[0];
  const caixas = seg.map(([x0, x1]) => {
    let y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = x0; x <= x1; x++) if (a[(y * w + x) * 4 + 3] > 60) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, x1, y0, y1 };
  });
  const esc = ref.alturaCorpo / (caixas[0].y1 - caixas[0].y0 + 1); // mesmo tamanho dos outros quadros dela
  ANIMS.geada.puloNinja = caixas.map((cx, i) => {
    const bw = cx.x1 - cx.x0 + 5, bh = cx.y1 - cx.y0 + 5;
    const fc = document.createElement('canvas');
    fc.width = Math.ceil(bw * esc); fc.height = Math.ceil(bh * esc);
    const fg = fc.getContext('2d');
    fg.imageSmoothingEnabled = true; fg.imageSmoothingQuality = 'high';
    fg.drawImage(limpo, cx.x0 - 2, cx.y0 - 2, bw, bh, 0, 0, fc.width, fc.height);
    // âncora: meio dos pés (10 linhas de baixo) e a base do desenho
    let sx = 0, n = 0;
    for (let y = Math.max(cx.y0, cx.y1 - 10); y <= cx.y1; y++) for (let x = cx.x0; x <= cx.x1; x++) if (a[(y * w + x) * 4 + 3] > 60) { sx += x; n++; }
    const ax = ((n ? sx / n : (cx.x0 + cx.x1) / 2) - (cx.x0 - 2)) * esc;
    return { c: fc, ax, ay: (cx.y1 + 1 - (cx.y0 - 2)) * esc, alturaCorpo: ref.alturaCorpo, topoCorpo: 2 * esc, fator: ref.fator, anim: 'puloNinja', i, branco: null };
  });
}

/* Pulo bolinha da Geada: folha 2 linhas x 6 quadros (fundo magenta, JPG).
 * 0 guarda · 1 agacha · 2 impulso · 3 sobe encolhendo · 4 bolinha · 5 bolinha (girada)
 * 6 de frente (não usado) · 7 desenrolando · 8 descendo · 9 pernas prontas · 10 pouso · 11 guarda */
// mantém só o corpo principal do quadro (tira pedaços do quadro vizinho que entraram no recorte)
function soCorpoPrincipal(cv) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d', { willReadFrequently: true });
  const d = g.getImageData(0, 0, w, h), p = d.data, lab = new Int32Array(w * h).fill(-1), grupos = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (lab[s0] >= 0 || p[s0 * 4 + 3] < 40) continue;
    const id = grupos.length, pilha = [s0], px = []; lab[s0] = id;
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (pilha.length) {
      const j = pilha.pop(), x = j % w, y = (j / w) | 0; px.push(j);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && lab[k] < 0 && p[k * 4 + 3] >= 40) { lab[k] = id; pilha.push(k); }
      }
    }
    grupos.push({ px, x0, x1, y0, y1 });
  }
  if (!grupos.length) return cv;
  const M = grupos.reduce((a, b) => (b.px.length > a.px.length ? b : a));
  const folga = 6;
  for (const gr of grupos) {
    if (gr === M) continue;
    const dentro = gr.x1 >= M.x0 - folga && gr.x0 <= M.x1 + folga && gr.y1 >= M.y0 - folga && gr.y0 <= M.y1 + folga;
    if (!dentro) for (const j of gr.px) p[j * 4 + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  return cv;
}

async function carregarPuloBola() {
  if (typeof ANIM_EXTRA === 'undefined' || !ANIM_EXTRA.geadaPuloBola || !ANIMS.geada || !ANIMS.geada.idle) return;
  const img = await carregarImg(ANIM_EXTRA.geadaPuloBola);
  const w = img.naturalWidth, h = img.naturalHeight, LIN = 2, COL = 6;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const fundo = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, r = p[o], gg = p[o + 1], b = p[o + 2], m = Math.min(r, b) - gg;
    if (m > 85 && r > 140 && b > 140) { p[o + 3] = 0; fundo[i] = 1; }
    else if (m > 45 && r > 110 && b > 110) { p[o + 3] = Math.round(255 * clamp(1 - (m - 45) / 40, 0, 1)); p[o] = 18; p[o + 1] = 20; p[o + 2] = 50; }
  }
  g.putImageData(d, 0, 0);
  const limpo = limparSujeira(c, 40);
  const quadros = [];
  const banda = h / LIN;
  for (let L = 0; L < LIN; L++) {
    const ya = Math.round(L * banda), yb = Math.round((L + 1) * banda) - 1;
    // colunas com desenho nessa linha → pedaços; junta pedacinhos (gotinhas de gelo) até sobrar 6
    const occ = [];
    for (let x = 0; x < w; x++) { let n = 0; for (let y = ya; y <= yb; y++) if (!fundo[y * w + x]) n++; occ.push(n > 1); }
    let seg = [];
    for (let x = 0; x < w; x++) { if (occ[x] && (x === 0 || !occ[x - 1])) seg.push([x, x]); if (occ[x]) seg[seg.length - 1][1] = x; }
    while (seg.length > COL) {
      let iM = 0; seg.forEach((q, i) => { if (q[1] - q[0] < seg[iM][1] - seg[iM][0]) iM = i; });
      const q = seg[iM], e = seg[iM - 1], dd = seg[iM + 1];
      const alvo = !dd || (e && q[0] - e[1] < dd[0] - q[1]) ? iM - 1 : iM + 1;
      seg[alvo] = [Math.min(seg[alvo][0], q[0]), Math.max(seg[alvo][1], q[1])]; seg.splice(iM, 1);
    }
    if (seg.length !== COL) { const lw = w / COL; seg = Array.from({ length: COL }, (_, i) => [Math.floor(i * lw), Math.floor((i + 1) * lw) - 1]); }
    for (const [x0, x1] of seg) {
      let y0 = yb, y1 = ya;
      for (let y = ya; y <= yb; y++) for (let x = x0; x <= x1; x++) if (!fundo[y * w + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
      quadros.push({ x0, x1, y0, y1 });
    }
  }
  const ref = ANIMS.geada.idle[0];
  const esc = ref.alturaCorpo / (quadros[0].y1 - quadros[0].y0 + 1);
  ANIMS.geada.puloBola = quadros.map((cx, i) => {
    const bw = cx.x1 - cx.x0 + 5, bh = cx.y1 - cx.y0 + 5;
    const fc = document.createElement('canvas');
    fc.width = Math.ceil(bw * esc); fc.height = Math.ceil(bh * esc);
    const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = true; fg.imageSmoothingQuality = 'high';
    const bruto = document.createElement('canvas'); bruto.width = bw; bruto.height = bh;
    bruto.getContext('2d').drawImage(limpo, cx.x0 - 2, cx.y0 - 2, bw, bh, 0, 0, bw, bh);
    soCorpoPrincipal(bruto);
    // mesmo estilo das outras animações: reduz para a resolução real da pixel art e amplia sem suavizar
    const pw = Math.max(1, Math.round(fc.width / ANIM_AMPLIA)), ph = Math.max(1, Math.round(fc.height / ANIM_AMPLIA));
    const pq = document.createElement('canvas'); pq.width = pw; pq.height = ph;
    const pg = pq.getContext('2d'); pg.imageSmoothingEnabled = true; pg.imageSmoothingQuality = 'high';
    pg.drawImage(bruto, 0, 0, pw, ph);
    // pixel nítido: transparência vira 0 ou 100% (sem borda borrada)
    const pd = pg.getImageData(0, 0, pw, ph);
    for (let k = 3; k < pd.data.length; k += 4) pd.data[k] = pd.data[k] > 110 ? 255 : 0;
    pg.putImageData(pd, 0, 0);
    fg.imageSmoothingEnabled = false;
    fg.drawImage(pq, 0, 0, pw * ANIM_AMPLIA, ph * ANIM_AMPLIA);
    // âncora pelos pés do que sobrou (base do desenho e meio dos pés)
    const bd = bruto.getContext('2d').getImageData(0, 0, bw, bh).data;
    let base = 0; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (bd[(y * bw + x) * 4 + 3] > 40) base = y;
    let sx = 0, n = 0;
    for (let y = Math.max(0, base - 10); y <= base; y++) for (let x = 0; x < bw; x++) if (bd[(y * bw + x) * 4 + 3] > 40) { sx += x; n++; }
    const ax = (n ? sx / n : bw / 2) * esc;
    return { c: fc, ax, ay: (base + 1) * esc, alturaCorpo: ref.alturaCorpo, topoCorpo: 2 * esc, fator: ref.fator, anim: 'puloBola', i, branco: null, bola: i === 4 || i === 5 };
  });
}

// Acerta o "tom" de quadros que vieram de pintura reduzida (Ventokami) para combinar com os outros:
// borda dura, cores mais saturadas/contrastadas, sombras mais fundas e contorno escuro de 1px por fora.
function estilizarQuadro(img, { sat = 1.35, con = 1.2, gama = 1.18 } = {}) {
  const w = img.width, h = img.height, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, N = w * h, cheio = new Uint8Array(N);
  const lim = (v) => Math.max(0, Math.min(255, v));
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (p[o + 3] < 100) { p[o + 3] = 0; continue; }
    p[o + 3] = 255; cheio[i] = 1;
    const m = (p[o] + p[o + 1] + p[o + 2]) / 3;
    for (let k = 0; k < 3; k++) {
      let v = m + (p[o + k] - m) * sat;          // satura
      v = (v - 128) * con + 128;                 // contraste
      p[o + k] = 255 * Math.pow(lim(v) / 255, gama); // aprofunda as sombras
    }
  }
  for (let i = 0; i < N; i++) {
    if (cheio[i]) continue;
    const x = i % w;
    if ((x > 0 && cheio[i - 1]) || (x < w - 1 && cheio[i + 1]) || (i >= w && cheio[i - w]) || (i < N - w && cheio[i + w])) {
      const o = i * 4; p[o] = 26; p[o + 1] = 14; p[o + 2] = 40; p[o + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

async function carregarAnims() {
  if (typeof ANIM_DATA === 'undefined') return;
  for (const [id, lista] of Object.entries(ANIM_DATA)) {
    if (!FOLHAS[id] || !lista.idle) continue;
    const A = {};
    // âncora e altura medidas no quadro base (idle 0): pés = última linha com pixel, x = média dos pés
    const base = await carregarImg(lista.idle[0]);
    const g0 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    g0.canvas.width = base.width; g0.canvas.height = base.height;
    g0.drawImage(base, 0, 0);
    const d0 = g0.getImageData(0, 0, base.width, base.height).data;
    let topo = base.height, pe = 0;
    for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) if (d0[(y * base.width + x) * 4 + 3] > 0) { topo = Math.min(topo, y); pe = Math.max(pe, y); }
    let sx = 0, n = 0;
    for (let y = pe - 3; y <= pe; y++) for (let x = 0; x < base.width; x++) if (d0[(y * base.width + x) * 4 + 3] > 0) { sx += x; n++; }
    const ax = (n ? sx / n : base.width / 2) * ANIM_AMPLIA, ay = (pe + 1) * ANIM_AMPLIA;
    const alturaCorpo = (pe - topo + 1) * ANIM_AMPLIA;
    const fator = FOLHAS[id].alturaBase / alturaCorpo; // mesma altura na tela que a folha antiga
    for (const [nome, srcs] of Object.entries(lista)) {
      if (nome === 'cartao') continue; // arte grande para menus (não é animação)
      A[nome] = [];
      for (let i = 0; i < srcs.length; i++) {
        const img = await carregarImg(srcs[i]);
        const c = document.createElement('canvas');
        c.width = img.width * ANIM_AMPLIA; c.height = img.height * ANIM_AMPLIA;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const limpo = limparSujeira(img);
        g.drawImage(PERS[id] && PERS[id].estilo ? estilizarQuadro(limpo, PERS[id].estilo) : limpo, 0, 0, c.width, c.height);
        // clipe num quadro maior (ex.: 128x192 para caber o fogo da comemoração): o personagem fica
        // embaixo e centralizado, então a âncora desce/anda o tanto que o quadro cresceu
        const dx = (img.width - base.width) / 2 * ANIM_AMPLIA, dy = (img.height - base.height) * ANIM_AMPLIA;
        A[nome].push({ c, ax: ax + dx, ay: ay + dy, alturaCorpo, topoCorpo: topo * ANIM_AMPLIA + dy, fator, anim: nome, i, branco: null });
      }
    }
    ANIMS[id] = A;
  }
}

/*
 * Estado → quadro da animação. Retorna null quando não há animação para o estado
 * (aí o desenho usa a folha antiga). Quadro 0 de cada clipe é a pose base, então
 * os ciclos (parado, andar, correr) tocam do 1 ao último.
 */
// Por personagem:
//  ciclos: quadros usados em cada ciclo (ex.: o clipe da corrida da Geada começa saindo da base: 1-2 ficam de fora)
//  atq: golpe → [clipe, quadros em ordem ao longo da duração do golpe]
//  pulo: quadros do clipe 'pulo' para subir→topo→cair, cambalhota, queda rápida e pouso
const ANIM_MAPA = {
  geada: {
    ciclos: {
      idle: [1, 2, 3, 4, 5, 6, 7, 8], walk: [1, 2, 3, 4, 5, 6, 7, 8], corrida: [3, 4, 5, 6, 7, 8],
      defesa: [2, 3, 4, 3], carga: [3, 4, 5, 6, 7, 8], vitoria: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    passoCorrida: 300, dash: 5,
    // derrubada: quadros do clipe 'caido' voando para trás (no ar) e caindo/deitada (no chão);
    // 'levantar' começa no quadro deitado (0) e termina na pose base
    voando: [3, 4], caido: [5, 6, 7, 8], levantar: [0, 1, 2, 3, 4],
    provocar: [1, 2, 3, 4, 5, 6, 7, 8],
    // pulo limpo: agacha (2,3) → sobe esticada (4) → encolhe no topo (5) → desce aberta (6) → pousa agachada (3)
    pulo: { impulso: [2, 3], voo: [4, 5, 6, 7, 8], duplo: 5, despenca: 8, pouso: [3, 2] },
    // clipe 'ninja' (PixelLab): 1 agacha · 2-5 mortal encolhida · 6 abre descendo · 7 toca o chão · 8 agachada
    ninja: { impulso: 1, mortal: [2, 3, 4, 5], mortalDur: 0.42, encolhida: 5, descendo: 6, pouso: [8, 7] },
    atq: {
      soco1: ['soco', [1, 1, 2, 2, 3]],
      soco2: ['soco', [4, 6, 6, 6, 7, 8]],
      projetil: ['soco', [3, 4, 6, 6, 6, 7, 8]],
      soco3: ['chute', [1, 3, 4, 5, 6, 6, 7, 8]],   // o giro já está desenhado no clipe
      corridaAtq: ['chute', [4, 5, 5, 6, 6, 6, 7, 8]],
      aereo: ['chute', [5, 5, 6, 6, 6, 6, 7]],
      especial: ['especial', [2, 3, 4, 5, 5, 6, 6, 7, 8]],
      final: ['especial', [2, 3, 4, 5, 6, 7]],
    },
    dano: [1, 2, 3, 4],
  },
  ventokami: {
    // novo: por enquanto só parado e andar (o resto usa a pose base com os efeitos por código)
    ciclos: { idle: [1, 2, 3, 4, 5, 6, 7, 8], walk: [1, 2, 3, 4, 5, 6, 7, 8] },
    passoCorrida: 320, dash: 4,
    pulo: { impulso: [1, 2], voo: [3, 4, 5, 6, 7], duplo: 5, despenca: 7, pouso: [8, 1] },
    atq: {},
    dano: [1, 2, 3, 4],
  },
  brasa: {
    // pesado: o ciclo da corrida também pula a saída da base; pulo com agachamento fundo
    ciclos: {
      idle: [1, 2, 3, 4, 5, 6, 7, 8], walk: [1, 2, 3, 4, 5, 6, 7, 8], corrida: [3, 4, 5, 6, 7, 8],
      defesa: [2, 3, 4, 3], carga: [4, 5, 6, 7, 8], vitoria: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    provocar: [1, 2, 3, 4, 5, 6, 7, 8],
    passoCorrida: 280, dash: 5,
    // derrubada: 3-5 voando para trás, 6 bate no chão, 7-8 deitado na poeira; levanta devagar (0 = deitado)
    voando: [3, 4, 5], caido: [6, 7, 8], levantar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    pulo: { impulso: [1, 2], voo: [3, 3, 4, 5, 5, 6, 6], duplo: 5, despenca: 6, pouso: [7, 7] },
    atq: {
      soco1: ['soco', [1, 2, 2, 3, 3]],
      soco2: ['soco', [4, 4, 5, 5, 5, 8]],
      projetil: ['sopro', [2, 3, 5, 5, 6, 6, 7, 8]],   // Sopro de Fogo: enche as bochechas e cospe fogo
      soco3: ['chute', [2, 3, 5, 6, 6, 7, 7, 8]],   // giro desenhado no clipe
      corridaAtq: ['chute', [4, 5, 6, 6, 6, 6, 7, 8]],
      aereo: ['chute', [5, 6, 6, 6, 6, 6, 7]],
      especial: ['especial', [2, 4, 5, 5, 6, 6, 7, 8]],   // garras pegam fogo → meia-lua de fogo
      final: ['especial', [2, 3, 4, 5, 6, 7, 8]],
    },
    dano: [1, 2, 3, 4],
  },
};
function quadroAnim(f) {
  const A = ANIMS[f.id], M = ANIM_MAPA[f.id];
  if (!A || !M) return null;
  const ATQ_ANIM = M.atq, P = M.pulo;
  const ciclo = (nome, pos) => {
    const q = A[nome], seq = M.ciclos[nome];
    if (!q || !seq) return null;
    const n = seq.length;
    return q[seq[((Math.floor(pos * n) % n) + n) % n]] || null;
  };
  const seqK = (q, seq, k) => (q && seq ? q[seq[Math.floor(clamp(k, 0, 0.999) * seq.length)]] || null : null);
  switch (f.est) {
    case 'idle': return ciclo('idle', G.t * 7 / 8);
    case 'walk': return ciclo('walk', f.ciclo || 0);                   // avança pela distância andada
    case 'corrida': return ciclo('corrida', (f.animDist || 0) / M.passoCorrida) || ciclo('walk', (f.animDist || 0) / 270);
    case 'dash': return A.corrida ? A.corrida[M.dash] : null;
    case 'freio': return A.idle[0];
    case 'pouso': if (A.puloBola) return A.puloBola[f.t < f.pousoDur * 0.6 ? 10 : 11];
      if (A.puloNinja) return A.puloNinja[f.t < f.pousoDur * 0.6 ? 9 : 10];
      if (A.ninja && M.ninja) return A.ninja[M.ninja.pouso[f.t < f.pousoDur * 0.6 ? 0 : 1]]; // pouso ninja agachada
      return A.pulo ? A.pulo[P.pouso[f.t < f.pousoDur * 0.5 ? 0 : 1]] : A.idle[0]; // agachadinho ao pousar
    case 'impulso': if (A.puloBola) return A.puloBola[f.t < f.impDur * 0.5 ? 1 : 2];
      if (A.puloNinja) return A.puloNinja[f.t < f.impDur * 0.5 ? 1 : 2];
      if (A.ninja && M.ninja) return A.ninja[M.ninja.impulso];
      return A.pulo && P.impulso ? A.pulo[P.impulso[f.t < f.impDur * 0.5 ? 0 : 1]] : null; // agacha antes de pular
    case 'rolamento': if (A.puloBola) return A.puloBola[4 + (Math.floor(f.t / 0.06) % 2)]; // rola como bolinha
      return A.pulo ? A.pulo[P.duplo] : null; // encolhida (o giro é feito rodando o quadro)
    case 'air': {
      const q = A.pulo;
      if (!q) return null;
      if (A.puloBola && !f.puloDuplo) {
        // pulo bolinha: impulso → sobe encolhendo → BOLINHA (2 quadros girando) → desenrola → pernas prontas
        const b2 = A.puloBola;
        const pul = f.p.pulo;
        const altChao = f.y - alturaSuperficie(f.x, f.y - 1);           // altura acima do chão/plataforma
        if (f.t < 0.06 && f.vy > 0) return b2[2];                        // impulso
        if (f.vy > pul * 0.5) return b2[3];                              // subindo, encolhendo
        if (f.vy > -pul * 0.45 && !f.quedaRapida) return b2[4 + (Math.floor(f.t / 0.08) % 2)]; // bolinha no topo
        if (altChao > 150) return b2[7];                                 // desenrolando
        if (altChao > 70) return b2[8];                                  // descendo
        return b2[9];                                                    // pernas prontas para pousar
      }
      if (A.puloNinja && !f.puloDuplo) {
        // pulo ninja desenhado: estica → encolhe → mortal → abre descendo
        const n2 = A.puloNinja;
        // no ar ela vira uma bolinha (quadro 5); só estica um instante na saída do chão
        if (f.t < 0.06 && f.vy > 0) return n2[3];
        return n2[5];
        if (f.flipNinja) {
          if (f.t < 0.07) return n2[3];
          // mortal: encolhe → bola → de cabeça para baixo → bola (o quadro 7 da tira veio com duas Geadas, não usamos)
          const MORTAL = [4, 5, 6, 5];
          if (f.t < f.flipDur) return n2[MORTAL[Math.min(3, Math.floor((f.t - 0.07) / (f.flipDur - 0.07) * 4))]];
          return f.vy > -150 ? n2[5] : n2[8];
        }
        if (f.vy > 350) return n2[3];
        if (f.vy > -250) return n2[4];
        return n2[8];
      }
      if (A.ninja && M.ninja && f.saltoMov && !f.puloDuplo && !f.quedaRapida) {
        // pulo ninja desenhado: mortal pelo tempo no ar, depois abre o corpo descendo
        const N = M.ninja;
        if (f.t < N.mortalDur) return A.ninja[N.mortal[Math.floor(f.t / N.mortalDur * N.mortal.length)]];
        return A.ninja[f.vy > 0 ? N.encolhida : N.descendo];
      }
      if (A.ninja && M.ninja && f.puloDuplo && !f.quedaRapida) {
        // pulo duplo/triplo: o mesmo mortal desenhado, contado desde o último pulo no ar
        const N = M.ninja, td = f.t - (f.duploT0 || 0);
        if (td < N.mortalDur) return A.ninja[N.mortal[Math.floor(td / N.mortalDur * N.mortal.length)]];
        return A.ninja[f.vy > 0 ? N.encolhida : N.descendo];
      }
      if (f.flipNinja && f.t < f.flipDur) return q[P.duplo];          // mortal ninja: encolhida
      if (f.puloDuplo && f.t - (f.duploT0 || 0) < DUR_PIRUETA) return q[P.duplo]; // encolhido na pirueta
      if (f.quedaRapida || f.vy < -1100) return q[P.despenca];        // despencando
      // subindo → topo → caindo, pela velocidade vertical
      return seqK(q, P.voo, (f.p.pulo - f.vy) / (f.p.pulo * 2));
    }
    case 'atk': {
      const a = f.atq, m = a && ATQ_ANIM[a.nome];
      if (!m || !A[m[0]]) return null;
      const seq = m[1], k = clamp(a.t / a.def.dur, 0, 0.999);
      return A[m[0]][seq[Math.floor(k * seq.length)]] || null;
    }
    case 'hurt':
      // arremessado (derrubado no ar): voa para trás com o clipe da queda, se houver
      if (f.derrubado && !f.solo && A.caido && M.voando) return seqK(A.caido, M.voando, f.t / 0.3);
      return seqK(A.dano, M.dano, f.t / 0.35);
    case 'defesa': return ciclo('defesa', G.t * 6 / 4);
    case 'carga': return ciclo('carga', G.t * 10 / 8);
    case 'caido': case 'ko': return seqK(A.caido, M.caido, f.t / 0.35);   // cai e fica no último quadro
    case 'levantar': return seqK(A.levantar, M.levantar, f.t / (f.p.defesa > 1 ? 0.45 : 0.25));
    case 'provocar': return seqK(A.provocar, M.provocar, f.t / 0.9);
    case 'vitoria': return ciclo('vitoria', f.t * 8 / 9);
    default: return null;
  }
}

// "Folha" de um personagem que só tem animações: os 16 quadros antigos viram a pose base (128x128),
// ampliada 3x e ancorada nos pés. Assim todo estado sem clipe próprio ainda desenha alguma coisa.
function folhaDaPoseBase(img, amplia = ANIM_AMPLIA) {
  const ANIM_AMPLIA = amplia; // 3x para pixel art pequena; 1x para arte grande
  const w = img.width, h = img.height;
  const c0 = document.createElement('canvas'); c0.width = w; c0.height = h;
  const g0 = c0.getContext('2d', { willReadFrequently: true });
  g0.drawImage(img, 0, 0);
  const d = g0.getImageData(0, 0, w, h).data;
  let topo = h, pe = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { topo = Math.min(topo, y); pe = Math.max(pe, y); }
  let sx = 0, n = 0;
  for (let y = pe - 3; y <= pe; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { sx += x; n++; }
  const c = document.createElement('canvas'); c.width = w * ANIM_AMPLIA; c.height = h * ANIM_AMPLIA;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = amplia === 1; g.drawImage(img, 0, 0, c.width, c.height);
  const fr = { c, ax: (n ? sx / n : w / 2) * ANIM_AMPLIA, ay: (pe + 1) * ANIM_AMPLIA, alturaCorpo: (pe - topo + 1) * ANIM_AMPLIA, topoCorpo: topo * ANIM_AMPLIA, branco: null };
  return { frames: Array.from({ length: 16 }, () => fr), alturaBase: fr.alturaCorpo };
}

function frameBranco(f) {
  if (f.branco) return f.branco;
  const c = document.createElement('canvas');
  c.width = f.c.width; c.height = f.c.height;
  const g = c.getContext('2d');
  g.drawImage(f.c, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  f.branco = c;
  return c;
}

const RETRATOS = {};
function criarRetrato(id) {
  const f = FOLHAS[id].frames[0];
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const g = c.getContext('2d');
  const esc = 120 / (f.alturaCorpo * 0.6);
  g.imageSmoothingQuality = 'high';
  g.drawImage(f.c, 60 - f.ax * esc - 4, -f.topoCorpo * esc + 6, f.c.width * esc, f.c.height * esc);
  RETRATOS[id] = c;
}

/* ---------------- Cenário (arena com cachoeiras, ruínas e cerejeiras) ---------------- */
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function circulo(g, x, y, r, cor) { g.fillStyle = cor; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

// cachoeiras na camada distante (coordenadas da camada A, baixa resolução)
const QUEDAS = [
  { x: 96, w: 18, y0: 92, y1: 206 },
  { x: 236, w: 14, y0: 104, y1: 204 },
  { x: 352, w: 26, y0: 74, y1: 206 },
  { x: 470, w: 30, y0: 66, y1: 206 },
  { x: 610, w: 20, y0: 88, y1: 206 },
];

let CENARIO_A = null, CENARIO_B = null;
const camadaA = document.createElement('canvas');
camadaA.width = LWA; camadaA.height = LH;
const gA = camadaA.getContext('2d');

function pintarCenario() {
  const R = rng(11);
  // ---- camada A: céu, montanhas, penhascos (fica atrás e se move devagar)
  const a = document.createElement('canvas'); a.width = LWA; a.height = LH;
  const g = a.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 180);
  gr.addColorStop(0, '#4f9be8'); gr.addColorStop(0.55, '#a6d2ff'); gr.addColorStop(1, '#ffd7e6');
  g.fillStyle = gr; g.fillRect(0, 0, LWA, LH);
  circulo(g, 330, 40, 26, 'rgba(255,250,220,.55)');
  circulo(g, 330, 40, 16, 'rgba(255,252,235,.9)');
  for (let i = 0; i < 10; i++) {
    const cx = R() * LWA, cy = 14 + R() * 55;
    for (let k = 0; k < 5; k++) circulo(g, cx + k * 9 - 18 + R() * 6, cy + R() * 5, 7 + R() * 7, 'rgba(255,255,255,.7)');
  }
  const montanha = (base, amp, cor) => {
    g.fillStyle = cor; g.beginPath(); g.moveTo(0, LH);
    let y = base;
    for (let x = 0; x <= LWA; x += 6) { y = clamp(y + (R() - 0.5) * amp * 0.35, base - amp, base + 8); g.lineTo(x, y); }
    g.lineTo(LWA, LH); g.closePath(); g.fill();
  };
  montanha(118, 46, '#9db2de');
  montanha(140, 34, '#7b93c4');
  const penhasco = (x0, x1, topo, cor, luz, grama) => {
    g.fillStyle = cor;
    g.beginPath(); g.moveTo(x0, LH);
    for (let x = x0; x <= x1; x += 5) g.lineTo(x, topo + Math.sin(x * 0.09) * 5 + R() * 4);
    g.lineTo(x1, LH); g.closePath(); g.fill();
    for (let i = 0; i < (x1 - x0) / 4; i++) {
      g.fillStyle = R() < 0.5 ? luz : 'rgba(0,0,0,.12)';
      g.fillRect(x0 + R() * (x1 - x0), topo + 8 + R() * (200 - topo), 2 + R() * 10, 2 + R() * 4);
    }
    g.fillStyle = grama;
    for (let x = x0; x <= x1; x += 4) g.fillRect(x, topo - 2 + Math.sin(x * 0.09) * 5, 5, 6 + R() * 4);
  };
  penhasco(0, 150, 84, '#58627c', '#717d98', '#4c9a50');
  penhasco(200, 300, 96, '#56607a', '#6c7894', '#478f4b');
  penhasco(320, 520, 62, '#5d6880', '#76829c', '#4c9a50');
  penhasco(560, 700, 80, '#58627c', '#717d98', '#4c9a50');
  CENARIO_A = a;

  // ---- camada B: ruínas, arbustos, chão, cerejeiras (anda junto com os lutadores)
  const b = document.createElement('canvas'); b.width = LWB; b.height = LH;
  const h = b.getContext('2d');
  for (let i = 0; i < 60; i++) circulo(h, R() * LWB, 198 + R() * 12, 6 + R() * 10, 'rgba(235,248,255,.3)');
  const pilar = (x, topo, larg, quebrado) => {
    h.fillStyle = '#9aa0ad'; h.fillRect(x, topo, larg, 214 - topo);
    h.fillStyle = '#b9bfcb'; h.fillRect(x, topo, 3, 214 - topo);
    h.fillStyle = '#727886'; h.fillRect(x + larg - 3, topo, 3, 214 - topo);
    for (let y = topo + 12; y < 214; y += 14) { h.fillStyle = 'rgba(0,0,0,.15)'; h.fillRect(x, y, larg, 1); }
    h.fillStyle = '#c3c8d2'; h.fillRect(x - 3, topo, larg + 6, 4);
    if (quebrado) { h.fillStyle = '#9aa0ad'; h.fillRect(x + 2, topo - 6, larg - 8, 6); h.fillRect(x + 5, topo - 10, 5, 4); }
    for (let i = 0; i < 4; i++) { h.fillStyle = '#5c9a4f'; h.fillRect(x + R() * larg, topo + R() * 60, 3 + R() * 4, 2 + R() * 3); }
  };
  const arco = (cx, raio) => {
    h.strokeStyle = '#9aa0ad'; h.lineWidth = 12;
    h.beginPath(); h.arc(cx, 122, raio, Math.PI, Math.PI * 1.75); h.stroke();
    h.strokeStyle = '#b9bfcb'; h.lineWidth = 3;
    h.beginPath(); h.arc(cx, 122, raio + 6, Math.PI, Math.PI * 1.72); h.stroke();
    pilar(cx - raio - 8, 112, 18, false);
    pilar(cx + raio - 8, 136, 16, true);
  };
  arco(214, 34);
  arco(690, 40);
  for (const [x, t, l] of [[128, 150, 14], [300, 160, 13], [420, 128, 16], [560, 150, 14], [820, 140, 15], [930, 158, 13]]) pilar(x, t, l, true);
  for (let i = 0; i < 8; i++) { h.fillStyle = '#868c99'; h.fillRect(R() * LWB, 202 + R() * 6, 10 + R() * 10, 8 + R() * 4); }
  for (let x = -10; x < LWB + 10; x += 9) {
    const y = 204 + R() * 6;
    circulo(h, x, y, 9 + R() * 6, R() < 0.5 ? '#2f6b3a' : '#3c8045');
    if (R() < 0.3) circulo(h, x + 3, y - 4, 4, '#55a35a');
  }
  // chão de pedra
  h.fillStyle = '#9b9484'; h.fillRect(0, 214, LWB, LH - 214);
  h.strokeStyle = 'rgba(70,62,52,.45)'; h.lineWidth = 1;
  let yl = 216, passo = 4;
  while (yl < LH) { h.beginPath(); h.moveTo(0, yl + 0.5); h.lineTo(LWB, yl + 0.5); h.stroke(); passo *= 1.32; yl += passo; }
  for (let i = -2; i <= 24; i++) {
    const xb = i * 46;
    h.beginPath(); h.moveTo(xb + 10, 214); h.lineTo(xb - 6, LH); h.stroke();
  }
  for (let i = 0; i < 150; i++) { h.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'; h.fillRect(R() * LWB, 216 + R() * 54, 2 + R() * 6, 1 + R() * 2); }
  for (let x = 0; x < LWB; x += 3) { h.fillStyle = R() < 0.5 ? '#4f9a52' : '#5fb35f'; h.fillRect(x, 210 + R() * 3, 3, 5 + R() * 3); }
  for (let i = 0; i < 40; i++) {
    const x = R() * LWB, y = 222 + R() * 46;
    h.fillStyle = '#4f9a52'; h.fillRect(x, y, 6, 3);
    h.fillStyle = R() < 0.5 ? '#ff8fc8' : '#ffffff'; h.fillRect(x + 2, y - 2, 2, 2);
  }
  for (const [x, y, r] of [[18, 252, 10], [380, 262, 7], [600, 256, 9], [982, 248, 12], [960, 264, 7]]) {
    circulo(h, x, y, r, '#6f6a62'); circulo(h, x - r * 0.3, y - r * 0.3, r * 0.55, '#8d877c');
  }
  // cerejeiras
  const copa = (cx, cy, raio, n) => {
    for (let i = 0; i < n; i++) {
      const a2 = R() * Math.PI * 2, d = R() * raio;
      circulo(h, cx + Math.cos(a2) * d, cy + Math.sin(a2) * d * 0.7, 8 + R() * 10, escolha(['#ff9ccf', '#ffb6da', '#f07ab8', '#ffc9e3']));
    }
    for (let i = 0; i < n / 2; i++) { const a2 = R() * Math.PI * 2, d = R() * raio; h.fillStyle = '#fff0f7'; h.fillRect(cx + Math.cos(a2) * d, cy + Math.sin(a2) * d * 0.7, 2, 2); }
  };
  const cerejeira = (x, escala, lado) => {
    h.strokeStyle = '#5a3a2a'; h.lineCap = 'round';
    h.lineWidth = 12 * escala; h.beginPath(); h.moveTo(x, 222); h.quadraticCurveTo(x - 8 * lado, 150, x + 32 * lado * escala, 76 + (1 - escala) * 60); h.stroke();
    h.lineWidth = 6 * escala; h.beginPath(); h.moveTo(x + 10 * lado, 140); h.quadraticCurveTo(x + 46 * lado, 120, x + 84 * lado * escala, 92); h.stroke();
    copa(x + 26 * lado * escala, 50 + (1 - escala) * 60, 70 * escala, Math.round(90 * escala));
    copa(x + 88 * lado * escala, 80 + (1 - escala) * 50, 34 * escala, Math.round(30 * escala));
  };
  cerejeira(34, 1, 1);
  cerejeira(505, 0.75, -1);
  cerejeira(966, 1, -1);
  CENARIO_B = b;
}

const PETALAS = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 16 + Math.random() * 28, f: Math.random() * 6 }));

// Câmera: x = borda esquerda no mundo, zoom = escala (1 = perto, ~0.6 = longe)
function transfMundo(cam, shx = 0, shy = 0) {
  // cam.y > 0 = câmera sobe junto com o personagem (pulos altos, plataformas)
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom + shx, H - H * cam.zoom + (cam.y || 0) * cam.zoom + shy);
}

function desenharCenario(t, dt, cam, shx = 0, shy = 0) {
  // camada distante com cachoeiras animadas
  gA.drawImage(CENARIO_A, 0, 0);
  for (const q of QUEDAS) {
    gA.fillStyle = '#bfe6ff'; gA.fillRect(q.x, q.y0, q.w, q.y1 - q.y0);
    for (let x = q.x; x < q.x + q.w; x += 2) {
      const fase = (x * 37) % 23;
      for (let k = 0; k < 4; k++) {
        const y = q.y0 + ((t * 90 + fase * 7 + k * 31) % (q.y1 - q.y0));
        gA.fillStyle = k % 2 ? '#ffffff' : '#8fcff5';
        gA.fillRect(x, y, 2, 6 + (fase % 5));
      }
    }
    gA.fillStyle = 'rgba(255,255,255,.5)'; gA.fillRect(q.x, q.y0, q.w, 3);
    for (let i = 0; i < 5; i++) circulo(gA, q.x + q.w / 2 + Math.sin(t * 2 + i) * q.w * 0.6, q.y1 - 2, 5 + ((t * 8 + i * 3) % 6), 'rgba(255,255,255,.45)');
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4f9be8';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const zA = 0.55 + 0.45 * cam.zoom;
  const offA = clamp(cam.x * 0.35, 0, LWA * 2 - W / zA);
  ctx.setTransform(zA, 0, 0, zA, -offA * zA + shx * 0.4, H - H * zA + (cam.y || 0) * 0.35 * zA + shy * 0.4);
  ctx.drawImage(camadaA, 0, 0, LWA * 2, LH * 2);
  // camada próxima (mesma escala do mundo)
  transfMundo(cam, shx, shy);
  ctx.drawImage(CENARIO_B, 0, 0, ARENA_W, H);
  ctx.imageSmoothingEnabled = true;
}

function desenharPetalas(t, dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of PETALAS) {
    p.y += p.v * dt; p.x += (Math.sin(t + p.f) * 20 - 12) * dt;
    if (p.y > H) { p.y = -6; p.x = Math.random() * W; }
    if (p.x < -6) p.x = W;
    ctx.fillStyle = Math.sin(t * 3 + p.f) > 0 ? '#ffb6da' : '#ff8fc8';
    ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, 4, Math.sin(t * 4 + p.f) > 0 ? 4 : 2);
  }
}

function desenharPlataformas() {
  for (const pl of PLATAFORMAS) {
    const y = CHAO - pl.y;
    // pilares de sustentação
    for (const px of [pl.x0 + 24, pl.x1 - 52]) {
      ctx.fillStyle = '#7d8391'; ctx.fillRect(px, y + 16, 28, CHAO - y - 16);
      ctx.fillStyle = '#959ba8'; ctx.fillRect(px, y + 16, 6, CHAO - y - 16);
      ctx.fillStyle = '#5f6572'; ctx.fillRect(px + 22, y + 16, 6, CHAO - y - 16);
      for (let yy = y + 36; yy < CHAO; yy += 28) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px, yy, 28, 2); }
    }
    // laje
    ctx.fillStyle = '#5f6572'; ctx.fillRect(pl.x0, y + 4, pl.x1 - pl.x0, 18);
    ctx.fillStyle = '#a7adba'; ctx.fillRect(pl.x0, y - 4, pl.x1 - pl.x0, 12);
    ctx.fillStyle = '#c6cbd5'; ctx.fillRect(pl.x0, y - 4, pl.x1 - pl.x0, 4);
    for (let x = pl.x0 + 30; x < pl.x1; x += 52) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x, y - 4, 2, 26); }
    ctx.fillStyle = '#5c9a4f';
    for (let x = pl.x0 + 8; x < pl.x1 - 8; x += 37) ctx.fillRect(x, y - 6, 14, 4);
  }
}

/* ---------------- Entrada ---------------- */
// 4 botões de golpe: ATAQUE, ESPECIAL, DEFESA, INVESTIDA (o resto sai da combinação com a direção;
// veja traduzirEntrada). O pulo é a direção para cima.
const MAPA_P1 = { KeyA: 'esq', KeyD: 'dir', KeyW: 'cima', KeyS: 'baixo', KeyJ: 'atk', KeyK: 'botaoEsp', KeyL: 'def', ShiftLeft: 'dash', Space: 'dash' };
const MAPA_P2 = { ArrowLeft: 'esq', ArrowRight: 'dir', ArrowUp: 'cima', ArrowDown: 'baixo', Numpad1: 'atk', Numpad2: 'botaoEsp', Numpad3: 'def', Numpad0: 'dash' };
const ENT = [{ h: new Set(), p: new Set() }, { h: new Set(), p: new Set() }];
const MENU_TECLA = {
  ArrowUp: 'cima', KeyW: 'cima', ArrowDown: 'baixo', KeyS: 'baixo', ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir',
  Enter: 'ok', Space: 'ok', KeyJ: 'ok', Numpad1: 'ok', Escape: 'voltar', Backspace: 'voltar', KeyK: 'voltar',
};

document.addEventListener('keydown', (e) => {
  // tela CONTROLES esperando a tecla nova: a próxima tecla vira a escolhida
  if (G.tela === 'controles' && CFG.esperando) {
    e.preventDefault();
    if (!e.repeat && CFG.col < 2) definirTecla(e.code);
    else if (e.code === 'Escape') CFG.esperando = false;
    return;
  }
  const usa = MAPA_P1[e.code] || MAPA_P2[e.code] || MENU_TECLA[e.code];
  if (usa) e.preventDefault();
  if (e.repeat) return;
  if (G.tela === 'luta') {
    if (e.code === 'Escape') { G.pausa = !G.pausa; return; }
    if (e.code === 'KeyH') { G.mostrarJuntas = !G.mostrarJuntas; return; } // mostra/esconde as articulações
    if (G.pausa) { if (e.code === 'Enter') G.pausa = false; if (e.code === 'KeyQ') irPara('titulo'); return; }
    const a1 = MAPA_P1[e.code];
    if (a1) { ENT[0].h.add(a1); ENT[0].p.add(a1); }
    const a2 = MAPA_P2[e.code];
    if (a2 && G.modo === '2p') { ENT[1].h.add(a2); ENT[1].p.add(a2); }
    if (a2 && G.modo !== '2p') { ENT[0].h.add(a2); ENT[0].p.add(a2); } // com 1 jogador as setas também controlam
  } else if (MENU_TECLA[e.code]) teclaMenu(MENU_TECLA[e.code]);
});
document.addEventListener('keyup', (e) => {
  const a1 = MAPA_P1[e.code];
  if (a1) ENT[0].h.delete(a1);
  const a2 = MAPA_P2[e.code];
  if (a2) { ENT[1].h.delete(a2); if (G.modo !== '2p') ENT[0].h.delete(a2); }
});
window.addEventListener('blur', () => ENT.forEach((e) => e.h.clear()));

/* ---------------- Configuração de controles (teclado e controle/gamepad) ----------------
 * Menu CONTROLES: escolhe a ação e aperta a tecla (ou o botão do controle) nova.
 * Fica salvo no navegador. Controle 1 joga como P1; no modo 2 jogadores, o controle 2 é o P2.
 * No controle, o direcional e o analógico esquerdo sempre andam (e "cima" também pula).
 */
const ACOES_CFG = [
  ['esq', 'Esquerda'], ['dir', 'Direita'], ['cima', 'Pular / cima'], ['baixo', 'Baixo'],
  ['atk', 'ATAQUE'], ['botaoEsp', 'ESPECIAL'], ['def', 'DEFESA'], ['dash', 'INVESTIDA'],
];
const PADRAO_P1 = { ...MAPA_P1 }, PADRAO_P2 = { ...MAPA_P2 };
// botões no layout padrão (Xbox / PlayStation): 0 A/✕ · 1 B/○ · 2 X/□ · 3 Y/△ · 4 LB · 5 RB · 6 LT · 7 RT · 8 Select · 9 Start
const PADRAO_PAD = { cima: 0, botaoEsp: 1, atk: 2, def: 5, dash: 4 };
const MAPA_PAD = { ...PADRAO_PAD };
const NOMES_BOTAO = ['A / ✕', 'B / ○', 'X / □', 'Y / △', 'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2', 'SELECT', 'START', 'L3', 'R3'];
const CFG = { lin: 0, col: 0, esperando: false, aviso: '', avisoT: 0 };
const CHAVE_CFG = 'duelo-elemental-controles-4botoes'; // chave nova: o mapa antigo (8 botões) não vale mais

/*
 * Tradução dos 4 botões para as ações do lutador (as mesmas que a CPU usa):
 *  ATAQUE               → combo (correndo = ataque de corrida, no ar = aéreo)
 *  ESPECIAL sozinho     → projétil      · ←/→ + ESPECIAL → golpe especial
 *  ↓ + segurar ESPECIAL → carregar energia
 *  ATAQUE + ESPECIAL juntos, energia cheia → GOLPE FINAL
 *  DEFESA (segurar)     → defender (↓ também defende)
 *  INVESTIDA            → investida/correr · apanhando = troca rápida · ↓ + INVESTIDA parado = provocar
 */
function traduzirEntrada(e, f) {
  const h = new Set(), p = new Set();
  for (const a of ['esq', 'dir', 'cima', 'baixo', 'atk', 'dash']) { if (e.h.has(a)) h.add(a); if (e.p.has(a)) p.add(a); }
  const lado = h.has('esq') || h.has('dir');
  const juntos = (e.p.has('botaoEsp') && (e.h.has('atk') || G.t - (f.ultAtkT || -9) < 0.12)) ||
                 (e.p.has('atk') && e.h.has('botaoEsp'));
  if (e.p.has('atk')) f.ultAtkT = G.t;
  if (juntos && f.en >= 100) { p.add('final'); p.delete('atk'); }
  else if (e.p.has('botaoEsp')) {
    if (h.has('baixo')) {/* começa a carregar (abaixo) */}
    else if (lado) p.add('esp');
    else p.add('proj');
  }
  // ↓ + segurar ESPECIAL: carrega (e não defende)
  if (e.h.has('botaoEsp') && h.has('baixo') && f.solo) { h.add('carga'); h.delete('baixo'); }
  // botão DEFESA: segura a guarda (no chão vira o mesmo que segurar ↓)
  if (e.h.has('def') && f.solo) h.add('baixo');
  // INVESTIDA: apanhando = troca rápida; ↓ + INVESTIDA parado no chão = provocar
  if (p.has('dash')) {
    if (f.est === 'hurt') { p.delete('dash'); p.add('sub'); }
    else if (h.has('baixo') && f.solo && Math.abs(f.vx) < 60 && !e.h.has('def')) { p.delete('dash'); p.add('provocar'); }
  }
  return { h, p };
}

function trocarMapa(alvo, novo) { for (const k of Object.keys(alvo)) delete alvo[k]; Object.assign(alvo, novo); }
function salvarControles() {
  try { localStorage.setItem(CHAVE_CFG, JSON.stringify({ p1: MAPA_P1, p2: MAPA_P2, pad: MAPA_PAD })); } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
}
function carregarControles() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_CFG) || 'null');
    if (!s) return;
    if (s.p1) trocarMapa(MAPA_P1, s.p1);
    if (s.p2) trocarMapa(MAPA_P2, s.p2);
    if (s.pad) trocarMapa(MAPA_PAD, s.pad);
  } catch (e) { /* configuração inválida: fica o padrão */ }
}
carregarControles();

function nomeTecla(code) {
  const esp = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPAÇO', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT D',
    ControlLeft: 'CTRL', ControlRight: 'CTRL D', AltLeft: 'ALT', AltRight: 'ALT GR', Enter: 'ENTER', Tab: 'TAB', Backspace: '⌫',
    Semicolon: 'Ç', Comma: ',', Period: '.', Slash: ';', Minus: '-', Equal: '=', BracketLeft: '´', BracketRight: '[', Backslash: ']', Quote: '~' };
  if (esp[code]) return esp[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6).replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.').replace('Enter', 'ENTER');
  return code.toUpperCase();
}
function teclasDe(mapa, acao) {
  const t = Object.keys(mapa).filter((k) => mapa[k] === acao).map(nomeTecla);
  return t.length ? t.join(' / ') : '—';
}
function botaoDe(acao) {
  const fixo = { esq: '← / analóg.', dir: '→ / analóg.', baixo: '↓ / analóg.' };
  if (fixo[acao]) return fixo[acao];
  const b = MAPA_PAD[acao];
  const nome = b === undefined ? '—' : (NOMES_BOTAO[b] || 'BOTÃO ' + b);
  return acao === 'cima' ? nome + ' / ↑' : nome;
}
function avisarCfg(txt) { CFG.aviso = txt; CFG.avisoT = 2.2; }

function definirTecla(code) {
  if (code === 'Escape') { CFG.esperando = false; return; }
  const acao = ACOES_CFG[CFG.lin][0], mapa = CFG.col === 0 ? MAPA_P1 : MAPA_P2;
  // uma tecla faz só uma coisa: tira ela de onde estava (nos dois jogadores)
  for (const m of [MAPA_P1, MAPA_P2]) if (m[code]) { if (m[code] !== acao || m !== mapa) avisarCfg(`${nomeTecla(code)} saiu de "${ACOES_CFG.find((a) => a[0] === m[code])[1]}"`); delete m[code]; }
  for (const k of Object.keys(mapa)) if (mapa[k] === acao) delete mapa[k];
  mapa[code] = acao;
  CFG.esperando = false;
  salvarControles();
}
function definirBotao(i) {
  const acao = ACOES_CFG[CFG.lin][0];
  // se o botão já tinha outra ação, as duas trocam de botão
  const outra = Object.keys(MAPA_PAD).find((a) => MAPA_PAD[a] === i && a !== acao);
  if (outra) {
    if (MAPA_PAD[acao] !== undefined) MAPA_PAD[outra] = MAPA_PAD[acao]; else delete MAPA_PAD[outra];
    avisarCfg(`trocou com "${ACOES_CFG.find((a) => a[0] === outra)[1]}"`);
  }
  MAPA_PAD[acao] = i;
  CFG.esperando = false;
  salvarControles();
}
function restaurarControles() {
  trocarMapa(MAPA_P1, PADRAO_P1); trocarMapa(MAPA_P2, PADRAO_P2); trocarMapa(MAPA_PAD, PADRAO_PAD);
  salvarControles();
  avisarCfg('controles voltaram ao padrão');
}
function teclaControles(k) {
  const N = ACOES_CFG.length; // linhas: ações, RESTAURAR PADRÃO, VOLTAR
  if (k === 'voltar') { irPara('titulo'); return; }
  if (k === 'cima') CFG.lin = (CFG.lin + N + 1) % (N + 2);
  if (k === 'baixo') CFG.lin = (CFG.lin + 1) % (N + 2);
  if (k === 'esq') CFG.col = (CFG.col + 2) % 3;
  if (k === 'dir') CFG.col = (CFG.col + 1) % 3;
  if (k !== 'ok') return;
  if (CFG.lin === N) { restaurarControles(); return; }
  if (CFG.lin === N + 1) { irPara('titulo'); return; }
  const acao = ACOES_CFG[CFG.lin][0];
  if (CFG.col === 2 && (acao === 'esq' || acao === 'dir' || acao === 'baixo')) { avisarCfg('no controle, direcional e analógico já fazem isso'); return; }
  CFG.esperando = true;
}

// leitura do controle (gamepad), uma vez por quadro
const PAD_ANT = [];
function lerControles() {
  let pads = [];
  try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { return; }
  pads.slice(0, 2).forEach((gp, n) => {
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const ant = PAD_ANT[n] || { botoes: [], acoes: new Set(), dirs: new Set() };
    const novo = (i) => b(i) && !ant.botoes[i];
    // direções (direcional + analógico): servem para andar e para os menus
    const dirs = new Set();
    if (b(14) || ax < -0.5) dirs.add('esq');
    if (b(15) || ax > 0.5) dirs.add('dir');
    if (b(12) || ay < -0.6) dirs.add('cima');
    if (b(13) || ay > 0.6) dirs.add('baixo');
    if (G.tela === 'controles' && CFG.esperando) {
      if (CFG.col === 2) for (let i = 0; i < Math.min(12, gp.buttons.length); i++) if (novo(i)) { definirBotao(i); break; }
    } else if (G.tela === 'luta') {
      if (novo(9)) G.pausa = !G.pausa;                                      // START: pausa
      else if (G.pausa && novo(0)) G.pausa = false;                         // A: continuar
      else if (G.pausa && novo(1)) irPara('titulo');                        // B: sair para o menu
      const acoes = new Set(dirs);
      for (const [acao, bi] of Object.entries(MAPA_PAD)) if (b(bi)) acoes.add(acao);
      const e = ENT[G.modo === '2p' ? n : 0];
      if (!G.pausa) for (const a of acoes) if (!ant.acoes.has(a)) { e.h.add(a); e.p.add(a); }
      for (const a of ant.acoes) if (!acoes.has(a)) e.h.delete(a);
      ant.acoes = G.pausa ? new Set() : acoes;
    } else {
      // menus: direcional/analógico navega, A confirma, B volta
      for (const d of dirs) if (!ant.dirs.has(d)) teclaMenu(d);
      if (novo(0) || novo(9)) teclaMenu('ok');
      if (novo(1)) teclaMenu('voltar');
      ant.acoes = new Set();
    }
    ant.dirs = dirs;
    ant.botoes = gp.buttons.map((_, i) => b(i));
    PAD_ANT[n] = ant;
  });
}

function desenharControles(dt) {
  desenharFundoMenu(dt);
  CFG.avisoT = Math.max(0, CFG.avisoT - dt);
  ctx.fillStyle = 'rgba(18,12,30,.9)'; ctx.fillRect(40, 18, W - 80, H - 36);
  texto('CONTROLES', W / 2, 46, 20, '#ffcf4a');
  const COLS = [{ x: 470, t: 'TECLADO P1' }, { x: 640, t: 'TECLADO P2' }, { x: 815, t: 'CONTROLE' }];
  COLS.forEach((c, i) => texto(c.t, c.x, 80, 9, i === CFG.col ? '#ffffff' : '#a698c6'));
  const y0 = 106, dy = 26, N = ACOES_CFG.length;
  ACOES_CFG.forEach(([acao, nome], l) => {
    const y = y0 + l * dy, linSel = l === CFG.lin;
    texto(nome, 80, y, 10, linSel ? '#ffffff' : '#c9bfe6', 'left');
    const vals = [teclasDe(MAPA_P1, acao), teclasDe(MAPA_P2, acao), botaoDe(acao)];
    vals.forEach((v, c) => {
      const sel = linSel && c === CFG.col;
      if (sel) { ctx.fillStyle = CFG.esperando ? 'rgba(255,207,74,.35)' : 'rgba(79,182,255,.28)'; ctx.fillRect(COLS[c].x - 80, y - 11, 160, 22); }
      texto(sel && CFG.esperando ? '...' : v, COLS[c].x, y, v.length > 14 ? 7 : 9, sel ? '#ffffff' : '#ffcf4a', 'center', false);
    });
  });
  [['RESTAURAR PADRÃO', N], ['VOLTAR', N + 1]].forEach(([t, l], i) => {
    const sel = CFG.lin === l;
    texto((sel ? '▶ ' : '') + t, W / 2, y0 + N * dy + 14 + i * 26, sel ? 13 : 11, sel ? '#ffffff' : '#a698c6');
  });
  let pads = [];
  try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { /* sem suporte */ }
  texto(pads.length ? `Controle conectado: ${pads.length}` : 'Nenhum controle: conecte e aperte um botão', W / 2, H - 52, 8, pads.length ? '#7dff9a' : '#a698c6', 'center', false);
  if (CFG.esperando) {
    const nome = ACOES_CFG[CFG.lin][1];
    texto(CFG.col === 2 ? `Aperte o BOTÃO do controle para "${nome}"` : `Aperte a TECLA nova para "${nome}" (Esc cancela)`, W / 2, H - 32, 10, '#ffcf4a');
  } else if (CFG.avisoT > 0) texto(CFG.aviso, W / 2, H - 32, 9, '#7dff9a', 'center', false);
  else texto('Setas: escolher · Enter: mudar · Esc: voltar', W / 2, H - 32, 9, '#a698c6', 'center', false);
}

/* ---------------- Estado do jogo ---------------- */
const G = {
  tela: 'carregando', t: 0, modo: 'cpu', menuSel: 0,
  sel: { etapa: 0, p: ['brasa', 'geada'] },
  f: [], vit: [0, 0], round: 1, tempo: 99, fase: 'intro', faseT: 0,
  proj: [], part: [], textos: [], rastros: [], zonas: [], hitstop: 0, shake: 0, slow: 1, cine: null, anuncio: null, pausa: false, vencedor: -1,
  cam: { x: (ARENA_W - W) / 2, zoom: 1 },
};

function irPara(tela) {
  G.tela = tela;
  G.menuSel = 0;
  G.pausa = false;
  ENT.forEach((e) => { e.h.clear(); e.p.clear(); });
}

const MENU_TITULO = [
  { txt: '1 JOGADOR  (vs CPU)', acao: () => { G.modo = 'cpu'; G.sel = { etapa: 0, p: ['brasa', 'geada'] }; irPara('selecao'); } },
  { txt: '2 JOGADORES', acao: () => { G.modo = '2p'; G.sel = { etapa: 0, p: ['brasa', 'geada'] }; irPara('selecao'); } },
  { txt: 'CPU VS CPU  (assistir)', acao: () => { G.modo = 'cpuvscpu'; G.sel = { etapa: 0, p: ['brasa', 'geada'] }; irPara('selecao'); } },
  { txt: 'COMO JOGAR', acao: () => irPara('ajuda') },
  { txt: 'CONTROLES', acao: () => { CFG.lin = 0; CFG.col = 0; CFG.esperando = false; irPara('controles'); } },
];

// Modo livre: só um lutador na arena (Geada por padrão), para treinar movimentação
function iniciarSolo(id = 'geada') {
  G.modo = 'solo';
  irPara('luta');
  const f = novoLutador(id, 0);
  f.x = ARENA_W / 2; f.face = 1;
  G.f = [f];
  G.proj = []; G.part = []; G.textos = []; G.rastros = []; G.zonas = [];
  G.fase = 'luta'; G.faseT = 0; G.cine = null; G.slow = 1; G.hitstop = 0; G.tempo = 99;
  atualizarCamera(0, true);
  anunciar('MODO LIVRE', 1.2, '#d6f3ff');
}

function teclaMenu(k) {
  if (G.tela === 'titulo') {
    if (k === 'cima') G.menuSel = (G.menuSel + MENU_TITULO.length - 1) % MENU_TITULO.length;
    if (k === 'baixo') G.menuSel = (G.menuSel + 1) % MENU_TITULO.length;
    if (k === 'ok') MENU_TITULO[G.menuSel].acao();
  } else if (G.tela === 'controles') {
    teclaControles(k);
  } else if (G.tela === 'ajuda') {
    if (k === 'ok' || k === 'voltar') irPara('titulo');
  } else if (G.tela === 'selecao') {
    const s = G.sel;
    if (k === 'voltar') { if (s.etapa > 0) s.etapa--; else irPara('titulo'); return; }
    if (s.etapa < 2 && (k === 'esq' || k === 'dir')) {
      const i = ORDEM_PERS.indexOf(s.p[s.etapa]);
      s.p[s.etapa] = ORDEM_PERS[(i + (k === 'dir' ? 1 : ORDEM_PERS.length - 1)) % ORDEM_PERS.length];
    }
    if (k === 'ok') { s.etapa++; if (s.etapa >= 2) iniciarPartida(); }
  } else if (G.tela === 'fim') {
    if (k === 'cima' || k === 'baixo') G.menuSel = 1 - G.menuSel;
    if (k === 'ok') { if (G.menuSel === 0) iniciarPartida(); else irPara('titulo'); }
  }
}

/* ---------------- Lutadores ---------------- */
function novoLutador(id, lado) {
  return {
    p: PERS[id], id, escala: ALTURA_PERS / FOLHAS[id].alturaBase,
    x: ARENA_W / 2 + (lado === 0 ? -230 : 230), y: 0, vx: 0, vy: 0, face: lado === 0 ? 1 : -1, solo: true,
    hp: 1000, hpVis: 1000, en: 50, est: 'idle', t: 0, atq: null, stun: 0, invul: 0, flash: 0,
    combo: 0, ultimoHit: -9, aereoUsado: false, puloDuplo: false, dashAr: false, atravessar: 0, derrubado: false, lado,
    dashDir: 1, rastroT: 0,
    ia: { t: 0, acao: null, dur: 0, subTentou: false },
  };
}

function iniciarPartida() {
  G.vit = [0, 0];
  G.round = 1;
  irPara('luta');
  iniciarRound();
}

function iniciarRound() {
  G.f = [novoLutador(G.sel.p[0], 0), novoLutador(G.sel.p[1], 1)];
  G.proj = []; G.part = []; G.textos = []; G.rastros = []; G.zonas = [];
  G.tempo = 99; G.fase = 'intro'; G.faseT = 0; G.cine = null; G.slow = 1; G.hitstop = 0;
  atualizarCamera(0, true);
  anunciar(`ROUND ${G.round}`, 1.3);
}

function anunciar(txt, dur, cor = '#ffcf4a') { G.anuncio = { txt, t: 0, dur, cor }; }
function textoFlutuante(x, y, txt, cor = '#fff', tam = 18) { G.textos.push({ x, y, txt, cor, tam, t: 0 }); }

function particulas(x, y, n, cores, vel = 300, vida = 0.5, tam = 5, grav = 600) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = Math.random() * vel;
    G.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - vel * 0.3, vida, t: 0, cor: escolha(cores), tam: tam * (0.5 + Math.random()), grav });
  }
}
function poeira(f, n = 8) { particulas(f.x, CHAO - f.y - 4, n, ['#d8d0c0', '#b0a898'], 140, 0.35, 6, 0); }
function coresElem(f) {
  if (f.p.elem === 'fogo') return ['#ff5a3c', '#ffb347', '#ffd166', '#fff3b0'];
  if (f.p.elem === 'vento') return ['#ff6fc8', '#c9a8ff', '#8fb8ff', '#ffffff'];
  return ['#4fb6ff', '#9fe0ff', '#d6f3ff', '#ffffff'];
}

/* ---------------- Física (chão + plataformas) ---------------- */
function apoioEm(x, y) {
  if (y <= 0) return true;
  return PLATAFORMAS.some((pl) => Math.abs(pl.y - y) < 0.5 && x >= pl.x0 && x <= pl.x1);
}

function aterrissar(f) {
  f.aereoUsado = false; f.puloDuplo = false; f.pulosAr = 0; f.flipNinja = false; f.dashAr = false; f.quedaRapida = false;
  if (f.est === 'air') {
    // aterrissar: pesado (Brasa) faz tremer e levanta poeira; leve (Geada) é rápido
    const pesado = f.p.defesa > 1;
    if (!pesado && Math.abs(f.vx) > f.p.vel * 0.9) {
      // NINJA: caiu correndo → rolamento no chão, mantendo o embalo, quase sem barulho
      f.est = 'rolamento'; f.t = 0; f.rolDir = Math.sign(f.vx); f.face = f.rolDir;
      f.vx = f.rolDir * Math.max(Math.abs(f.vx), f.p.vel * 1.3);
      f.invul = Math.max(f.invul, 0.12);
      poeira(f, 3);
    } else if (!pesado) {
      // NINJA: pouso leve e silencioso, agachadinha rápida
      // pouso ninja: agacha firme num instante (amortece) e já está pronta para agir
      f.est = 'pouso'; f.t = 0; f.pousoDur = 0.1; f.vx *= 0.4;
      poeira(f, 2);
    } else {
      f.est = 'pouso'; f.t = 0; f.pousoDur = 0.1; f.vx *= 0.2;
      poeira(f, 16);
      G.shake = Math.max(G.shake, 3);
    }
  }
  if (f.est === 'atk' && f.atq && f.atq.def.aereo) { f.est = 'idle'; f.atq = null; }
  if (f.derrubado || f.est === 'ko') { G.shake = Math.max(G.shake, 4); poeira(f, 14); }
}

function fisica(f, dt) {
  f.atravessar = Math.max(0, f.atravessar - dt);
  f.coyote = Math.max(0, (f.coyote || 0) - dt);
  f.bufferPulo = Math.max(0, (f.bufferPulo || 0) - dt);
  if (f.solo && !apoioEm(f.x, f.y)) {
    // saiu da beirada andando: ainda dá para pular por um instante (coyote time)
    f.solo = false; f.vy = 0;
    if (f.est === 'idle' || f.est === 'walk' || f.est === 'corrida' || f.est === 'freio') { f.est = 'air'; f.coyote = f.p.mov.coyote; }
  }
  if (!f.solo) {
    const yAnt = f.y;
    let g = GRAV * (f.p.gravMult || 1);                                  // Geada é mais leve no ar
    // flutua no topo do pulo (sobe devagarinho, para no ar um instante, começa a descer devagar)
    if (Math.abs(f.vy) < 230 && !f.quedaRapida) g *= f.p.flutua || 0.6;
    else if (f.vy < 0) g *= f.p.mov.queda;                              // cai um pouco mais rápido do que sobe
    if (f.est === 'dash') f.vy = Math.max(f.vy, 0) - GRAV * dt * 0.15;
    else f.vy = Math.max(f.vy - g * dt, -1500);
    f.y += f.vy * dt;
    if (f.vy <= 0) {
      let s = null;
      if (f.y <= 0) s = 0;
      if (!f.atravessar) for (const pl of PLATAFORMAS) {
        if (f.x >= pl.x0 && f.x <= pl.x1 && yAnt >= pl.y - 0.01 && f.y <= pl.y && (s === null || pl.y > s)) s = pl.y;
      }
      if (s !== null) { f.y = s; f.vy = 0; f.solo = true; aterrissar(f); }
    }
  }
  if (f.solo && (f.est === 'hurt' || f.est === 'caido' || f.est === 'ko' || f.est === 'atk')) f.vx *= Math.pow(0.0015, dt);
  f.x = clamp(f.x + f.vx * dt, 50, ARENA_W - 50);
}

/* ---------------- Ações ---------------- */
function iniciarAtq(f, nome) {
  const def = ATQ[nome];
  if (def.custo) f.en -= def.custo;
  f.est = 'atk'; f.t = 0;
  f.atq = { nome, def, t: 0, acertou: false, encadear: false, lancou: false };
  if (!def.aereo) f.vx = 0;
  if (nome === 'especial') {
    textoFlutuante(f.x, CHAO - f.y - 210, f.p.especial, f.p.cor2, 14); particulas(f.x + f.face * 60, CHAO - f.y - 90, 14, coresElem(f), 260, 0.5, 6, 0);
    if (f.p.mecanica === 'gelo' && f.solo) criarZona('gelo', f.x + f.face * 40, f.y, f); // Giro Glacial congela o chão em volta
  }
  if (nome === 'final') { anunciar(f.p.final, 1.1, f.p.cor2); particulas(f.x, CHAO - f.y - 90, 40, coresElem(f), 400, 0.7, 7, 0); }
}

function iniciarDash(f, dir) {
  f.est = 'dash'; f.t = 0; f.dashDir = dir; f.face = dir; f.atq = null;
  f.invul = Math.max(f.invul, 0.14);
  if (!f.solo) { f.dashAr = true; f.vy = 60; }
  particulas(f.x - dir * 30, CHAO - f.y - 60, 12, coresElem(f), 160, 0.35, 6, 0);
  poeira(f, 6);
}

function caixaAtq(f, def) {
  const a = f.x + f.face * def.alc[0], b = f.x + f.face * def.alc[1];
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: f.y + def.alt[0], y1: f.y + def.alt[1] };
}
function caixaCorpo(o) { return { x0: o.x - 38, x1: o.x + 38, y0: o.y, y1: o.y + 150 }; }
const sobrepoe = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const vulneravel = (o) => o.invul <= 0 && o.est !== 'ko' && o.est !== 'caido' && !G.cine;

/* ---------------- Vantagem de elemento ----------------
 * Triângulo: fogo derrete gelo · gelo congela vento · vento apaga fogo.
 * Com vantagem o golpe dá +10% ("SUPER EFETIVO!"); contra quem te vence, −8% ("pouco efetivo...").
 * Para um elemento novo (ex.: elétrico), é só incluir quem ele vence aqui.
 */
const VENCE = { fogo: ['gelo'], gelo: ['vento'], vento: ['fogo'] };
const NOME_ELEM = { fogo: 'FOGO', gelo: 'GELO', vento: 'VENTO' };
// testado CPU x CPU: 1.2/0.85 deixava quem tem vantagem ganhar ~85%; 1.1/0.92 fica em ~65-78%
const ELEM_FORTE = 1.1, ELEM_FRACO = 0.92;
function vantagemElem(eAt, eDf) {
  if ((VENCE[eAt] || []).includes(eDf)) return ELEM_FORTE;
  if ((VENCE[eDf] || []).includes(eAt)) return ELEM_FRACO;
  return 1;
}
function avisoElem(mult, x, y) {
  if (mult > 1) textoFlutuante(x, y - 48, 'SUPER EFETIVO!', '#ffcf4a', 12);
  else if (mult < 1) textoFlutuante(x, y - 48, 'pouco efetivo...', '#a698c6', 10);
}

function aplicarDano(at, df, def, dirX, px, py) {
  if (def.final) { iniciarCine(at, df); return; }
  const bloqueou = df.est === 'defesa' && df.face === -dirX;
  if (bloqueou) {
    const chip = Math.round(def.dano * 0.12);
    df.hp = Math.max(1, df.hp - chip);
    df.vx = dirX * 180;
    df.en = Math.min(100, df.en + 3);
    particulas(px, py, 10, ['#ffffff', '#cfd8ff', '#8fa8ff'], 250, 0.3, 4, 0);
    textoFlutuante(px, py - 30, 'DEFESA', '#cfd8ff', 12);
    G.hitstop = 0.04;
    mecanicaNoGolpe(at, df, true);
    return;
  }
  const elem = vantagemElem(at.p.elem, df.p.elem);
  const dano = Math.round(def.dano * at.p.forca / df.p.defesa * rand(0.95, 1.05) * (at.furia > 0 ? FURIA_DANO : 1) * elem);
  df.hp = Math.max(0, df.hp - dano);
  avisoElem(elem, px, py);
  // FÚRIA do Brasa: a 1ª pancada é absorvida pela armadura (leva o dano, mas não sai do lugar)
  if (df.furia > 0 && df.armadura > 0 && df.hp > 0) {
    df.armadura--; df.flash = 0.12;
    at.en = Math.min(100, at.en + 7);
    textoFlutuante(px, py - 20, String(dano), '#ffffff', 16);
    textoFlutuante(df.x, CHAO - df.y - 200, 'ARMADURA!', '#ffb347', 12);
    particulas(px, py, 18, ['#ff5a3c', '#ffb347', '#ffffff'], 300, 0.4, 6, 0);
    G.hitstop = 0.08; G.shake = 6;
    mecanicaNoGolpe(at, df, false);
    return;
  }
  at.en = Math.min(100, at.en + 7);
  // golpes do Brasa queimam: labaredas no ponto do impacto
  if (at.p.elem === 'fogo') for (let i = 0; i < 10; i++) G.part.push({ x: px + rand(-25, 25), y: py + rand(-25, 25), vx: rand(-60, 60), vy: -rand(120, 280), vida: 0.5, t: 0, cor: escolha(['#ff5a3c', '#ffb347', '#ffd166']), tam: rand(7, 13), grav: -120 });
  df.en = Math.min(100, df.en + 7);
  // peso: o Brasa voa menos e sai do atordoamento antes; a Geada voa mais longe
  const peso = df.p.peso || 1;
  df.est = 'hurt'; df.t = 0; df.stun = def.stun / Math.sqrt(peso); df.atq = null;
  df.vx = dirX * def.kb / peso;
  df.face = -dirX;
  df.ia.subTentou = false;
  if ((def.derruba && !(df.furia > 0)) || df.hp <= 0) { df.vy = 460; df.solo = false; df.derrubado = true; } // em Fúria o Brasa não cai
  else if (!df.solo) df.vy = 220;
  df.flash = 0.12;
  at.combo = G.t - at.ultimoHit < 1.0 ? at.combo + 1 : 1;
  at.ultimoHit = G.t;
  G.hitstop = def.dano >= 100 ? 0.1 : 0.06;
  G.shake = def.dano >= 100 ? 10 : 5;
  particulas(px, py, def.dano >= 100 ? 26 : 14, coresElem(at), 380, 0.45, 6, 300);
  particulas(px, py, 6, ['#ffffff'], 200, 0.2, 8, 0);
  textoFlutuante(px, py - 20, String(dano), '#ffffff', def.dano >= 100 ? 22 : 16);
  mecanicaNoGolpe(at, df, false);
  if (df.hp <= 0) nocaute(df, at);
}

function nocaute(df, at) {
  df.est = 'ko'; df.t = 0; df.vy = 520; df.vx = (df.x < at.x ? -1 : 1) * 380; df.solo = false;
  G.slow = 0.35;
  G.fase = 'ko'; G.faseT = 0;
  anunciar('K.O.!', 1.6, '#ff5a3c');
}

function trocaRapida(f, o) {
  f.en -= 25;
  particulas(f.x, CHAO - f.y - 80, 30, ['#e8e8f0', '#c8c8d8', '#ffffff'], 220, 0.6, 10, -80);
  textoFlutuante(f.x, CHAO - f.y - 220, 'TROCA RÁPIDA!', '#ffffff', 14);
  f.x = clamp(o.x - o.face * 95, 50, ARENA_W - 50);
  f.y = o.solo ? o.y : 0;
  f.solo = apoioEm(f.x, f.y);
  if (!f.solo) f.y = Math.max(f.y, 1);
  f.vy = 0; f.vx = 0; f.est = f.solo ? 'idle' : 'air'; f.t = 0; f.stun = 0; f.derrubado = false;
  f.invul = 0.4; f.face = o.x >= f.x ? 1 : -1;
  if (o.atq) o.atq.acertou = true;
  particulas(f.x, CHAO - f.y - 80, 20, ['#e8e8f0', '#ffffff'], 180, 0.5, 9, -80);
}

function semEnergia(f) { textoFlutuante(f.x, CHAO - f.y - 210, 'SEM ENERGIA', '#a698c6', 10); }

function pular(f, inp) {
  const d = (inp.h.has('dir') ? 1 : 0) - (inp.h.has('esq') ? 1 : 0);
  // descer da plataforma: baixo + pulo
  if (inp.h.has('baixo') && f.y > 0) { f.solo = false; f.atravessar = 0.3; f.vy = 0; f.est = 'air'; f.t = 0; return; }
  const correndo = f.est === 'corrida' || Math.abs(f.vx) > f.p.vel * 1.3;
  f.duploPend = false;
  if (f.solo) {
    // impulso: agacha um instante antes de sair do chão (Brasa demora mais, Geada quase nada).
    // Soltar o pulo durante o impulso = pulo baixinho.
    f.est = 'impulso'; f.t = 0; f.impCorrendo = correndo; f.impSoltou = false;
    f.impDur = f.p.peso > 1 ? 0.085 : 0.045;
    return;
  }
  lancarPulo(f, d, correndo, false);
}

function lancarPulo(f, d, correndo, baixinho) {
  f.vy = f.p.pulo * (correndo ? 1.05 : 1) * (baixinho ? 0.62 : 1);
  f.solo = false; f.coyote = 0; f.bufferPulo = 0;
  f.puloSegurado = !baixinho; // soltar o botão cedo = pulo mais baixo
  // pulo longo a partir da corrida; parado, sai com a velocidade que já tinha
  f.vx = correndo ? f.vx * 0.95 : (d ? d * Math.max(f.p.vel, Math.abs(f.vx)) : f.vx * 0.6);
  f.est = 'air'; f.t = 0;
  // NINJA: pulando em movimento, a Geada dá um mortal para frente encolhida
  f.flipNinja = USAR_PULOS_EXTRAS && f.p.peso < 1 && !baixinho && Math.abs(f.vx) > f.p.vel * 0.45;
  f.flipDir = Math.sign(f.vx) || f.face; f.flipDur = 0.4;
  // pulo em movimento (usa o clipe 'ninja' desenhado, se o personagem tiver)
  f.saltoMov = !baixinho && Math.abs(f.vx) > f.p.vel * 0.45;
  poeira(f, f.p.peso > 1 ? 12 : 3);
}

function atualizarLutador(f, o, inp, dt) {
  f.t += dt;
  f.invul = Math.max(0, f.invul - dt);
  f.flash = Math.max(0, f.flash - dt);
  const livre = f.est === 'idle' || f.est === 'walk' || f.est === 'defesa' || f.est === 'carga';
  const d = (inp.h.has('dir') ? 1 : 0) - (inp.h.has('esq') ? 1 : 0);
  // sem oponente, ela olha para onde anda; numa luta, olha para o oponente
  if (livre) f.face = o === ALVO_NULO ? (d || f.face) : (o.x >= f.x ? 1 : -1);
  if (o === ALVO_NULO && f.est === 'air' && d) f.face = d;
  if (f.est === 'corrida' && !f.solo) f.est = 'air';

  // dois toques rápidos na mesma direção = correr; dois toques para baixo = atravessar plataforma
  let duploToque = 0, duploBaixo = false;
  const toque = inp.p.has('dir') ? 1 : inp.p.has('esq') ? -1 : 0;
  if (toque) {
    if (f.ultToque === toque && G.t - f.ultToqueT < 0.25) duploToque = toque;
    f.ultToque = toque; f.ultToqueT = G.t;
  }
  if (inp.p.has('baixo')) {
    if (G.t - (f.ultBaixoT || -9) < 0.25) duploBaixo = true;
    f.ultBaixoT = G.t;
  }
  // segurando para correr: Shift/Espaço, ou a direção depois do toque duplo
  const segurandoCorrida = (dir) => inp.h.has('dash') || (f.correToque && d === dir);

  if (f.est === 'hurt' && inp.p.has('sub') && f.en >= 25 && G.fase === 'luta') { trocaRapida(f, o); return; }

  switch (f.est) {
    case 'idle': case 'walk': case 'defesa': case 'carga': {
      if (G.fase !== 'luta') { f.vx = 0; f.est = 'idle'; break; }
      if (inp.p.has('final') && f.en >= 100) { iniciarAtq(f, 'final'); break; }
      if (inp.p.has('esp')) { if (f.en >= ATQ.especial.custo) { iniciarAtq(f, 'especial'); break; } semEnergia(f); }
      if (inp.p.has('proj')) { if (f.en >= ATQ.projetil.custo) { iniciarAtq(f, 'projetil'); break; } semEnergia(f); }
      if (inp.p.has('atk')) { iniciarAtq(f, 'soco1'); break; }
      if (inp.p.has('dash')) { f.correToque = false; iniciarDash(f, d || f.face); break; }
      if (duploToque) { f.correToque = true; iniciarDash(f, duploToque); break; }
      if (duploBaixo && f.y > 0) { f.solo = false; f.atravessar = 0.3; f.vy = 0; f.est = 'air'; f.t = 0; break; }
      if (inp.p.has('cima')) { pular(f, inp); break; }
      if (inp.p.has('provocar')) {
        f.est = 'provocar'; f.t = 0; f.vx = 0;
        textoFlutuante(f.x, CHAO - f.y - 230, f.p.provocacao, '#ffffff', 11);
        break;
      }
      if (f.bufferPulo > 0) { pular(f, inp); break; } // pulo apertado pouco antes de tocar o chão
      if (inp.h.has('baixo')) { f.est = 'defesa'; f.vx = 0; break; }
      if (inp.h.has('carga')) {
        if (f.est !== 'carga') f.t = 0;
        f.est = 'carga'; f.vx = 0;
        f.en = Math.min(100, f.en + 40 * dt);
        if (Math.random() < 0.6) {
          G.part.push({ x: f.x + rand(-45, 45), y: CHAO - f.y - rand(0, 30), vx: 0, vy: -rand(120, 260), vida: 0.6, t: 0, cor: escolha(coresElem(f)), tam: rand(3, 7), grav: 0 });
        }
        break;
      }
      if (d) {
        // acelera até a velocidade de caminhada (não arranca na hora)
        const alvo = d * f.p.vel * (d === f.face ? 1 : 0.85);
        const ac = Math.sign(f.vx) === -d ? f.p.mov.freio : f.p.mov.acel;
        f.vx = aproximar(f.vx, alvo, ac * dt);
        f.est = 'walk';
        // ciclo da caminhada acompanha a distância andada (pés não patinam)
        f.ciclo = (f.ciclo || 0) + Math.abs(f.vx) * dt / (f.p.defesa > 1 ? 230 : 270);
        // passos: Brasa pisa pesado (poeira e tremidinha), Geada pisa leve
        f.passo = (f.passo || 0) + Math.abs(f.vx) * dt;
        if (f.passo > (f.p.defesa > 1 ? 95 : 120)) {
          f.passo = 0;
          if (f.p.defesa > 1) { poeira(f, 7); G.shake = Math.max(G.shake, 2); } else poeira(f, 2); // Brasa: passo pesado
        }
      } else {
        // freia até parar
        f.vx = aproximar(f.vx, 0, f.p.mov.freio * dt);
        f.est = Math.abs(f.vx) > 60 ? 'walk' : 'idle';
      }
      break;
    }
    case 'air': {
      if (d) { const mx = Math.max(f.p.vel * 1.1, Math.abs(f.vx)); f.vx = clamp(f.vx + d * f.p.mov.acelAr * dt, -mx, mx); }
      else f.vx = aproximar(f.vx, 0, f.p.mov.acelAr * 0.15 * dt); // resistência do ar leve
      // pulo variável: soltou o botão durante a subida = corta o pulo
      if (f.puloSegurado && !f.cpu && !inp.h.has('cima')) { f.puloSegurado = false; if (f.vy > 0) f.vy *= 0.5; }
      if (f.vy <= 0) f.puloSegurado = false;
      if (G.fase !== 'luta') break;
      if (inp.p.has('cima') && f.coyote > 0) { pular(f, inp); break; }
      // queda rápida: apertar para baixo no ar (depois de começar a cair) despenca
      if (inp.p.has('baixo') && f.vy < 250 && !f.quedaRapida) {
        f.quedaRapida = true; f.puloSegurado = false;
        f.vy = Math.min(f.vy, -1250);
        particulas(f.x, CHAO - f.y - 60, 6, ['#ffffff'], 120, 0.2, 5, 0);
      }
      if (f.quedaRapida) f.vy = Math.min(f.vy, -1250);
      if (inp.p.has('atk') && !f.aereoUsado) { f.aereoUsado = true; iniciarAtq(f, 'aereo'); break; }
      if (inp.p.has('dash') && !f.dashAr) { iniciarDash(f, d || f.face); break; }
      if (inp.p.has('proj') && f.en >= ATQ.projetil.custo) { iniciarAtq(f, 'projetil'); break; }
      // pulo duplo guardado (apertou 2x rápido, ainda no agachamento): sai assim que deixa o chão
      const duploGuardado = f.duploPend && f.t > 0.1;
      if (duploGuardado) f.duploPend = false;
      if (inp.p.has('cima') || duploGuardado) {
        const parede = f.x <= 75 ? 1 : f.x >= ARENA_W - 75 ? -1 : 0;
        if (parede) {
          f.vx = parede * 520; f.vy = f.p.pulo * 0.92; f.face = parede; f.puloDuplo = false; f.puloSegurado = true;
          particulas(f.x - parede * 20, CHAO - f.y - 60, 10, ['#d8d0c0', '#ffffff'], 160, 0.3, 6, 0);
          textoFlutuante(f.x, CHAO - f.y - 200, 'PULO NA PAREDE', '#ffffff', 10);
        } else if ((f.pulosAr || 0) < (f.p.pulosAr ?? 1)) {
          f.pulosAr = (f.pulosAr || 0) + 1; // Geada (ninja) tem 2 pulos no ar, Brasa nenhum
          // pulo duplo muda de direção na hora (sem direção apertada, perde metade do embalo)
          f.puloDuplo = true; f.puloSegurado = true; f.quedaRapida = false; f.flipNinja = false; f.vy = f.p.pulo * f.p.puloDuplo;
          f.duploT0 = f.t; // início deste pulo no ar (o mortal desenhado é cronometrado a partir daqui)
          f.vx = d ? d * Math.max(f.p.vel * 1.05, Math.abs(f.vx) * 0.8) : f.vx * 0.5;
          particulas(f.x, CHAO - f.y - 10, 12, coresElem(f), 180, 0.35, 6, 0);
        } else f.bufferPulo = f.p.mov.buffer; // guarda o pulo para quando tocar o chão
      }
      break;
    }
    case 'dash':
      f.vx = f.dashDir * f.p.dashVel;
      if (f.t > 0.2) {
        // segurando a investida no chão = continua correndo
        if (f.solo && segurandoCorrida(f.dashDir) && d !== -f.dashDir) { f.est = 'corrida'; f.t = 0; }
        else { f.vx = f.dashDir * f.p.vel * 0.6; f.est = f.solo ? 'idle' : 'air'; f.t = 0; }
      }
      break;
    case 'corrida': {
      // soltou a corrida: derrapa até parar. Virou de lado: derrapa e volta a correr para o outro lado.
      if (d === -f.dashDir && G.fase === 'luta') { f.est = 'freio'; f.t = 0; f.viraPara = d; break; }
      if (G.fase !== 'luta' || !segurandoCorrida(f.dashDir)) { f.est = 'freio'; f.t = 0; f.viraPara = 0; break; }
      f.face = f.dashDir;
      f.vx = aproximar(f.vx, f.dashDir * f.p.vel * f.p.corrida, f.p.mov.acel * 1.5 * dt);
      if (inp.p.has('cima')) { pular(f, inp); break; }
      if (inp.p.has('atk')) { iniciarAtq(f, 'corridaAtq'); break; }
      if (inp.p.has('esp') && f.en >= ATQ.especial.custo) { iniciarAtq(f, 'especial'); break; }
      if (Math.random() < 0.35) G.part.push({ x: f.x - f.face * 30, y: CHAO - f.y - rand(0, 8), vx: -f.face * rand(40, 120), vy: -rand(20, 80), vida: 0.35, t: 0, cor: escolha(['#d8d0c0', '#b0a898']), tam: rand(4, 8), grav: 0 });
      break;
    }
    case 'atk': atualizarAtaque(f, o, inp, dt); break;
    case 'hurt':
      f.stun -= dt;
      if (f.stun <= 0 && f.solo) { f.est = f.derrubado ? 'caido' : 'idle'; f.t = 0; }
      break;
    case 'caido':
      if (f.t > 0.55) { f.est = 'levantar'; f.t = 0; f.invul = 0.6; }
      break;
    case 'levantar':
      // levantar: Brasa devagar e com esforço, Geada rápida
      f.vx = 0;
      if (f.t > (f.p.defesa > 1 ? 0.45 : 0.25)) { f.est = 'idle'; f.t = 0; f.invul = 0.3; f.derrubado = false; }
      break;
    case 'freio': {
      // derrapagem: desliza com poeira; o Brasa demora mais para parar
      f.vx = aproximar(f.vx, 0, f.p.mov.freio * 1.1 * dt);
      if (Math.random() < 0.6) G.part.push({ x: f.x + f.face * 20, y: CHAO - f.y - rand(0, 6), vx: f.vx * 0.3 + rand(-30, 30), vy: -rand(30, 90), vida: 0.35, t: 0, cor: escolha(['#d8d0c0', '#b0a898']), tam: rand(4, 9), grav: 0 });
      if (inp.p.has('cima')) { pular(f, inp); break; }
      if (f.t > f.p.mov.derrapagem) {
        if (f.viraPara && segurandoCorrida(f.viraPara)) { f.dashDir = f.viraPara; f.face = f.viraPara; f.est = 'corrida'; f.t = 0; f.vx = f.viraPara * f.p.vel; }
        else { f.est = 'idle'; f.t = 0; }
      }
      break;
    }
    case 'rolamento': {
      // rolamento ninja: rola no chão com o embalo e já levanta pronta para agir
      const DUR = 0.26;
      f.vx = aproximar(f.vx, f.rolDir * f.p.vel, f.p.mov.freio * 0.25 * dt);
      if (inp.p.has('cima')) { pular(f, inp); break; }
      if (inp.p.has('atk')) { iniciarAtq(f, 'corridaAtq'); break; }
      if (f.t >= DUR) {
        const continua = inp.h.has('dash') || (d === f.rolDir);
        if (continua) { f.est = 'corrida'; f.dashDir = f.rolDir; f.correToque = !inp.h.has('dash'); }
        else { f.est = 'freio'; f.viraPara = 0; }
        f.t = 0;
      }
      break;
    }
    case 'impulso': {
      // agachado antes do pulo: freia um pouco; se soltar o botão aqui, sai um pulo baixinho
      f.vx = aproximar(f.vx, 0, f.p.mov.freio * 0.3 * dt);
      // apertou pular de novo ainda agachado: guarda para sair o pulo duplo logo depois (e o 1º pulo sai cheio)
      if (inp.p.has('cima') && (f.p.pulosAr ?? 1) > 0) { f.duploPend = true; f.impSoltou = false; }
      if (!inp.h.has('cima') && !f.ehCPU && !f.duploPend) f.impSoltou = true;
      if (f.t >= f.impDur) lancarPulo(f, d, f.impCorrendo, f.impSoltou);
      break;
    }
    case 'pouso':
      f.vx = aproximar(f.vx, 0, f.p.mov.freio * dt);
      if (inp.p.has('cima') || f.bufferPulo > 0) { pular(f, inp); break; } // pode pular direto do pouso
      if (inp.p.has('atk')) { iniciarAtq(f, 'soco1'); break; }               // ou atacar
      if (inp.p.has('dash')) { f.correToque = false; iniciarDash(f, d || f.face); break; }
      if (duploToque) { f.correToque = true; iniciarDash(f, duploToque); break; }
      if (f.t > f.pousoDur) { f.est = 'idle'; f.t = 0; }
      break;
    case 'provocar':
      f.vx = 0;
      if (f.t > 0.9) { f.est = 'idle'; f.t = 0; f.en = Math.min(100, f.en + 12); textoFlutuante(f.x, CHAO - f.y - 210, '+ENERGIA', f.p.cor2, 10); }
      break;
    case 'vitoria': f.vx = 0; break;
    case 'ko': break;
  }

  // rastro (afterimage) na investida e no golpe final
  f.rastroT -= dt;
  // (sem rastro na corrida comum: ao pular correndo, os fantasmas pareciam uma segunda personagem)
  if ((f.est === 'dash' || (f.est === 'atk' && f.atq && (f.atq.def.final || f.atq.nome === 'corridaAtq'))) && f.rastroT <= 0) {
    f.rastroT = 0.045;
    G.rastros.push({ id: f.id, q: quadroAnim(f) || quadroDe(f), x: f.x, y: f.y, face: f.face, escala: f.escala, t: 0, cor: f.p.cor,
      rig: f.rig ? { ...f.rig } : null, rigJ: f.rigJ ? JSON.parse(JSON.stringify(f.rigJ)) : null });
  }
  fisica(f, dt);
}

function atualizarAtaque(f, o, inp, dt) {
  const a = f.atq, def = a.def;
  // ATAQUE + ESPECIAL quase juntos: o soco que começou vira o golpe final
  if (inp.p.has('final') && f.en >= 100 && a.nome === 'soco1' && a.t < 0.15 && G.fase === 'luta') { iniciarAtq(f, 'final'); return; }
  a.t += dt;
  if (def.prox && inp.p.has('atk')) a.encadear = true;
  if (def.avanco && a.t < def.dur * 0.5) f.vx = f.face * def.avanco * 2.2;
  else if (!def.aereo && !def.final) f.vx *= 0.8;
  if (def.final) f.vx = a.t < 0.4 ? f.face * 950 : 0;
  if (def.spawn && !f.solo) f.vy = Math.max(f.vy, -60); // flutua um pouco ao atirar no ar

  if (def.ativo && !a.acertou && a.t >= def.ativo[0] && a.t <= def.ativo[1] && vulneravel(o)) {
    if (sobrepoe(caixaAtq(f, def), caixaCorpo(o))) {
      a.acertou = true;
      const dirX = o.x >= f.x ? 1 : -1;
      aplicarDano(f, o, def, dirX, (f.x + o.x) / 2, CHAO - o.y - 95);
    }
  }
  if (def.spawn && !a.lancou && a.t >= def.spawn) {
    a.lancou = true;
    G.proj.push({ dono: f, x: f.x + f.face * 120, y: f.y + f.p.projY, vx: f.face * 660, elem: f.p.elem, t: 0 });
  }
  if (a.t >= def.dur) {
    f.atq = null;
    if (a.encadear && def.prox && G.fase === 'luta') { iniciarAtq(f, def.prox); return; }
    f.est = f.solo ? 'idle' : 'air';
    f.t = 0;
  }
}

function atualizarProjeteis(dt) {
  for (const p of G.proj) {
    p.t += dt;
    p.x += p.vx * dt;
    const alvo = G.f[0] === p.dono ? G.f[1] : G.f[0];
    const cx = { x0: p.x - 24, x1: p.x + 24, y0: p.y - 24, y1: p.y + 24 };
    if (alvo && vulneravel(alvo) && sobrepoe(cx, caixaCorpo(alvo))) {
      p.morto = true;
      aplicarDano(p.dono, alvo, PROJ_HIT, Math.sign(p.vx), p.x, CHAO - p.y);
    }
    const c = p.elem === 'fogo' ? ['#ff5a3c', '#ffb347', '#ffd166'] : ['#9fe0ff', '#d6f3ff', '#ffffff'];
    if (Math.random() < 0.8) G.part.push({ x: p.x - Math.sign(p.vx) * 20, y: CHAO - p.y + rand(-10, 10), vx: -p.vx * 0.1, vy: rand(-40, 40), vida: 0.35, t: 0, cor: escolha(c), tam: rand(3, 7), grav: 0 });
    if (p.x < -60 || p.x > ARENA_W + 60 || p.t > 2.5) p.morto = true;
  }
  for (let i = 0; i < G.proj.length; i++) for (let j = i + 1; j < G.proj.length; j++) {
    const a = G.proj[i], b = G.proj[j];
    if (a.dono !== b.dono && Math.abs(a.x - b.x) < 40 && Math.abs(a.y - b.y) < 50) {
      a.morto = b.morto = true;
      particulas((a.x + b.x) / 2, CHAO - a.y, 30, ['#ffffff', '#ffd166', '#9fe0ff'], 350, 0.5, 6, 0);
      G.shake = 6;
    }
  }
  G.proj = G.proj.filter((p) => !p.morto);
}

/* ---------------- Mecânicas únicas ----------------
 * BRASA · RAIVA: cada golpe que ele LEVA enche a barra (fica mais bravo). Cheia = FÚRIA por 6 s:
 *   +25% de dano, quase não é arremessado nem derrubado, a 1ª pancada é absorvida (armadura).
 * GEADA · POÇAS DE GELO: os golpes dela congelam o chão (5 s, até 3 poças).
 *   No gelo ela fica mais rápida; o oponente fica LENTO.
 *   O GOLPE FINAL congela quem estiver numa poça.
 * (O "chão em brasa" saiu a pedido; o código de zona de fogo ficou, mas nada cria mais.)
 */
const ZONA = { gelo: { larg: 140, vida: 5, max: 3 }, fogo: { larg: 95, vida: 2.6, max: 6 } };
// balanceamento da Raiva/Fúria do Brasa (antes: 6 s, +25% de dano, 18 de raiva por golpe levado)
const FURIA_DUR = 4.5;      // duração da Fúria (s)
const FURIA_DANO = 1.15;    // dano extra na Fúria
const RAIVA_POR_GOLPE = 10; // raiva por golpe levado (~10 golpes para encher)
const RAIVA_DEFESA = 3;     // raiva por golpe defendido
const RAIVA_ESFRIA = 4;     // raiva que some por segundo sem apanhar

function superficieDe(f) { return f.solo ? f.y : alturaSuperficie(f.x, f.y); }
function vapor(x, y) { particulas(x, CHAO - y - 12, 16, ['#ffffff', '#e8eef5', '#c9d4e0'], 110, 0.9, 11, -70); }
function criarZona(tipo, x, y, dono) {
  const cfg = ZONA[tipo], oposto = tipo === 'fogo' ? 'gelo' : 'fogo';
  for (const z of G.zonas) {
    if (z.tipo === oposto && z.vida > 0 && Math.abs(z.y - y) < 1 && Math.abs(z.x - x) < (z.larg + cfg.larg) / 2) {
      z.vida = 0; vapor((z.x + x) / 2, y);
      textoFlutuante((z.x + x) / 2, CHAO - y - 60, 'VAPOR', '#ffffff', 10);
      return; // um anula o outro
    }
  }
  G.zonas.push({ tipo, x, y, larg: cfg.larg, vida: cfg.vida, dur: cfg.vida, dono, tick: 0 });
  const minhas = G.zonas.filter((z) => z.tipo === tipo && z.dono === dono && z.vida > 0);
  if (minhas.length > cfg.max) minhas[0].vida = 0;
}
function zonaSob(f, tipo) {
  if (!f.solo) return null;
  return G.zonas.find((z) => z.tipo === tipo && z.vida > 0 && Math.abs(z.y - f.y) < 1 && Math.abs(z.x - f.x) < z.larg / 2) || null;
}
function ganharCalor(f, n) {
  if (f.p.mecanica !== 'calor' || f.furia > 0 || f.est === 'ko') return;
  f.calor = Math.min(100, (f.calor || 0) + n);
  if (f.calor >= 100) {
    f.furia = FURIA_DUR; f.armadura = 1;
    anunciar('FÚRIA!', 0.9, '#ff5a3c');
    particulas(f.x, CHAO - f.y - 80, 40, ['#ff5a3c', '#ffb347', '#ffd166'], 420, 0.7, 9, -150);
    G.shake = Math.max(G.shake, 8);
  }
}

// chamado pelo aplicarDano em cada golpe que acerta (ou é defendido)
function mecanicaNoGolpe(at, df, bloqueou) {
  // Brasa só fica mais bravo APANHANDO (defendendo esquenta um pouquinho)
  if (df.p.mecanica === 'calor') ganharCalor(df, bloqueou ? RAIVA_DEFESA : RAIVA_POR_GOLPE);
  if (bloqueou) return;
  if (at.p.mecanica === 'gelo') criarZona('gelo', df.x, superficieDe(df), at);
}

function atualizarMecanicas(dt) {
  for (const z of G.zonas) {
    z.vida -= dt;
    if (z.tipo === 'fogo' && z.vida > 0) {
      if (Math.random() < 0.5) G.part.push({ x: z.x + rand(-z.larg / 2, z.larg / 2), y: CHAO - z.y - rand(0, 8), vx: rand(-15, 15), vy: -rand(60, 150), vida: 0.45, t: 0, cor: escolha(['#ff5a3c', '#ffb347', '#ffd166']), tam: rand(4, 8), grav: -80 });
      // queima quem pisa (não o dono), um pouquinho a cada meio segundo
      z.tick -= dt;
      for (const f of G.f) {
        if (f === z.dono || !vulneravel(f) || z.tick > 0) continue;
        if (Math.abs(f.x - z.x) < z.larg / 2 && f.solo && Math.abs(f.y - z.y) < 1) {
          z.tick = 0.5;
          f.hp = Math.max(1, f.hp - 9); f.flash = 0.06;
          textoFlutuante(f.x, CHAO - f.y - 150, '9', '#ffb347', 11);
        }
      }
    } else if (z.tipo === 'gelo' && z.vida > 0 && Math.random() < 0.08) {
      G.part.push({ x: z.x + rand(-z.larg / 2, z.larg / 2), y: CHAO - z.y - 2, vx: 0, vy: -rand(10, 40), vida: 0.6, t: 0, cor: '#ffffff', tam: 3, grav: 0 });
    }
  }
  G.zonas = G.zonas.filter((z) => z.vida > 0);

  for (const f of G.f) {
    const base = PERS[f.id];
    // Brasa: calor esfria devagar; Fúria vai acabando
    if (f.furia > 0) {
      f.furia -= dt;
      if (Math.random() < 0.6) G.part.push({ x: f.x + rand(-40, 40), y: CHAO - f.y - rand(10, 130), vx: rand(-20, 20), vy: -rand(80, 200), vida: 0.5, t: 0, cor: escolha(['#ff5a3c', '#ffb347', '#ffd166']), tam: rand(5, 10), grav: -100 });
      if (f.furia <= 0) { f.furia = 0; f.calor = 0; f.armadura = 0; textoFlutuante(f.x, CHAO - f.y - 200, 'esfriou...', '#c9bfb8', 10); }
    } else if (f.calor > 0) f.calor = Math.max(0, f.calor - RAIVA_ESFRIA * dt);
    if (f.congelado > 0) f.congelado = Math.max(0, f.congelado - dt);
    // gelo no chão: a dona desliza rápido, o oponente escorrega; em Fúria o Brasa fica "pesado demais"
    const gelo = zonaSob(f, 'gelo');
    if (gelo && gelo.dono === f) f.p = f.pRapido || (f.pRapido = { ...base, vel: base.vel * 1.3, corrida: base.corrida * 1.15 });
    else if (gelo) {
      // oponente no gelo fica LENTO: anda, corre e investe bem mais devagar
      f.p = f.pLento || (f.pLento = { ...base, vel: base.vel * 0.55, corrida: base.corrida * 0.7, dashVel: base.dashVel * 0.6 });
      if (Math.random() < 0.2) particulas(f.x + rand(-30, 30), CHAO - f.y - rand(0, 40), 1, ['#ffffff', '#d6f3ff', '#9fe0ff'], 30, 0.5, 4, 0);
    } else if (f.furia > 0) f.p = f.pFuria || (f.pFuria = { ...base, peso: base.peso * 2 }); // era *3
    else f.p = base;
  }
}

function desenharZonas() {
  for (const z of G.zonas) {
    const y = CHAO - z.y, a = Math.min(1, z.vida / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    if (z.tipo === 'gelo') {
      // placa de gelo: azul translúcido com brilho e rachaduras
      ctx.fillStyle = 'rgba(160,224,255,.55)';
      ctx.beginPath(); ctx.ellipse(z.x, y + 1, z.larg / 2, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230,248,255,.85)';
      ctx.beginPath(); ctx.ellipse(z.x - z.larg * 0.12, y - 1, z.larg * 0.28, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(79,182,255,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(z.x + 10, y - 4); ctx.lineTo(z.x + 26, y + 3); ctx.lineTo(z.x + 40, y - 2); ctx.stroke();
    } else {
      // chão em brasa: mancha escura com miolo laranja pulsando
      const pul = 0.75 + Math.sin(G.t * 14 + z.x) * 0.25;
      ctx.fillStyle = 'rgba(60,20,10,.55)';
      ctx.beginPath(); ctx.ellipse(z.x, y + 1, z.larg / 2, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,120,40,${0.65 * pul})`;
      ctx.beginPath(); ctx.ellipse(z.x, y, z.larg * 0.36, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,220,120,${0.8 * pul})`;
      ctx.beginPath(); ctx.ellipse(z.x, y - 1, z.larg * 0.16, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// bloco de gelo em volta de quem foi congelado
function desenharCongelado(f) {
  if (!(f.congelado > 0)) return;
  const k = Math.min(1, f.congelado / 0.3);
  ctx.save();
  ctx.globalAlpha = 0.55 * k;
  ctx.fillStyle = '#bfeaff';
  const x = f.x - 52, y = CHAO - f.y - 150;
  ctx.fillRect(x, y, 104, 150);
  ctx.globalAlpha = 0.9 * k;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(x, y, 104, 150);
  ctx.beginPath(); ctx.moveTo(x + 14, y + 12); ctx.lineTo(x + 34, y + 12); ctx.moveTo(x + 14, y + 12); ctx.lineTo(x + 14, y + 40); ctx.stroke();
  ctx.restore();
}

/* ---------------- Golpe final (cena especial) ---------------- */
function iniciarCine(at, df) {
  G.cine = { at, df, t: 0, dur: 3.4, ma: 0, md: 0, cpuT: 0 };
  at.est = at.solo ? 'idle' : 'air'; at.atq = null; at.vx = 0;
  df.est = 'hurt'; df.stun = 99; df.vx = 0;
  G.proj = [];
}

function atualizarCine(dt) {
  const c = G.cine;
  c.t += dt;
  const iA = G.f.indexOf(c.at), iD = G.f.indexOf(c.df);
  const humano = (i) => G.modo !== 'cpuvscpu' && (i === 0 || G.modo === '2p');
  if (c.t > 0.6 && c.t < 2.8) {
    if (humano(iA) && ENT[iA].p.has('atk')) c.ma++;
    if (humano(iD) && ENT[iD].p.has('atk')) c.md++;
    c.cpuT += dt;
    if (c.cpuT > 0.13) {
      c.cpuT = 0;
      if (!humano(iA)) c.ma++;
      if (!humano(iD) && Math.random() < 0.75) c.md++;
    }
    if (Math.random() < 0.5) G.part.push({ x: W / 2 + rand(-300, 300), y: H / 2 + rand(-150, 150), vx: rand(-300, 300), vy: rand(-300, 300), vida: 0.5, t: 0, cor: escolha(coresElem(c.at)), tam: rand(4, 9), grav: 0, tela: true });
    if (Math.random() < 0.15) G.shake = 8;
  }
  if (c.t >= c.dur) {
    const elemF = vantagemElem(c.at.p.elem, c.df.p.elem);
    const dano = Math.round((230 + clamp((c.ma - c.md) * 9, -70, 150)) * c.at.p.forca * elemF);
    const df = c.df, at = c.at;
    avisoElem(elemF, df.x, CHAO - df.y - 230);
    G.cine = null;
    G.part = G.part.filter((p) => !p.tela);
    df.hp = Math.max(0, df.hp - dano);
    if (at.p.mecanica === 'gelo' && zonaSob(df, 'gelo') && df.hp > 0) {
      // GEADA: quem está numa poça de gelo fica CONGELADO (parado, aberto para combo)
      df.est = 'hurt'; df.stun = 1.3; df.derrubado = false; df.vx = 0; df.vy = 0; df.congelado = 1.3;
      textoFlutuante(df.x, CHAO - df.y - 200, 'CONGELADO!', '#bfeaff', 16);
      particulas(df.x, CHAO - df.y - 80, 40, ['#ffffff', '#bfeaff', '#4fb6ff'], 300, 0.7, 7, 0);
    } else {
      df.est = 'hurt'; df.stun = 0.8; df.derrubado = true; df.solo = false;
      df.vx = (df.x >= at.x ? 1 : -1) * 650; df.vy = 650;
    }
    at.en = 0;
    G.shake = 16; G.hitstop = 0.15;
    particulas(df.x, CHAO - df.y - 90, 60, coresElem(at), 520, 0.8, 8, 200);
    textoFlutuante(df.x, CHAO - df.y - 230, `${dano}!`, '#ffcf4a', 30);
    if (df.hp <= 0) nocaute(df, at);
  }
}

/* ---------------- CPU ---------------- */
function entradaCPU(f, o, dt) {
  const inp = { h: new Set(), p: new Set() };
  const ia = f.ia;
  const dist = Math.abs(o.x - f.x);
  const frente = o.x >= f.x ? 'dir' : 'esq', tras = frente === 'dir' ? 'esq' : 'dir';
  if (f.est === 'hurt' && f.en >= 25 && !ia.subTentou) { ia.subTentou = true; if (Math.random() < 0.22) inp.p.add('sub'); }
  if (f.est === 'atk' && f.atq && f.atq.def.prox && f.atq.acertou && Math.random() < 0.85) inp.p.add('atk');
  // pulo duplo quando o oponente está numa plataforma
  if (f.est === 'air' && !f.puloDuplo && o.y > f.y + 60 && f.vy < 150 && Math.random() < 0.3) { inp.p.add('cima'); inp.h.add(frente); }
  if (f.est === 'air') inp.h.add(frente);
  // desvia de projétil
  for (const p of G.proj) if (p.dono !== f && Math.sign(p.vx) === Math.sign(f.x - p.x) && Math.abs(p.x - f.x) < 240 && Math.random() < 0.06) {
    const r = Math.random();
    if (r < 0.45) inp.p.add('cima'); else if (r < 0.7 && f.solo) inp.p.add('dash'); else { ia.acao = 'defesa'; ia.dur = 0.5; }
  }
  ia.t -= dt;
  if (ia.t <= 0) {
    ia.t = rand(0.12, 0.3);
    const oAtacando = o.est === 'atk';
    const alturaDif = o.y - f.y;
    if (oAtacando && dist < 170 && Math.random() < 0.35) { ia.acao = 'defesa'; ia.dur = 0.45; }
    else if (f.en >= 100 && dist < 320 && Math.abs(alturaDif) < 40 && Math.random() < 0.6) inp.p.add('final');
    else if (alturaDif > 80 && dist < 420) { inp.p.add('cima'); inp.h.add(frente); }
    else if (alturaDif < -80 && f.solo && Math.random() < 0.4) { inp.h.add('baixo'); inp.p.add('cima'); }
    else if (dist > 450 && Math.random() < 0.45) { ia.acao = 'correr'; ia.dur = 1.5; }
    else if (dist > 340) {
      if (f.en >= ATQ.projetil.custo && Math.random() < 0.5) inp.p.add('proj');
      else if (f.en < 70 && Math.random() < 0.3) { ia.acao = 'carga'; ia.dur = rand(0.6, 1.2); }
      else { ia.acao = 'frente'; ia.dur = rand(0.3, 0.6); }
    } else if (dist > 120) {
      const r = Math.random();
      if (r < 0.12) { inp.p.add('cima'); inp.h.add(frente); }
      else if (r < 0.3 && f.en >= ATQ.projetil.custo) inp.p.add('proj');
      else if (r < 0.3) { inp.p.add('dash'); inp.h.add(frente); }
      else { ia.acao = 'frente'; ia.dur = rand(0.2, 0.5); }
    } else {
      const r = Math.random();
      if (r < 0.18 && f.en >= 20) inp.p.add('esp');
      else if (r < 0.72) inp.p.add('atk');
      else if (r < 0.8) { inp.p.add('dash'); inp.h.add(tras); }
      else if (r < 0.88) { ia.acao = 'tras'; ia.dur = 0.3; }
      else { ia.acao = 'defesa'; ia.dur = 0.35; }
    }
  }
  if (ia.acao) {
    ia.dur -= dt;
    if (ia.acao === 'frente') inp.h.add(frente);
    if (ia.acao === 'tras') inp.h.add(tras);
    if (ia.acao === 'defesa') inp.h.add('baixo');
    if (ia.acao === 'carga') { if (dist < 220) ia.dur = 0; else inp.h.add('carga'); }
    if (ia.acao === 'correr') {
      inp.h.add('dash'); inp.h.add(frente);
      if (f.est !== 'dash' && f.est !== 'corrida' && f.solo) inp.p.add('dash');
      if (dist < 170) { ia.dur = 0; if (Math.random() < 0.6) inp.p.add('atk'); }
    }
    if (ia.dur <= 0) ia.acao = null;
  }
  return inp;
}

/* ---------------- Câmera ---------------- */
// "oponente" vazio usado no modo livre (nunca é atingido)
const ALVO_NULO = { x: -99999, y: 0, invul: 1e9, est: 'idle', face: 1, atq: null, solo: true };

const ZOOM_SOLO = 1.1;
function atualizarCamera(dt, instantaneo = false) {
  if (G.modo === 'solo') {
    // câmera de perto (personagem grande), olha um pouco à frente e sobe nos pulos
    const f = G.f[0];
    // ZOOM_SOLO: tamanho da personagem na tela (1 = igual à luta; maior = mais perto)
    const z = clamp(ZOOM_SOLO - Math.max(0, f.y - 120) / 1200, ZOOM_SOLO - 0.2, ZOOM_SOLO);
    const k = instantaneo ? 1 : 1 - Math.exp(-dt * 3);
    G.cam.zoom += (z - G.cam.zoom) * k;
    const vw = W / G.cam.zoom;
    const frente = clamp(f.vx * 0.22, -160, 160) + f.face * 40;
    const alvoX = clamp(f.x + frente - vw / 2, 0, ARENA_W - vw);
    G.cam.x += (alvoX - G.cam.x) * (instantaneo ? 1 : 1 - Math.exp(-dt * 5));
    G.cam.x = clamp(G.cam.x, 0, ARENA_W - vw);
    const alvoY = Math.max(0, f.y - 200) * 0.6; // pulo normal: câmera parada (dá para ver ela subir e descer)
    G.cam.y = (G.cam.y || 0) + (alvoY - (G.cam.y || 0)) * (instantaneo ? 1 : 1 - Math.exp(-dt * 4));
    return;
  }
  G.cam.y = 0;
  const a = G.f[0], b = G.f[1] || G.f[0];
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), maxY = Math.max(a.y, b.y);
  let z = Math.min(1, W / (maxX - minX + 440), 430 / (270 + Math.max(0, maxY - 200)));
  z = clamp(z, 0.6, 1);
  const k = instantaneo ? 1 : Math.min(1, dt * 4);
  G.cam.zoom += (z - G.cam.zoom) * k;
  const vw = W / G.cam.zoom;
  const alvoX = clamp((minX + maxX) / 2 - vw / 2, 0, ARENA_W - vw);
  G.cam.x += (alvoX - G.cam.x) * (instantaneo ? 1 : Math.min(1, dt * 6));
  G.cam.x = clamp(G.cam.x, 0, ARENA_W - vw);
}

/* ---------------- Atualização ---------------- */
function passo(dt) {
  G.t += dt;
  if (G.tela !== 'luta' || G.pausa) return;
  // guarda a posição anterior para desenhar interpolado (movimento liso em telas de 120/144 Hz)
  for (const f of G.f) { f.px = f.x; f.py = f.y; }
  G.camAnt = { x: G.cam.x, y: G.cam.y || 0, zoom: G.cam.zoom };

  for (const p of G.part) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; }
  G.part = G.part.filter((p) => p.t < p.vida);
  for (const r of G.rastros) r.t += dt;
  G.rastros = G.rastros.filter((r) => r.t < 0.25);
  for (const t of G.textos) t.t += dt;
  G.textos = G.textos.filter((t) => t.t < 1);
  if (G.anuncio) { G.anuncio.t += dt; if (G.anuncio.t > G.anuncio.dur) G.anuncio = null; }
  G.shake = Math.max(0, G.shake - dt * 40);
  for (const f of G.f) f.hpVis += (f.hp - f.hpVis) * Math.min(1, dt * 3);

  if (G.cine) { atualizarCine(dt); return; }
  if (G.hitstop > 0) { G.hitstop -= dt; return; }

  const dtj = dt * G.slow;
  G.faseT += dt;
  atualizarMecanicas(dtj); // calor/fúria do Brasa, poças de gelo, chão em brasa
  if (G.fase === 'intro' && G.faseT > 1.4) { G.fase = 'luta'; G.faseT = 0; anunciar('LUTEM!', 0.9, '#ffffff'); }
  if (G.fase === 'luta' && G.modo !== 'solo') {
    G.tempo -= dt;
    if (G.tempo <= 0) { G.tempo = 0; G.fase = 'ko'; G.faseT = 0; anunciar('TEMPO!', 1.6, '#ffffff'); }
  }
  if (G.fase === 'ko') {
    G.slow = Math.min(1, G.slow + dt * 0.4);
    // comemoração do vencedor
    if (G.faseT > 1.0) {
      const [a0, b0] = G.f;
      const ven = a0.hp > b0.hp ? a0 : b0.hp > a0.hp ? b0 : null;
      if (ven && ven.solo && ven.est !== 'vitoria' && ven.est !== 'ko' && ven.est !== 'hurt') { ven.est = 'vitoria'; ven.t = 0; ven.atq = null; }
    }
    if (G.faseT > 3.2) { terminarRound(); return; }
  }

  if (G.modo === 'solo') {
    // modo livre: só a Geada, sem oponente, energia infinita
    const f = G.f[0];
    f.en = 100;
    atualizarLutador(f, ALVO_NULO, traduzirEntrada(ENT[0], f), dtj);
    atualizarProjeteis(dtj);
    atualizarCamera(dt);
    return;
  }
  const [a, b] = G.f;
  // CPU vs CPU: as duas CPUs jogam sozinhas (o teclado não controla ninguém)
  const vazio = () => ({ h: new Set(), p: new Set() });
  const cpuA = G.modo === 'cpuvscpu', cpuB = G.modo === 'cpu' || G.modo === 'cpuvscpu';
  a.ehCPU = cpuA; b.ehCPU = cpuB;
  const inpA = cpuA ? (G.fase === 'luta' ? entradaCPU(a, b, dtj) : vazio()) : traduzirEntrada(ENT[0], a);
  const inpB = cpuB ? (G.fase === 'luta' ? entradaCPU(b, a, dtj) : vazio()) : traduzirEntrada(ENT[1], b);
  atualizarLutador(a, b, inpA, dtj);
  atualizarLutador(b, a, inpB, dtj);
  // empurra para não ficarem um dentro do outro
  const dx = b.x - a.x;
  if (Math.abs(dx) < 64 && Math.abs(a.y - b.y) < 80 && a.est !== 'ko' && b.est !== 'ko') {
    const emp = (64 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1);
    a.x = clamp(a.x - emp, 50, ARENA_W - 50);
    b.x = clamp(b.x + emp, 50, ARENA_W - 50);
  }
  // distância máxima (os dois sempre cabem na tela)
  const MAXD = 1350;
  if (Math.abs(b.x - a.x) > MAXD) {
    const meio = (a.x + b.x) / 2;
    a.x = clamp(a.x, meio - MAXD / 2, meio + MAXD / 2);
    b.x = clamp(b.x, meio - MAXD / 2, meio + MAXD / 2);
  }
  atualizarProjeteis(dtj);
  atualizarCamera(dt);
}

function terminarRound() {
  const [a, b] = G.f;
  let v = -1;
  if (a.hp <= 0 && b.hp > 0) v = 1;
  else if (b.hp <= 0 && a.hp > 0) v = 0;
  else if (a.hp !== b.hp) v = a.hp > b.hp ? 0 : 1;
  if (v >= 0) G.vit[v]++;
  if (G.vit[0] >= 2 || G.vit[1] >= 2) {
    G.vencedor = G.vit[0] >= 2 ? 0 : 1;
    irPara('fim');
    return;
  }
  G.round++;
  iniciarRound();
}

/* ---------------- Desenho ---------------- */
function quadroDe(f) {
  switch (f.est) {
    case 'idle': return Math.floor(G.t * 1.8) % 2;
    // caminhada em 6 tempos (como na ficha): 2-3-4-5-4-3, guiada pela distância andada
    case 'walk': return [2, 3, 4, 5, 4, 3][Math.floor((f.ciclo || 0) * 6) % 6];
    case 'defesa': return 7;
    case 'carga': return 11;
    case 'air': return f.vy > 0 ? 8 : 9;
    case 'dash': return 6;
    case 'corrida': return Math.floor(G.t * 10) % 2 ? 6 : 3;
    case 'atk': return f.atq ? f.atq.def.frame : 0;
    case 'pouso': case 'impulso': return 6;
    case 'rolamento': return 9;
    case 'levantar': return f.t < 0.15 ? 6 : 7;
    case 'provocar': return [0, 11, 0, 11][Math.floor(f.t * 4.5) % 4];
    case 'vitoria': return [8, 11, 0, 11][Math.floor(f.t * 3) % 4];
    default: return 15;
  }
}

function desenharSprite(id, idx, x, yChao, face, escala, branco = false, rot = 0, alpha = 1) {
  // idx pode ser o número do quadro da folha antiga ou um quadro de animação (objeto)
  const fr = typeof idx === 'object' ? idx : FOLHAS[id].frames[idx];
  if (!fr) return;
  escala *= fr.fator || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, yChao);
  if (rot) ctx.rotate(rot);
  ctx.scale(face * escala, escala);
  ctx.drawImage(branco ? frameBranco(fr) : fr.c, -fr.ax, -fr.ay);
  ctx.restore();
}

function alturaSuperficie(x, y) {
  let s = 0;
  for (const pl of PLATAFORMAS) if (x >= pl.x0 && x <= pl.x1 && pl.y <= y + 0.5 && pl.y > s) s = pl.y;
  return s;
}

const POSE_VAZIA = { oy: 0, ox: 0, rot: 0 };
// true = Geada desenhada como boneco articulado por código; false = sprites originais
const USAR_BONECO = false;
function desenharLutador(f) {
  const sup = alturaSuperficie(f.x, f.y);
  const s = clamp(1 - (f.y - sup) / 400, 0.4, 1);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(f.x, CHAO - sup + 2, 48 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (f.en >= 100 && f.est !== 'ko' && G.modo !== 'solo') {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(G.t * 10) * 0.1;
    ctx.fillStyle = f.p.cor;
    ctx.beginPath(); ctx.ellipse(f.x, CHAO - f.y - 85, 70, 105, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (USAR_BONECO && f.id === 'geada' && typeof renderBoneco === 'function') {
    // Geada: boneco articulado desenhado por código
    const pisca = f.invul > 0 && f.est !== 'dash' && f.est !== 'levantar' && f.est !== 'corrida' && f.est !== 'rolamento' && f.est !== 'air' && f.est !== 'pouso' && Math.floor(G.t * 20) % 2 === 0;
    efeitosAtras(f, POSE_VAZIA);
    atualizarBoneco(f, G.dtDesenho || 0.016);
    renderBoneco(f, { branco: f.flash > 0, alpha: pisca ? 0.45 : 1 });
    efeitosFrente(f, POSE_VAZIA);
    return;
  }
  const alvo = poseDe(f);
  // quadro da animação nova (se houver): os movimentos já estão desenhados na arte,
  // então o balanço/dobra feito por código fica bem mais leve nesses estados
  if (f.solo && (f.est === 'corrida' || f.est === 'dash')) f.animDist = (f.animDist || 0) + Math.abs(f.vx) * (G.dtDesenho || 0.016);
  const af = quadroAnim(f);
  if (af) {
    alvo.q = af;
    alvo.onda = 0;
    if (f.est === 'idle' || f.est === 'walk' || f.est === 'corrida') { alvo.dobra = 0; alvo.oy = 0; alvo.ex = 1; alvo.ey = 1; alvo.rot = 0; }
    if (f.est === 'air' || f.est === 'atk') alvo.dobra = 0;
    if (f.est === 'atk' && f.atq && f.atq.def.giro) alvo.rot = 0; // o giro vem da arte, não rodando o sprite
    // deitar, levantar, voar para trás, provocar e comemorar já estão desenhados: sem girar/pular por código
    if (f.est === 'caido' || f.est === 'ko' || f.est === 'levantar' || (f.est === 'hurt' && f.derrubado && !f.solo) ||
        f.est === 'provocar' || f.est === 'vitoria') {
      alvo.rot = 0; alvo.ergue = 0; alvo.dobra = 0; alvo.ex = 1; alvo.ey = 1;
      if (f.est !== 'caido') alvo.oy = 0;
    }
    // pulo ninja desenhado (mortal já está na arte): nada de girar/esticar o sprite por código
    if (af.anim === 'ninja') { alvo.rot = 0; alvo.ex = 1; alvo.ey = 1; alvo.dobra = 0; alvo.pivo = 0; }
  }
  // inércia: ao acelerar o tronco fica um pouco para trás; ao frear ele vai para frente
  const dtD = G.dtDesenho || 0.016;
  const acel = f.vxAnt === undefined ? 0 : (f.vx - f.vxAnt) / Math.max(dtD, 0.001);
  f.vxAnt = f.vx;
  f.inercia = lerpN(f.inercia || 0, clamp(-acel * f.face / 30000, -0.1, 0.1), Math.min(1, dtD * 10));
  if (f.solo && (f.est === 'walk' || f.est === 'idle' || f.est === 'corrida' || f.est === 'freio')) alvo.dobra += f.inercia;
  const pose = suavizarPose(f, alvo);
  efeitosAtras(f, pose);
  const pisca = f.invul > 0 && f.est !== 'dash' && f.est !== 'levantar' && f.est !== 'corrida' && f.est !== 'rolamento' && f.est !== 'air' && f.est !== 'pouso' && Math.floor(G.t * 20) % 2 === 0;

  // transição entre quadros: o quadro anterior some aos poucos por cima do novo
  // (entre quadros da mesma animação nova não há mistura: a arte já é quadro a quadro)
  // no pulo (agachada, voo e pouso) os quadros se misturam rapidinho para a subida/queda ficar contínua
  const fluido = f.est === 'air' || f.est === 'impulso' || f.est === 'pouso';
  if (f.animQ !== pose.q) {
    const ambosAnim = typeof f.animQ === 'object' && typeof pose.q === 'object';
    f.animAnt = ambosAnim ? undefined : f.animQ; f.animQ = pose.q; f.animT = G.t; // arte nova: troca limpa, sem fantasma
  }
  const DUR_TROCA = f.est === 'atk' ? 0.05 : fluido ? 0.075 : 0.09;
  const kTroca = f.animAnt === undefined ? 1 : clamp((G.t - f.animT) / DUR_TROCA, 0, 1);

  // virar de lado: espelha na hora (como nos jogos de luta), sem "achatar" o desenho.
  // Só um tranquinho rápido no corpo na hora da virada para não parecer seco.
  if (f.faceVis !== f.face) { f.faceVis = f.face; f.viradaT = G.t; }
  const faceEsc = f.face;
  const kVirada = clamp((G.t - (f.viradaT ?? -9)) / 0.08, 0, 1);
  if (kVirada < 1) { pose.ex *= 1 - 0.06 * (1 - kVirada); pose.ey *= 1 + 0.04 * (1 - kVirada); }

  const desenha = (q, alfa) => {
    const fr = typeof q === 'object' ? q : FOLHAS[f.id].frames[q];
    if (!fr) return;
    const esc = f.escala * (fr.fator || 1);
    ctx.save();
    ctx.globalAlpha = alfa * (pisca ? 0.45 : 1);
    ctx.translate(f.x + pose.ox, CHAO - f.y - pose.oy);
    ctx.scale(pose.ex, pose.ey);
    // gira em torno de um ponto acima dos pés (pivo), mantendo o corpo no lugar certo
    ctx.translate(0, -pose.pivo);
    ctx.rotate(pose.rot);
    ctx.translate(0, pose.pivo - pose.ergue);
    ctx.scale(faceEsc * esc, esc);
    // pixel nítido: quadros de animação de quem pede (Ventokami) sem suavizar ao reduzir/ampliar
    if (f.p.pixelNitido && fr.anim) ctx.imageSmoothingEnabled = false;
    desenharDeformado(f.flash > 0 ? frameBranco(fr) : fr.c, fr, pose);
    ctx.restore();
  };
  desenha(pose.q, 1);
  if (kTroca < 1 && f.animAnt !== pose.q) desenha(f.animAnt, 1 - suave(kTroca));
  efeitosFrente(f, pose);
}

/*
 * Desenha o quadro em fatias horizontais. Cada fatia é deslocada conforme a altura:
 *  - dobra: os pés ficam no lugar e o topo (cabeça) vai para frente/trás → o corpo "dobra"
 *  - onda: uma ondulação que sobe pelo corpo → balanço, respiração, cabeça atrasada
 * Isso dá vida ao sprite sem precisar de quadros novos.
 */
function desenharDeformado(img, fr, pose) {
  const dobra = pose.dobra || 0, onda = pose.onda || 0;
  if (Math.abs(dobra) < 0.002 && Math.abs(onda) < 0.05) { ctx.drawImage(img, -fr.ax, -fr.ay); return; }
  const h = img.height, w = img.width, alt = fr.alturaCorpo || h;
  const N = 30, fatia = h / N;
  for (let i = 0; i < N; i++) {
    const sy = i * fatia;
    const yRel = clamp((fr.ay - (sy + fatia / 2)) / alt, 0, 1.3); // 0 = pés, 1 = topo da cabeça
    const off = dobra * alt * yRel * yRel + onda * Math.sin(pose.ondaFase - yRel * pose.ondaFreq) * yRel;
    ctx.drawImage(img, 0, sy, w, fatia + 1, -fr.ax + off, -fr.ay + sy, w, fatia + 1);
  }
}

// Pose com "mola": os valores chegam ao alvo suavemente, exceto giros rápidos (que já são contínuos)
const CAMPOS_POSE = ['rot', 'pivo', 'ergue', 'ex', 'ey', 'ox', 'oy', 'dobra', 'onda'];
function suavizarPose(f, alvo) {
  const dt = G.dtDesenho || 0.016;
  const giro = (f.est === 'atk' && f.atq && f.atq.def.giro) || (f.est === 'air' && f.puloDuplo && alvo.rot !== 0) ||
    ((f.est === 'hurt' || f.est === 'ko') && f.derrubado && !f.solo) || f.est === 'rolamento' || (f.est === 'air' && (f.flipNinja || (ANIMS[f.id] && ANIMS[f.id].puloBola)));
  if (!f.poseS || giro) { f.poseS = { ...alvo }; return alvo; }
  const s = f.poseS;
  const k = Math.min(1, dt * 16);
  for (const c of CAMPOS_POSE) {
    if (c === 'rot') {
      // menor caminho angular
      let d = alvo.rot - s.rot;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      s.rot += d * k;
    } else s[c] += (alvo[c] - s[c]) * k;
  }
  s.q = alvo.q;
  s.ondaFase = alvo.ondaFase; s.ondaFreq = alvo.ondaFreq;
  return s;
}

/* ---------------- Animação procedural ----------------
 * Cada estado vira uma "pose": quadro + deslocamento, rotação e esticar/achatar.
 * Brasa (pesado) tem movimentos mais lentos e firmes; Geada (ágil) mais leves e elásticos.
 */
const suave = (t) => t * t * (3 - 2 * t);
const DUR_PIRUETA = 0.42; // duração da pirueta do pulo duplo (s)
function poseDe(f) {
  const P = { q: quadroDe(f), rot: 0, pivo: 0, ergue: 0, ex: 1, ey: 1, ox: 0, oy: 0, dobra: 0, onda: 0, ondaFase: 0, ondaFreq: 1.6 };
  const pesado = f.p.defesa > 1;
  const alt = FOLHAS[f.id].alturaBase * f.escala;
  const meio = alt * 0.45;
  switch (f.est) {
    case 'idle': {
      const r = Math.sin(G.t * (pesado ? 2.6 : 3.6));
      P.ey = 1 + r * (pesado ? 0.018 : 0.012);
      P.ex = 1 - r * 0.008;
      // balanço suave: o tronco e a cabeça oscilam devagar enquanto os pés ficam firmes
      P.onda = pesado ? 1.5 : 3; P.ondaFase = G.t * (pesado ? 2 : 2.8); P.ondaFreq = 1.4;
      P.dobra = Math.sin(G.t * 1.3) * 0.012;
      break;
    }
    case 'walk': {
      const c = (f.ciclo || 0) * Math.PI * 2;      // um ciclo = dois passos
      const salto = Math.abs(Math.sin(c));          // sobe entre os passos, desce no contato
      const vel = Math.min(1, Math.abs(f.vx) / f.p.vel);
      if (pesado) { P.oy = -salto * 3; P.ey = 1 - (1 - salto) * 0.03; }
      else {
        // passo leve e saltitante: quica, achata de leve no contato e o corpo DOBRA para frente
        // (não gira inteiro); a cabeça balança um pouco atrasada em relação aos pés
        P.oy = salto * 8 * vel;
        P.ey = 1 + (salto - 0.5) * 0.05 * vel;
        P.ex = 1 - (salto - 0.5) * 0.03 * vel;
        P.dobra = (0.07 + Math.sin(c * 2 - 0.6) * 0.03) * vel;
        P.onda = 4 * vel; P.ondaFase = c * 2; P.ondaFreq = 2.2;
      }
      break;
    }
    case 'corrida': {
      const c = G.t * 16;
      P.oy = Math.abs(Math.sin(c)) * (pesado ? 3 : 8);
      P.ex = 1.04;
      P.dobra = pesado ? 0.12 : 0.18;                 // tronco bem jogado para frente
      P.dobra += Math.sin(c * 2 - 0.8) * 0.025;       // cada passada empurra o tronco
      P.onda = pesado ? 3 : 5; P.ondaFase = c * 2; P.ondaFreq = 2.4;
      P.rot = f.face * 0.05; P.pivo = meio;
      break;
    }
    case 'dash': {
      const k = 1 - clamp(f.t / 0.2, 0, 1);
      P.ex = 1 + 0.16 * k; P.ey = 1 - 0.1 * k;
      P.dobra = 0.22; P.rot = f.face * 0.06; P.pivo = meio;
      break;
    }
    case 'freio': {
      // derrapando: corpo jogado para trás, tremendo com o atrito
      P.dobra = -0.16; P.onda = 2.5; P.ondaFase = G.t * 40; P.ondaFreq = 3;
      P.ey = 0.95; P.ex = 1.04;
      break;
    }
    case 'impulso': {
      // agachada antes do pulo: comprime o corpo como uma mola
      const k = clamp(f.t / (f.impDur || 0.05), 0, 1);
      P.ey = 1 - (pesado ? 0.14 : 0.1) * suave(k); P.ex = 1 + (pesado ? 0.1 : 0.07) * suave(k);
      break;
    }
    case 'rolamento': {
      // rolamento ninja: gira uma volta inteira no chão, encolhida
      const k = clamp(f.t / 0.26, 0, 1);
      P.rot = (f.rolDir || f.face) * suave(k) * Math.PI * 2; P.pivo = meio * 0.75;
      P.oy = -Math.sin(k * Math.PI) * 4;
      break;
    }
    case 'air': {
      const v = clamp(f.vy / 1000, -1, 1);
      P.ey = 1 + v * 0.07; P.ex = 1 - v * 0.05;
      // saída do chão: estica forte no primeiro instante e volta suave (mola)
      if (f.t < 0.14 && f.vy > 0) { const s = 1 - f.t / 0.14; P.ey += 0.1 * s; P.ex -= 0.07 * s; }
      if (ANIMS[f.id] && ANIMS[f.id].puloNinja && !f.puloDuplo) {
        // bolinha: gira sem parar enquanto está no ar (pulo em movimento); pulo parado = bolinha parada
        P.dobra = 0; P.ex = 1; P.ey = 1; P.pivo = meio * 0.45;
        const af2 = quadroAnim(f);
        P.rot = af2 && af2.bola ? (f.flipNinja ? f.flipDir : f.face) * f.t * Math.PI * 2 / 0.4 : 0;
        break;
      }
      if (f.flipNinja && f.t < f.flipDur) {
        const k = clamp(f.t / f.flipDur, 0, 1);
        P.rot = f.flipDir * suave(k) * Math.PI * 2; P.pivo = meio * 0.8; P.ey = 1; P.ex = 1;
        break;
      }
      // inclina levemente para o lado do salto (subindo para frente, caindo nivelando)
      P.rot = clamp(f.vx / (f.p.vel * 9), -0.09, 0.09) * (f.vy > 0 ? 1 : 0.5); P.pivo = meio;
      // no ar o corpo acompanha a direção do movimento; subindo, a cabeça "puxa" o corpo
      P.dobra = clamp(f.vx * f.face / (f.p.vel * 2.2), -0.15, 0.15) + v * 0.03;
      P.onda = 2; P.ondaFase = G.t * 6; P.ondaFreq = 1.5;
      if (f.puloDuplo && f.t - (f.duploT0 || 0) < DUR_PIRUETA) {
        // pirueta no pulo duplo: uma volta inteira para frente, no tempo (bem visível)
        const k = clamp((f.t - (f.duploT0 || 0)) / DUR_PIRUETA, 0, 1);
        P.rot = f.face * suave(k) * Math.PI * 2; P.pivo = meio; P.dobra = 0; P.onda = 0; P.ex = 1; P.ey = 1;
        if (k < 1) P.q = 9;
      }
      break;
    }
    case 'pouso': {
      const k = 1 - f.t / f.pousoDur;
      P.ey = 1 - (pesado ? 0.16 : 0.08) * k; P.ex = 1 + (pesado ? 0.12 : 0.06) * k;
      P.dobra = 0.06 * k; // amortece o impacto inclinando o tronco
      break;
    }
    case 'defesa':
      P.ey = 0.96; P.ex = 1.03; P.ox = -f.face * 3;
      break;
    case 'carga':
      P.ox = rand(-1.5, 1.5); P.ey = 0.97 + Math.sin(G.t * 20) * 0.01;
      break;
    case 'atk': {
      const a = f.atq, d = a.def, k = a.t / d.dur;
      const ini = d.ativo ? d.ativo[0] : (d.spawn || 0.1);
      if (a.t < ini) { P.ox = -f.face * 10 * (a.t / ini); P.ey = 0.97; } // preparação
      else { const e = Math.max(0, 1 - (a.t - ini) / (d.dur - ini)); P.ex = 1 + 0.08 * e; P.ox = f.face * 6 * e; }
      if (d.giro) { P.rot = f.face * suave(Math.min(1, k / 0.75)) * Math.PI * 2; P.pivo = meio; P.oy = Math.sin(k * Math.PI) * 30; }
      if (a.nome === 'aereo') { P.rot = f.face * 0.35 * Math.sin(k * Math.PI); P.pivo = meio; }
      if (a.nome === 'corridaAtq') { P.rot = f.face * 0.25; P.pivo = meio; }
      if (a.nome === 'projetil' && f.p.elem === 'fogo') P.ox -= f.face * 8 * Math.sin(k * Math.PI); // recuo do sopro
      break;
    }
    case 'hurt':
      if (f.derrubado && !f.solo) { P.rot = -f.face * f.t * (pesado ? 9 : 13); P.pivo = meio; } // rola no ar
      else { P.rot = -f.face * 0.18 * Math.max(0, 1 - f.t / 0.3); P.pivo = meio; P.ox = f.t < 0.15 ? rand(-3, 3) : 0; }
      if (f.t < 0.1) { P.ex = 0.9; P.ey = 1.08; }
      break;
    case 'caido': case 'ko':
      if (f.solo) {
        P.rot = -f.face * Math.PI / 2; P.pivo = 0; P.ergue = alt * 0.32;
        P.oy = f.t < 0.25 ? Math.sin(f.t / 0.25 * Math.PI) * 14 : 0; // quique ao cair
      } else { P.rot = -f.face * f.t * 10; P.pivo = meio; }
      break;
    case 'levantar': {
      const dur = pesado ? 0.45 : 0.25, k = suave(clamp(f.t / dur, 0, 1));
      P.rot = -f.face * Math.PI / 2 * (1 - k); P.ergue = alt * 0.32 * (1 - k);
      P.q = k < 0.6 ? 15 : 6;
      if (!pesado) P.oy = Math.sin(k * Math.PI) * 18; // Geada levanta com um pulinho
      break;
    }
    case 'provocar': {
      P.oy = pesado ? 0 : Math.abs(Math.sin(f.t * 9)) * 10;
      P.ey = pesado ? 1 + Math.sin(f.t * 12) * 0.04 : 1;
      if (pesado && f.t > 0.3 && f.t < 0.8) P.q = 14;
      break;
    }
    case 'vitoria': {
      const s = Math.sin(f.t * (pesado ? 5 : 7));
      P.oy = Math.abs(s) * (pesado ? 16 : 34);
      if (!pesado && Math.floor(f.t * 7 / Math.PI) % 4 === 3) { P.rot = -f.face * ((f.t * 7) % Math.PI) * 2; P.pivo = meio; }
      break;
    }
  }
  return P;
}

function corElem(f, a = 1) {
  if (f.p.elem === 'vento') return `rgba(205,150,255,${a})`;
  return f.p.elem === 'fogo' ? `rgba(255,120,60,${a})` : `rgba(120,210,255,${a})`;
}

function efeitosAtras(f, pose) {
  // aura ao carregar energia
  if (f.est === 'carga') {
    ctx.save();
    const cy = CHAO - f.y - 85;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.18 - i * 0.04;
      ctx.fillStyle = f.p.cor;
      ctx.beginPath(); ctx.ellipse(f.x, cy, 60 + i * 16 + Math.sin(G.t * 14 + i) * 5, 100 + i * 14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (Math.random() < 0.5) {
      const fogo = f.p.elem === 'fogo';
      G.part.push({ x: f.x + rand(-55, 55), y: CHAO - f.y - rand(0, 20), vx: rand(-20, 20), vy: -rand(180, 320), vida: 0.55, t: 0, cor: escolha(coresElem(f)), tam: fogo ? rand(6, 11) : rand(3, 6), grav: fogo ? -100 : 0 });
    }
  }
  // linhas de velocidade na corrida
  if (f.est === 'corrida' || f.est === 'dash') {
    ctx.save();
    ctx.strokeStyle = corElem(f, 0.5); ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const y = CHAO - f.y - 30 - i * 32 - ((G.t * 400 + i * 37) % 20);
      const x = f.x - f.face * (60 + ((G.t * 900 + i * 53) % 80));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - f.face * 50, y); ctx.stroke();
    }
    ctx.restore();
  }
}

function arcoGolpe(f, cx, cy, raio, a0, a1, prog, larg) {
  // rastro curvo do golpe (smear), na cor do elemento
  const dir = f.face;
  const ini = a0, fim = a0 + (a1 - a0) * prog;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dir, 1);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 2 ? 'rgba(255,255,255,.9)' : corElem(f, 0.35 + i * 0.25);
    ctx.lineWidth = larg * (1 - i * 0.3);
    ctx.beginPath(); ctx.arc(0, 0, raio - i * 3, Math.max(ini, fim - 1.6), fim); ctx.stroke();
  }
  ctx.restore();
}

function efeitosFrente(f, pose) {
  const cy = CHAO - f.y - 90;
  if (f.est === 'atk' && f.atq && f.atq.def.ativo) {
    const a = f.atq, d = a.def;
    const k = clamp((a.t - d.ativo[0] * 0.6) / (d.ativo[1] - d.ativo[0] * 0.6), 0, 1);
    const sumindo = a.t > d.ativo[1] ? 1 - clamp((a.t - d.ativo[1]) / 0.12, 0, 1) : 1;
    if (sumindo > 0 && a.t >= d.ativo[0] * 0.6) {
      ctx.save();
      ctx.globalAlpha = sumindo;
      const x = f.x + f.face * 40;
      switch (a.nome) {
        case 'soco1': arcoGolpe(f, x, cy - 10, 70, -1.0, 0.4, k, 10); break;
        case 'soco2': arcoGolpe(f, x, cy + 20, 75, -0.2, 1.2, k, 12); break;
        case 'soco3': arcoGolpe(f, f.x, cy - pose.oy, 95, -Math.PI, Math.PI, k, 14); break;
        case 'aereo': arcoGolpe(f, x, cy, 80, -1.2, 1.3, k, 12); break;
        case 'corridaAtq': arcoGolpe(f, x + f.face * 20, cy, 90, -0.5, 0.6, k, 16); break;
        case 'especial': arcoGolpe(f, f.x + f.face * 30, cy - 10, 125, -1.9, 1.5, k, 22); break;
      }
      ctx.restore();
    }
  }
  // escudo ao defender
  if (f.est === 'defesa') {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(G.t * 12) * 0.08;
    ctx.strokeStyle = corElem(f, 1); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(f.x + f.face * 10, cy, 85, f.face > 0 ? -1.1 : Math.PI - 1.1, f.face > 0 ? 1.1 : Math.PI + 1.1); ctx.stroke();
    ctx.globalAlpha *= 0.4; ctx.fillStyle = corElem(f, 1);
    ctx.beginPath(); ctx.ellipse(f.x + f.face * 70, cy, 16, 75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // provocar e vitória: fumaça/fogo para Brasa, flocos de gelo para Geada
  if ((f.est === 'provocar' || f.est === 'vitoria') && Math.random() < 0.35) {
    if (f.p.elem === 'fogo') G.part.push({ x: f.x + f.face * 40, y: CHAO - f.y - 150, vx: f.face * rand(20, 80), vy: -rand(60, 140), vida: 0.6, t: 0, cor: escolha(['#9a8f8a', '#c9bfb8', '#ffb347']), tam: rand(6, 12), grav: -60 });
    else if (f.p.elem === 'vento') G.part.push({ x: f.x + rand(-70, 70), y: CHAO - f.y - rand(20, 160), vx: rand(60, 160) * (Math.random() < 0.5 ? -1 : 1), vy: -rand(20, 80), vida: 0.8, t: 0, cor: escolha(coresElem(f)), tam: rand(3, 6), grav: 0 }); // pétalas de vento
    else G.part.push({ x: f.x + rand(-70, 70), y: CHAO - f.y - rand(80, 200), vx: rand(-20, 20), vy: rand(20, 60), vida: 0.9, t: 0, cor: escolha(['#ffffff', '#d6f3ff', '#9fe0ff']), tam: rand(3, 6), grav: 0 });
  }
  if (f.est === 'vitoria' && Math.random() < 0.15) particulas(f.x + rand(-60, 60), CHAO - f.y - rand(60, 200), 3, ['#ffcf4a', '#ffffff'], 80, 0.5, 5, 0);
}

function desenharProjetil(p) {
  const y = CHAO - p.y;
  ctx.save();
  if (p.elem === 'fogo') {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['rgba(255,90,60,.5)', '#ff7a3d', '#ffb347', '#fff3b0'][i];
      ctx.beginPath(); ctx.arc(p.x, y, 30 - i * 7 + Math.sin(G.t * 30 + i) * 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (p.elem === 'vento') {
    // Rajada Celestial: meia-lua de vento rosa/lilás girando
    ctx.translate(p.x, y);
    ctx.scale(Math.sign(p.vx) || 1, 1);
    ctx.lineCap = 'round';
    const giro = G.t * 18;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = ['rgba(201,168,255,.55)', '#ff6fc8', '#ffffff'][i];
      ctx.lineWidth = [16, 9, 4][i];
      ctx.beginPath(); ctx.arc(-6, 0, 26 - i * 3, -1.3 + Math.sin(giro) * 0.15, 1.3 + Math.sin(giro) * 0.15); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(143,184,255,.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const yy = (i - 1) * 12; ctx.beginPath(); ctx.moveTo(-20, yy); ctx.lineTo(-48 - i * 6, yy); ctx.stroke(); }
  } else {
    ctx.translate(p.x, y);
    ctx.scale(Math.sign(p.vx), 1);
    ctx.rotate(Math.sin(G.t * 20) * 0.05);
    ctx.fillStyle = 'rgba(160,224,255,.45)';
    ctx.beginPath(); ctx.ellipse(-6, 0, 38, 20, 0, 0, Math.PI * 2); ctx.fill();
    const lanca = (cor, s) => {
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.moveTo(34 * s, 0); ctx.lineTo(0, -14 * s); ctx.lineTo(-26 * s, 0); ctx.lineTo(0, 14 * s); ctx.closePath(); ctx.fill();
    };
    lanca('#4fb6ff', 1.1); lanca('#bfeaff', 0.8); lanca('#ffffff', 0.4);
  }
  ctx.restore();
}

function texto(txt, x, y, tam, cor, alinh = 'center', contorno = true) {
  ctx.font = `${tam}px ${FONTE}`;
  ctx.textAlign = alinh;
  ctx.textBaseline = 'middle';
  if (contorno) { ctx.lineWidth = Math.max(3, tam / 4); ctx.strokeStyle = '#120c1e'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = cor;
  ctx.fillText(txt, x, y);
}

function retratoLosango(id, cx, cy, tam, espelhar, corBorda) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath(); ctx.moveTo(0, -tam); ctx.lineTo(tam, 0); ctx.lineTo(0, tam); ctx.lineTo(-tam, 0); ctx.closePath();
  ctx.fillStyle = '#1c1630'; ctx.fill();
  ctx.save(); ctx.clip();
  if (espelhar) ctx.scale(-1, 1);
  ctx.drawImage(RETRATOS[id], -tam, -tam, tam * 2, tam * 2);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = corBorda; ctx.stroke();
  ctx.restore();
}

function barraHUD(x, y, w, h, frac, fracVis, cor, espelhar) {
  ctx.fillStyle = '#120c1e'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#3a2e5a'; ctx.fillRect(x, y, w, h);
  const desenha = (fr, c) => { const ww = w * clamp(fr, 0, 1); ctx.fillStyle = c; ctx.fillRect(espelhar ? x + w - ww : x, y, ww, h); };
  desenha(fracVis, '#ffffff');
  desenha(frac, cor);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w, h * 0.35);
}

// barra de CALOR do Brasa (vira FÚRIA piscando quando enche)
function desenharBarraCalor(f, x, y, esq) {
  const w = 130, h = 10, furia = f.furia > 0;
  const fr = furia ? f.furia / FURIA_DUR : (f.calor || 0) / 100;
  ctx.fillStyle = '#120c1e'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#2a2140'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = furia ? (Math.floor(G.t * 10) % 2 ? '#ffd166' : '#ff5a3c') : '#ff7a3d';
  ctx.fillRect(esq ? x : x + w * (1 - fr), y, w * fr, h);
  texto(furia ? 'FÚRIA' : 'RAIVA', esq ? x + w + 8 : x - 8, y + 5, 8, furia ? '#ffd166' : '#ffb347', esq ? 'left' : 'right', false);
}

function desenharHUDSolo() {
  const f = G.f[0];
  retratoLosango(f.id, 62, 62, 48, false, f.p.cor);
  texto(f.p.nome, 124, 40, 16, f.p.cor2, 'left');
  texto('MODO LIVRE · movimentação', 124, 64, 9, '#a698c6', 'left', false);
  // painel com o estado do movimento
  const nomes = {
    idle: 'parada', walk: 'andando', corrida: 'correndo', freio: 'derrapando', dash: 'investida', air: f.vy > 0 ? 'subindo' : 'caindo',
    pouso: 'aterrissando', defesa: 'defendendo', carga: 'carregando', atk: 'atacando', provocar: 'provocando',
  };
  const linhas = [
    ['ESTADO', nomes[f.est] || f.est],
    ['VEL. X', String(Math.round(Math.abs(f.vx)))],
    ['ALTURA', String(Math.round(f.y))],
    ['PULO DUPLO', f.p.pulosAr === 0 ? 'não tem' : f.solo ? 'pronto' : f.puloDuplo ? 'usado' : 'pronto'],
    ['INVESTIDA NO AR', f.solo ? 'pronta' : f.dashAr ? 'usada' : 'pronta'],
  ];
  if (f.p.mecanica === 'calor') linhas.push(['RAIVA', f.furia > 0 ? `FÚRIA ${f.furia.toFixed(1)}s` : `${Math.round(f.calor || 0)}%`]);
  if (f.p.mecanica === 'gelo') linhas.push(['POÇAS DE GELO', String(G.zonas.filter((z) => z.tipo === 'gelo').length)]);
  ctx.fillStyle = 'rgba(18,12,30,.75)'; ctx.fillRect(W - 300, 16, 284, 24 + linhas.length * 22);
  linhas.forEach(([a, b], i) => {
    texto(a, W - 288, 34 + i * 22, 9, '#a698c6', 'left', false);
    texto(b, W - 28, 34 + i * 22, 9, '#ffffff', 'right', false);
  });
  texto(`${teclasDe(MAPA_P1, 'atk')} ataque · ${teclasDe(MAPA_P1, 'botaoEsp')} especial (→ golpe, ↓ carrega) · ${teclasDe(MAPA_P1, 'def')} defesa · ${teclasDe(MAPA_P1, 'dash')} investida · ↑ pula · Esc: menu`, W / 2, 528, 8, '#ffffff');
}

function desenharHUD() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.modo === 'solo') { desenharHUDSolo(); return; }
  for (let i = 0; i < 2; i++) {
    const f = G.f[i], esq = i === 0;
    const px = esq ? 62 : W - 62;
    retratoLosango(f.id, px, 62, 48, !esq, f.p.cor);
    const bx = esq ? 120 : W - 120 - 330;
    const hpCor = f.hp / 1000 < 0.3 ? '#ff5d5d' : '#5ee07a';
    barraHUD(bx, 28, 330, 22, f.hp / 1000, f.hpVis / 1000, hpCor, !esq);
    for (let s = 0; s < 4; s++) {
      const sw = 70, sx = esq ? bx + s * (sw + 6) : bx + 330 - (s + 1) * sw - s * 6;
      const fr = clamp((f.en - s * 25) / 25, 0, 1);
      ctx.fillStyle = '#120c1e'; ctx.fillRect(sx - 2, 60, sw + 4, 14);
      ctx.fillStyle = '#2a2140'; ctx.fillRect(sx, 62, sw, 10);
      ctx.fillStyle = f.en >= 100 ? (Math.floor(G.t * 8) % 2 ? '#ffffff' : '#ffcf4a') : '#4fb6ff';
      ctx.fillRect(esq ? sx : sx + sw * (1 - fr), 62, sw * fr, 10);
    }
    texto(f.p.nome, esq ? bx : bx + 330, 92, 14, f.p.cor2, esq ? 'left' : 'right');
    if (f.p.mecanica === 'calor') desenharBarraCalor(f, esq ? bx : bx + 330 - 130, 126, esq);
    // lembrete das teclas de poder (só para quem joga)
    if ((esq && G.modo !== 'cpuvscpu') || G.modo === '2p') {
      const mapa = esq ? MAPA_P1 : MAPA_P2, k = teclasDe(mapa, 'botaoEsp'), a = teclasDe(mapa, 'atk');
      const custo = ATQ.projetil.custo;
      const cor = f.en >= custo ? '#ffffff' : '#7a6d99';
      texto(`${k} ${f.p.projetil} (${custo}) · →${k} ${f.p.especial} (${ATQ.especial.custo}) · ${a}+${k} FINAL`, esq ? bx : bx + 330, 114, 8, cor, esq ? 'left' : 'right');
    }
    for (let v = 0; v < 2; v++) {
      const vx = esq ? bx + 150 + v * 22 : bx + 330 - 150 - v * 22;
      ctx.fillStyle = '#120c1e'; ctx.beginPath(); ctx.arc(vx, 92, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = G.vit[i] > v ? '#ffcf4a' : '#3a2e5a'; ctx.beginPath(); ctx.arc(vx, 92, 5.5, 0, Math.PI * 2); ctx.fill();
    }
    if (f.combo >= 2 && G.t - f.ultimoHit < 1) texto(`${f.combo} HITS`, esq ? 40 : W - 40, 160, 18, '#ffcf4a', esq ? 'left' : 'right');
  }
  ctx.fillStyle = '#120c1e'; ctx.fillRect(W / 2 - 40, 16, 80, 62);
  ctx.strokeStyle = '#3a2e5a'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 40, 16, 80, 62);
  texto(String(Math.ceil(G.tempo)).padStart(2, '0'), W / 2, 50, 26, '#ffffff', 'center', false);
  // mini-mapa da arena
  const mx = W / 2 - 120, my = 512, mw = 240;
  ctx.fillStyle = 'rgba(18,12,30,.7)'; ctx.fillRect(mx - 4, my - 6, mw + 8, 14);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(mx + (G.cam.x / ARENA_W) * mw, my - 4, (W / G.cam.zoom / ARENA_W) * mw, 10);
  for (const pl of PLATAFORMAS) { ctx.fillStyle = '#a7adba'; ctx.fillRect(mx + pl.x0 / ARENA_W * mw, my - 3 - pl.y / 60, (pl.x1 - pl.x0) / ARENA_W * mw, 2); }
  G.f.forEach((f) => { ctx.fillStyle = f.p.cor; ctx.fillRect(mx + f.x / ARENA_W * mw - 3, my - 2, 6, 6); });
}

function desenharCine() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const c = G.cine;
  ctx.fillStyle = 'rgba(8,4,16,.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  for (let i = 0; i < 18; i++) {
    ctx.rotate(Math.PI / 9);
    ctx.fillStyle = i % 2 ? c.at.p.cor : c.at.p.cor2;
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(700, -40 - Math.sin(G.t * 5 + i) * 20); ctx.lineTo(700, 40); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const seq = [11, 11, 13, 14, 10, 12, 13, 14];
  const qa = seq[Math.min(seq.length - 1, Math.floor(c.t / 0.42))];
  desenharSprite(c.df.id, 15, 680 + (c.t > 0.6 ? rand(-6, 6) : 0), 430, -1, c.df.escala * 1.3, Math.floor(G.t * 16) % 3 === 0 && c.t > 0.6);
  desenharSprite(c.at.id, qa, 300, 450, 1, c.at.escala * 1.7);
  for (const p of G.part) if (p.tela) { ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(p.x, p.y, p.tam, p.tam); }
  ctx.globalAlpha = 1;
  texto(c.at.p.final, W / 2, 80, 22, c.at.p.cor2);
  if (c.t > 0.6 && c.t < 2.8) {
    const iA = G.f.indexOf(c.at);
    const teclaA = iA === 0 ? 'J' : 'Numpad 1';
    texto(`APERTE ${teclaA} SEM PARAR!`, W / 2, 130, 12, '#ffffff');
    const tot = Math.max(1, c.ma + c.md);
    barraHUD(W / 2 - 200, 480, 400, 14, c.ma / tot, c.ma / tot, c.at.p.cor, false);
  }
  if (c.t > c.dur - 0.25) { ctx.fillStyle = `rgba(255,255,255,${(c.t - (c.dur - 0.25)) / 0.25})`; ctx.fillRect(0, 0, W, H); }
}

function desenharLuta(dt) {
  const shx = G.shake > 0 ? rand(-G.shake, G.shake) : 0, shy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
  // posições interpoladas entre o passo anterior e o atual
  const a = G.pausa || G.hitstop > 0 ? 1 : (G.alfa ?? 1);
  const reais = G.f.map((f) => ({ x: f.x, y: f.y }));
  for (const f of G.f) if (f.px !== undefined) { f.x = lerpN(f.px, f.x, a); f.y = lerpN(f.py, f.y, a); }
  const cam = G.camAnt ? { x: lerpN(G.camAnt.x, G.cam.x, a), y: lerpN(G.camAnt.y || 0, G.cam.y || 0, a), zoom: lerpN(G.camAnt.zoom, G.cam.zoom, a) } : G.cam;
  desenharCenario(G.t, dt, cam, shx, shy);
  transfMundo(cam, shx, shy);
  desenharPlataformas();
  desenharZonas(); // poças de gelo e chão em brasa
  for (const r of G.rastros) {
    const al = 0.35 * (1 - r.t / 0.25);
    if (r.rig && r.rigJ) renderBoneco(r, { branco: true, alpha: al, semCorrentes: true });
    else desenharSprite(r.id, r.q, r.x, CHAO - r.y, r.face, r.escala, true, 0, al);
  }
  const ordem = [...G.f].sort((a, b) => (a.est === 'atk' ? 1 : 0) - (b.est === 'atk' ? 1 : 0));
  for (const f of ordem) { desenharLutador(f); desenharCongelado(f); }
  G.f.forEach((f, i) => { f.x = reais[i].x; f.y = reais[i].y; });
  for (const p of G.proj) desenharProjetil(p);
  for (const p of G.part) {
    if (p.tela) continue;
    ctx.globalAlpha = 1 - p.t / p.vida;
    ctx.fillStyle = p.cor;
    ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
  }
  ctx.globalAlpha = 1;
  for (const t of G.textos) {
    ctx.globalAlpha = 1 - t.t;
    texto(t.txt, t.x, t.y - t.t * 50, t.tam, t.cor);
  }
  ctx.globalAlpha = 1;
  desenharPetalas(G.t, dt);
  if (G.cine) desenharCine();
  desenharHUD();
  if (G.anuncio) {
    const a = G.anuncio, k = Math.min(1, a.t / 0.15);
    ctx.globalAlpha = a.t > a.dur - 0.25 ? (a.dur - a.t) / 0.25 : 1;
    texto(a.txt, W / 2, H / 2 - 30, Math.round(lerpN(60, 34, k)), a.cor);
    ctx.globalAlpha = 1;
  }
  if (G.pausa) {
    ctx.fillStyle = 'rgba(8,4,16,.7)'; ctx.fillRect(0, 0, W, H);
    texto('PAUSA', W / 2, H / 2 - 30, 32, '#ffcf4a');
    texto('Enter: continuar   ·   Q: sair para o menu', W / 2, H / 2 + 30, 12, '#ffffff');
  }
}

const CAM_MENU = { x: 0, zoom: 1 };
function desenharFundoMenu(dt) {
  CAM_MENU.x = (ARENA_W - W) / 2 + Math.sin(G.t * 0.12) * ((ARENA_W - W) / 2 - 10);
  desenharCenario(G.t, dt, CAM_MENU);
  transfMundo(CAM_MENU);
  desenharPlataformas();
  desenharPetalas(G.t, dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(10,6,22,.55)';
  ctx.fillRect(0, 0, W, H);
}

function desenharTitulo(dt) {
  desenharFundoMenu(dt);
  desenharSprite('brasa', Math.floor(G.t * 2.5) % 2, 190, 480, 1, 210 / FOLHAS.brasa.alturaBase);
  desenharSprite('geada', Math.floor(G.t * 2.5) % 2, 770, 480, -1, 210 / FOLHAS.geada.alturaBase);
  texto('DUELO', W / 2, 110, 54, '#ffcf4a');
  texto('ELEMENTAL', W / 2, 175, 40, '#ff8a5c');
  MENU_TITULO.forEach((m, i) => {
    const sel = i === G.menuSel;
    texto((sel ? '▶ ' : '') + m.txt, W / 2, 280 + i * 46, sel ? 18 : 15, sel ? '#ffffff' : '#a698c6');
  });
  texto('W/S ou setas para escolher · Enter para confirmar', W / 2, 510, 10, '#a698c6');
}

function desenharAjuda(dt) {
  desenharFundoMenu(dt);
  ctx.fillStyle = 'rgba(18,12,30,.88)'; ctx.fillRect(70, 26, W - 140, H - 52);
  texto('COMO JOGAR', W / 2, 60, 22, '#ffcf4a');
  // mostra as teclas atuais do P1 (mudam no menu CONTROLES)
  const t = (a) => teclasDe(MAPA_P1, a);
  const linhas = [
    ['Andar / Pular (2x = pulo duplo)', `${t('esq')} ${t('dir')} / ${t('cima')}`],
    ['Correr: 2 toques na direção ou INVESTIDA', `${t('dir')} ${t('dir')} / ${t('dash')}`],
    ['Ataque (3x = combo; correndo / no ar muda)', t('atk')],
    ['Projétil (15 de energia)', t('botaoEsp')],
    ['Golpe especial: lado + ESPECIAL (20)', `→ + ${t('botaoEsp')}`],
    ['Carregar energia: baixo + segurar ESPECIAL', `${t('baixo')} + ${t('botaoEsp')}`],
    ['GOLPE FINAL: ATAQUE + ESPECIAL (cheia)', `${t('atk')} + ${t('botaoEsp')}`],
    ['Defender (segurar)', `${t('def')} / ${t('baixo')}`],
    ['Troca rápida: INVESTIDA apanhando (25)', t('dash')],
    ['Provocar: baixo + INVESTIDA parado', `${t('baixo')} + ${t('dash')}`],
    ['Queda rápida (no ar) / descer plataforma', `${t('baixo')} / ${t('baixo')} ${t('baixo')}`],
    ['Pular na parede (no canto, no ar)', t('cima')],
  ];
  linhas.forEach(([a, b], i) => {
    texto(a, 110, 96 + i * 28, 11, '#ffffff', 'left');
    texto(b, W - 110, 96 + i * 28, 11, '#ffcf4a', 'right');
  });
  texto('Mude teclas e botões do controle no menu CONTROLES · Esc pausa', W / 2, 482, 9, '#a698c6');
}

function desenharCartao(id, x, destaque, rotulo, cor) {
  const P = PERS[id];
  ctx.fillStyle = destaque ? 'rgba(46,35,80,.92)' : 'rgba(18,12,30,.85)';
  ctx.fillRect(x - 190, 90, 380, 380);
  ctx.strokeStyle = destaque ? cor : '#3a2e5a'; ctx.lineWidth = 4; ctx.strokeRect(x - 190, 90, 380, 380);
  texto(rotulo, x, 115, 12, cor);
  const esc = 190 / FOLHAS[id].alturaBase;
  desenharSprite(id, destaque ? Math.floor(G.t * 2.5) % 2 : 0, x - 70, 330, 1, esc);
  texto(P.nome, x + 80, 180, 20, P.cor2);
  texto(P.titulo, x + 80, 210, 8, '#a698c6', 'center', false);
  const nomes = { forca: 'FORÇA', vel: 'VELOC.', defesa: 'DEFESA', alcance: 'ALCANCE' };
  Object.entries(P.stats).forEach(([k, v], i) => {
    texto(nomes[k], x - 10, 250 + i * 22, 9, '#ffffff', 'left', false);
    for (let s = 0; s < 5; s++) { ctx.fillStyle = s < v ? P.cor : '#3a2e5a'; ctx.fillRect(x + 80 + s * 18, 244 + i * 22, 14, 12); }
  });
  // vantagem de elemento: forte contra / fraco contra
  const forte = (VENCE[P.elem] || []).map((e) => NOME_ELEM[e]).join(', ');
  const fraco = Object.keys(VENCE).filter((e) => VENCE[e].includes(P.elem)).map((e) => NOME_ELEM[e]).join(', ');
  texto(`${NOME_ELEM[P.elem] || P.elem}`, x + 80, 228, 8, P.cor, 'center', false);
  if (forte) texto(`forte contra ${forte}`, x - 95, 345, 8, '#7dff9a', 'center', false);
  if (fraco) texto(`fraco contra ${fraco}`, x + 95, 345, 8, '#ff8a8a', 'center', false);
  const kE = teclasDe(MAPA_P1, 'botaoEsp'), kA = teclasDe(MAPA_P1, 'atk');
  texto(`→+${kE}: ${P.especial}`, x, 375, 9, '#ffffff', 'center', false);
  texto(`${kE}: ${P.projetil}`, x, 400, 9, '#ffffff', 'center', false);
  texto(`${kA}+${kE}: ${P.final}`, x, 425, 9, '#ffcf4a', 'center', false);
  texto('◀  ▶', x, 452, 12, destaque ? '#ffffff' : '#5a4d80');
}

function desenharSelecao(dt) {
  desenharFundoMenu(dt);
  const s = G.sel;
  texto('ESCOLHA OS LUTADORES', W / 2, 50, 20, '#ffcf4a');
  const r2 = G.modo === 'cpu' || G.modo === 'cpuvscpu' ? 'CPU 2 (você escolhe)' : 'JOGADOR 2';
  desenharCartao(s.p[0], 250, s.etapa === 0, G.modo === 'cpuvscpu' ? 'CPU 1 (você escolhe)' : 'JOGADOR 1', '#ff8a5c');
  desenharCartao(s.p[1], 710, s.etapa === 1, r2, '#4fb6ff');
  texto('VS', W / 2, 280, 34, '#ffffff');
  texto(s.etapa < 2 ? 'A/D ou setas: trocar · Enter: confirmar · Esc: voltar' : '', W / 2, 505, 10, '#a698c6');
}

function desenharFim(dt) {
  desenharFundoMenu(dt);
  const v = G.vencedor, f = PERS[G.sel.p[v]];
  const quem = G.modo === 'cpuvscpu' ? `CPU ${v + 1} VENCEU!` : G.modo === 'cpu' ? (v === 0 ? 'VOCÊ VENCEU!' : 'A CPU VENCEU!') : `JOGADOR ${v + 1} VENCEU!`;
  texto(quem, W / 2, 90, 30, '#ffcf4a');
  desenharSprite(f.id, Math.floor(G.t * 2.5) % 2, W / 2, 400, 1, 230 / FOLHAS[f.id].alturaBase);
  texto(f.nome, W / 2, 140, 18, f.cor2);
  ['REVANCHE', 'MENU PRINCIPAL'].forEach((t, i) => {
    const sel = G.menuSel === i;
    texto((sel ? '▶ ' : '') + t, W / 2, 450 + i * 36, sel ? 16 : 13, sel ? '#ffffff' : '#a698c6');
  });
}

/* ---------------- Laço principal ---------------- */
let ultimo = performance.now(), acum = 0;
const PASSO = 1 / 60;

function laco(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.tela === 'carregando') {
    ctx.fillStyle = '#0d0a16'; ctx.fillRect(0, 0, W, H);
    texto('Carregando lutadores...', W / 2, H / 2, 14, '#ffffff');
  } else {
    lerControles(); // controle (gamepad)
    acum += dt;
    let passos = 0;
    while (acum >= PASSO && passos < 6) {
      passo(PASSO);
      ENT.forEach((e) => e.p.clear());
      acum -= PASSO;
      passos++;
    }
    G.alfa = clamp(acum / PASSO, 0, 1);
    G.dtDesenho = dt;
    if (G.tela === 'titulo') desenharTitulo(dt);
    else if (G.tela === 'ajuda') desenharAjuda(dt);
    else if (G.tela === 'controles') desenharControles(dt);
    else if (G.tela === 'selecao') desenharSelecao(dt);
    else if (G.tela === 'fim') desenharFim(dt);
    else if (G.tela === 'luta') desenharLuta(dt);
  }
  requestAnimationFrame(laco);
}

async function iniciar() {
  requestAnimationFrame(laco);
  try { await document.fonts.load(`16px ${FONTE}`); } catch (e) { /* segue com a fonte padrão */ }
  for (const id of [...ORDEM_PERS]) {
    if (PERS[id].soAnim) {
      // personagem novo sem folha 4x4: monta a "folha" com a pose base das animações dele
      const dados = typeof ANIM_DATA !== 'undefined' && ANIM_DATA[id];
      const base = dados && dados.idle && dados.idle[0];
      if (!base) { ORDEM_PERS.splice(ORDEM_PERS.indexOf(id), 1); continue; } // sem arte ainda: fica fora da seleção
      // com arte grande ('cartao'), seleção/retrato/fim ficam nítidos; senão usa a pose base ampliada
      FOLHAS[id] = dados.cartao ? folhaDaPoseBase(await carregarImg(dados.cartao[0]), 1) : folhaDaPoseBase(await carregarImg(base));
      criarRetrato(id);
      continue;
    }
    const img = await carregarImg(SPRITE_DATA[id]);
    FOLHAS[id] = processarFolha(img);
    criarRetrato(id);
    if (USAR_BONECO && id === 'geada' && typeof retratoBoneco === 'function') RETRATOS.geada = retratoBoneco();
  }
  // animações quadro a quadro (PixelLab)
  try { await carregarAnims(); } catch (e) { console.warn('não deu para carregar as animações', e); }
  // pulos extras (ninja/bolinha) desligados a pedido: a Geada usa o pulo original do PixelLab
  if (USAR_PULOS_EXTRAS) {
    try { await carregarPuloNinja(); } catch (e) { console.warn('não deu para carregar o pulo ninja', e); }
    try { await carregarPuloBola(); } catch (e) { console.warn('não deu para carregar o pulo bolinha', e); }
  }
  // peças desenhadas da Geada (para o boneco articulado)
  if (typeof PARTES_DATA !== 'undefined' && typeof prepararPartes === 'function') {
    try { prepararPartes(await carregarImg(PARTES_DATA)); } catch (e) { console.warn('não deu para carregar as peças', e); }
  }
  pintarCenario();
  irPara('titulo');
}
iniciar();
