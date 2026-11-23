// =====================================================================
// Stadium map seen from above, drawn in SVG like the ticket offices of big
// clubs: the pitch in the middle, four stands, each cut into blocks
// (sectors) on two tiers, plus the VIP loges. Each block takes the colour
// of its price category.
// Security: every text comes from the API and goes through textContent;
// colours are checked against a strict #rrggbb pattern before use.
// =====================================================================
import { euros } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
const PITCH = { x0: 0, y0: 0, x1: 420, y1: 272 };   // 105 m x 68 m, scale 4
const DEPTH = { bas: 64, loge: 30, haut: 70 };       // thickness of each tier
const TIER_ORDER = ['bas', 'loge', 'haut'];          // from the pitch outwards
const TIER_LABEL = { bas: 'anneau bas', loge: 'loges', haut: 'anneau haut' };
const FIRST_GAP = 14;   // space between the pitch and the first tier
const TIER_GAP = 8;     // space between two tiers
const BLOCK_GAP = 7;    // space between two blocks of the same tier
const FLARE = 0;        // flat top view: every block is a straight rectangle
const COLOR = /^#[0-9a-f]{6}$/i;
let uid = 0;            // unique ids for the SVG patterns (several maps per page)

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined && v !== false) node.setAttribute(k, String(v));
  }
  node.append(...children);
  return node;
}

export const safeColor = (c) => (COLOR.test(c) ? c : '#5a6681');

/** Dark text on light colours, white text on dark ones (WCAG relative luminance). */
export function textColor(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b1f4b' : '#ffffff';
}

/**
 * Point of a stand: t = 0..1 along the stand, d = distance from the touchline.
 * Blocks are numbered from west to east (nord, sud) and from north to south (est, ouest).
 */
function point(position, t, d) {
  const { x0, y0, x1, y1 } = PITCH;
  const along = (a, b) => a - d * FLARE + t * (b - a + 2 * d * FLARE);
  switch (position) {
    case 'nord': return [along(x0, x1), y0 - d];
    case 'sud': return [along(x0, x1), y1 + d];
    case 'ouest': return [x0 - d, along(y0, y1)];
    default: return [x1 + d, along(y0, y1)];   // est
  }
}

/** Length of the stand at distance d (to turn a gap in units into a fraction of t). */
function lengthAt(position, d) {
  const side = position === 'nord' || position === 'sud' ? PITCH.x1 - PITCH.x0 : PITCH.y1 - PITCH.y0;
  return side + 2 * d * FLARE;
}

function drawPitch() {
  const { x0, y0, x1, y1 } = PITCH;
  const w = x1 - x0;
  const h = y1 - y0;
  const mid = y0 + h / 2;
  const stripes = Array.from({ length: 10 }, (_, i) => svg('rect', {
    class: i % 2 ? 'bande claire' : 'bande', x: x0 + (i * w) / 10, y: y0, width: w / 10, height: h,
  }));
  const lines = svg('g', { class: 'lignes' },
    svg('rect', { x: x0, y: y0, width: w, height: h }),
    svg('line', { x1: x0 + w / 2, y1: y0, x2: x0 + w / 2, y2: y1 }),
    svg('circle', { cx: x0 + w / 2, cy: mid, r: 36.6 }),
    svg('rect', { x: x0, y: mid - 80.6, width: 66, height: 161.2 }),          // penalty areas
    svg('rect', { x: x1 - 66, y: mid - 80.6, width: 66, height: 161.2 }),
    svg('rect', { x: x0, y: mid - 36.6, width: 22, height: 73.2 }),            // goal areas
    svg('rect', { x: x1 - 22, y: mid - 36.6, width: 22, height: 73.2 }));
  return svg('g', { class: 'pelouse', 'aria-hidden': 'true' }, ...stripes, lines,
    svg('circle', { class: 'point', cx: x0 + w / 2, cy: mid, r: 2.5 }));
}

function sectorLabel(stand, s, cat) {
  // The accessible name must contain the visible code (WCAG 2.5.3 "label in name")
  const name = s.name.includes(s.code) ? s.name : `${s.code}, ${s.name}`;
  const parts = [`${name}, ${stand.name}, ${TIER_LABEL[s.tier] || s.tier}`, cat?.name || ''];
  if (!s.onSale) parts.push('non vendu en ligne');
  else if (s.available === 0) parts.push('complet');
  else {
    parts.push(`${euros(cat.priceCents)} la place`, `${s.available} places libres`);
    if (s.accessibleFree > 0) parts.push(`dont ${s.accessibleFree} PMR`);
  }
  return parts.filter(Boolean).join(', ');
}

/**
 * @param {{ stands: Array, categories: Array }} details  GET /api/matches/:id
 * @param {{ interactive?: boolean, onSelect?: Function, title?: string }} options
 * @returns {SVGSVGElement|null} null when the stadium has no sector to draw
 */
export function buildStadium(details, { interactive = false, onSelect, title = 'Plan du stade' } = {}) {
  const stands = (details?.stands || []).filter((s) => ['nord', 'sud', 'est', 'ouest'].includes(s.position));
  if (stands.length === 0) return null;
  const categories = new Map((details.categories || []).map((c) => [c.categoryId, c]));
  const hatchId = `hachures-${++uid}`;

  const blocks = svg('g', { class: 'blocs' });
  const names = svg('g', { class: 'noms-tribunes', 'aria-hidden': 'true' });
  const xs = [PITCH.x0, PITCH.x1];
  const ys = [PITCH.y0, PITCH.y1];

  for (const stand of stands) {
    let d = FIRST_GAP;
    const tiers = TIER_ORDER.filter((t) => stand.sectors.some((s) => s.tier === t));
    for (const tier of tiers) {
      const dIn = d;
      const dOut = d + DEPTH[tier];
      d = dOut + TIER_GAP;
      const row = stand.sectors.filter((s) => s.tier === tier).sort((a, b) => a.positionIndex - b.positionIndex);
      // The loges only take the centre of the stand (behind the halfway line).
      const [from, to] = tier === 'loge' ? [0.25, 0.75] : [0, 1];
      row.forEach((s, i) => {
        const ta = from + ((to - from) * i) / row.length;
        const tb = from + ((to - from) * (i + 1)) / row.length;
        const gap = (dist) => BLOCK_GAP / 2 / lengthAt(stand.position, dist);
        const corners = [
          point(stand.position, ta + gap(dIn), dIn), point(stand.position, tb - gap(dIn), dIn),
          point(stand.position, tb - gap(dOut), dOut), point(stand.position, ta + gap(dOut), dOut),
        ];
        corners.forEach(([x, y]) => { xs.push(x); ys.push(y); });
        const [cx, cy] = point(stand.position, (ta + tb) / 2, (dIn + dOut) / 2);
        const cat = categories.get(s.categoryId);
        const color = safeColor(cat?.color);
        const state = !s.onSale ? 'hors-vente' : s.available === 0 ? 'complet' : 'ouvert';

        const shape = svg('polygon', {
          points: corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
          fill: state === 'hors-vente' ? `url(#${hatchId})` : color,
        });
        const label = svg('text', {
          x: cx.toFixed(1), y: cy.toFixed(1), 'aria-hidden': 'true',
          fill: state === 'ouvert' ? textColor(color) : '#5a6681',
          class: tier === 'loge' ? 'code petit' : 'code',
        });
        label.textContent = s.code;

        const group = svg('g', {
          class: `bloc ${state}`, 'data-sector': s.sectorId, 'data-category': s.categoryId,
        }, shape, label);
        if (interactive) {
          const clickable = state === 'ouvert';
          group.setAttribute('role', 'button');
          group.setAttribute('aria-label', sectorLabel(stand, s, cat));
          group.setAttribute('aria-pressed', 'false');
          if (clickable) {
            group.setAttribute('tabindex', '0');
            const choose = () => onSelect?.({ ...s, standName: stand.name, position: stand.position, category: cat });
            group.addEventListener('click', choose);
            group.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
            });
          } else {
            group.setAttribute('aria-disabled', 'true');
          }
        }
        blocks.append(group);
      });
    }
    // Name of the stand, outside the last tier
    const [nx, ny] = point(stand.position, 0.5, d + 10);
    const vertical = stand.position === 'est' || stand.position === 'ouest';
    const name = svg('text', {
      x: nx.toFixed(1), y: ny.toFixed(1), class: 'nom-tribune',
      transform: vertical ? `rotate(${stand.position === 'est' ? 90 : -90} ${nx.toFixed(1)} ${ny.toFixed(1)})` : null,
    });
    name.textContent = stand.name;
    names.append(name);
    const [ex, ey] = point(stand.position, 0.5, d + 24);
    xs.push(ex); ys.push(ey);
  }

  const m = 6;
  const minX = Math.min(...xs) - m;
  const minY = Math.min(...ys) - m;
  const viewBox = [minX, minY, Math.max(...xs) - minX + m, Math.max(...ys) - minY + m].map((n) => n.toFixed(0)).join(' ');
  const defs = svg('defs', {},
    svg('pattern', { id: hatchId, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('rect', { width: 8, height: 8, fill: '#eef0f5' }),
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#c3cad9', 'stroke-width': 3 })));

  const root = svg('svg', {
    class: `carte-stade${interactive ? '' : ' mini'}`, viewBox, xmlns: NS,
    role: interactive ? 'group' : 'img', 'aria-label': title,
  }, defs, drawPitch(), blocks, names);
  if (!interactive) root.querySelectorAll('.bloc').forEach((b) => b.setAttribute('aria-hidden', 'true'));
  return root;
}

/** Shows the chosen block and dims the blocks outside the chosen category (no redraw: focus stays). */
export function updateStadium(map, { selectedId = null, categoryId = null } = {}) {
  map.querySelectorAll('.bloc').forEach((g) => {
    const selected = Number(g.dataset.sector) === selectedId;
    g.classList.toggle('choisi', selected);
    if (g.getAttribute('role') === 'button') g.setAttribute('aria-pressed', String(selected));
    g.classList.toggle('estompe', categoryId !== null && Number(g.dataset.category) !== categoryId);
  });
}
