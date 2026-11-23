import { api, el, euros, dateLongue, initLayout, showMessage, getSession } from './common.js';
import { buildStadium, updateStadium } from './stadium.js';

initLayout('matchs');

const MAX_SEATS = 6;
const message = document.getElementById('message');
const entete = document.getElementById('entete');
const planStade = document.getElementById('plan-stade');
const listeCategories = document.getElementById('liste-categories');
const infoPmr = document.getElementById('info-pmr');
const zoneSieges = document.getElementById('sieges');
const titreSieges = document.getElementById('titre-sieges');
const infoBloc = document.getElementById('info-bloc');
const resume = document.getElementById('resume');
const lignes = document.getElementById('lignes');
const total = document.getElementById('total');
const acheter = document.getElementById('acheter');

const matchId = Number(new URLSearchParams(location.search).get('id'));
let details = null;
let carte = null;              // the SVG stadium map
let currentSector = null;      // block whose seats are shown
let categoryFilter = null;     // category chosen in the list (null = all)
// seatId -> { sectorId, sectorName, standName, categoryName, row, number, priceCents }
const selection = new Map();
const PENDING_KEY = 'footix.selection';
const NO_REDUCTION = ['VIP'];                 // no reduced fare in the VIP loges (as in big clubs)
const reducedPrice = (cents) => Math.round(cents / 2);   // display only: the server recomputes it
const COLOR = /^#[0-9a-f]{6}$/i;

// Keeps the chosen seats while the visitor logs in (the server re-checks everything at purchase).
function savePending() {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ matchId, seats: [...selection] })); } catch { /* ignore */ }
}
function restorePending() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    sessionStorage.removeItem(PENDING_KEY);
    if (saved?.matchId === matchId && Array.isArray(saved.seats)) {
      for (const [id, seat] of saved.seats.slice(0, MAX_SEATS)) selection.set(Number(id), seat);
    }
  } catch { /* nothing to restore */ }
}

/** Small coloured square; the colour is set through the CSSOM (allowed by the CSP). */
function swatch(color) {
  const node = el('span', { class: 'pastille-cat', 'aria-hidden': 'true' });
  if (COLOR.test(color || '')) node.style.setProperty('--cat', color);
  return node;
}

// --- Stadium map + categories -------------------------------------------
function renderStadium() {
  carte = buildStadium(details, {
    interactive: true,
    title: `Plan du ${details.stadium} : choisissez un bloc`,
    onSelect: (sector) => { currentSector = sector; refreshMap(); loadSeats(true); },
  });
  planStade.replaceChildren(carte || el('p', {}, 'Plan indisponible pour ce stade.'));
  refreshMap();
}

function refreshMap() {
  if (carte) updateStadium(carte, { selectedId: currentSector?.sectorId ?? null, categoryId: categoryFilter });
  listeCategories.querySelectorAll('button[data-category]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.category) === categoryFilter));
  });
}

function renderCategories() {
  listeCategories.replaceChildren(...details.categories.map((c) => {
    const content = [
      swatch(c.color),
      el('span', { class: 'nom' }, c.name),
      el('span', { class: 'prix' }, c.onSale ? euros(c.priceCents) : 'Hors vente'),
      el('span', { class: 'desc' }, c.description),
      el('span', { class: 'dispo' }, !c.onSale ? 'Non vendu en ligne'
        : c.available === 0 ? 'Complet' : `${c.available} places libres`),
    ];
    if (!c.onSale) return el('li', { class: 'categorie hors-vente' }, el('div', {}, content));
    return el('li', { class: 'categorie' }, el('button', {
      type: 'button', 'data-category': c.categoryId, 'aria-pressed': 'false',
      'aria-describedby': 'aide-categories',
      onclick: () => { categoryFilter = categoryFilter === c.categoryId ? null : c.categoryId; refreshMap(); },
    }, content));
  }));

  // Wheelchair spaces: where they are, so nobody has to search block by block.
  const pmr = details.stands.flatMap((st) => st.sectors).filter((s) => s.accessibleFree > 0);
  const nb = pmr.reduce((n, s) => n + s.accessibleFree, 0);
  infoPmr.textContent = nb === 0
    ? 'Plus aucune place PMR n’est libre pour ce match.'
    : `Places PMR (fauteuil roulant) : ${nb} libres, au rang 1 des blocs ${pmr.map((s) => s.code).join(', ')}. Accès de plain-pied.`;
}

// --- Seats of one block --------------------------------------------------
async function loadSeats(moveFocus = false) {
  titreSieges.textContent = `${currentSector.name}, ${currentSector.standName}`;
  infoBloc.replaceChildren();
  zoneSieges.replaceChildren(el('p', { class: 'vide' }, 'Chargement des places…'));
  let data;
  try {
    data = await api(`/matches/${matchId}/sectors/${currentSector.sectorId}/seats`);
  } catch (err) {
    zoneSieges.replaceChildren();
    showMessage(message, err.message, 'erreur');
    return;
  }
  const { sector, seats } = data;
  currentSector = { ...currentSector, ...sector };
  infoBloc.append(swatch(sector.categoryColor),
    el('strong', {}, sector.categoryName),
    `, ${euros(sector.priceCents)} la place. ${sector.categoryDescription}`);

  // Group by row; row 1 is the closest to the pitch, so it is drawn at the bottom.
  const rows = new Map();
  for (const s of seats) {
    if (!rows.has(s.row)) rows.set(s.row, []);
    rows.get(s.row).push(s);
  }
  const grille = el('div', { class: 'sieges', role: 'group', 'aria-label': `Places du ${sector.name}` });
  for (const row of [...rows.keys()].sort((a, b) => b - a)) {
    const ligne = el('div', { class: 'rang' }, el('span', { class: 'num', 'aria-hidden': 'true' }, `Rang ${row}`));
    for (const s of rows.get(row)) {
      const label = `Rang ${s.row}, place ${s.number}${s.accessible ? ', place PMR pour fauteuil roulant' : ''}${s.sold ? ', vendue' : ''}`;
      ligne.append(el('button', {
        type: 'button',
        class: `siege${s.accessible ? ' pmr' : ''}`,
        'data-seat': s.seatId,
        disabled: s.sold,
        'aria-pressed': String(selection.has(s.seatId)),
        'aria-label': label,
        title: label,
        onclick: (e) => toggleSeat(e.currentTarget, s),
      }));
    }
    grille.append(ligne);
  }
  grille.append(el('p', { class: 'cote-terrain' }, 'Côté terrain')); // same width as the seats
  zoneSieges.replaceChildren(grille);
  if (moveFocus) titreSieges.focus({ preventScroll: false });
}

function toggleSeat(button, seat) {
  showMessage(message, '');
  if (selection.has(seat.seatId)) {
    selection.delete(seat.seatId);
  } else {
    if (selection.size >= MAX_SEATS) {
      showMessage(message, `Vous pouvez acheter ${MAX_SEATS} places au maximum par commande.`, 'erreur');
      return;
    }
    selection.set(seat.seatId, {
      sectorId: currentSector.sectorId, sectorName: currentSector.name, standName: currentSector.standName,
      categoryName: currentSector.categoryName, categoryCode: currentSector.categoryCode,
      row: seat.row, number: seat.number, accessible: seat.accessible,
      priceCents: currentSector.priceCents, reduced: false,
    });
  }
  button.setAttribute('aria-pressed', String(selection.has(seat.seatId)));
  renderBasket();
}

function removeSeat(seatId) {
  selection.delete(seatId);
  zoneSieges.querySelector(`[data-seat="${seatId}"]`)?.setAttribute('aria-pressed', 'false');
  renderBasket();
  acheter.focus();
}

// --- Basket ---------------------------------------------------------------
const linePrice = (s) => (s.reduced ? reducedPrice(s.priceCents) : s.priceCents);

/** Updates the amounts only (keeps the focus on the checkbox the user just ticked). */
function renderTotals() {
  for (const [id, s] of selection) {
    const prix = lignes.querySelector(`[data-prix="${id}"]`);
    if (prix) prix.textContent = euros(linePrice(s));
  }
  total.textContent = euros([...selection.values()].reduce((acc, s) => acc + linePrice(s), 0));
}

function renderBasket() {
  const items = [...selection];
  resume.textContent = items.length === 0 ? 'Aucune place choisie.'
    : `${items.length} place${items.length > 1 ? 's' : ''} sur ${MAX_SEATS} au maximum par match.`;
  lignes.replaceChildren(...items.map(([id, s]) => {
    const where = `${s.sectorName}, rang ${s.row}, place ${s.number}`;
    const noReduction = NO_REDUCTION.includes(s.categoryCode);
    if (noReduction) s.reduced = false;
    return el('li', {},
      el('span', { class: 'ou' }, where, s.accessible ? el('span', { class: 'tag-pmr' }, 'PMR') : null),
      el('span', { class: 'cat' }, s.categoryName),
      el('span', { class: 'prix', 'data-prix': id }, euros(linePrice(s))),
      el('button', { type: 'button', class: 'retirer', 'aria-label': `Retirer ${where}`, onclick: () => removeSeat(id) }, 'Retirer'),
      noReduction ? null : el('label', { class: 'reduit' },
        el('input', {
          type: 'checkbox', checked: s.reduced, 'aria-describedby': 'aide-reduit',
          onchange: (e) => { s.reduced = e.currentTarget.checked; renderTotals(); },
        }),
        'Tarif réduit (-50 %)'));
  }));
  document.getElementById('aide-reduit').hidden = items.length === 0;
  renderTotals();
  const loggedIn = Boolean(getSession().token);
  acheter.disabled = items.length === 0;
  acheter.textContent = !loggedIn ? 'Se connecter pour acheter'
    : items.length > 1 ? `Acheter ${items.length} places` : 'Acheter cette place';
}

async function buy() {
  if (!getSession().token) {
    savePending();
    location.assign(`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  acheter.disabled = true;
  acheter.textContent = 'Achat en cours…';
  try {
    const order = await api('/orders', { method: 'POST', auth: true, body: {
      matchId,
      seatIds: [...selection.keys()],
      reducedSeatIds: [...selection].filter(([, s]) => s.reduced).map(([id]) => id),
    } });
    location.assign(`/billets?commande=${encodeURIComponent(order.id)}`);
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    if (err.code === 'SEAT_ALREADY_SOLD') {
      // Refresh availability: the seats sold in the meantime become grey.
      selection.clear();
      details = await api(`/matches/${matchId}`).catch(() => details);
      renderCategories();
      renderStadium();
      if (currentSector) await loadSeats();
    }
    renderBasket();
    message.focus();
  }
}

async function main() {
  if (!Number.isInteger(matchId) || matchId <= 0) {
    showMessage(message, 'Ce match n’existe pas. Retournez à la liste des matchs.', 'erreur');
    return;
  }
  try {
    details = await api(`/matches/${matchId}`);
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    return;
  }
  document.title = `${details.homeTeam} – ${details.awayTeam} | Footix`;
  entete.append(
    el('p', { class: 'date' }, dateLongue(details.kickoffAt)),
    el('h1', {}, `${details.homeTeam} – ${details.awayTeam}`),
    el('p', {}, `${details.stadium}, ${details.city}`));
  document.getElementById('achat').hidden = false;
  restorePending();
  renderCategories();
  renderStadium();
  renderBasket();
  if (selection.size > 0) showMessage(message, 'Vos places sont toujours sélectionnées. Vous pouvez finaliser l’achat.');
  acheter.addEventListener('click', buy);
}

main();
