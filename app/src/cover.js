// VICE CUT — cover renderer. Classic script, no dependencies.
// Draws the whole cover (panels + title) onto any 2D canvas at any size,
// so the on-screen preview and the exported PNG are the same drawing.
'use strict';

const ViceCut = (function () {
  // ---- catalogue ---------------------------------------------------------
  const SAMPLES = [
    { src: 'samples/scene-couple.jpg', label: 'Golden Hour' },
    { src: 'samples/scene-moto.jpg', label: 'Neon Wheelie' },
    { src: 'samples/scene-boat.jpg', label: 'Flamingo Run' },
    { src: 'samples/scene-car.jpg', label: 'Ocean Drive' },
    { src: 'samples/scene-gator.jpg', label: 'Swamp Dusk' },
    { src: 'samples/scene-heli.jpg', label: 'Skyline Pass' },
    { src: 'samples/scene-diner.jpg', label: 'Diner Night' },
    { src: 'samples/scene-pier.jpg', label: 'Pier Light' },
  ];

  const LAYOUTS = [
    { id: 'grid', label: 'Cover Grid' },
    { id: 'comic', label: 'Comic Cuts' },
    { id: 'hero3', label: 'Hero + 3' },
    { id: 'strip', label: 'Film Strip' },
    { id: 'four', label: 'Four Square' },
  ];

  const GRADES = [
    { id: 'sunset', label: 'Vice Sunset' },
    { id: 'neon', label: 'Neon Night' },
    { id: 'teal', label: 'Teal Coast' },
    { id: 'mono', label: 'Ink Mono' },
  ];

  const STYLES = [
    { id: 'sunset', label: 'Sunset' },
    { id: 'chrome', label: 'Chrome' },
    { id: 'neon', label: 'Neon' },
    { id: 'mono', label: 'Mono' },
  ];

  const SIZES = {
    square: { id: 'square', label: 'Square', w: 1080, h: 1080 },
    portrait: { id: 'portrait', label: 'Portrait', w: 1080, h: 1350 },
    wide: { id: 'wide', label: 'Wide', w: 1920, h: 1080 },
  };

  // ---- state -------------------------------------------------------------
  function defaultState() {
    return {
      layout: 'grid',
      grade: 'sunset',
      style: 'sunset',
      title: 'VICE CUT',
      tagline: 'Painted in Leonida.',
      stars: false,
      badge: true,
      size: 'square',
      activePhoto: null, // src of the tray photo waiting to be placed
      panels: SAMPLES.map(function (s) {
        return { src: s.src, ox: 0.5, oy: 0.42, zoom: 1 };
      }),
      selected: 0,
    };
  }

  function cloneState(s) {
    return JSON.parse(JSON.stringify(s));
  }

  // ---- image loading -----------------------------------------------------
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('cannot load ' + src)); };
      img.src = src;
    });
  }

  // Loads every distinct image a state needs (samples + uploads).
  // Returns a Map src -> HTMLImageElement.
  function loadAllImages(state) {
    const srcs = [];
    state.panels.forEach(function (p) {
      if (srcs.indexOf(p.src) === -1) srcs.push(p.src);
    });
    SAMPLES.forEach(function (s) {
      if (srcs.indexOf(s.src) === -1) srcs.push(s.src);
    });
    return Promise.all(srcs.map(function (src) {
      return loadImage(src).then(function (img) { return [src, img]; });
    })).then(function (pairs) { return new Map(pairs); });
  }

  // ---- layout geometry ---------------------------------------------------
  // Every layout returns { panels: [poly, ...], title: rect | 'grid' }.
  // A poly is [[x, y], ...] in pixels; rect is {x, y, w, h}.
  // 'grid' means the title owns the centre cell of the 3x3 grid.
  function rectPoly(r) {
    return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  }

  function layoutGeometry(layout, W, H) {
    const g = Math.max(4, Math.round(W * 0.008)); // gutter
    if (layout === 'grid') {
      const cw = (W - 4 * g) / 3;
      const ch = (H - 4 * g) / 3;
      const cell = function (cx, cy) {
        return { x: g + cx * (cw + g), y: g + cy * (ch + g), w: cw, h: ch };
      };
      const cells = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
      return {
        panels: cells.map(function (c) { return rectPoly(cell(c[0], c[1])); }),
        title: cell(1, 1),
        titleKind: 'block',
      };
    }
    if (layout === 'comic') {
      const bandH = 0.86 * H;
      const b1 = 0.38 * bandH, b2 = 0.70 * bandH;
      const slant = 0.05 * W;
      return {
        panels: [
          [[g, g], [0.56 * W, g], [0.56 * W - slant, b1], [g, b1]],
          [[0.56 * W + g, g], [W - g, g], [W - g, b1], [0.56 * W - slant + g, b1]],
          [[g, b1 + g], [0.36 * W, b1 + g], [0.36 * W - slant, b2], [g, b2]],
          [[0.36 * W + g, b1 + g], [0.68 * W, b1 + g], [0.68 * W - slant, b2], [0.36 * W - slant + g, b2]],
          [[0.68 * W + g, b1 + g], [W - g, b1 + g], [W - g, b2], [0.68 * W - slant + g, b2]],
          [[g, b2 + g], [0.34 * W, b2 + g], [0.34 * W - slant, bandH], [g, bandH]],
          [[0.34 * W + g, b2 + g], [0.67 * W, b2 + g], [0.67 * W - slant, bandH], [0.34 * W - slant + g, bandH]],
          [[0.67 * W + g, b2 + g], [W - g, b2 + g], [W - g, bandH], [0.67 * W - slant + g, bandH]],
        ],
        title: { x: 0, y: bandH + g, w: W, h: H - bandH - g },
        titleKind: 'band',
      };
    }
    if (layout === 'hero3') {
      const heroH = 0.60 * H, bandH = 0.86 * H;
      const pw = (W - 4 * g) / 3;
      const row = function (i) {
        return { x: g + i * (pw + g), y: heroH + g, w: pw, h: bandH - heroH - g };
      };
      return {
        panels: [
          [[g, g], [W - g, g], [W - g, heroH], [g, heroH]],
          rectPoly(row(0)), rectPoly(row(1)), rectPoly(row(2)),
        ],
        title: { x: 0, y: bandH + g, w: W, h: H - bandH - g },
        titleKind: 'band',
      };
    }
    if (layout === 'strip') {
      // Left hero column keeps a safe inset so its top is never cropped.
      const heroW = 0.60 * W, bandH = 0.86 * H;
      const colX = heroW + g;
      const colW = W - colX - g;
      const ph = (bandH - 5 * g) / 4;
      const panels = [[[g, g], [heroW, g], [heroW, bandH], [g, bandH]]];
      for (let i = 0; i < 4; i++) {
        panels.push(rectPoly({ x: colX, y: g + i * (ph + g), w: colW, h: ph }));
      }
      return {
        panels: panels,
        title: { x: 0, y: bandH + g, w: W, h: H - bandH - g },
        titleKind: 'band',
      };
    }
    // four
    const bandH4 = 0.86 * H;
    const cw4 = (W - 3 * g) / 2, ch4 = (bandH4 - 3 * g) / 2;
    const cell4 = function (cx, cy) {
      return { x: g + cx * (cw4 + g), y: g + cy * (ch4 + g), w: cw4, h: ch4 };
    };
    return {
      panels: [cell4(0, 0), cell4(1, 0), cell4(0, 1), cell4(1, 1)].map(rectPoly),
      title: { x: 0, y: bandH4 + g, w: W, h: H - bandH4 - g },
      titleKind: 'band',
    };
  }

  function polyBounds(poly) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    poly.forEach(function (p) {
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ---- painting helpers --------------------------------------------------
  function tracePoly(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }

  function drawImageCover(ctx, img, bounds, panel) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const base = Math.max(bounds.w / iw, bounds.h / ih);
    const scale = base * (panel.zoom || 1);
    const dw = iw * scale, dh = ih * scale;
    const dx = bounds.x + (bounds.w - dw) * (panel.ox == null ? 0.5 : panel.ox);
    const dy = bounds.y + (bounds.h - dh) * (panel.oy == null ? 0.5 : panel.oy);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function gradeWash(ctx, grade, bounds) {
    if (grade === 'mono') return; // mono is a filter at draw time
    ctx.save();
    if (grade === 'sunset') {
      const grad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
      grad.addColorStop(0, 'rgba(255, 122, 89, 0.20)');
      grad.addColorStop(0.55, 'rgba(255, 94, 120, 0.10)');
      grad.addColorStop(1, 'rgba(178, 80, 255, 0.20)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grad;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    } else if (grade === 'neon') {
      const grad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
      grad.addColorStop(0, 'rgba(255, 46, 170, 0.22)');
      grad.addColorStop(0.5, 'rgba(120, 60, 255, 0.10)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.22)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = grad;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 4, 32, 0.10)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    } else if (grade === 'teal') {
      const grad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
      grad.addColorStop(0, 'rgba(0, 200, 190, 0.20)');
      grad.addColorStop(1, 'rgba(0, 90, 140, 0.22)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grad;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    ctx.restore();
  }

  function vignette(ctx, W, H) {
    const r = Math.max(W, H) * 0.72;
    const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(8, 2, 18, 0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- caption lettering -------------------------------------------------
  function titleGradient(ctx, style, x, yTop, w, h) {
    const grad = ctx.createLinearGradient(x, yTop, x, yTop + h);
    if (style === 'chrome') {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#dfe6ec');
      grad.addColorStop(0.55, '#9aa7b1');
      grad.addColorStop(1, '#f4f7f9');
    } else if (style === 'neon') {
      grad.addColorStop(0, '#ff7ad9');
      grad.addColorStop(0.5, '#ff2e9a');
      grad.addColorStop(1, '#7df9ff');
    } else if (style === 'mono') {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#e8e8e8');
    } else { // sunset
      grad.addColorStop(0, '#ffe259');
      grad.addColorStop(0.45, '#ff7e5f');
      grad.addColorStop(1, '#c44dff');
    }
    return grad;
  }

  function fitFont(ctx, text, maxW, startPx, family) {
    let px = startPx;
    ctx.font = '900 ' + px + 'px ' + family;
    while (px > 24 && ctx.measureText(text).width > maxW) {
      px = Math.floor(px * 0.92);
      ctx.font = '900 ' + px + 'px ' + family;
    }
    return px;
  }

  function paintTitleText(ctx, state, cx, cy, maxW, maxH) {
    const family = '"Arial Black", Arial, sans-serif';
    const px = fitFont(ctx, state.title, maxW, Math.floor(maxH * 0.72), family);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (state.style === 'neon') {
      ctx.shadowColor = 'rgba(255, 46, 154, 0.9)';
      ctx.shadowBlur = Math.max(10, px * 0.18);
    }
    ctx.fillStyle = titleGradient(ctx, state.style, cx - maxW / 2, cy - px * 0.55, maxW, px * 1.1);
    ctx.strokeStyle = state.style === 'mono' ? '#111111' : '#20041f';
    ctx.lineWidth = Math.max(2, px * 0.07);
    ctx.strokeText(state.title, cx, cy);
    ctx.fillText(state.title, cx, cy);
    ctx.restore();
    return px;
  }

  function drawPalm(ctx, x, y, h, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(20, 4, 24, 0.92)';
    ctx.lineWidth = Math.max(2, h * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * h * 0.25, -h * 0.55, lean * h * 0.42, -h * 0.95);
    ctx.stroke();
    const tx = lean * h * 0.42, ty = -h * 0.95;
    ctx.lineWidth = Math.max(1.5, h * 0.022);
    for (let i = 0; i < 6; i++) {
      const a = (-0.15 - i * 0.28) * Math.PI + (lean > 0 ? 0.35 : -0.35);
      const len = h * (0.34 - Math.abs(i - 2.5) * 0.03);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(
        tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.55 - h * 0.06,
        tx + Math.cos(a) * len, ty + Math.sin(a) * len + h * 0.10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintTitleBlock(ctx, state, rect) {
    const W = rect.w, H = rect.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, W, H);
    ctx.clip();
    // Sunset sky inside the block.
    const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + H);
    sky.addColorStop(0, '#ff5e8a');
    sky.addColorStop(0.45, '#ff8a5c');
    sky.addColorStop(0.75, '#ffb347');
    sky.addColorStop(1, '#7b2fbe');
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, W, H);
    // Sun, small and high so it never sits behind the title lettering.
    const sunR = H * 0.15;
    ctx.fillStyle = 'rgba(255, 236, 170, 0.95)';
    ctx.beginPath();
    ctx.arc(rect.x + W * 0.5, rect.y + H * 0.26, sunR, 0, Math.PI * 2);
    ctx.fill();
    // Skyline silhouette, low and deterministic (same buildings every paint,
    // so the preview and the exported PNG always match).
    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    ctx.fillStyle = 'rgba(32, 6, 38, 0.55)';
    let bx = rect.x + W * 0.06;
    while (bx < rect.x + W * 0.94) {
      const bw = W * (0.05 + rnd() * 0.04);
      const bh = H * (0.08 + rnd() * 0.06);
      ctx.fillRect(bx, rect.y + H - bh, bw, bh);
      bx += bw + W * 0.015;
    }
    // Palms at the block's corners.
    drawPalm(ctx, rect.x + W * 0.10, rect.y + H * 0.98, H * 0.55, -1);
    drawPalm(ctx, rect.x + W * 0.90, rect.y + H * 0.98, H * 0.48, 1);
    // Title + tagline, with a dark scrim behind the tagline so it stays
    // readable over the skyline.
    const titlePx = paintTitleText(ctx, state, rect.x + W / 2, rect.y + H * 0.52, W * 0.88, H * 0.40);
    if (state.tagline) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.max(11, Math.floor(titlePx * 0.24)) + 'px Arial, sans-serif';
      const tw = ctx.measureText(state.tagline).width;
      const th = Math.max(14, titlePx * 0.34);
      ctx.fillStyle = 'rgba(12, 2, 16, 0.55)';
      ctx.fillRect(rect.x + W / 2 - tw / 2 - 10, rect.y + H * 0.80 - th / 2, tw + 20, th);
      ctx.fillStyle = 'rgba(255, 244, 224, 0.96)';
      ctx.fillText(state.tagline, rect.x + W / 2, rect.y + H * 0.80);
      ctx.restore();
    }
    ctx.restore();
    // Gold frame.
    ctx.save();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = Math.max(2, W * 0.008);
    ctx.strokeRect(rect.x + ctx.lineWidth, rect.y + ctx.lineWidth, W - 2 * ctx.lineWidth, H - 2 * ctx.lineWidth);
    ctx.restore();
    paintBadgeAndStars(ctx, state, rect);
  }

  function paintTitleBand(ctx, state, rect) {
    ctx.save();
    const band = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    band.addColorStop(0, '#160a1e');
    band.addColorStop(1, '#050308');
    ctx.fillStyle = band;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(245, 197, 66, 0.9)';
    ctx.fillRect(rect.x, rect.y, rect.w, Math.max(2, rect.h * 0.05));
    const titlePx = paintTitleText(ctx, state, rect.x + rect.w / 2, rect.y + rect.h * 0.44, rect.w * 0.9, rect.h * 0.62);
    if (state.tagline) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 244, 224, 0.9)';
      ctx.font = '700 ' + Math.max(11, Math.floor(titlePx * 0.22)) + 'px Arial, sans-serif';
      ctx.fillText(state.tagline, rect.x + rect.w / 2, rect.y + rect.h * 0.82);
      ctx.restore();
    }
    ctx.restore();
    paintBadgeAndStars(ctx, state, rect);
  }

  function paintBadgeAndStars(ctx, state, rect) {
    ctx.save();
    const pad = Math.max(8, rect.w * 0.03);
    if (state.badge) {
      const label = 'LEONIDA';
      ctx.font = '800 ' + Math.max(10, Math.floor(rect.h * 0.09)) + 'px Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + pad * 1.6, bh = Math.max(16, rect.h * 0.16);
      const bx = rect.x + rect.w - bw - pad, by = rect.y + pad;
      ctx.fillStyle = 'rgba(8, 2, 14, 0.72)';
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd970';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
    }
    if (state.stars) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = Math.max(12, Math.floor(rect.h * 0.11)) + 'px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('★★★★★', rect.x + pad, rect.y + pad + rect.h * 0.06);
    }
    ctx.restore();
  }

  // ---- main draw ---------------------------------------------------------
  function drawCover(ctx, state, images, W, H) {
    ctx.save();
    ctx.fillStyle = '#12060f';
    ctx.fillRect(0, 0, W, H);
    const geo = layoutGeometry(state.layout, W, H);
    geo.panels.forEach(function (poly, i) {
      const panel = state.panels[i] || state.panels[0];
      const img = images.get(panel.src);
      if (!img) return;
      const bounds = polyBounds(poly);
      ctx.save();
      tracePoly(ctx, poly);
      ctx.clip();
      if (state.grade === 'mono') {
        ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.04)';
      }
      drawImageCover(ctx, img, bounds, panel);
      ctx.filter = 'none';
      gradeWash(ctx, state.grade, bounds);
      ctx.restore();
    });
    // Gutters stay dark; outline each panel thinly.
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    geo.panels.forEach(function (poly) { tracePoly(ctx, poly); ctx.stroke(); });
    ctx.restore();
    if (geo.titleKind === 'block') paintTitleBlock(ctx, state, geo.title);
    else paintTitleBand(ctx, state, geo.title);
    vignette(ctx, W, H);
    ctx.restore();
  }

  function renderToCanvas(state, images, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    drawCover(canvas.getContext('2d'), state, images, w, h);
    return canvas;
  }

  function exportPNG(state, images, sizeKey) {
    const size = SIZES[sizeKey] || SIZES.square;
    const canvas = renderToCanvas(state, images, size.w, size.h);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve({ blob: blob, w: size.w, h: size.h }); }, 'image/png');
    });
  }

  // Hit-test a point (canvas pixel coords) against the layout's panels.
  function hitPanel(state, x, y, W, H) {
    const geo = layoutGeometry(state.layout, W, H);
    for (let i = geo.panels.length - 1; i >= 0; i--) {
      if (pointInPoly(x, y, geo.panels[i])) return i;
    }
    return -1;
  }

  return {
    SAMPLES: SAMPLES,
    LAYOUTS: LAYOUTS,
    GRADES: GRADES,
    STYLES: STYLES,
    SIZES: SIZES,
    defaultState: defaultState,
    cloneState: cloneState,
    loadImage: loadImage,
    loadAllImages: loadAllImages,
    layoutGeometry: layoutGeometry,
    drawCover: drawCover,
    renderToCanvas: renderToCanvas,
    exportPNG: exportPNG,
    hitPanel: hitPanel,
  };
})();
