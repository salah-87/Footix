'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');                  // do not advertise "Express"
// Secure HTTP headers. Content-Security-Policy: scripts, styles and fonts only from our own server.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],          // the QR code is a data: PNG
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],           // no clickjacking
      // HTTPS is handled by the reverse proxy in production; do not force it on http://localhost
      upgradeInsecureRequests: config.env === 'production' ? [] : null,
    },
  },
}));
app.use(cors({ origin: config.corsOrigin }));  // only our front-end may call the API from a browser
app.use(express.json({ limit: '10kb' }));     // reject huge bodies

// Front-end: static files (HTML, CSS, JS, fonts) served by the same server, same origin as the API
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: '1h' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/matches', require('./routes/match.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/tickets', require('./routes/ticket.routes'));
app.use('/api/scan', require('./routes/scan.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
