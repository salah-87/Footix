// =====================================================================
// Footix front-end: shared helpers (API calls, session, layout, DOM).
// Security rule: data coming from the API is ALWAYS inserted with
// textContent / setAttribute, never with innerHTML (prevents XSS).
// =====================================================================

const TOKEN_KEY = 'footix.token';
const USER_KEY = 'footix.user';

// --- Session -----------------------------------------------------------
// sessionStorage: the session ends when the tab is closed.
// Access is wrapped in try/catch because storage can be blocked (private mode).
export function getSession() {
  try {
    return {
      token: sessionStorage.getItem(TOKEN_KEY),
      user: JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'),
    };
  } catch {
    return { token: null, user: null };
  }
}

export function saveSession(token, user) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable: the user will have to log in again */ }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch { /* nothing to clear */ }
}

// --- API ---------------------------------------------------------------
// User-facing French messages for the API error codes.
const MESSAGES = {
  NETWORK: 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.',
  VALIDATION_ERROR: 'Certaines informations ne sont pas valides. Vérifiez les champs signalés.',
  INVALID_CREDENTIALS: 'E-mail ou mot de passe incorrect.',
  EMAIL_TAKEN: 'Un compte existe déjà avec cet e-mail. Connectez-vous plutôt.',
  TOO_MANY_ATTEMPTS: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  MISSING_TOKEN: 'Connectez-vous pour continuer.',
  INVALID_TOKEN: 'Votre session a expiré. Connectez-vous à nouveau.',
  FORBIDDEN: 'Votre compte ne donne pas accès à cette page.',
  MATCH_NOT_FOUND: 'Ce match n’est pas en vente.',
  SECTOR_NOT_FOUND: 'Ce bloc n’est pas vendu en ligne pour ce match.',
  MATCH_NOT_ON_SALE: 'La vente n’est pas ouverte pour ce match.',
  MATCH_ALREADY_STARTED: 'Ce match a déjà commencé : la vente est fermée.',
  SEAT_ALREADY_SOLD: 'Une de vos places vient d’être achetée par quelqu’un d’autre. Le plan est à jour : choisissez-en une autre.',
  INVALID_SEATS: 'Une des places choisies n’est pas en vente pour ce match.',
  TICKET_NOT_FOUND: 'Billet introuvable.',
  SAME_TEAM: 'Une équipe ne peut pas jouer contre elle-même.',
  UNKNOWN_TEAM: 'Une des équipes n’existe pas.',
  UNKNOWN_STADIUM: 'Ce stade n’existe pas.',
  INVALID_CATEGORY: 'Une des catégories n’existe pas dans ce stade.',
  INVALID_TRANSITION: 'Ce changement de statut n’est pas possible.',
  MATCH_CANCELLED: 'Ce match est annulé.',
  LOGS_UNAVAILABLE: 'Le journal est indisponible : MongoDB n’est pas démarré.',
  PAYLOAD_TOO_LARGE: 'Les données envoyées sont trop volumineuses.',
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Calls the API (same origin, prefix /api).
 * @param {string} path e.g. "/matches"
 * @param {{method?: string, body?: object, auth?: boolean}} options
 */
export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const { token } = getSession();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', MESSAGES.NETWORK);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data?.error?.code || 'UNKNOWN';
    if (res.status === 401 && auth) clearSession(); // expired or invalid session
    throw new ApiError(res.status, code, MESSAGES[code] || 'Une erreur est survenue. Réessayez dans un instant.', data?.error?.details);
  }
  return data;
}

// --- Formatting --------------------------------------------------------
const fmtEuros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
});
const fmtJour = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
});

export const euros = (cents) => fmtEuros.format(cents / 100);
export const dateLongue = (iso) => {
  const s = fmtDate.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const dateCourte = (iso) => fmtJour.format(new Date(iso));

// --- DOM ---------------------------------------------------------------
/**
 * Creates an element. Children that are strings become TEXT nodes (never HTML).
 * el('a', { href: '/x', class: 'btn' }, 'Label')
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

export function showMessage(node, text, type = 'info') {
  node.textContent = text;
  node.classList.toggle('erreur', type === 'erreur');
}

/** Only accepts a local path ("/billets"), never "//evil.com" or "https://…" (open redirect). */
export function safeReturn(value) {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

/** Redirects to the login page if nobody is logged in. Returns the session otherwise. */
export function requireLogin() {
  const session = getSession();
  if (!session.token) {
    const retour = location.pathname + location.search;
    location.replace(`/connexion?retour=${encodeURIComponent(retour)}`);
    return null;
  }
  return session;
}

/**
 * Header: highlights the current page and shows the links allowed for the role.
 * The server checks every right again: hiding a link is comfort, not security.
 */
export function initLayout(page) {
  const { user } = getSession();
  const role = user?.role;
  document.querySelectorAll('[data-page]').forEach((a) => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
  });
  const visible = {
    anonyme: !user,
    connecte: Boolean(user),
    controle: role === 'controller' || role === 'admin',
    admin: role === 'admin',
  };
  document.querySelectorAll('[data-role]').forEach((li) => { li.hidden = !visible[li.dataset.role]; });
  const qui = document.getElementById('qui');
  if (qui && user) qui.textContent = user.firstName;
  document.getElementById('deconnexion')?.addEventListener('click', () => {
    clearSession();
    location.assign('/');
  });
}
