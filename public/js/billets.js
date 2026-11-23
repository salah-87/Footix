import { api, el, euros, dateLongue, initLayout, requireLogin, showMessage } from './common.js';

initLayout('billets');

const message = document.getElementById('message');
const liste = document.getElementById('billets');

async function toggleQr(button, ticket, zone) {
  const open = button.getAttribute('aria-expanded') === 'true';
  if (open) {
    zone.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Afficher le QR code';
    return;
  }
  if (!zone.hasChildNodes()) {
    try {
      const { qrDataUrl, token } = await api(`/tickets/${ticket.id}/qr`, { auth: true });
      zone.append(
        el('img', { src: qrDataUrl, width: 208, height: 208,
          alt: `QR code du billet n° ${ticket.id}, à présenter à l’entrée du stade` }),
        el('div', {},
          el('p', {}, 'Présentez ce QR code à l’entrée. Il n’est accepté qu’une seule fois.'),
          el('details', {}, el('summary', {}, 'Code du billet en texte'), el('code', {}, token))));
    } catch (err) {
      showMessage(message, err.message, 'erreur');
      return;
    }
  }
  zone.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.textContent = 'Masquer le QR code';
}

async function main() {
  if (!requireLogin()) return;
  const commande = new URLSearchParams(location.search).get('commande');
  if (commande && /^\d+$/.test(commande)) {
    showMessage(message, `Commande n° ${commande} confirmée. Vos billets sont ci-dessous.`);
  }
  let tickets;
  try {
    tickets = await api('/tickets/me', { auth: true });
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    return;
  }
  if (tickets.length === 0) {
    liste.replaceWith(el('p', { class: 'vide' }, 'Vous n’avez pas encore de billet. ',
      el('a', { href: '/' }, 'Voir les matchs en vente')));
    return;
  }
  for (const t of tickets) {
    const used = t.status === 'used';
    const zone = el('div', { class: 'qr', id: `qr-${t.id}`, hidden: true });
    const button = el('button', {
      type: 'button', class: 'btn btn-secondaire', 'aria-expanded': 'false', 'aria-controls': `qr-${t.id}`,
      onclick: (e) => toggleQr(e.currentTarget, t, zone),
    }, 'Afficher le QR code');
    liste.append(el('li', { class: `billet${used ? ' utilise' : ''}` },
      el('div', {},
        el('p', { class: 'rencontre' }, `${t.homeTeam} – ${t.awayTeam}`),
        el('p', { class: 'meta' }, dateLongue(t.kickoffAt)),
        el('p', { class: 'place' }, `${t.standName}, ${t.sectorName}, rang ${t.row}, place ${t.number}`),
        el('p', { class: 'categorie-billet' }, t.categoryName, t.accessible ? ', place PMR' : ''),
        el('p', { class: 'meta' }, `Billet n° ${t.id}, ${euros(t.priceCents)} `,
          el('span', { class: `statut ${used ? 'utilise' : 'valide'}` }, used ? 'Déjà utilisé' : 'Valide'))),
      used ? null : button,
      zone));
  }
}

main();
