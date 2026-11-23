import { api, el, getSession, initLayout, requireLogin, showMessage } from './common.js';

initLayout('controle');

const message = document.getElementById('message');
const form = document.getElementById('form-scan');
const input = document.getElementById('code');
const verdict = document.getElementById('verdict');

const REFUS = {
  TICKET_ALREADY_USED: ['Billet déjà utilisé', 'Ce billet a déjà servi à entrer. Refusez l’entrée.'],
  INVALID_TICKET: ['Billet invalide', 'Ce QR code n’a pas été émis par Footix.'],
  UNKNOWN_TICKET: ['Billet inconnu', 'Aucun billet ne correspond à ce code pour ce match.'],
  MATCH_CANCELLED: ['Match annulé', 'Ce billet concerne un match annulé.'],
};

function showVerdict(ok, title, text) {
  verdict.className = `verdict ${ok ? 'ok' : 'refus'}`;
  verdict.replaceChildren(title, el('p', {}, text));
  verdict.hidden = false;
}

async function check(token) {
  showMessage(message, '');
  try {
    const res = await api('/scan', { method: 'POST', auth: true, body: { token } });
    showVerdict(true, 'Entrée autorisée', `Billet n° ${res.ticketId} validé.`);
  } catch (err) {
    const [title, text] = REFUS[err.code] || ['Contrôle impossible', err.message];
    showVerdict(false, title, text);
  }
  // Ready for the next spectator (USB scanners type the code then press Enter).
  input.value = '';
  input.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const token = input.value.trim();
  if (token) check(token);
});

// Camera scan, only where the browser can read QR codes (progressive enhancement).
function initCamera() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return;
  const zone = document.getElementById('camera');
  const start = el('button', { type: 'button', class: 'btn btn-secondaire' }, 'Scanner avec la caméra');
  zone.append(start);
  zone.hidden = false;
  let stream = null;
  start.addEventListener('click', async () => {
    if (stream) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      showMessage(message, 'La caméra n’est pas accessible. Autorisez-la dans le navigateur ou saisissez le code.', 'erreur');
      return;
    }
    const video = el('video', { autoplay: true, muted: true, playsinline: true, 'aria-label': 'Image de la caméra' });
    video.srcObject = stream;
    const stop = el('button', { type: 'button', class: 'btn btn-danger' }, 'Arrêter la caméra');
    zone.append(video, stop);
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const end = () => { stream.getTracks().forEach((t) => t.stop()); stream = null; video.remove(); stop.remove(); };
    stop.addEventListener('click', end);
    const loop = async () => {
      if (!stream) return;
      const codes = await detector.detect(video).catch(() => []);
      if (codes[0]?.rawValue) { end(); await check(codes[0].rawValue); return; }
      setTimeout(loop, 300);
    };
    video.addEventListener('playing', loop, { once: true });
  });
}

const session = requireLogin();
if (session) {
  if (!['controller', 'admin'].includes(session.user?.role)) {
    showMessage(message, 'Cette page est réservée au personnel de contrôle.', 'erreur');
    form.hidden = true;
  } else {
    initCamera();
    input.focus();
  }
}
