// Top view of the stadium: the pitch in the middle, one stand on each side.
import { el, euros, positionTribune } from './common.js';

const shortName = (name) => name.replace(/^tribune\s+/i, '');

/**
 * @param {Array} stands   [{ standId, name, priceCents, available }]
 * @param {{ interactive?: boolean, selectedId?: number, onSelect?: Function }} options
 * @returns {HTMLElement|null} null when the stands cannot be placed around a pitch
 */
export function buildStadium(stands, { interactive = false, selectedId = null, onSelect } = {}) {
  const placed = stands.map((s) => ({ ...s, position: positionTribune(s.name) }));
  if (placed.some((s) => !s.position)) return null;

  const stade = el('div', { class: `stade${interactive ? '' : ' stade-mini'}` },
    el('div', { class: 'terrain', 'aria-hidden': 'true' }));

  for (const s of placed) {
    const full = s.available === 0;
    const libres = full ? 'Complet' : `${s.available} libres`;
    const props = {
      class: `tribune ${s.position}`,
      'aria-label': `${s.name}, ${euros(s.priceCents)}, ${full ? 'complète' : `${s.available} places libres`}`,
    };
    const content = [
      el('span', { class: 'nom' }, shortName(s.name)),
      el('span', { class: 'detail' }, euros(s.priceCents)),
      el('span', { class: 'detail' }, libres),
    ];
    if (interactive) {
      stade.append(el('button', {
        ...props,
        type: 'button',
        'aria-pressed': String(s.standId === selectedId),
        disabled: full,
        onclick: () => onSelect?.(s),
      }, content));
    } else {
      stade.append(el('div', props, content));
    }
  }
  return stade;
}
