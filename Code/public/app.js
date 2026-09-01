/* global cytoscape */
(() => {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    rootPath: null,
    tree: null,
    map: null,
    files: [],
    tabs: [],
    activeTab: null,
    view: 'files',
    preview: false,
    drafts: {},
    saved: {},
    orphanSet: new Set(),
    cy: null,
  };

  const GRAPH_STYLE = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': '10px',
        'font-family': 'IBM Plex Sans, sans-serif',
        'text-margin-y': 6,
        color: '#94a3b8',
        width: 22,
        height: 22,
        'background-color': '#272f42',
        'border-width': 1,
        'border-color': '#64748b',
      },
    },
    {
      selector: 'node[kind = "brain"]',
      style: {
        'background-color': '#1e293b',
        'border-color': '#cbd5e1',
        color: '#e2e8f0',
        shape: 'diamond',
        width: 28,
        height: 28,
      },
    },
    {
      selector: 'node[?hub][kind != "brain"]',
      style: {
        'background-color': '#14532d',
        'border-color': '#22c55e',
        color: '#bbf7d0',
        width: 26,
        height: 26,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.2,
        'line-color': '#334155',
        'target-arrow-color': '#334155',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.7,
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': '8px',
        'font-family': 'IBM Plex Sans, sans-serif',
        color: '#64748b',
        'text-rotation': 'autorotate',
        'text-background-color': '#0f172a',
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
      },
    },
    {
      selector: 'edge[?auto]',
      style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e' },
    },
    {
      selector: 'edge[!auto]',
      style: {
        'line-style': 'dashed',
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
      },
    },
    {
      selector: 'node.highlighted, node:selected',
      style: { 'border-width': 2, 'border-color': '#22c55e', color: '#f8fafc' },
    },
  ];

  function httpApi() {
    const json = async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    };
    return {
      runtime: 'web',
      async selectFolder() {
        const next = window.prompt('Chemin du coffre', state.rootPath || '');
        if (!next) return null;
        const data = await json(
          await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootPath: next }),
          })
        );
        return data.rootPath;
      },
      async mapFolder() {
        return json(await fetch('/api/map', { method: 'POST' }));
      },
      async applyUpdates(_root, updates) {
        return json(
          await fetch('/api/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
          })
        );
      },
      async vaultTree() {
        return json(await fetch('/api/tree'));
      },
      async readFile(_root, relPath) {
        return json(await fetch(`/api/file?path=${encodeURIComponent(relPath)}`));
      },
      async writeFile(_root, relPath, content) {
        return json(
          await fetch('/api/file', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: relPath, content }),
          })
        );
      },
      async search(_root, query) {
        return json(await fetch(`/api/search?q=${encodeURIComponent(query)}`));
      },
      async session() {
        return json(await fetch('/api/session'));
      },
    };
  }

  function electronApi() {
    return { runtime: 'electron', ...window.brainMapper };
  }

  const api = window.brainMapper ? electronApi() : httpApi();

  function flatten(node, acc = []) {
    if (!node) return acc;
    if (node.type === 'file') acc.push(node);
    for (const child of node.children || []) flatten(child, acc);
    return acc;
  }

  function setLoading(loading) {
    document.body.classList.toggle('loading', loading);
    $('#btn-select').disabled = loading;
  }

  function confirmDialog(title, body) {
    return new Promise((resolve) => {
      const modal = $('#modal');
      $('#modal-title').textContent = title;
      $('#modal-body').textContent = body;
      modal.hidden = false;
      const done = (ok) => {
        modal.hidden = true;
        $('#modal-ok').onclick = null;
        $('#modal-cancel').onclick = null;
        resolve(ok);
      };
      $('#modal-ok').onclick = () => done(true);
      $('#modal-cancel').onclick = () => done(false);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkdown(src) {
    const lines = String(src).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inCode = false;
    let list = false;

    const inline = (t) =>
      escapeHtml(t)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCode) {
          out.push('</code></pre>');
          inCode = false;
        } else {
          if (list) {
            out.push('</ul>');
            list = false;
          }
          out.push('<pre><code>');
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        out.push(`${escapeHtml(line)}\n`);
        continue;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        if (list) {
          out.push('</ul>');
          list = false;
        }
        const n = heading[1].length;
        out.push(`<h${n}>${inline(heading[2])}</h${n}>`);
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        if (!list) {
          out.push('<ul>');
          list = true;
        }
        out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
        continue;
      }
      if (list) {
        out.push('</ul>');
        list = false;
      }
      if (!line.trim()) {
        out.push('');
        continue;
      }
      out.push(`<p>${inline(line)}</p>`);
    }
    if (inCode) out.push('</code></pre>');
    if (list) out.push('</ul>');
    return out.join('');
  }

  function fileName(rel) {
    return rel.split('/').pop();
  }

  function isDirty(path) {
    return path in state.drafts && state.drafts[path] !== state.saved[path];
  }

  function updateStats(data) {
    if (!data) {
      $('#status-counts').textContent = '—';
      $('#scan-time').textContent = '—';
      return;
    }
    $('#status-counts').textContent = `${data.fileCount} notes · ${data.resolvedCount}/${data.linkCount} liens · ${data.brokenCount} cassés · ${data.orphanCount} orphelins`;
    $('#scan-time').textContent = data.scannedAt
      ? `Scanné ${new Date(data.scannedAt).toLocaleString('fr-FR')}`
      : '—';
    $('#btn-apply').disabled = !(data.updateCount > 0);
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('.ribbon__btn').forEach((btn) => {
      const on = btn.dataset.view === view;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    $('#sidebar-title').textContent =
      view === 'issues' ? 'Problèmes' : view === 'graph' ? 'Coffre' : 'Coffre';
    $('#issues-panel').hidden = view !== 'issues';
    $('#tree').hidden = view === 'issues';

    if (view === 'graph') {
      showGraphPane();
    } else if (state.activeTab) {
      showEditorPane();
    }
  }

  function showGraphPane() {
    $('#graph-container').hidden = false;
    $('#editor-pane').hidden = true;
    $('#pane-toolbar').hidden = true;
    if (state.cy) state.cy.resize();
  }

  function showEditorPane() {
    $('#graph-container').hidden = true;
    $('#editor-pane').hidden = false;
    $('#pane-toolbar').hidden = false;
  }

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    const graphTab = document.createElement('button');
    graphTab.type = 'button';
    graphTab.className = `tab${state.view === 'graph' && !state.activeTab ? ' is-active' : ''}`;
    graphTab.textContent = 'Graphe';
    graphTab.addEventListener('click', () => {
      state.activeTab = null;
      setView('graph');
      renderTabs();
    });
    tabs.appendChild(graphTab);

    for (const path of state.tabs) {
      const wrap = document.createElement('div');
      wrap.style.display = 'inline-flex';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab${state.activeTab === path ? ' is-active' : ''}${isDirty(path) ? ' is-dirty' : ''}`;
      btn.textContent = fileName(path);
      btn.title = path;
      btn.addEventListener('click', () => openFile(path));
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab__close';
      close.setAttribute('aria-label', `Fermer ${fileName(path)}`);
      close.textContent = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(path);
      });
      btn.appendChild(close);
      wrap.appendChild(btn);
      tabs.appendChild(wrap);
    }
  }

  function renderTree(filter = '') {
    const root = $('#tree');
    root.innerHTML = '';
    if (!state.tree) {
      root.innerHTML =
        '<p class="empty">Ouvrez un coffre pour parcourir et modifier les fichiers sur place.</p>';
      return;
    }

    const q = filter.trim().toLowerCase();

    function matches(node) {
      if (!q) return true;
      if (node.path.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) return true;
      return (node.children || []).some(matches);
    }

    function dirEl(node, depth) {
      if (!matches(node)) return null;
      const wrap = document.createElement('div');
      wrap.className = 'tree-dir is-open';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tree-item';
      btn.style.paddingLeft = `${8 + depth * 12}px`;
      btn.setAttribute('aria-expanded', 'true');
      const chevron = document.createElement('span');
      chevron.className = 'tree-item__chevron';
      chevron.textContent = '▾';
      btn.appendChild(chevron);
      btn.appendChild(document.createTextNode(node.name));
      const kids = document.createElement('div');
      kids.className = 'tree-children';
      btn.addEventListener('click', () => {
        const open = wrap.classList.toggle('is-open');
        chevron.textContent = open ? '▾' : '▸';
        btn.setAttribute('aria-expanded', String(open));
      });
      for (const child of node.children || []) {
        const el = child.type === 'dir' ? dirEl(child, depth + 1) : fileEl(child, depth + 1);
        if (el) kids.appendChild(el);
      }
      wrap.appendChild(btn);
      wrap.appendChild(kids);
      return wrap;
    }

    function fileEl(node, depth) {
      if (q && !node.path.toLowerCase().includes(q) && !node.name.toLowerCase().includes(q)) {
        return null;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tree-item';
      if (node.kind === 'brain') btn.classList.add('tree-item--brain');
      if (state.orphanSet.has(node.path)) btn.classList.add('is-orphan');
      if (state.activeTab === node.path) btn.classList.add('is-active');
      btn.style.paddingLeft = `${20 + depth * 12}px`;
      btn.dataset.path = node.path;
      btn.textContent = node.name;
      btn.title = node.path;
      btn.addEventListener('click', () => openFile(node.path));
      return btn;
    }

    const kids = state.tree.children || [];
    if (kids.length === 0) {
      root.innerHTML = '<p class="empty">Ce coffre ne contient aucun fichier visible.</p>';
      return;
    }
    for (const child of kids) {
      const el = child.type === 'dir' ? dirEl(child, 0) : fileEl(child, 0);
      if (el) root.appendChild(el);
    }
    if (!root.children.length) {
      root.innerHTML =
        '<p class="empty">Aucun fichier ne correspond. Effacez le filtre ou ouvrez le sélecteur (Ctrl+P).</p>';
    }
  }

  function showIssues(data) {
    const list = $('#issues-list');
    list.innerHTML = '';
    const issues = [
      ...(data.brokenLinks || []).map((l) => ({
        text: `Lien cassé · ${l.source}:${l.line} → ${l.target}`,
        path: l.source,
      })),
      ...(data.orphans || []).map((o) => ({
        text: `Orphelin · ${o}`,
        path: o,
      })),
    ];
    if (issues.length === 0) {
      list.innerHTML = '<li>Aucun problème détecté.</li>';
      return;
    }
    for (const issue of issues) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = issue.text;
      btn.addEventListener('click', () => openFile(issue.path));
      li.appendChild(btn);
      list.appendChild(li);
    }
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
    if (state.cy) state.cy.destroy();
    if (typeof cytoscape !== 'function') return;
    state.cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      style: GRAPH_STYLE,
      layout: {
        name: 'cose',
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationDuration: 400,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        padding: 60,
      },
    });
    state.cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      highlightNode(id);
      openFile(id);
    });
  }

  function highlightNode(nodeId) {
    if (!state.cy) return;
    state.cy.elements().removeClass('highlighted');
    const node = state.cy.getElementById(nodeId);
    if (node.length) {
      node.addClass('highlighted');
      state.cy.animate({ center: { eles: node }, zoom: 1.4 }, { duration: 220 });
    }
  }

  function applyEditorMode() {
    const path = state.activeTab;
    const draft = path ? state.drafts[path] : null;
    const binary = draft && draft.__binary;
    $('#binary-note').hidden = !binary;
    $('#editor').hidden = Boolean(binary) || state.preview;
    $('#preview').hidden = Boolean(binary) || !state.preview;
    $('#btn-edit').classList.toggle('is-active', !state.preview);
    $('#btn-preview').classList.toggle('is-active', state.preview);
    $('#btn-edit').setAttribute('aria-pressed', String(!state.preview));
    $('#btn-preview').setAttribute('aria-pressed', String(state.preview));
    const canPreview = path && /\.md$/i.test(path);
    $('#btn-preview').disabled = !canPreview;
    if (state.preview && canPreview && typeof draft === 'string') {
      $('#preview').innerHTML = renderMarkdown(draft);
    }
    $('#btn-save').disabled = !path || !isDirty(path);
    $('#status-file').textContent = path
      ? `${isDirty(path) ? 'Modifié · ' : ''}${path}`
      : 'Ctrl+P fichier · Ctrl+S enregistrer';
  }

  async function openFile(relPath) {
    if (!state.rootPath || !relPath) return;
    if (!state.tabs.includes(relPath)) state.tabs.push(relPath);
    state.activeTab = relPath;
    state.view = 'files';
    setView('files');
    showEditorPane();
    $('#active-path').textContent = relPath;
    try {
      if (!(relPath in state.drafts)) {
        const file = await api.readFile(state.rootPath, relPath);
        if (file.binary) {
          state.drafts[relPath] = { __binary: true };
          state.saved[relPath] = { __binary: true };
        } else {
          state.drafts[relPath] = file.content;
          state.saved[relPath] = file.content;
        }
      }
      const draft = state.drafts[relPath];
      $('#editor').value = typeof draft === 'string' ? draft : '';
    } catch (err) {
      $('#editor').value = '';
      $('#status-file').textContent = err.message;
    }
    applyEditorMode();
    renderTabs();
    renderTree($('#sidebar-filter').value);
    highlightNode(relPath);
  }

  async function closeTab(relPath) {
    if (isDirty(relPath)) {
      const ok = await confirmDialog(
        'Fermer sans enregistrer ?',
        `${fileName(relPath)} contient des modifications non enregistrées.`
      );
      if (!ok) return;
    }
    delete state.drafts[relPath];
    delete state.saved[relPath];
    state.tabs = state.tabs.filter((p) => p !== relPath);
    if (state.activeTab === relPath) {
      state.activeTab = state.tabs[state.tabs.length - 1] || null;
    }
    if (state.activeTab) await openFile(state.activeTab);
    else {
      setView('graph');
      renderTabs();
    }
  }

  async function saveActive() {
    const path = state.activeTab;
    if (!path || !isDirty(path)) return;
    const content = state.drafts[path];
    if (typeof content !== 'string') return;
    await api.writeFile(state.rootPath, path, content);
    state.saved[path] = content;
    applyEditorMode();
    renderTabs();
    await refreshMap();
  }

  function onEditorInput() {
    if (!state.activeTab) return;
    state.drafts[state.activeTab] = $('#editor').value;
    applyEditorMode();
    renderTabs();
  }

  async function loadVault(folderPath) {
    setLoading(true);
    try {
      state.rootPath = folderPath;
      state.tree = await api.vaultTree(folderPath);
      state.files = flatten(state.tree);
      $('#vault-name').textContent = state.tree.name;
      $('#folder-path').textContent = folderPath;
      $('#status-vault').textContent = folderPath;
      renderTree($('#sidebar-filter').value);
      await refreshMap();
    } catch (err) {
      await confirmDialog('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshMap() {
    if (!state.rootPath) return;
    const data = await api.mapFolder(state.rootPath);
    state.map = data;
    state.orphanSet = new Set(data.orphans || []);
    updateStats(data);
    showIssues(data);
    renderGraph(data);
    renderTree($('#sidebar-filter').value);
  }

  async function selectAndMap() {
    const folder = await api.selectFolder();
    if (folder) await loadVault(folder);
  }

  async function applyUpdates() {
    if (!state.map || !state.map.updates || state.map.updates.length === 0) return;
    const ok = await confirmDialog(
      'Appliquer les liens',
      `Écrire ${state.map.updateCount} mise(s) à jour dans les fichiers brain.yaml ?`
    );
    if (!ok) return;
    await api.applyUpdates(state.rootPath, state.map.updates);
    await refreshMap();
    if (state.activeTab && /\.ya?ml$/i.test(state.activeTab)) {
      delete state.drafts[state.activeTab];
      delete state.saved[state.activeTab];
      await openFile(state.activeTab);
    }
  }

  function openSwitcher() {
    if (!state.files.length) return;
    const box = $('#switcher');
    const input = $('#switcher-input');
    const list = $('#switcher-list');
    let index = 0;
    box.hidden = false;
    input.value = '';
    input.focus();

    const paint = () => {
      const q = input.value.trim().toLowerCase();
      const items = state.files
        .filter((f) => !q || f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
        .slice(0, 30);
      list.innerHTML = '';
      if (!items.length) {
        const li = document.createElement('li');
        li.innerHTML = '<button type="button" disabled>Aucun fichier. Essayez un autre nom.</button>';
        list.appendChild(li);
        return items;
      }
      items.forEach((f, i) => {
        const li = document.createElement('li');
        if (i === index) li.className = 'is-active';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = `<span>${escapeHtml(f.name)}</span><span class="meta">${escapeHtml(f.path)}</span>`;
        btn.addEventListener('click', () => pick(f.path));
        li.appendChild(btn);
        list.appendChild(li);
      });
      return items;
    };

    const pick = async (path) => {
      close();
      await openFile(path);
    };

    const close = () => {
      box.hidden = true;
      input.oninput = null;
      input.onkeydown = null;
    };

    input.oninput = () => {
      index = 0;
      paint();
    };
    input.onkeydown = (e) => {
      const items = paint();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        index = Math.min(index + 1, items.length - 1);
        paint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        index = Math.max(index - 1, 0);
        paint();
      } else if (e.key === 'Enter' && items[index]) {
        e.preventDefault();
        pick(items[index].path);
      }
    };
    paint();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('#btn-select').addEventListener('click', selectAndMap);
    $('#btn-apply').addEventListener('click', applyUpdates);
    $('#btn-switcher').addEventListener('click', openSwitcher);
    $('#btn-save').addEventListener('click', () => saveActive().catch((e) => confirmDialog('Erreur', e.message)));
    $('#editor').addEventListener('input', onEditorInput);
    $('#sidebar-filter').addEventListener('input', (e) => renderTree(e.target.value));
    $('#btn-edit').addEventListener('click', () => {
      state.preview = false;
      applyEditorMode();
    });
    $('#btn-preview').addEventListener('click', () => {
      state.preview = true;
      applyEditorMode();
    });
    $('#btn-zoom-in').addEventListener('click', () => state.cy && state.cy.zoom(state.cy.zoom() * 1.25));
    $('#btn-zoom-out').addEventListener('click', () => state.cy && state.cy.zoom(state.cy.zoom() / 1.25));
    $('#btn-fit').addEventListener('click', () => state.cy && state.cy.fit(undefined, 60));

    document.querySelectorAll('.ribbon__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view === 'graph') {
          state.activeTab = null;
          renderTabs();
        }
        setView(btn.dataset.view);
      });
    });

    $('#modal .modal__backdrop').addEventListener('click', () => {
      $('#modal').hidden = true;
    });
    $('#switcher .switcher__backdrop').addEventListener('click', () => {
      $('#switcher').hidden = true;
    });

    document.addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActive().catch((err) => confirmDialog('Erreur', err.message));
      } else if (meta && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openSwitcher();
      } else if (e.key === 'Escape') {
        $('#modal').hidden = true;
        $('#switcher').hidden = true;
      }
    });

    const params = new URLSearchParams(window.location.search);
    const autoPath = params.get('path');
    if (autoPath) {
      await loadVault(autoPath);
    } else if (api.runtime === 'web') {
      try {
        const session = await api.session();
        await loadVault(session.rootPath);
      } catch {
        /* empty vault until opened */
      }
    }
  });
})();
