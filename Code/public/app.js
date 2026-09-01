/* global cytoscape */
(() => {
  let cy = null;
  let currentMap = null;

  const $ = (sel) => document.querySelector(sel);

  const GRAPH_STYLE = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': '10px',
        'font-family': 'Inter, Segoe UI, sans-serif',
        'text-margin-y': 7,
        color: '#97a1b7',
        width: 26,
        height: 26,
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
        color: '#b5aaff',
        shape: 'diamond',
        width: 36,
        height: 36,
      },
    },
    {
      selector: 'node[?hub][kind != "brain"]',
      style: {
        'background-color': '#16294a',
        'border-color': '#55a9ff',
        color: '#8fc4ff',
        width: 32,
        height: 32,
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
        label: 'data(label)',
        'font-size': '8px',
        'font-family': 'Inter, Segoe UI, sans-serif',
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

  function buildTree(data) {
    const tree = $('#tree');
    tree.innerHTML = '';

    const orphanSet = new Set(data.orphans || []);
    const hubs = data.brainNodes || [];

    if (hubs.length === 0) {
      (data.files || []).forEach((f) => {
        tree.appendChild(
          treeItem({
            className: 'tree-item' + (orphanSet.has(f.path) ? ' tree-item--orphan' : ''),
            path: f.path,
            text: f.path,
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
        const el = treeItem({ className: 'tree-item', icon: '📁', text: child });
        el.style.paddingLeft = '26px';
        tree.appendChild(el);
      });
    });

    (data.orphans || []).forEach((path) => {
      tree.appendChild(
        treeItem({
          className: 'tree-item tree-item--orphan',
          path,
          icon: '⚠️',
          text: path,
          title: 'Fichier orphelin — ne participe à aucun lien',
        })
      );
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

    cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      style: GRAPH_STYLE,
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        padding: 60,
      },
    });

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
