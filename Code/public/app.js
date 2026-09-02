/* global cytoscape */
(() => {
  let cy = null;
  let currentMap = null;

  const $ = (sel) => document.querySelector(sel);

  const FONT_ROUNDED = '"Arial Rounded MT Bold", "Arial Rounded MT", Nunito, sans-serif';
  const BALL_GAP = 36;

  const GRAPH_STYLE = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': '13px',
        'font-weight': 700,
        'font-family': FONT_ROUNDED,
        'text-margin-y': 10,
        'text-max-width': 90,
        'text-wrap': 'ellipsis',
        color: '#97a1b7',
        width: 28,
        height: 28,
        'background-color': '#232e45',
        'border-width': 2,
        'border-color': '#5f6b84',
      },
    },
    {
      selector: 'node[kind = "brain"]',
      style: {
        'background-color': '#2a2350',
        'border-color': '#8b7cff',
        color: '#c8bfff',
        shape: 'ellipse',
        width: 44,
        height: 44,
      },
    },
    {
      selector: 'node[?hub][kind != "brain"]',
      style: {
        'background-color': '#16294a',
        'border-color': '#55a9ff',
        color: '#8fc4ff',
        width: 40,
        height: 40,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'line-color': '#33415c',
        'target-arrow-color': '#33415c',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        'curve-style': 'bezier',
        label: '',
        'font-size': '8px',
        'font-family': FONT_ROUNDED,
        color: '#5f6b84',
        'text-rotation': 'autorotate',
        'text-background-color': '#0e1420',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
      },
    },
    {
      selector: 'edge[?auto]',
      style: {
        'line-color': '#3e6ea8',
        'target-arrow-color': '#3e6ea8',
      },
    },
    {
      selector: 'edge[!auto]',
      style: {
        'line-style': 'dashed',
        'line-color': '#57499e',
        'target-arrow-color': '#57499e',
      },
    },
    {
      selector: 'node.highlighted, node:selected',
      style: {
        'border-width': 3,
        'border-color': '#ffc24b',
        color: '#e8ecf4',
      },
    },
  ];

  function setLoading(loading) {
    document.body.classList.toggle('loading', loading);
    $('#btn-select').disabled = loading;
  }

  function updateStats(data) {
    $('#stat-files').textContent = data.fileCount;
    $('#stat-links').textContent = `${data.resolvedCount}/${data.linkCount}`;
    $('#stat-broken').textContent = data.brokenCount;
    $('#stat-orphans').textContent = data.orphanCount;
    $('#scan-time').textContent = data.scannedAt
      ? `Scanné le ${new Date(data.scannedAt).toLocaleString('fr-FR')}`
      : '';
  }

  function treeItem({ className, path, icon, text, title }) {
    const el = document.createElement('div');
    el.className = className;
    if (title) el.title = title;

    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.textContent = icon;
      el.appendChild(iconEl);
    }
    el.appendChild(document.createTextNode(text));

    if (path) {
      el.dataset.path = path;
      el.addEventListener('click', () => highlightNode(path));
    }
    return el;
  }

  function folderLabel(relPath) {
    if (!relPath) return 'racine';
    const clean = String(relPath).replace(/\/+$/, '');
    if (!clean || !clean.includes('/')) {
      return clean && !clean.includes('.') ? clean : 'racine';
    }
    const dir = clean.slice(0, clean.lastIndexOf('/'));
    return dir === '' ? 'racine' : dir.split('/').pop();
  }

  function buildTree(data) {
    const tree = $('#tree');
    tree.innerHTML = '';

    const hubs = data.brainNodes || [];

    if (hubs.length === 0) {
      const folders = new Map();
      (data.files || []).forEach((f) => {
        const name = folderLabel(f.path);
        if (!folders.has(name)) folders.set(name, f.path);
      });
      folders.forEach((path, name) => {
        tree.appendChild(
          treeItem({
            className: 'tree-item',
            path,
            icon: '📁',
            text: name,
            title: name,
          })
        );
      });
      return;
    }

    hubs.forEach((hub) => {
      tree.appendChild(
        treeItem({
          className: 'tree-item tree-item--brain',
          path: hub.yamlPath,
          icon: '🧠',
          text: hub.name,
          title: hub.purpose || undefined,
        })
      );

      (hub.children || []).forEach((child) => {
        const name = String(child).replace(/\/+$/, '');
        const el = treeItem({
          className: 'tree-item',
          icon: '📁',
          text: name,
          title: name,
        });
        el.style.paddingLeft = '26px';
        tree.appendChild(el);
      });
    });
  }

  function showIssues(data) {
    const panel = $('#issues-panel');
    const list = $('#issues-list');
    list.innerHTML = '';

    const issues = [
      ...(data.brokenLinks || []).map(
        (l) => `Lien cassé : ${l.source}:${l.line} → ${l.target}`
      ),
      ...(data.orphans || []).map((o) => `Orphelin : ${o}`),
    ];

    panel.hidden = issues.length === 0;

    issues.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function ballRadius(node) {
    return Math.max(node.outerWidth(), node.outerHeight()) / 2;
  }

  /**
   * Répulsion de collision : chaque boule pousse les autres hors de
   * son rayon + marge, pour que labels et nœuds ne se recouvrent pas.
   * Si `pinnedId` est fourni (nœud en cours de drag), il reste fixe
   * et les voisins s'écartent.
   */
  function separateBalls(graph, pinnedId) {
    if (!graph) return;
    const balls = graph.nodes().map((n) => {
      const p = n.position();
      return { n, x: p.x, y: p.y, r: ballRadius(n) };
    });

    for (let iter = 0; iter < 18; iter++) {
      let moved = false;
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const min = a.r + b.r + BALL_GAP;
          if (dist < 0.01) {
            dx = 1;
            dy = 0;
            dist = 1;
          }
          if (dist >= min) continue;

          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          const aPinned = a.n.id() === pinnedId;
          const bPinned = b.n.id() === pinnedId;

          if (!aPinned) {
            a.x -= nx * (bPinned ? push * 2 : push);
            a.y -= ny * (bPinned ? push * 2 : push);
            moved = true;
          }
          if (!bPinned) {
            b.x += nx * (aPinned ? push * 2 : push);
            b.y += ny * (aPinned ? push * 2 : push);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    balls.forEach((b) => b.n.position({ x: b.x, y: b.y }));
  }

  function renderGraph(data) {
    $('#graph-placeholder').hidden = true;

    const elements = [
      ...(data.nodes || []).map((n) => ({
        data: { id: n.id, label: n.label, kind: n.kind, hub: n.hub },
      })),
      ...(data.edges || []).map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target, label: e.label, auto: e.auto },
      })),
    ];

    if (cy) cy.destroy();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      style: GRAPH_STYLE,
      layout: {
        name: 'cose',
        animate: !reduceMotion,
        animationDuration: 550,
        randomize: true,
        fit: false,
        padding: 48,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 18000,
        nodeOverlap: 48,
        idealEdgeLength: () => 170,
        edgeElasticity: () => 0.35,
        nestingFactor: 1.2,
        gravity: 0.18,
        numIter: 2500,
        initialTemp: 220,
        coolingFactor: 0.95,
        minTemp: 1.0,
        componentSpacing: 80,
      },
    });

    cy.one('layoutstop', () => {
      separateBalls(cy);
      cy.fit(undefined, 52);
    });
    cy.on('drag', 'node', (evt) => separateBalls(cy, evt.target.id()));
    cy.on('tap', 'node', (evt) => highlightNode(evt.target.id()));
  }

  function highlightNode(nodeId) {
    if (!cy) return;
    cy.elements().removeClass('highlighted');
    const node = cy.getElementById(nodeId);
    if (node.length) {
      node.addClass('highlighted');
      cy.animate({ center: { eles: node }, zoom: 1.5 }, { duration: 300 });
    }
    document.querySelectorAll('.tree-item').forEach((el) => {
      el.classList.toggle('tree-item--active', el.dataset.path === nodeId);
    });
  }

  async function mapFolder(folderPath) {
    setLoading(true);
    try {
      const data = await window.brainMapper.mapFolder(folderPath);
      currentMap = data;
      $('#folder-path').textContent = data.rootPath;
      updateStats(data);
      buildTree(data);
      showIssues(data);
      renderGraph(data);
      $('#btn-apply').disabled = !(data.updateCount > 0);
    } catch (err) {
      alert(`Erreur de cartographie : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function selectAndMap() {
    const folder = await window.brainMapper.selectFolder();
    if (folder) await mapFolder(folder);
  }

  async function applyUpdates() {
    if (!currentMap || !currentMap.updates || currentMap.updates.length === 0) return;
    const confirmed = confirm(
      `Appliquer ${currentMap.updateCount} mise(s) à jour des liens dans brain.yaml ?`
    );
    if (!confirmed) return;

    try {
      await window.brainMapper.applyUpdates(currentMap.rootPath, currentMap.updates);
      await mapFolder(currentMap.rootPath);
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#btn-select').addEventListener('click', selectAndMap);
    $('#btn-apply').addEventListener('click', applyUpdates);
    $('#btn-zoom-in').addEventListener('click', () => cy && cy.zoom(cy.zoom() * 1.25));
    $('#btn-zoom-out').addEventListener('click', () => cy && cy.zoom(cy.zoom() / 1.25));
    $('#btn-fit').addEventListener('click', () => cy && cy.fit(undefined, 60));

    const params = new URLSearchParams(window.location.search);
    const autoPath = params.get('path');
    if (autoPath) mapFolder(autoPath);
  });
})();
