// VICE CUT — studio editor wiring. Classic script, no dependencies.
// Owns the controls, the sample tray, uploads, panel pan/zoom and export.
'use strict';

(function () {
  const state = ViceCut.defaultState();
  let images = new Map();
  let ready = false;

  const $ = function (id) { return document.getElementById(id); };
  const preview = $('preview');
  const pctx = preview.getContext('2d');
  const statusLine = $('status');

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function previewSize() {
    // In cover-shot mode shots.js sizes the canvas to the frame already;
    // the editor's 560 px cap must not shrink it back.
    if (document.body.classList.contains('shot-cover')) {
      return { w: preview.width, h: preview.height };
    }
    const size = ViceCut.SIZES[state.size];
    const box = preview.parentElement.getBoundingClientRect();
    const scale = Math.min((box.width - 8) / size.w, 560 / size.h, 1);
    const w = Math.max(320, Math.floor(size.w * scale));
    const h = Math.floor(size.h * scale);
    if (preview.width !== w || preview.height !== h) {
      preview.width = w;
      preview.height = h;
    }
    return { w: w, h: h };
  }

  function draw() {
    if (!ready) return;
    const s = previewSize();
    ViceCut.drawCover(pctx, state, images, s.w, s.h);
    // The dashed selection outline belongs to the editor only — a cover
    // screenshot must show the clean cover.
    if (!document.body.classList.contains('shot-cover')) highlightSelected();
  }

  function highlightSelected() {
    const geo = ViceCut.layoutGeometry(state.layout, preview.width, preview.height);
    const poly = geo.panels[state.selected];
    if (!poly) return;
    pctx.save();
    pctx.strokeStyle = '#ffd94a';
    pctx.lineWidth = 3;
    pctx.setLineDash([10, 6]);
    pctx.beginPath();
    pctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) pctx.lineTo(poly[i][0], poly[i][1]);
    pctx.closePath();
    pctx.stroke();
    pctx.restore();
  }

  function refreshTraySelection() {
    document.querySelectorAll('#tray img').forEach(function (img) {
      img.classList.toggle('active', img.dataset.src === state.activePhoto);
    });
  }

  function buildTray() {
    const tray = $('tray');
    tray.innerHTML = '';
    ViceCut.SAMPLES.forEach(function (s) {
      const img = document.createElement('img');
      img.src = s.src;
      img.alt = s.label;
      img.title = s.label + ' — click, then click a panel to place it';
      img.dataset.src = s.src;
      img.addEventListener('click', function () {
        state.activePhoto = (state.activePhoto === s.src) ? null : s.src;
        refreshTraySelection();
        setStatus(state.activePhoto
          ? 'Photo picked: ' + s.label + ' — click a panel to place it.'
          : 'Photo unpicked.');
      });
      tray.appendChild(img);
    });
    refreshTraySelection();
  }

  function buildButtons(groupId, items, current, onPick) {
    const group = $(groupId);
    group.innerHTML = '';
    items.forEach(function (item) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.className = 'chip' + (item.id === current ? ' on' : '');
      b.addEventListener('click', function () { onPick(item.id); });
      group.appendChild(b);
    });
  }

  function rebuildControls() {
    buildButtons('layoutGroup', ViceCut.LAYOUTS, state.layout, function (id) {
      state.layout = id;
      state.selected = 0;
      rebuildControls();
      draw();
    });
    buildButtons('gradeGroup', ViceCut.GRADES, state.grade, function (id) {
      state.grade = id;
      rebuildControls();
      draw();
    });
    buildButtons('styleGroup', ViceCut.STYLES, state.style, function (id) {
      state.style = id;
      rebuildControls();
      draw();
    });
    buildButtons('sizeGroup', Object.values(ViceCut.SIZES), state.size, function (id) {
      state.size = id;
      rebuildControls();
      draw();
    });
    $('titleInput').value = state.title;
    $('taglineInput').value = state.tagline;
    $('starsToggle').checked = state.stars;
    $('badgeToggle').checked = state.badge;
    $('zoomSlider').value = String((state.panels[state.selected] || {}).zoom || 1);
    $('zoomLabel').textContent = 'Zoom ' + Math.round(((state.panels[state.selected] || {}).zoom || 1) * 100) + '%';
  }

  function placeActivePhoto(panelIndex) {
    if (!state.activePhoto) return false;
    state.panels[panelIndex] = { src: state.activePhoto, ox: 0.5, oy: 0.42, zoom: 1 };
    return true;
  }

  function canvasPoint(evt) {
    const r = preview.getBoundingClientRect();
    return {
      x: (evt.clientX - r.left) * (preview.width / r.width),
      y: (evt.clientY - r.top) * (preview.height / r.height),
    };
  }

  let drag = null;

  preview.addEventListener('pointerdown', function (evt) {
    const p = canvasPoint(evt);
    const hit = ViceCut.hitPanel(state, p.x, p.y, preview.width, preview.height);
    if (hit < 0) return;
    state.selected = hit;
    if (placeActivePhoto(hit)) {
      state.activePhoto = null;
      refreshTraySelection();
      setStatus('Placed into panel ' + (hit + 1) + '.');
    } else {
      setStatus('Panel ' + (hit + 1) + ' selected — drag to pan, slider to zoom.');
    }
    const panel = state.panels[hit];
    drag = { x: p.x, y: p.y, ox: panel.ox, oy: panel.oy };
    preview.setPointerCapture(evt.pointerId);
    rebuildControls();
    draw();
  });

  preview.addEventListener('pointermove', function (evt) {
    if (!drag) return;
    const p = canvasPoint(evt);
    const panel = state.panels[state.selected];
    const geo = ViceCut.layoutGeometry(state.layout, preview.width, preview.height);
    const poly = geo.panels[state.selected];
    if (!panel || !poly) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach(function (pt) {
      minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]);
    });
    const img = images.get(panel.src);
    if (!img) return;
    const base = Math.max((maxX - minX) / img.naturalWidth, (maxY - minY) / img.naturalHeight);
    const dw = img.naturalWidth * base * panel.zoom;
    const dh = img.naturalHeight * base * panel.zoom;
    // Overflow in pixels: how far the drawn image can slide. At zoom 1 the
    // image exactly covers the panel, so there is nothing to pan.
    const spanX = dw - (maxX - minX);
    const spanY = dh - (maxY - minY);
    if (spanX > 0) panel.ox = Math.min(1, Math.max(0, drag.ox - (p.x - drag.x) / spanX));
    if (spanY > 0) panel.oy = Math.min(1, Math.max(0, drag.oy - (p.y - drag.y) / spanY));
    draw();
  });

  preview.addEventListener('pointerup', function () { drag = null; });
  preview.addEventListener('pointercancel', function () { drag = null; });

  preview.addEventListener('wheel', function (evt) {
    evt.preventDefault();
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = Math.min(3, Math.max(1, panel.zoom * (evt.deltaY < 0 ? 1.08 : 0.92)));
    rebuildControls();
    draw();
  }, { passive: false });

  function bindControls() {
    $('titleInput').addEventListener('input', function (evt) {
      state.title = evt.target.value.toUpperCase().slice(0, 24) || 'VICE CUT';
      draw();
    });
    $('taglineInput').addEventListener('input', function (evt) {
      state.tagline = evt.target.value.slice(0, 60);
      draw();
    });
    $('starsToggle').addEventListener('change', function (evt) {
      state.stars = evt.target.checked;
      draw();
    });
    $('badgeToggle').addEventListener('change', function (evt) {
      state.badge = evt.target.checked;
      draw();
    });
    $('zoomSlider').addEventListener('input', function (evt) {
      const panel = state.panels[state.selected];
      if (!panel) return;
      panel.zoom = Number(evt.target.value);
      $('zoomLabel').textContent = 'Zoom ' + Math.round(panel.zoom * 100) + '%';
      draw();
    });
    $('fillAllBtn').addEventListener('click', function () {
      const src = state.activePhoto || state.panels[state.selected].src;
      state.panels.forEach(function (p, i) {
        state.panels[i] = { src: src, ox: 0.5, oy: 0.42, zoom: 1 };
      });
      setStatus('Every panel now shows the same photo — pick different tray photos to vary it.');
      draw();
    });
    $('resetBtn').addEventListener('click', function () {
      const fresh = ViceCut.defaultState();
      Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
      rebuildControls();
      draw();
      setStatus('Reset to the painted Cover Grid.');
    });
    $('uploadInput').addEventListener('change', function (evt) {
      const files = Array.prototype.slice.call(evt.target.files || []);
      files.forEach(function (file) {
        if (!file.type || file.type.indexOf('image/') !== 0) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          images.set(url, img);
          const thumb = document.createElement('img');
          thumb.src = url;
          thumb.alt = file.name;
          thumb.title = file.name + ' — click, then click a panel to place it';
          thumb.dataset.src = url;
          thumb.addEventListener('click', function () {
            state.activePhoto = (state.activePhoto === url) ? null : url;
            refreshTraySelection();
          });
          $('tray').appendChild(thumb);
        };
        img.src = url;
      });
      setStatus(files.length + ' photo(s) added to the tray — click one, then click a panel.');
      evt.target.value = '';
    });
    $('exportBtn').addEventListener('click', function () {
      const size = ViceCut.SIZES[state.size];
      setStatus('Exporting ' + size.w + ' x ' + size.h + ' PNG…');
      ViceCut.exportPNG(state, images, state.size).then(function (out) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(out.blob);
        a.download = 'vice-cut-' + state.size + '.png';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        setStatus('Exported ' + out.w + ' x ' + out.h + ' PNG — check your downloads.');
      });
    });
    window.addEventListener('resize', draw);
  }

  // Shot mode (see shots.js) drives state from the URL; the editor just
  // exposes what the shot runner and the tests need.
  window.__vicecut = {
    state: state,
    get images() { return images; },
    get ready() { return ready; },
    draw: draw,
    rebuildControls: rebuildControls,
    applyState: function (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k === 'panels') return;
        state[k] = patch[k];
      });
      if (patch.panels) {
        patch.panels.forEach(function (p, i) {
          if (state.panels[i]) Object.assign(state.panels[i], p);
        });
      }
      rebuildControls();
      draw();
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    buildTray();
    bindControls();
    rebuildControls();
    ViceCut.loadAllImages(state).then(function (map) {
      // Merge, never replace: a photo uploaded while the samples were
      // still loading must survive (its tray thumb already points at it).
      map.forEach(function (img, src) { images.set(src, img); });
      ready = true;
      window.__shotReady = false;
      draw();
      setStatus('Ready — 8 original illustrations loaded. Click a panel, drag to pan.');
      if (window.__vicecutShot) window.__vicecutShot();
    }).catch(function (err) {
      setStatus('A sample failed to load: ' + err.message);
    });
  });
})();
