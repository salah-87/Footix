import { api, initLayout, saveSession, safeReturn, showMessage } from './common.js';

initLayout('connexion');

const retour = safeReturn(new URLSearchParams(location.search).get('retour') || '/');
const message = document.getElementById('message');

/** Marks the fields the API rejected (aria-invalid), and clears the others. */
function markInvalid(form, details = []) {
  const fields = new Set(details.map((d) => d.field));
  form.querySelectorAll('input').forEach((input) => {
    if (fields.has(input.name)) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  });
  form.querySelector('[aria-invalid="true"]')?.focus();
}

async function login(email, password) {
  const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
  saveSession(token, user);
  location.assign(retour);
}

document.getElementById('form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = new FormData(form);
  showMessage(message, '');
  try {
    await login(data.get('email'), data.get('password'));
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    markInvalid(form, err.details);
    message.focus();
  }
});

document.getElementById('form-inscription').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  showMessage(message, '');
  try {
    await api('/auth/register', { method: 'POST', body: data });
    await login(data.email, data.password); // account created: log in straight away
  } catch (err) {
    showMessage(message, err.message, 'erreur');
    markInvalid(form, err.details);
    if (!err.details) message.focus();
  }
});
