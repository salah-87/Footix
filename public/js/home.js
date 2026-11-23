import { api, el, euros, dateLongue, dateCourte, initLayout, showMessage } from './common.js';
import { buildStadium } from './stadium.js';

initLayout('matchs');

const affiche = document.getElementById('affiche');
const liste = document.getElementById('calendrier');
const message = document.getElementById('message');

async function main() {
  let matches;
  try {
    matches = await api('/matches');
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    return;
  }
  if (matches.length === 0) {
    affiche.append(el('p', { class: 'vide' }, 'Aucun match n’est en vente pour le moment. Revenez bientôt.'));
    return;
  }

  // The next match gets the poster, with the stadium and the seats left per stand.
  const [next, ...others] = matches;
  const lien = `/match?id=${encodeURIComponent(next.id)}`;
  const texte = el('div', {},
    el('p', { class: 'date' }, dateLongue(next.kickoffAt)),
    el('h1', { class: 'equipes' },
      el('span', {}, next.homeTeam),
      el('span', { class: 'contre' }, 'reçoit'),
      el('span', {}, next.awayTeam)),
    el('p', { class: 'lieu' }, `${next.stadium}, ${next.city}`),
    el('div', { class: 'actions' },
      el('a', { class: 'btn', href: lien }, 'Choisir mes places'),
      el('span', { class: 'prix' }, `À partir de ${euros(next.minPriceCents)}`)));
  affiche.append(texte);

  try {
    const details = await api(`/matches/${next.id}`);
    const stade = buildStadium(details, {
      title: `Plan du ${details.stadium} : quatre tribunes découpées en blocs, colorés par catégorie`,
    });
    if (stade) {
      // Legend: one line per category sold online, with its price for this match
      const legende = el('ul', { class: 'legende-cat' }, ...details.categories.filter((c) => c.onSale).map((c) => {
        const pastille = el('span', { class: 'pastille-cat', 'aria-hidden': 'true' });
        if (/^#[0-9a-f]{6}$/i.test(c.color)) pastille.style.setProperty('--cat', c.color);
        return el('li', {}, pastille, el('span', {}, c.name), el('span', { class: 'prix' }, euros(c.priceCents)));
      }));
      affiche.append(el('figure', { class: 'plan' }, stade,
        el('figcaption', {}, legende)));
    }
  } catch { /* the poster works without the stadium view */ }

  document.getElementById('autres').hidden = others.length === 0;
  for (const m of others) {
    liste.append(el('li', {},
      el('span', { class: 'jour' }, dateCourte(m.kickoffAt)),
      el('span', { class: 'rencontre' }, `${m.homeTeam} – ${m.awayTeam}`),
      el('span', { class: 'des' }, `dès ${euros(m.minPriceCents)}`),
      el('a', { class: 'btn btn-secondaire btn-petit', href: `/match?id=${encodeURIComponent(m.id)}`,
        'aria-label': `Choisir mes places pour ${m.homeTeam} – ${m.awayTeam}` }, 'Choisir mes places')));
  }
}

main();
