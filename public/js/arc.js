'use strict';
// A curved wall of works. Tiles turn toward the viewer as they move away from the centre,
// the row drifts slowly until someone touches it, and the centred work is named underneath.
window.HoomaArc = (() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mount(root, works, getLang) {
    if (!root || !works.length) return { relabel() {} };
    const L = (o) => (o && (o[getLang()] || o.fa || o.en)) || '';
    root.innerHTML = '<div class="arc-row" tabindex="0" aria-label="Works">' +
      works.map((w) => '<a class="arc-tile" href="/w/' + w.id + '" data-id="' + w.id + '"><img loading="lazy" src="' + w.img + '" alt=""></a>').join('') +
      '</div><p class="arc-cap" aria-live="polite"><b></b><span></span></p>';
    const row = root.querySelector('.arc-row'), tiles = [...row.children], cap = root.querySelector('.arc-cap');
    let centre = -1, hold = false, dir = 1, raf = 0, seen = false, acc = 0;
    function label() {
      const w = works[centre]; if (!w) return;
      cap.querySelector('b').textContent = L(w.title);
      cap.querySelector('span').textContent = L(w.medium);
      tiles.forEach((t, i) => { t.setAttribute('aria-label', L(works[i].title)); });
    }
    function shape() {
      const r = row.getBoundingClientRect(), mid = r.left + r.width / 2, half = r.width / 2;
      let best = 1e9, bi = 0;
      tiles.forEach((t, i) => {
        const b = t.getBoundingClientRect(), d = ((b.left + b.width / 2) - mid) / half;       // -1 … 1 across the row
        const c = Math.max(-1.4, Math.min(1.4, d));
        t.style.transform = 'rotateY(' + (-c * 38).toFixed(2) + 'deg) translateZ(' + (c * c * 150).toFixed(1) + 'px)';
        t.style.zIndex = String(100 - Math.round(Math.abs(c) * 50));
        if (Math.abs(d) < best) { best = Math.abs(d); bi = i; }
      });
      if (bi !== centre) { centre = bi; tiles.forEach((t, i) => t.classList.toggle('mid', i === bi)); label(); }
    }
    function drift() {
      if (!hold && seen && !document.hidden) {
        const max = row.scrollWidth - row.clientWidth;
        if (row.scrollLeft >= max - 1) dir = -1; else if (row.scrollLeft <= 1) dir = 1;
        acc += dir * 0.35; if (Math.abs(acc) >= 1) { row.scrollLeft += Math.trunc(acc); acc -= Math.trunc(acc); }
      }
      raf = requestAnimationFrame(drift);
    }
    row.addEventListener('scroll', shape, { passive: true });
    addEventListener('resize', shape);
    ['pointerenter', 'pointerdown', 'touchstart', 'focusin', 'wheel'].forEach((e) => row.addEventListener(e, () => { hold = true; }, { passive: true }));
    row.addEventListener('pointerleave', () => { hold = false; });
    row.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); hold = true; row.scrollBy({ left: d * tiles[0].offsetWidth, behavior: still ? 'instant' : 'smooth' }); } });
    // start with the middle work in the centre
    const m = tiles[Math.floor(tiles.length / 2)];
    row.scrollLeft = m.offsetLeft + m.offsetWidth / 2 - row.clientWidth / 2;
    shape();
    if (!still) {
      if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => { seen = e.isIntersecting; }), { threshold: 0.3 }).observe(root); else seen = true;
      raf = requestAnimationFrame(drift);
    }
    return { relabel: label };
  }
  return { mount };
})();
