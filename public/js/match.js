import { api, el, euros, dateLongue, initLayout, showMessage, getSession } from './common.js';
import { buildStadium } from './stadium.js';

initLayout('matchs');

const MAX_SEATS = 6;
const message = document.getElementById('message');
const entete = document.getElementById('entete');
const planStade = document.getElementById('plan-stade');
const zoneSieges = document.getElementById('sieges');
const titreSieges = document.getElementById('titre-sieges');
const resume = document.getElementById('resume');
const total = document.getElementById('total');
const acheter = document.getElementById('acheter');

const matchId = Number(new URLSearchParams(location.search).get('id'));
let details = null;
let currentStand = null;
const selection = new Map(); // seatId -> { standName, row, number, priceCents }
const PENDING_KEY = 'footix.selection';

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

function renderStadium() {
  const stade = buildStadium(details.stands, {
    interactive: true,
    selectedId: currentStand?.standId,
    onSelect: (stand) => { currentStand = stand; renderStadium(); loadSeats(); },
  });
  planStade.replaceChildren(stade || el('p', {}, 'Plan indisponible pour ce stade.'));
}

async function loadSeats() {
  titreSieges.textContent = `Choisissez vos places : ${currentStand.name}`;
  zoneSieges.replaceChildren(el('p', { class: 'vide' }, 'Chargement des places…'));
  let seats;
  try {
    seats = await api(`/matches/${matchId}/stands/${currentStand.standId}/seats`);
  } catch (err) {
    zoneSieges.replaceChildren();
    showMessage(message, err.message, 'erreur');
    return;
  }
  // Group by row; row 1 is the closest to the pitch, so it is drawn at the bottom.
  const rows = new Map();
  for (const s of seats) {
    if (!rows.has(s.row)) rows.set(s.row, []);
    rows.get(s.row).push(s);
  }
  const grille = el('div', { class: 'sieges', role: 'group', 'aria-label': `Places de la ${currentStand.name}` });
  for (const row of [...rows.keys()].sort((a, b) => b - a)) {
    const ligne = el('div', { class: 'rang' }, el('span', { class: 'num', 'aria-hidden': 'true' }, `Rang ${row}`));
    for (const s of rows.get(row)) {
      ligne.append(el('button', {
        type: 'button',
        class: 'siege',
        disabled: s.sold,
        'aria-pressed': String(selection.has(s.seatId)),
        'aria-label': `Rang ${s.row}, place ${s.number}${s.sold ? ', vendue' : ''}`,
        title: `Rang ${s.row}, place ${s.number}`,
        onclick: (e) => toggleSeat(e.currentTarget, s),
      }));
    }
    grille.append(ligne);
  }
  grille.append(el('p', { class: 'cote-terrain' }, 'Côté terrain')); // same width as the seats
  zoneSieges.replaceChildren(grille);
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
    selection.set(seat.seatId, { standName: currentStand.name, row: seat.row, number: seat.number, priceCents: currentStand.priceCents });
  }
  button.setAttribute('aria-pressed', String(selection.has(seat.seatId)));
  renderBasket();
}

function renderBasket() {
  const items = [...selection.values()];
  const sum = items.reduce((acc, s) => acc + s.priceCents, 0);
  if (items.length === 0) {
    resume.textContent = 'Aucune place choisie.';
  } else {
    const places = items.map((s) => `${s.standName.replace(/^tribune\s+/i, '')} rang ${s.row} place ${s.number}`).join(', ');
    resume.textContent = `${items.length} place${items.length > 1 ? 's' : ''} : ${places}`;
  }
  total.textContent = euros(sum);
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
    const order = await api('/orders', { method: 'POST', auth: true, body: { matchId, seatIds: [...selection.keys()] } });
    location.assign(`/billets?commande=${encodeURIComponent(order.id)}`);
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    if (err.code === 'SEAT_ALREADY_SOLD') {
      // Refresh availability: the seats sold in the meantime become grey.
      selection.clear();
      details = await api(`/matches/${matchId}`).catch(() => details);
      renderStadium();
      if (currentStand) await loadSeats();
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
  renderStadium();
  renderBasket();
  if (selection.size > 0) showMessage(message, 'Vos places sont toujours sélectionnées. Vous pouvez finaliser l’achat.');
  acheter.addEventListener('click', buy);
}

main();
