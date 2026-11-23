import { api, el, euros, dateCourte, initLayout, requireLogin, showMessage } from './common.js';

initLayout('admin');

const message = document.getElementById('message');
const form = document.getElementById('form-match');
const stadiumSelect = document.getElementById('stade');
const homeSelect = document.getElementById('domicile');
const awaySelect = document.getElementById('exterieur');
const pricesZone = document.getElementById('prix-tribunes');
const matchesBody = document.getElementById('matchs-admin');
const journalBody = document.getElementById('journal');
const journalMessage = document.getElementById('journal-message');

const ROLES = { spectator: 'Spectateur', controller: 'Contrôleur', admin: 'Administrateur' };
const STATUTS = { draft: 'Brouillon', on_sale: 'En vente', cancelled: 'Annulé' };
const ACTIONS = {
  'user.registered': 'Inscription', 'order.created': 'Commande',
  'match.created': 'Match créé', 'match.updated': 'Match modifié',
};
let reference = null;

function fillSelect(select, items, label) {
  select.replaceChildren(el('option', { value: '' }, label), ...items.map((i) => el('option', { value: i.id }, i.name)));
}

function renderPrices() {
  const stadium = reference.stadiums.find((s) => String(s.id) === stadiumSelect.value);
  pricesZone.replaceChildren(...(stadium?.stands || []).map((st) => el('div', { class: 'field' },
    el('label', { for: `prix-${st.id}` }, `${st.name} (€)`),
    el('input', { id: `prix-${st.id}`, name: `prix-${st.id}`, type: 'number', min: 0, max: 1000, step: '0.5',
      inputmode: 'decimal', 'data-stand': st.id }))));
}

async function changeStatus(match, status, button) {
  // Cancelling is final: ask for a second click instead of a blocking dialog.
  if (status === 'cancelled' && button.dataset.confirm !== 'yes') {
    button.dataset.confirm = 'yes';
    button.textContent = 'Confirmer l’annulation';
    return;
  }
  try {
    await api(`/admin/matches/${match.id}`, { method: 'PATCH', auth: true, body: { status } });
    showMessage(message, `${match.homeTeam} – ${match.awayTeam} : ${STATUTS[status].toLowerCase()}.`);
    await loadMatches();
    await loadJournal();
  } catch (err) {
    showMessage(message, err.message, 'erreur');
  }
}

async function loadMatches() {
  const matches = await api('/admin/matches', { auth: true });
  matchesBody.replaceChildren(...matches.map((m) => {
    const actions = el('td', { class: 'actions' });
    if (m.status === 'draft') {
      actions.append(el('button', { type: 'button', class: 'btn btn-petit', onclick: (e) => changeStatus(m, 'on_sale', e.currentTarget) }, 'Mettre en vente'));
    }
    if (m.status !== 'cancelled') {
      actions.append(el('button', { type: 'button', class: 'btn btn-danger btn-petit', onclick: (e) => changeStatus(m, 'cancelled', e.currentTarget) }, 'Annuler le match'));
    }
    return el('tr', {},
      el('th', { scope: 'row' }, `${m.homeTeam} – ${m.awayTeam}`),
      el('td', {}, dateCourte(m.kickoffAt)),
      el('td', {}, STATUTS[m.status]),
      el('td', {}, String(m.sold)),
      actions);
  }));
}

async function loadJournal() {
  try {
    const logs = await api('/admin/audit?limit=15', { auth: true });
    showMessage(journalMessage, logs.length ? '' : 'Aucune action enregistrée pour le moment.');
    journalBody.replaceChildren(...logs.map((l) => el('tr', {},
      el('td', {}, dateCourte(l.createdAt)),
      el('td', {}, ACTIONS[l.action] || l.action),
      el('td', {}, l.actorId ? `${ROLES[l.actorRole] || l.actorRole} n° ${l.actorId}` : '–'),
      el('td', {}, l.details?.totalCents !== undefined
        ? `${l.details.seatCount} place(s), ${euros(l.details.totalCents)}`
        : l.details?.matchId ? `Match n° ${l.details.matchId}` : ''))));
  } catch (err) {
    journalBody.replaceChildren();
    showMessage(journalMessage, err.message, 'erreur');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prices = [...pricesZone.querySelectorAll('input')]
    .filter((i) => i.value !== '')
    .map((i) => ({ standId: Number(i.dataset.stand), priceCents: Math.round(Number(i.value) * 100) }));
  if (prices.length === 0) {
    showMessage(message, 'Indiquez le prix d’au moins une tribune.', 'erreur');
    return;
  }
  const kickoff = document.getElementById('coup-envoi').value;
  const body = {
    stadiumId: Number(stadiumSelect.value),
    homeTeamId: Number(homeSelect.value),
    awayTeamId: Number(awaySelect.value),
    kickoffAt: kickoff ? new Date(kickoff).toISOString() : '',
    status: document.getElementById('statut').value,
    prices,
  };
  try {
    await api('/admin/matches', { method: 'POST', auth: true, body });
    showMessage(message, 'Match créé.');
    form.reset();
    renderPrices();
    await loadMatches();
    await loadJournal();
  } catch (err) {
    showMessage(message, err.message, 'erreur');
  }
  message.focus();
});

async function main() {
  const session = requireLogin();
  if (!session) return;
  if (session.user?.role !== 'admin') {
    showMessage(message, 'Cette page est réservée aux administrateurs.', 'erreur');
    document.getElementById('contenu-admin').hidden = true;
    return;
  }
  try {
    reference = await api('/admin/reference', { auth: true });
    fillSelect(stadiumSelect, reference.stadiums, 'Choisir un stade');
    fillSelect(homeSelect, reference.teams, 'Choisir une équipe');
    fillSelect(awaySelect, reference.teams, 'Choisir une équipe');
    if (reference.stadiums.length === 1) stadiumSelect.value = String(reference.stadiums[0].id);
    renderPrices();
    stadiumSelect.addEventListener('change', renderPrices);
    await loadMatches();
  } catch (err) {
    showMessage(message, err.message, 'erreur');
  }
  await loadJournal();
}

main();
