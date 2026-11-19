// VICE CUT — shot runner. Classic script, no dependencies.
// Reads ?shot=cover | editor plus layout/grade/style/title/tagline/size/
// stars/badge params, applies them to the editor state, and sets
// window.__shotReady once the cover is painted.
'use strict';

(function () {
  function parseParams() {
    const q = new URLSearchParams(window.location.search);
    const patch = {};
    const layout = q.get('layout');
    if (layout) patch.layout = layout;
    const grade = q.get('grade');
    if (grade) patch.grade = grade;
    const style = q.get('style');
    if (style) patch.style = style;
    const title = q.get('title');
    if (title) patch.title = title;
    const tagline = q.get('tagline');
    if (tagline !== null) patch.tagline = tagline;
    const size = q.get('size');
    if (size) patch.size = size;
    const stars = q.get('stars');
    if (stars !== null) patch.stars = stars === '1';
    const badge = q.get('badge');
    if (badge !== null) patch.badge = badge === '1';
    return { shot: q.get('shot') || 'editor', patch: patch };
  }

  function fitCoverCanvas() {
    const canvas = document.getElementById('preview');
    const size = window.__vicecut.state.size;
    const dims = ViceCut.SIZES[size] || ViceCut.SIZES.square;
    const scale = Math.min(window.innerWidth / dims.w, window.innerHeight / dims.h);
    canvas.width = Math.floor(dims.w * scale);
    canvas.height = Math.floor(dims.h * scale);
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  }

  function markReady() {
    // One frame after the paint, so a screenshot catches the finished cover.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        window.__shotReady = true;
      });
    });
  }

  window.__vicecutShot = function () {
    const run = parseParams();
    window.__vicecut.applyState(run.patch);
    if (run.shot === 'cover') {
      document.body.classList.add('shot-cover');
      fitCoverCanvas();
      window.__vicecut.draw();
      window.addEventListener('resize', function () {
        fitCoverCanvas();
        window.__vicecut.draw();
      });
    }
    markReady();
  };

  // If the editor already finished loading before this script ran, run now.
  if (window.__vicecut && window.__vicecut.ready && !window.__shotReady) {
    window.__vicecutShot();
  }
})();
