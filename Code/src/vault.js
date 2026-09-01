'use strict';

/**
 * Coffre (vault) : arborescence, lecture / écriture et recherche
 * de fichiers texte. Module Node pur, sans Electron.
 */

const fs = require('fs');
const path = require('path');
const mapper = require('./mapper');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.cursor',
  'dist',
  'bin',
  'obj',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'vendor',
]);

const TEXT_EXT = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.yaml',
  '.yml',
  '.json',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.svg',
  '.xml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.rb',
  '.php',
  '.sql',
  '.csv',
  '.tsv',
  '.env',
  '.gitignore',
  '.editorconfig',
  '.lock',
  '.log',
]);

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

function resolveSafe(rootPath, relPath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relPath || '.');
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const err = new Error('Chemin hors du coffre');
    err.code = 'OUTSIDE_VAULT';
    throw err;
  }
  return target;
}

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (!ext) return true;
  return false;
}

function compareEntries(a, b) {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
}

function walkDir(absDir, relDir) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = [];
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      items.push({
        name: entry.name,
        path: relPath,
        type: 'dir',
        children: walkDir(path.join(absDir, entry.name), relPath),
      });
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    items.push({
      name: entry.name,
      path: relPath,
      type: 'file',
      kind: mapper.classifyFile(relPath),
      text: isTextFile(entry.name),
    });
  }

  items.sort(compareEntries);
  return items;
}

function buildTree(rootPath) {
  const root = path.resolve(rootPath);
  return {
    name: path.basename(root) || root,
    path: '',
    type: 'dir',
    children: walkDir(root, ''),
  };
}

function flattenFiles(node, acc = []) {
  if (!node) return acc;
  if (node.type === 'file') {
    acc.push(node);
    return acc;
  }
  for (const child of node.children || []) flattenFiles(child, acc);
  return acc;
}

function readFile(rootPath, relPath) {
  const full = resolveSafe(rootPath, relPath);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    const err = new Error('Impossible de lire un dossier');
    err.code = 'IS_DIRECTORY';
    throw err;
  }

  const text = isTextFile(relPath) && stat.size <= MAX_TEXT_BYTES;
  if (!text) {
    return {
      path: relPath.replace(/\\/g, '/'),
      binary: true,
      content: '',
      size: stat.size,
      kind: mapper.classifyFile(relPath),
    };
  }

  return {
    path: relPath.replace(/\\/g, '/'),
    binary: false,
    content: fs.readFileSync(full, 'utf8'),
    size: stat.size,
    kind: mapper.classifyFile(relPath),
  };
}

function writeFile(rootPath, relPath, content) {
  if (typeof content !== 'string') {
    throw new Error('Le contenu doit être du texte');
  }
  const full = resolveSafe(rootPath, relPath);
  if (!fs.existsSync(full)) {
    const err = new Error('Fichier introuvable');
    err.code = 'ENOENT';
    throw err;
  }
  if (!isTextFile(relPath)) {
    const err = new Error('Ce fichier ne peut pas être modifié');
    err.code = 'NOT_TEXT';
    throw err;
  }
  fs.writeFileSync(full, content, 'utf8');
  return { ok: true, path: relPath.replace(/\\/g, '/') };
}

function search(rootPath, query, limit = 40) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const tree = buildTree(rootPath);
  const files = flattenFiles(tree);
  const results = [];

  for (const file of files) {
    if (results.length >= limit) break;
    const nameHit = file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q);
    let snippets = [];

    if (file.text) {
      try {
        const { content, binary } = readFile(rootPath, file.path);
        if (!binary && content) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              snippets.push({ line: i + 1, text: lines[i].trim().slice(0, 160) });
              if (snippets.length >= 3) break;
            }
          }
        }
      } catch {
        /* ignore unreadable files */
      }
    }

    if (nameHit || snippets.length) {
      results.push({
        path: file.path,
        name: file.name,
        kind: file.kind,
        nameMatch: nameHit,
        snippets,
      });
    }
  }

  return results;
}

function scanMappedFiles(rootPath) {
  const files = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(path.join(currentPath, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      if (mapper.classifyFile(relPath) === 'other') continue;
      files.push([relPath, fs.readFileSync(fullPath, 'utf8')]);
    }
  }

  walk(path.resolve(rootPath));
  return files;
}

module.exports = {
  SKIP_DIRS,
  TEXT_EXT,
  MAX_TEXT_BYTES,
  resolveSafe,
  isTextFile,
  buildTree,
  flattenFiles,
  readFile,
  writeFile,
  search,
  scanMappedFiles,
};
