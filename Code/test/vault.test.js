'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vault = require('../src/vault');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vizuai-vault-'));

fs.mkdirSync(path.join(tmp, 'Notes'));
fs.writeFileSync(path.join(tmp, 'README.md'), '# Hub\nLien vers [Notes](Notes/a.md)\n');
fs.writeFileSync(path.join(tmp, 'Notes', 'a.md'), 'Contenu initial\n');
fs.writeFileSync(path.join(tmp, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
fs.mkdirSync(path.join(tmp, 'node_modules', 'pkg'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'node_modules', 'pkg', 'index.js'), 'ignored');

const tree = vault.buildTree(tmp);
assert.equal(tree.type, 'dir');
const names = tree.children.map((c) => c.name);
assert.ok(names.includes('Notes'));
assert.ok(names.includes('README.md'));
assert.ok(!names.includes('node_modules'), 'dossiers techniques exclus');

const noteDir = tree.children.find((c) => c.name === 'Notes');
assert.equal(noteDir.children[0].path, 'Notes/a.md');

const read = vault.readFile(tmp, 'Notes/a.md');
assert.equal(read.binary, false);
assert.equal(read.content, 'Contenu initial\n');

const written = vault.writeFile(tmp, 'Notes/a.md', 'Modifié dans le coffre\n');
assert.equal(written.ok, true);
assert.equal(fs.readFileSync(path.join(tmp, 'Notes', 'a.md'), 'utf8'), 'Modifié dans le coffre\n');

assert.throws(() => vault.resolveSafe(tmp, '../secret'), /hors du coffre/);
assert.throws(() => vault.writeFile(tmp, 'missing.md', 'x'), /introuvable/);

const hits = vault.search(tmp, 'modifié');
assert.ok(hits.some((h) => h.path === 'Notes/a.md'));
assert.ok(hits.find((h) => h.path === 'Notes/a.md').snippets.length >= 1);

const mapped = vault.scanMappedFiles(tmp);
assert.ok(mapped.some(([p]) => p === 'README.md'));
assert.ok(!mapped.some(([p]) => p.endsWith('.bin')));

const binary = vault.readFile(tmp, 'binary.bin');
assert.equal(binary.binary, true);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('OK — tous les tests du coffre passent.');
