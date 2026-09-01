'use strict';

/**
 * Serveur HTTP local — même UI que l'app Electron, pour le navigateur.
 * Le coffre par défaut est la racine du dépôt (VAULT_PATH pour le changer).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const mapper = require('./src/mapper');
const vault = require('./src/vault');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const CYTOSCAPE = path.join(__dirname, 'node_modules', 'cytoscape', 'dist', 'cytoscape.min.js');

let vaultRoot = path.resolve(process.env.VAULT_PATH || path.join(__dirname, '..'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, {
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/vendor/cytoscape.min.js') {
    if (!fs.existsSync(CYTOSCAPE)) {
      return send(res, 404, 'cytoscape missing — run npm install in Code/', {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
    return send(res, 200, fs.readFileSync(CYTOSCAPE), {
      'Content-Type': 'application/javascript; charset=utf-8',
    });
  }

  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), {
    'Content-Type': MIME[ext] || 'application/octet-stream',
  });
}

async function handleApi(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/session') {
      return sendJson(res, 200, { rootPath: vaultRoot, runtime: 'web' });
    }

    if (req.method === 'POST' && url.pathname === '/api/vault') {
      const body = await readBody(req);
      if (body.rootPath) {
        const next = path.resolve(body.rootPath);
        if (!fs.existsSync(next) || !fs.statSync(next).isDirectory()) {
          return sendJson(res, 400, { error: 'Dossier introuvable' });
        }
        vaultRoot = next;
      }
      return sendJson(res, 200, { rootPath: vaultRoot, tree: vault.buildTree(vaultRoot) });
    }

    if (req.method === 'GET' && url.pathname === '/api/tree') {
      return sendJson(res, 200, vault.buildTree(vaultRoot));
    }

    if (req.method === 'GET' && url.pathname === '/api/file') {
      const rel = url.searchParams.get('path');
      if (!rel) return sendJson(res, 400, { error: 'path requis' });
      return sendJson(res, 200, vault.readFile(vaultRoot, rel));
    }

    if (req.method === 'PUT' && url.pathname === '/api/file') {
      const body = await readBody(req);
      return sendJson(res, 200, vault.writeFile(vaultRoot, body.path, body.content));
    }

    if (req.method === 'GET' && url.pathname === '/api/search') {
      return sendJson(res, 200, vault.search(vaultRoot, url.searchParams.get('q') || ''));
    }

    if (req.method === 'POST' && url.pathname === '/api/map') {
      const files = vault.scanMappedFiles(vaultRoot);
      return sendJson(res, 200, mapper.mapFolder(vaultRoot, files));
    }

    if (req.method === 'POST' && url.pathname === '/api/apply') {
      const body = await readBody(req);
      for (const update of body.updates || []) {
        const fullPath = path.join(vaultRoot, update.yamlPath);
        if (!fs.existsSync(fullPath)) continue;
        const links = {};
        for (const { key, value } of update.newLinks || []) links[key] = value;
        const content = fs.readFileSync(fullPath, 'utf8');
        fs.writeFileSync(fullPath, mapper.updateYamlLinks(content, links), 'utf8');
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const status = err.code === 'OUTSIDE_VAULT' ? 403 : err.code === 'ENOENT' ? 404 : 500;
    return sendJson(res, status, { error: err.message });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`brAIn Mapper — ${HOST}:${PORT}`);
  console.log(`Coffre : ${vaultRoot}`);
});
