'use strict';

/**
 * Cœur de brAIn Mapper : scan des fichiers Markdown / brain.yaml,
 * extraction des hyperliens, construction du graphe et suggestions
 * de liens pour les sections `links:` des brain.yaml.
 *
 * Module Node pur, sans dépendance à Electron — utilisé par le
 * process principal et testable directement avec `node`.
 */

const yaml = require('js-yaml');

// --- Classification des fichiers -------------------------------------------

function isBrainYaml(relPath) {
  return relPath.endsWith('brain.yaml') || relPath.endsWith('brain.yml');
}

function classifyFile(relPath) {
  if (isBrainYaml(relPath)) return 'brain';
  if (relPath.endsWith('.md')) return 'markdown';
  return 'other';
}

// --- Extraction des hyperliens ----------------------------------------------

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

function isExternal(target) {
  return /^(https?:\/\/|mailto:|#)/.test(target);
}

/** Résout `.` et `..` sans toucher au disque ("a/../b" → "b"). */
function normalizeSegments(relPath) {
  const out = [];
  for (const part of relPath.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && out.length > 0 && out[out.length - 1] !== '..') {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

/** Transforme une cible de lien en chemin relatif à la racine scannée. */
function normalizeTarget(sourcePath, rawTarget) {
  const clean = rawTarget.split('#')[0].split('?')[0].trim();
  if (!clean) return '';

  if (clean.startsWith('/')) return normalizeSegments(clean);

  const idx = sourcePath.lastIndexOf('/');
  const sourceDir = idx < 0 ? '' : sourcePath.slice(0, idx);
  return normalizeSegments(sourceDir ? `${sourceDir}/${clean}` : clean);
}

/**
 * Extrait les liens `[texte](cible)` et wikilinks `[[page]]` d'un
 * fichier Markdown, avec numéro de ligne. Les blocs de code (```)
 * et le code inline (`…`) sont ignorés : ce sont des exemples,
 * pas des liens de navigation.
 */
function extractFromMarkdown(sourcePath, content) {
  const links = [];
  let inFence = false;

  content.split('\n').forEach((rawLine, i) => {
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const line = rawLine.replace(/`[^`]*`/g, '`code`');

    for (const m of line.matchAll(MD_LINK_RE)) {
      const rawTarget = m[2].trim();
      if (isExternal(rawTarget)) continue;
      const target = normalizeTarget(sourcePath, rawTarget);
      if (!target) continue;
      links.push({ source: sourcePath, target, label: m[1], line: i + 1, resolved: false });
    }

    for (const m of line.matchAll(WIKI_LINK_RE)) {
      const target = m[1].trim();
      if (!target) continue;
      links.push({ source: sourcePath, target, label: target, line: i + 1, resolved: false });
    }
  });

  return links;
}

/** Variantes acceptées pour résoudre une cible vers un fichier scanné. */
function targetVariants(target) {
  const t = target.replace(/\\/g, '/').replace(/\/+$/, '');
  const variants = [t];
  if (!t.endsWith('.md') && !isBrainYaml(t)) variants.push(`${t}.md`);
  if (t.endsWith('/README.md')) variants.push(t.slice(0, -'/README.md'.length));
  else variants.push(`${t}/README.md`);
  return variants;
}

/**
 * Marque chaque lien comme résolu (fichier trouvé) ou cassé.
 * `paths` : chemins relatifs de tous les fichiers existants — pas
 * seulement les documents, pour ne pas signaler à tort comme cassés
 * les liens vers package.json, images, etc.
 */
function resolveLinks(paths, links) {
  const fileSet = paths instanceof Set ? paths : new Set(paths);

  return links.map((link) => {
    const found = targetVariants(link.target).find((c) => fileSet.has(c));
    return { ...link, target: found ?? link.target, resolved: found !== undefined };
  });
}

// --- Parsing brain.yaml ------------------------------------------------------

function toStringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) out[String(k)] = String(v ?? '');
  return out;
}

function parseBrainYaml(relativePath, content) {
  let doc;
  try {
    doc = yaml.load(content);
  } catch {
    doc = null;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) doc = {};

  return {
    name: typeof doc.name === 'string' && doc.name ? doc.name : relativePath,
    purpose: typeof doc.purpose === 'string' ? doc.purpose : '',
    parent: typeof doc.parent === 'string' ? doc.parent : null,
    children: Array.isArray(doc.children) ? doc.children.map(String) : [],
    files: toStringMap(doc.files),
    whenToRead: toStringMap(doc.when_to_read),
    links: toStringMap(doc.links),
    yamlPath: relativePath,
  };
}

/** Dossier contenant un fichier ("Code/README.md" → "Code", racine → ""). */
function dirOf(relPath) {
  const idx = relPath.lastIndexOf('/');
  return idx < 0 ? '' : relPath.slice(0, idx);
}

/**
 * Suggère les liens détectés dans les fichiers du dossier du brain.yaml
 * qui ne figurent pas encore dans sa section `links:`.
 * Retourne la map complète (liens existants + nouveaux).
 */
function suggestLinks(node, hyperlinks) {
  const brainDir = dirOf(node.yamlPath);
  const suggested = { ...node.links };

  for (const link of hyperlinks) {
    if (!link.resolved) continue;
    if (dirOf(link.source) !== brainDir) continue;
    if (link.target === node.yamlPath) continue;
    const key = link.label.trim() ? link.label.trim() : link.target;
    if (key in suggested) continue;
    suggested[key] = link.target;
  }

  return suggested;
}

// --- Mise à jour de la section links: ---------------------------------------

function formatLinksSection(links) {
  const entries = Object.entries(links)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  "${k}": "${v}"`);

  return entries.length === 0 ? 'links: {}' : `links:\n${entries.join('\n')}`;
}

/**
 * Remplace (ou ajoute) la section `links:` d'un brain.yaml en préservant
 * le reste du fichier tel quel, commentaires compris.
 */
function updateYamlLinks(content, newLinks) {
  const section = formatLinksSection(newLinks);
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^links:(\s|$)/.test(l));

  if (start < 0) {
    return `${content.trimEnd()}\n${section}\n`;
  }

  let end = start + 1;
  while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++;

  return [...lines.slice(0, start), ...section.split('\n'), ...lines.slice(end)].join('\n');
}

// --- Graphe -------------------------------------------------------------------

function nodeLabel(file) {
  if (file.kind === 'brain') {
    const dir = dirOf(file.relativePath);
    return `🧠 ${dir === '' ? 'racine' : dir.split('/').pop()}`;
  }
  if (file.relativePath.endsWith('README.md')) {
    const dir = dirOf(file.relativePath);
    return dir === '' ? 'racine' : dir.split('/').pop();
  }
  return file.relativePath.split('/').pop();
}

function buildGraph(files, links, brainNodes) {
  const fileSet = new Set(files.map((f) => f.relativePath));

  const nodes = files.map((f) => ({
    id: f.relativePath,
    label: nodeLabel(f),
    kind: f.kind,
    hub: f.kind === 'brain' || f.relativePath.endsWith('README.md'),
  }));

  const seen = new Set();
  const edges = [];

  for (const link of links) {
    if (!link.resolved || link.source === link.target) continue;
    // Un lien peut être résolu vers un fichier non documentaire
    // (package.json, image…) qui n'a pas de nœud dans le graphe.
    if (!fileSet.has(link.target)) continue;
    const key = `${link.source}→${link.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source: link.source, target: link.target, label: link.label, auto: true });
  }

  for (const node of brainNodes) {
    const dir = dirOf(node.yamlPath);
    const prefix = dir === '' ? '' : `${dir}/`;

    for (const child of node.children) {
      const target = `${prefix}${child.replace(/\/+$/, '')}/README.md`;
      const key = `${node.yamlPath}→${target}`;
      if (!fileSet.has(target) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: node.yamlPath, target, label: '', auto: false });
    }
  }

  return { nodes, edges };
}

/** Fichiers Markdown qui ne participent à aucun lien résolu. */
function findOrphans(files, links) {
  const linked = new Set();
  for (const link of links) {
    if (!link.resolved) continue;
    linked.add(link.source);
    linked.add(link.target);
  }

  return files
    .filter(
      (f) =>
        f.kind === 'markdown' &&
        !f.relativePath.endsWith('README.md') &&
        !linked.has(f.relativePath)
    )
    .map((f) => f.relativePath);
}

// --- Orchestration ------------------------------------------------------------

/**
 * Cartographie un dossier à partir de la liste `[cheminRelatif, contenu]`
 * de ses documents (.md / brain.yaml). `allFilePaths` liste en option les
 * chemins de tous les autres fichiers du dossier, utilisés uniquement pour
 * la résolution des liens. Retourne l'objet consommé par le renderer.
 */
function mapFolder(rootPath, entries, allFilePaths = []) {
  const files = entries
    .map(([relativePath, content]) => ({
      relativePath,
      kind: classifyFile(relativePath),
      content,
    }))
    .filter((f) => f.kind !== 'other');

  const rawLinks = files
    .filter((f) => f.kind === 'markdown')
    .flatMap((f) => extractFromMarkdown(f.relativePath, f.content));

  const resolveSet = new Set([
    ...entries.map(([relativePath]) => relativePath),
    ...allFilePaths,
  ]);
  const links = resolveLinks(resolveSet, rawLinks);

  const brainNodes = files
    .filter((f) => f.kind === 'brain')
    .map((f) => parseBrainYaml(f.relativePath, f.content));

  const { nodes, edges } = buildGraph(files, links, brainNodes);

  const updates = brainNodes.flatMap((node) => {
    const suggested = suggestLinks(node, links);
    if (Object.keys(suggested).length <= Object.keys(node.links).length) return [];
    return [
      {
        yamlPath: node.yamlPath,
        linkCount: Object.keys(suggested).length,
        newLinks: Object.entries(suggested).map(([key, value]) => ({ key, value })),
      },
    ];
  });

  const brokenLinks = links.filter((l) => !l.resolved);
  const orphans = findOrphans(files, links);

  return {
    rootPath,
    scannedAt: new Date().toISOString(),
    fileCount: files.length,
    linkCount: links.length,
    resolvedCount: links.length - brokenLinks.length,
    brokenCount: brokenLinks.length,
    orphanCount: orphans.length,
    updateCount: updates.length,
    nodes,
    edges,
    files: files.map((f) => ({ path: f.relativePath, kind: f.kind })),
    brainNodes: brainNodes.map((b) => ({
      name: b.name,
      purpose: b.purpose,
      yamlPath: b.yamlPath,
      children: b.children,
      fileCount: Object.keys(b.files).length,
    })),
    orphans,
    brokenLinks: brokenLinks.map((l) => ({ source: l.source, target: l.target, line: l.line })),
    updates,
  };
}

module.exports = {
  classifyFile,
  isBrainYaml,
  extractFromMarkdown,
  normalizeTarget,
  resolveLinks,
  parseBrainYaml,
  suggestLinks,
  formatLinksSection,
  updateYamlLinks,
  buildGraph,
  findOrphans,
  mapFolder,
};
