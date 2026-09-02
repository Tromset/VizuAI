'use strict';

const assert = require('node:assert/strict');
const mapper = require('../src/mapper');

// --- Extraction et résolution des liens ---

const links = mapper.extractFromMarkdown(
  'Code/README.md',
  [
    '# Hub',
    '> 🧠 [Parent](../README.md) · [Variables](brain.yaml)',
    'Voir [docs externes](https://example.com) et [[Agents/project]].',
    'Lien cassé : [nulle part](missing.md)',
  ].join('\n')
);

assert.equal(links.length, 4, 'externes exclus, internes + wikilink extraits');
assert.deepEqual(
  links.map((l) => l.target),
  ['README.md', 'Code/brain.yaml', 'Agents/project', 'Code/missing.md'],
  'les chemins relatifs (../, même dossier) sont normalisés'
);
assert.equal(links[0].line, 2);

const files = [
  { relativePath: 'README.md', kind: 'markdown', content: '' },
  { relativePath: 'Code/brain.yaml', kind: 'brain', content: '' },
  { relativePath: 'Agents/project.md', kind: 'markdown', content: '' },
];

const resolved = mapper.resolveLinks(files, links);
assert.deepEqual(
  resolved.map((l) => l.resolved),
  [true, true, true, false],
  'wikilink résolu via la variante .md, lien manquant marqué cassé'
);

// --- Parsing brain.yaml ---

const node = mapper.parseBrainYaml(
  'Code/brain.yaml',
  [
    '# commentaire',
    'name: Code',
    'purpose: "Source"',
    'children:',
    '  - src/',
    'files:',
    '  README.md: "Hub"',
    'when_to_read:',
    '  "Où est le code ?": src/',
    'links: {}',
  ].join('\n')
);

assert.equal(node.name, 'Code');
assert.deepEqual(node.children, ['src/']);
assert.deepEqual(node.whenToRead, { 'Où est le code ?': 'src/' });
assert.deepEqual(node.links, {});

// --- Suggestions de liens (fichiers du dossier du brain.yaml uniquement) ---

const suggested = mapper.suggestLinks(node, [
  { source: 'Code/README.md', target: 'Code/src/mapper.js', label: 'Mapper', resolved: true },
  { source: 'Autre/x.md', target: 'Autre/y.md', label: 'Ailleurs', resolved: true },
  { source: 'Code/README.md', target: 'Code/missing.md', label: 'Cassé', resolved: false },
]);

assert.deepEqual(suggested, { Mapper: 'Code/src/mapper.js' });

// --- Mise à jour de la section links: ---

const updated = mapper.updateYamlLinks(
  ['name: Code', 'links:', '  "Ancien": "old.md"', 'files:', '  a.md: "A"'].join('\n'),
  { Mapper: 'src/mapper.js' }
);

assert.equal(
  updated,
  ['name: Code', 'links:', '  "Mapper": "src/mapper.js"', 'files:', '  a.md: "A"'].join('\n'),
  'remplace la section links: sans toucher au reste'
);

assert.ok(
  mapper.updateYamlLinks('name: X', {}).endsWith('links: {}\n'),
  'ajoute une section links: vide si absente'
);

// --- Cartographie de bout en bout ---

const result = mapper.mapFolder('/tmp/demo', [
  ['README.md', '# Racine\n[Code](Code/README.md)\n'],
  ['brain.yaml', 'name: Racine\nchildren:\n  - Code/\n'],
  ['Code/README.md', '# Code\n[retour](../README.md)\n[cassé](nope.md)\n'],
  ['Code/brain.yaml', 'name: Code\nlinks: {}\n'],
  ['Code/notes.md', 'Aucun lien entrant ni sortant.\n'],
  ['image.png', 'binaire ignoré'],
]);

assert.equal(result.fileCount, 5, 'le fichier non pertinent est ignoré');
assert.equal(result.resolvedCount, 2);
assert.equal(result.brokenCount, 1);
assert.deepEqual(result.orphans, ['Code/notes.md']);
assert.equal(result.updateCount > 0, true, 'des liens sont suggérés pour les brain.yaml');

const structureEdges = result.edges.filter((e) => !e.auto);
assert.deepEqual(
  structureEdges,
  [{ source: 'brain.yaml', target: 'Code/README.md', label: '', auto: false }],
  'arête de structure brain.yaml → README du dossier enfant'
);

const nodeIds = new Set(result.nodes.map((n) => n.id));
for (const edge of result.edges) {
  assert.ok(nodeIds.has(edge.source) && nodeIds.has(edge.target), 'arêtes valides uniquement');
}

const folderNodes = result.nodes.filter((n) => n.hub);
const fileNodes = result.nodes.filter((n) => !n.hub);
assert.ok(
  folderNodes.every((n) => n.label && !n.label.includes('.md') && !n.label.includes('.yaml')),
  'les hubs affichent un nom de dossier, pas un nom de fichier'
);
assert.deepEqual(
  folderNodes.map((n) => n.label).sort(),
  ['Code', 'Code', 'racine', 'racine'],
  'README.md et brain.yaml portent le nom de leur dossier'
);
assert.ok(
  fileNodes.every((n) => n.label === ''),
  'les fichiers individuels n\'ont pas de libellé sur le graphe'
);
assert.equal(mapper.nodeLabel({ kind: 'markdown', relativePath: 'Code/notes.md' }), '');
assert.equal(mapper.folderNameOf('Code/src/mapper.js'), 'src');

console.log('OK — tous les tests du mapper passent.');
