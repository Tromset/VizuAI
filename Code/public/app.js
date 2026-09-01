/* global cytoscape */
(() => {
  let cy = null;
  let currentMap = null;

  const $ = (sel) => document.querySelector(sel);

  async function initTheme() {
    try {
      const design = await window.brainMapper.getDesignTheme();
      if (design && design.cssVariables) {
        const root = document.documentElement;
        Object.entries(design.cssVariables).forEach(([key, val]) => {
          root.style.setProperty(key, val);
        });
      }
    } catch (e) {
      console.warn('Theme load skipped:', e);
    }
  }

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

  function buildTree(data) {
    const tree = $('#tree');
    tree.innerHTML = '';

    const orphanSet = new Set(data.orphans || []);

    const hubs = (data.brainNodes || []).map((b) => ({
      name: b.name,
      path: b.yamlPath,
      children: b.children,
      purpose: b.purpose,
    }));

    if (hubs.length === 0 && (data.files || []).length > 0) {
      (data.files || []).forEach((f) => {
        const item = document.createElement('div');
        item.className = 'tree-item' + (orphanSet.has(f.path) ? ' tree-item--orphan' : '');
        item.dataset.path = f.path;
        item.textContent = f.path;
        item.addEventListener('click', () => highlightNode(f.path));
        tree.appendChild(item);
      });
      return;
    }

    hubs.forEach((hub) => {
      const hubEl = document.createElement('div');
      hubEl.className = 'tree-item tree-item--brain tree-item--hub';
      hubEl.dataset.path = hub.path;
      hubEl.innerHTML = `<span>🧠</span> ${hub.name}`;
      if (hub.purpose) hubEl.title = hub.purpose;
      hubEl.addEventListener('click', () => highlightNode(hub.path));
      tree.appendChild(hubEl);

      (hub.children || []).forEach((child) => {
        const childEl = document.createElement('div');
        childEl.className = 'tree-item';
        childEl.style.paddingLeft = '24px';
        childEl.innerHTML = `<span>📁</span> ${child}`;
        tree.appendChild(childEl);
      });
    });

    (data.orphans || []).forEach((path) => {
      const el = document.createElement('div');
      el.className = 'tree-item tree-item--orphan';
      el.dataset.path = path;
      el.innerHTML = `<span>⚠️</span> ${path}`;
      el.title = 'Fichier orphelin — aucun lien entrant';
      el.addEventListener('click', () => highlightNode(path));
      tree.appendChild(el);
    });
  }

  function showIssues(data) {
    const panel = $('#issues-panel');
    const list = $('#issues-list');
    list.innerHTML = '';

    const issues = [
      ...(data.brokenLinks || []).map(
        (l) => `Lien cassé: ${l.source}:${l.line} → ${l.target}`
      ),
      ...(data.orphans || []).map((o) => `Orphelin: ${o}`),
    ];

    if (issues.length === 0) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    issues.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function renderGraph(data) {
    $('#graph-placeholder').hidden = true;

    const elements = [];

    (data.nodes || []).forEach((n) => {
      elements.push({
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          hub: n.hub,
        },
      });
    });

    (data.edges || []).forEach((e, i) => {
      elements.push({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.label,
          auto: e.auto,
        },
      });
    });

    if (cy) cy.destroy();

    cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            'font-family': 'Google Sans Flex, Segoe UI, sans-serif',
            'text-margin-y': 6,
            width: 28,
            height: 28,
            'background-color': '#E8EAED',
            'border-width': 2,
            'border-color': '#DADCE0',
          },
        },
        {
          selector: 'node[kind = "brain"]',
          style: {
            'background-color': '#F3E8FD',
            'border-color': '#9334E6',
            shape: 'diamond',
            width: 36,
            height: 36,
          },
        },
        {
          selector: 'node[hub]',
          style: {
            'background-color': '#E8F0FE',
            'border-color': '#1A73E8',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#DADCE0',
            'target-arrow-color': '#DADCE0',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: '#9AA0A6',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge[auto]',
          style: {
            'line-color': '#1A73E8',
            'target-arrow-color': '#1A73E8',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#1A73E8',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        padding: 40,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      highlightNode(node.id());
    });
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
      alert(`Erreur de cartographie: ${err.message}`);
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
      await window.brainMapper.applyUpdates(
        currentMap.rootPath,
        currentMap.updates
      );
      alert('Liens mis à jour avec succès !');
      await mapFolder(currentMap.rootPath);
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    $('#btn-select').addEventListener('click', selectAndMap);
    $('#btn-apply').addEventListener('click', applyUpdates);

    const params = new URLSearchParams(window.location.search);
    const autoPath = params.get('path');
    if (autoPath) mapFolder(autoPath);
  });
})();
