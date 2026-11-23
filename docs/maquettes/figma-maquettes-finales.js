// Script Figma (plugin API) qui crée la page « Maquettes finales (Prestige) ». À exécuter avec l'outil use_figma ou dans un plugin de développement.
// Footix – maquettes finales (style Prestige), une seule exécution.
const NAVY = '#0b1f4b', GREY = '#5a6681', LINE = '#dde2ec', BG2 = '#f5f6fa', GOLD = '#c5a253', GOLDTXT = '#7d5f17', PITCH = '#1e5e3a', RED = '#a1192e', GREEN = '#1e6b45';
const CAT = {
  VIP: { name: 'Hospitalité VIP', color: '#c5a253', txt: NAVY, price: '180,00 €', free: '36 places libres', desc: 'Loge privée, accueil dédié, repas inclus' },
  CAT1: { name: 'Catégorie 1', color: '#0b1f4b', txt: '#ffffff', price: '45,00 €', free: '670 places libres', desc: 'Anneau bas, face au rond central' },
  CAT2: { name: 'Catégorie 2', color: '#3b5bab', txt: '#ffffff', price: '30,00 €', free: '952 places libres', desc: 'Corners en bas, centre en haut' },
  CAT3: { name: 'Catégorie 3', color: '#8fa3cf', txt: NAVY, price: '19,00 €', free: '504 places libres', desc: 'Anneau haut, bouts de tribune, Est' },
  KOP: { name: 'Virage Kop', color: '#a1192e', txt: '#ffffff', price: '12,00 €', free: '336 places libres', desc: 'Derrière le but, places debout' },
  VISIT: { name: 'Parcage visiteurs', color: '#eef0f5', txt: GREY, price: 'Hors vente', free: 'Non vendu en ligne', desc: 'Billets vendus par le club visiteur' },
};

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 }; }
const solid = (hex, opacity = 1) => [{ type: 'SOLID', color: rgb(hex), opacity }];

async function pick(family, styles) {
  for (const style of styles) { try { await figma.loadFontAsync({ family, style }); return { family, style }; } catch (e) {} }
  return null;
}
const F = {};
F.serif = await pick('Fraunces', ['SemiBold', 'Semi Bold', 'Medium', 'Regular']) || await pick('Playfair Display', ['SemiBold', 'Semi Bold', 'Bold', 'Regular']) || await pick('Georgia', ['Bold', 'Regular']);
F.serifBold = await pick('Fraunces', ['Bold', 'SemiBold', 'Semi Bold']) || F.serif;
F.sans = await pick('Archivo', ['Regular']) || await pick('Inter', ['Regular']);
F.sansBold = await pick('Archivo', ['SemiBold', 'Semi Bold', 'Bold']) || await pick('Inter', ['Semi Bold', 'Bold']);

function rect(parent, x, y, w, h, fill, opts = {}) {
  const r = figma.createRectangle(); parent.appendChild(r);
  r.x = x; r.y = y; r.resize(Math.max(1, w), Math.max(1, h));
  r.fills = fill ? solid(fill, opts.opacity ?? 1) : [];
  if (opts.stroke) { r.strokes = solid(opts.stroke); r.strokeWeight = opts.sw || 1; if (opts.dash) r.dashPattern = opts.dash; r.strokeAlign = 'INSIDE'; }
  if (opts.radius) r.cornerRadius = opts.radius;
  if (opts.name) r.name = opts.name;
  return r;
}
function text(parent, str, x, y, o = {}) {
  const t = figma.createText(); parent.appendChild(t);
  t.fontName = o.font || F.sans; t.fontSize = o.size || 16; t.characters = str;
  t.fills = solid(o.color || NAVY);
  if (o.lh) t.lineHeight = { value: o.lh, unit: 'PIXELS' };
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); }
  if (o.align) t.textAlignHorizontal = o.align;
  t.x = x; t.y = y;
  if (o.rotate) t.rotation = o.rotate;
  return t;
}
function frame(parent, name, x, y, w, h, fill = '#ffffff') {
  const f = figma.createFrame(); parent.appendChild(f); f.name = name; f.x = x; f.y = y; f.resize(w, h); f.fills = solid(fill); f.clipsContent = true; return f;
}
function logo(parent, x, y, s = 1) {
  const c = figma.createEllipse(); parent.appendChild(c); c.resize(16 * s, 16 * s); c.x = x; c.y = y + 5 * s; c.fills = []; c.strokes = solid(GOLD); c.strokeWeight = 2 * s;
  text(parent, 'Footix', x + 24 * s, y, { font: F.serifBold, size: 22 * s });
}
function header(parent, w, mobile) {
  rect(parent, 0, 0, w, mobile ? 60 : 72, '#ffffff');
  rect(parent, 0, mobile ? 59 : 71, w, 1, LINE);
  if (mobile) {
    logo(parent, 16, 17, 1);
    for (let i = 0; i < 3; i++) rect(parent, w - 40, 22 + i * 7, 22, 2, NAVY);
  } else {
    logo(parent, 80, 22, 1);
    text(parent, 'Matchs', w - 400, 26, { size: 15, font: F.sansBold });
    rect(parent, w - 400, 50, 52, 2, GOLD);
    text(parent, 'Mes billets', w - 320, 26, { size: 15 });
    rect(parent, w - 200, 16, 120, 40, null, { stroke: NAVY });
    text(parent, 'Se connecter', w - 186, 26, { size: 15, font: F.sansBold });
  }
}
// Stadium seen from above. Base box 692 x 568, scaled by s.
const BLOCKS = [];
const top = (row, y, h, codes, cats) => codes.forEach((c, i) => BLOCKS.push([c, 185 + i * 65.5, y, 58, h, cats[i]]));
top(0, 42, 53, ['NH1', 'NH2', 'NH3', 'NH4', 'NH5'], ['CAT3', 'CAT2', 'CAT2', 'CAT2', 'CAT3']);
top(0, 103, 48, ['N1', 'N2', 'N3', 'N4', 'N5'], ['CAT2', 'CAT1', 'CAT1', 'CAT1', 'CAT2']);
top(0, 387, 48, ['S1', 'S2', 'S3', 'S4', 'S5'], ['CAT2', 'CAT1', 'CAT1', 'CAT1', 'CAT2']);
top(0, 472, 53, ['SH1', 'SH2', 'SH3', 'SH4', 'SH5'], ['CAT3', 'CAT2', 'CAT2', 'CAT2', 'CAT3']);
[['L1', 267], ['L2', 322], ['L3', 377]].forEach(([c, x]) => BLOCKS.push([c, x, 443, 48, 22, 'VIP']));
BLOCKS.push(['OH1', 61, 167, 53, 98, 'KOP'], ['O1', 122, 167, 48, 98, 'KOP'], ['OH2', 61, 273, 53, 98, 'KOP'], ['O2', 122, 273, 48, 98, 'KOP']);
BLOCKS.push(['E1', 521, 167, 48, 98, 'CAT3'], ['EH1', 577, 167, 53, 98, 'CAT3'], ['E2', 521, 273, 48, 98, 'VISIT'], ['EH2', 577, 273, 53, 98, 'VISIT']);

function stadium(parent, x, y, s, selected) {
  const g = frame(parent, 'Plan du stade', x, y, 692 * s, 568 * s, BG2);
  g.strokes = solid(LINE); g.strokeWeight = 1;
  rect(g, 182 * s, 164 * s, 326 * s, 210 * s, PITCH);
  for (let i = 0; i < 10; i += 2) rect(g, (182 + i * 32.6) * s, 164 * s, 32.6 * s, 210 * s, '#23693f');
  rect(g, 344.5 * s, 164 * s, 1.5 * s, 210 * s, '#ffffff');
  const cc = figma.createEllipse(); g.appendChild(cc); cc.resize(58 * s, 58 * s); cc.x = 316 * s; cc.y = 240 * s; cc.fills = []; cc.strokes = solid('#ffffff'); cc.strokeWeight = 1.5 * s;
  rect(g, 182 * s, 207 * s, 52 * s, 124 * s, null, { stroke: '#ffffff', sw: 1.5 * s });
  rect(g, 456 * s, 207 * s, 52 * s, 124 * s, null, { stroke: '#ffffff', sw: 1.5 * s });
  for (const [code, bx, by, bw, bh, cat] of BLOCKS) {
    const c = CAT[cat];
    const r = rect(g, bx * s, by * s, bw * s, bh * s, c.color, cat === 'VISIT' ? { stroke: '#9aa3b8', dash: [4, 3], radius: 2 } : { radius: 2 });
    r.name = `Bloc ${code}`;
    if (selected === code) { r.strokes = solid(GOLD); r.strokeWeight = 3 * s; r.strokeAlign = 'OUTSIDE'; }
    const t = text(g, code, 0, 0, { size: Math.max(7, 11 * s), font: F.sansBold, color: c.txt });
    t.x = bx * s + (bw * s - t.width) / 2; t.y = by * s + (bh * s - t.height) / 2;
  }
  const lbl = (str, lx, ly, rot) => { const t = text(g, str, 0, 0, { size: Math.max(7, 11 * s), font: F.serif, color: NAVY }); if (rot) { t.rotation = rot; } t.x = lx * s - (rot ? 0 : t.width / 2); t.y = ly * s; };
  lbl('Tribune Nord', 346, 20); lbl('Tribune Sud', 346, 540);
  const w1 = text(g, 'Tribune Ouest', 0, 0, { size: Math.max(7, 11 * s), font: F.serif }); w1.rotation = 90; w1.x = 30 * s; w1.y = 270 * s + w1.width / 2;
  const e1 = text(g, 'Tribune Est', 0, 0, { size: Math.max(7, 11 * s), font: F.serif }); e1.rotation = -90; e1.x = 662 * s + e1.height; e1.y = 270 * s - e1.width / 2;
  return g;
}
function categoryRow(parent, x, y, w, code, compact) {
  const c = CAT[code];
  const box = rect(parent, x, y, w, compact ? 52 : 74, '#ffffff', { stroke: LINE, dash: code === 'VISIT' ? [4, 3] : undefined });
  if (code === 'CAT1' && !compact) { rect(parent, x, y, 3, 74, GOLD); box.strokes = solid(NAVY); }
  rect(parent, x + 14, y + 16, 14, 14, code === 'VISIT' ? GREY : c.color, { radius: 2 });
  text(parent, c.name, x + 38, y + 11, { font: F.serif, size: compact ? 16 : 19 });
  const p = text(parent, c.price, 0, y + 11, { font: F.sansBold, size: compact ? 15 : 18 }); p.x = x + w - 14 - p.width;
  if (compact) text(parent, c.free, x + 38, y + 32, { size: 12, color: GREY });
  else { text(parent, c.desc, x + 38, y + 38, { size: 13, color: GREY }); const f = text(parent, c.free, 0, y + 40, { size: 12, font: F.sansBold, color: GREY }); f.x = x + w - 14 - f.width; }
}
function checkbox(parent, x, y, label, on) {
  rect(parent, x, y, 16, 16, on ? NAVY : '#ffffff', { stroke: NAVY, radius: 2 });
  if (on) text(parent, '✓', x + 3, y - 1, { size: 13, font: F.sansBold, color: '#ffffff' });
  text(parent, label, x + 24, y - 1, { size: 13, color: NAVY });
}
function basket(parent, x, y, w, mobile) {
  const h = mobile ? 300 : 312;
  rect(parent, x, y, w, h, '#ffffff', { stroke: NAVY });
  rect(parent, x, y, w, 4, GOLD);
  text(parent, 'Votre sélection', x + 20, y + 20, { font: F.serif, size: 22 });
  const lines = [['Tribune Nord, Bloc N3, rang 1, place 1', 'Catégorie 1', '45,00 €', false], ['Tribune Nord, Bloc N3, rang 1, place 2', 'Catégorie 1', '22,50 €', true]];
  lines.forEach(([where, cat, price, red], i) => {
    const ly = y + 62 + i * 78;
    text(parent, where, x + 20, ly, { size: 14, font: F.sansBold, w: w - 130 });
    text(parent, cat, x + 20, ly + (mobile ? 38 : 20), { size: 13, color: GOLDTXT, font: F.sansBold });
    const p = text(parent, price, 0, ly, { size: 15, font: F.sansBold }); p.x = x + w - 20 - p.width;
    checkbox(parent, x + 20, ly + (mobile ? 58 : 42), 'Tarif réduit (-50 %), justificatif à présenter', red);
    rect(parent, x + 20, ly + 72, w - 40, 1, LINE);
  });
  const ty = y + 222;
  text(parent, 'Total', x + 20, ty, { font: F.serif, size: 20 });
  const tot = text(parent, '67,50 €', 0, ty, { font: F.serifBold, size: 22 }); tot.x = x + w - 20 - tot.width;
  rect(parent, x + 20, ty + 36, w - 40, 44, NAVY, { radius: 2 });
  const b = text(parent, 'Acheter 2 places', 0, ty + 48, { size: 15, font: F.sansBold, color: '#ffffff' }); b.x = x + (w - b.width) / 2;
}
function qr(parent, x, y, size) {
  rect(parent, x, y, size, size, '#ffffff', { stroke: LINE });
  const n = 25, m = (size - 16) / n; let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const finder = (i, j) => (i < 7 && j < 7) || (i < 7 && j >= n - 7) || (i >= n - 7 && j < 7);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let on;
    if (finder(i, j)) { const a = i >= n - 7 ? i - (n - 7) : i, b = j >= n - 7 ? j - (n - 7) : j; on = a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4); }
    else on = rnd() > 0.52;
    if (on) rect(parent, x + 8 + j * m, y + 8 + i * m, m, m, '#000000');
  }
}
function ticket(parent, x, y, w, open, mobile, data) {
  const h = open ? (mobile ? 470 : 290) : (mobile ? 216 : 130);
  rect(parent, x, y, w, h, '#ffffff', { stroke: LINE });
  rect(parent, x, y, 4, h, GOLD);
  text(parent, 'FC Limoges – AS Bordeaux Nord', x + 22, y + 18, { font: F.serif, size: mobile ? 19 : 22, w: mobile ? w - 40 : undefined });
  const dy = mobile ? 26 : 0;
  text(parent, 'Jeudi 3 décembre à 20 h 45', x + 22, y + 50 + dy, { size: 13, color: GREY });
  text(parent, data.where, x + 22, y + 72 + dy, { size: 15, font: F.sansBold, w: mobile ? w - 40 : undefined });
  text(parent, data.cat, x + 22, y + 96 + dy + (mobile ? 18 : 0), { size: 13, font: F.sansBold, color: GOLDTXT });
  const by = y + (mobile ? 140 + 18 : 50);
  const bw = 170, bx = mobile ? x + 22 : x + w - bw - 24;
  if (!mobile) { rect(parent, bx, by, bw, 40, '#ffffff', { stroke: NAVY }); const t = text(parent, open ? 'Masquer le QR code' : 'Afficher le QR code', 0, by + 11, { size: 14, font: F.sansBold }); t.x = bx + (bw - t.width) / 2; }
  if (open) {
    const qy = mobile ? y + 200 : y + 150;
    qr(parent, x + 22, qy, mobile ? 200 : 120);
    text(parent, 'Présentez ce QR code à l’entrée. Il n’est accepté qu’une seule fois.', mobile ? x + 22 : x + 170, mobile ? qy + 214 : qy + 44, { size: 14, w: mobile ? w - 44 : 420 });
  }
  if (mobile) { const yb = y + h - 56; rect(parent, x + 22, yb, w - 44, 40, '#ffffff', { stroke: NAVY }); const t = text(parent, open ? 'Masquer le QR code' : 'Afficher le QR code', 0, yb + 11, { size: 14, font: F.sansBold }); t.x = x + 22 + (w - 44 - t.width) / 2; }
  return h;
}

// ---------- Page and root frame ----------
let page = figma.root.children.find((p) => p.name === 'Maquettes finales (Prestige)');
if (page) { for (const c of [...page.children]) c.remove(); } else { page = figma.createPage(); page.name = 'Maquettes finales (Prestige)'; }
await figma.setCurrentPageAsync(page);
const root = frame(page, 'Footix – maquettes finales', 0, 0, 1990, 2930, '#e9ebf0');

// ---------- 1. Enchaînement ----------
const flow = frame(root, 'Schéma d’enchaînement des écrans', 40, 40, 1910, 560, '#ffffff');
text(flow, 'Enchaînement des écrans', 40, 30, { font: F.serif, size: 30 });
text(flow, 'Le menu change selon le rôle : le spectateur voit « Mes billets », le contrôleur « Contrôle », l’administrateur « Administration ».', 40, 74, { size: 15, color: GREY });
function node(x, y, title, sub, role) {
  rect(flow, x, y, 230, 116, '#ffffff', { stroke: NAVY });
  rect(flow, x, y, 230, 4, role === 'admin' ? RED : role === 'ctrl' ? '#3b5bab' : GOLD);
  const t = text(flow, title, x + 16, y + 16, { font: F.serif, size: 19, w: 200 });
  text(flow, sub, x + 16, y + 16 + t.height + 6, { size: 13, color: GREY, w: 200, lh: 18 });
}
async function arrow(x1, y1, x2, y2, label, lx, ly) {
  const v = figma.createVector(); flow.appendChild(v);
  const net = { vertices: [{ x: x1, y: y1 }, { x: x2, y: y2, strokeCap: 'ARROW_EQUILATERAL' }], segments: [{ start: 0, end: 1 }], regions: [] };
  if (v.setVectorNetworkAsync) await v.setVectorNetworkAsync(net); else v.vectorNetwork = net;
  v.strokes = solid(NAVY); v.strokeWeight = 2;
  if (label) text(flow, label, lx ?? Math.min(x1, x2) + 8, ly ?? Math.min(y1, y2) - 22, { size: 12, color: GOLDTXT, font: F.sansBold });
}
node(40, 150, 'Accueil', 'Prochain match, plan du stade, prix par catégorie', 'fan');
node(390, 150, 'Page du match', 'Plan en 31 blocs, catégories, sièges, panier, tarif réduit', 'fan');
node(740, 150, 'Connexion / inscription', 'Demandée seulement au moment d’acheter', 'fan');
node(1090, 150, 'Mes billets', 'Confirmation de commande, billets valides', 'fan');
node(1440, 150, 'QR code du billet', 'Signé par le serveur, présenté à l’entrée', 'fan');
node(740, 390, 'Contrôle à l’entrée', 'Scan : accepté, déjà utilisé ou faux billet', 'ctrl');
node(1090, 390, 'Administration', 'Matchs, prix par catégorie, journal d’activité', 'admin');
await arrow(270, 204, 388, 204, 'choisir un match', 280, 180);
await arrow(620, 204, 738, 204, 'Acheter', 652, 180);
await arrow(970, 204, 1088, 204, 'achat validé', 990, 180);
await arrow(1320, 204, 1438, 204, 'afficher', 1352, 180);
await arrow(855, 258, 855, 388, 'rôle contrôleur', 865, 312);
await arrow(970, 240, 1150, 388, 'rôle administrateur', 1075, 296);
rect(flow, 40, 520, 14, 4, GOLD); text(flow, 'spectateur', 62, 512, { size: 12, color: GREY });
rect(flow, 160, 520, 14, 4, '#3b5bab'); text(flow, 'contrôleur', 182, 512, { size: 12, color: GREY });
rect(flow, 280, 520, 14, 4, RED); text(flow, 'administrateur', 302, 512, { size: 12, color: GREY });

// ---------- 2. Desktop – page du match ----------
const d1 = frame(root, 'Ordinateur – Page du match (1440)', 40, 660, 1440, 1150);
header(d1, 1440, false);
text(d1, 'Jeudi 3 décembre à 20 h 45 – Stade Municipal, Limoges', 80, 104, { size: 15, color: GREY });
text(d1, 'FC Limoges – AS Bordeaux Nord', 80, 130, { font: F.serifBold, size: 46 });
rect(d1, 80, 196, 60, 2, GOLD);
text(d1, 'Choisissez un bloc', 80, 226, { font: F.serif, size: 28 });
text(d1, 'Chaque bloc prend la couleur de sa catégorie. Les blocs hachurés ne sont pas vendus en ligne.', 80, 266, { size: 15, color: GREY });
stadium(d1, 80, 304, 1.0, 'N3');
text(d1, 'Bloc N3 – Tribune Nord : cliquez sur un siège libre (rang 1 réservé aux fauteuils roulants).', 80, 892, { size: 14, color: GREY });
// seat grid of block N3
for (let r = 0; r < 4; r++) for (let c = 0; c < 18; c++) {
  const sold = (r * 7 + c * 3) % 5 === 0, chosen = r === 0 && (c === 0 || c === 1);
  rect(d1, 80 + c * 30, 922 + r * 28, 24, 22, chosen ? GOLD : sold ? '#e3e6ee' : '#3b5bab', { radius: 3 });
}
text(d1, 'Catégories et tarifs', 820, 226, { font: F.serif, size: 28 });
['VIP', 'CAT1', 'CAT2', 'CAT3', 'KOP', 'VISIT'].forEach((c, i) => categoryRow(d1, 820, 270 + i * 84, 540, c, false));
basket(d1, 820, 790, 540, false);
text(d1, '6 billets au maximum par compte et par match.', 820, 1114, { size: 13, color: GREY });

// ---------- 3. Mobile – page du match ----------
const m1 = frame(root, 'Mobile – Page du match (390)', 1540, 660, 390, 1250);
header(m1, 390, true);
text(m1, 'Jeudi 3 décembre à 20 h 45', 16, 78, { size: 13, color: GREY });
text(m1, 'FC Limoges – AS Bordeaux Nord', 16, 98, { font: F.serifBold, size: 28, w: 358, lh: 32 });
text(m1, 'Choisissez un bloc', 16, 176, { font: F.serif, size: 21 });
stadium(m1, 16, 210, 358 / 692, 'N3');
text(m1, 'Catégories et tarifs', 16, 524, { font: F.serif, size: 21 });
['VIP', 'CAT1', 'CAT2', 'CAT3', 'KOP', 'VISIT'].forEach((c, i) => categoryRow(m1, 16, 558 + i * 58, 358, c, true));
basket(m1, 16, 924, 358, true);

// ---------- 4. Desktop – Mes billets ----------
const d2 = frame(root, 'Ordinateur – Mes billets (1440)', 40, 1970, 1440, 920);
header(d2, 1440, false);
text(d2, 'Mes billets', 80, 110, { font: F.serifBold, size: 46 });
rect(d2, 80, 176, 60, 2, GOLD);
rect(d2, 80, 204, 1280, 54, '#e7f3ec', { stroke: '#b7d9c4' });
text(d2, 'Commande confirmée : 2 billets. Présentez le QR code de chaque billet à l’entrée du stade.', 100, 221, { size: 15, color: GREEN, font: F.sansBold });
const h1 = ticket(d2, 80, 286, 1280, true, false, { where: 'Tribune Nord, Bloc N3, rang 1, place 1', cat: 'Catégorie 1, place PMR' });
ticket(d2, 80, 286 + h1 + 20, 1280, false, false, { where: 'Tribune Nord, Bloc N3, rang 1, place 2', cat: 'Catégorie 1, tarif réduit (justificatif à présenter)' });

// ---------- 5. Mobile – Mes billets ----------
const m2 = frame(root, 'Mobile – Mes billets (390)', 1540, 1970, 390, 920);
header(m2, 390, true);
text(m2, 'Mes billets', 16, 84, { font: F.serifBold, size: 32 });
const h2 = ticket(m2, 16, 140, 358, true, true, { where: 'Tribune Nord, Bloc N3, rang 1, place 1', cat: 'Catégorie 1, place PMR' });
ticket(m2, 16, 140 + h2 + 16, 358, false, true, { where: 'Tribune Nord, Bloc N3, rang 1, place 2', cat: 'Catégorie 1, tarif réduit' });

figma.viewport.scrollAndZoomIntoView([root]);
return { root: root.id, flow: flow.id, d1: d1.id, m1: m1.id, d2: d2.id, m2: m2.id, fonts: F };
