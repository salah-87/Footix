'use strict';
const { request, app } = require('./helpers/api');

describe('Front-end served by the API', () => {
  test.each(['/', '/match', '/connexion', '/billets', '/controle', '/admin'])('GET %s returns a French HTML page', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/<html lang="fr">/);
  });

  test('strict Content-Security-Policy: no inline script, no external source', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https:/);
  });

  test('HTML pages contain no inline script or inline style (they would be blocked by the CSP)', async () => {
    for (const url of ['/', '/match', '/connexion', '/billets', '/controle', '/admin']) {
      const html = (await request(app).get(url)).text;
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
      expect(html).not.toMatch(/\sstyle="/);
      expect(html).not.toMatch(/\son[a-z]+="/); // no onclick="..." handlers
    }
  });

  test('static assets are served, unknown API routes still answer JSON 404', async () => {
    expect((await request(app).get('/css/style.css')).status).toBe(200);
    expect((await request(app).get('/js/common.js')).headers['content-type']).toMatch(/javascript/);
    expect((await request(app).get('/fonts/archivo-variable.woff2')).status).toBe(200);
    expect((await request(app).get('/fonts/fraunces-variable.woff2')).status).toBe(200);
    expect((await request(app).get('/css/themes/prestige.css')).status).toBe(200);
    expect((await request(app).get('/api/nope')).body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
