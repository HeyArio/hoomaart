'use strict';
// The wall tool, live on the page. When a space arrives (a client space, the visitor's camera or a photo of their
// wall) the picture is analysed on the device: edges are found, the largest flat wall area is located, and the
// strength, warmth and direction of the light are read. Each step is drawn on screen, then the work is hung on the
// wall and lit to match the room. Nothing leaves the device.
window.HoomaLive = (() => {
  const t = (fa, en) => '<span class="fa">' + fa + '</span><span class="en">' + en + '</span>';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Client spaces. x, y, w place the work (fractions of the picture); roi is the surveyed wall the search keeps to.
  const SPACES = [
    { img: '/img/spaces/room-living.jpg', fa: 'نشیمن', en: 'Living room', x: 0.492, y: 0.375, w: 0.25, roi: [0.3, 0.12, 0.7, 0.62] },
    { img: '/img/spaces/hall-empty.jpg', fa: 'سالن', en: 'Hall', x: 0.165, y: 0.55, w: 0.12, roi: [0.06, 0.42, 0.28, 0.66] },
    { img: '/img/spaces/room-classic.jpg', fa: 'تالار', en: 'Classical hall', x: 0.79, y: 0.6, w: 0.19, roi: [0.6, 0.42, 0.97, 0.78] },
  ];
  const track = (k) => { try { const b = JSON.stringify({ t: k, w: '' }); if (!(navigator.sendBeacon && navigator.sendBeacon('/api/event', new Blob([b], { type: 'application/json' })))) fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b, keepalive: true }).catch(() => {}); } catch {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));

  /* ---------- analysis ---------- */
  function analyse(src, aspect, roi) {
    const W = 320, H = Math.max(80, Math.round(W / aspect));
    const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
    if (!sw || !sh) return null;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const k = Math.max(W / sw, H / sh); // same crop as object-fit: cover
    cx.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
    const px = cx.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    // Sobel edges
    const G = new Float32Array(W * H); let gmax = 1;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1] + L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1];
      const gy = -L[i - W - 1] - 2 * L[i - W] - L[i - W + 1] + L[i + W - 1] + 2 * L[i + W] + L[i + W + 1];
      const g = Math.sqrt(gx * gx + gy * gy); G[i] = g; if (g > gmax) gmax = g;
    }
    // edge picture for the overlay
    const ec = document.createElement('canvas'); ec.width = W; ec.height = H;
    const ex = ec.getContext('2d'), ed = ex.createImageData(W, H), thr = gmax * 0.12;
    for (let i = 0; i < W * H; i++) if (G[i] > thr) { const a = Math.min(255, (G[i] / gmax) * 520); ed.data[i * 4] = ed.data[i * 4 + 1] = ed.data[i * 4 + 2] = 255; ed.data[i * 4 + 3] = a; }
    ex.putImageData(ed, 0, 0);
    // flat cells: low edge energy, neither black nor blown out
    const cols = 18, rows = Math.max(8, Math.round(cols / aspect)), cw = W / cols, ch = H / rows;
    const cell = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let g = 0, l = 0, n = 0;
      for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) { g += G[y * W + x]; l += L[y * W + x]; n++; }
      cell.push({ r, c, g: g / n, l: l / n / 255 });
    }
    const sorted = cell.map((q) => q.g).sort((a, b) => a - b), tFlat = sorted[Math.floor(sorted.length * 0.5)];
    const inRoi = (q) => !roi || ((q.c + 0.5) / cols >= roi[0] && (q.c + 0.5) / cols <= roi[2] && (q.r + 0.5) / rows >= roi[1] && (q.r + 0.5) / rows <= roi[3]);
    const flat = cell.map((q) => q.g <= tFlat && q.l > 0.12 && q.l < 0.985 && (q.r + 0.5) / rows > (roi ? 0 : 0.16) && (q.r + 0.5) / rows < (roi ? 1 : 0.72) && inRoi(q));
    // largest connected flat area, preferring the upper part of the picture (walls stand above floors)
    const seen = new Uint8Array(cell.length); let best = null;
    for (let i = 0; i < cell.length; i++) {
      if (!flat[i] || seen[i]) continue;
      const comp = [], stack = [i]; seen[i] = 1;
      while (stack.length) {
        const j = stack.pop(); comp.push(j); const r = Math.floor(j / cols), c = j % cols;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => { if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return; const q = rr * cols + cc; if (flat[q] && !seen[q]) { seen[q] = 1; stack.push(q); } });
      }
      const cy = comp.reduce((s, j) => s + Math.floor(j / cols), 0) / comp.length / rows;
      const cx = comp.reduce((s, j) => s + (j % cols), 0) / comp.length / cols;
      const score = comp.length * (1.2 - Math.abs(cy - 0.42) * 1.6) * (1.1 - Math.abs(cx - 0.5) * 0.5);
      if (!best || score > best.score) best = { comp, score };
    }
    let box;
    if (best && best.comp.length >= 3) {
      const rs = best.comp.map((j) => Math.floor(j / cols)), cs = best.comp.map((j) => j % cols);
      box = [Math.min(...cs) / cols, Math.min(...rs) / rows, (Math.max(...cs) + 1) / cols, (Math.max(...rs) + 1) / rows];
    } else box = roi ? roi.slice() : [0.3, 0.18, 0.7, 0.62];
    // the light on that wall
    const X0 = Math.floor(box[0] * W), Y0 = Math.floor(box[1] * H), X1 = Math.ceil(box[2] * W), Y1 = Math.ceil(box[3] * H), mid = (X0 + X1) / 2;
    let R = 0, Gc = 0, B = 0, n = 0, left = 0, nl = 0, right = 0, nr = 0;
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
      const i = y * W + x; R += px[i * 4]; Gc += px[i * 4 + 1]; B += px[i * 4 + 2]; n++;
      if (x < mid) { left += L[i]; nl++; } else { right += L[i]; nr++; }
    }
    R /= n; Gc /= n; B /= n;
    const lum = (0.2126 * R + 0.7152 * Gc + 0.0722 * B) / 255, warm = (R - B) / 255, lr = (right / Math.max(1, nr) - left / Math.max(1, nl)) / 255;
    return { edges: ec, cells: best ? best.comp.map((j) => [(j % cols + 0.5) / cols, (Math.floor(j / cols) + 0.5) / rows]) : [], box, lum, warm, dir: lr > 0.04 ? 1 : lr < -0.04 ? -1 : 0, rgb: [R, Gc, B].map(Math.round), cols, rows };
  }

  /* ---------- the tool ---------- */
  function mount(root, works, opts) {
    if (!root || !works.length) return;
    opts = opts || {};
    root.classList.add('live');
    root.innerHTML =
      '<div class="lv-stage"><img class="lv-bg" alt=""><video class="lv-video" playsinline muted hidden></video>' +
        '<div class="lv-dim"></div><canvas class="lv-edges"></canvas><div class="lv-scanline"></div><div class="lv-cells"></div>' +
        '<div class="lv-wall"><span class="lv-tag glass"></span></div>' +
        '<div class="lv-art"><img alt="" draggable="false"><i class="lv-tint"></i></div>' +
        '<div class="lv-spaces glass" role="group">' + SPACES.map((s, i) => '<button type="button" data-space="' + i + '">' + t(s.fa, s.en) + '</button>').join('') +
          '<button type="button" data-cam>' + t('دوربین من', 'My camera') + '</button>' +
          '<label>' + t('عکس دیوار من', 'A photo of my wall') + '<input type="file" accept="image/*" hidden data-wall></label></div>' +
        '<p class="lv-step glass" aria-live="polite" hidden></p>' +
        '<button type="button" class="lv-again glass" data-again hidden>' + t('تحلیل دوباره', 'Analyse again') + '</button>' +
        '<p class="lv-credit">' + t('فضا: Divan Development', 'Space: Divan Development') + '</p></div>' +
      '<div class="lv-bar"><div class="lv-strip">' +
          (opts.own ? '<label class="lv-own">' + t('+ اثر خودم', '+ My own work') + '<input type="file" accept="image/*" hidden data-own></label>' : '') +
          works.map((w, i) => '<button type="button" data-work="' + i + '"><img loading="lazy" src="' + w.img + '" alt=""></button>').join('') + '</div>' +
        '<label class="lv-size">' + t('اندازه', 'Size') + '<input type="range" min="6" max="60" step="0.5"></label>' +
        '<a class="btn sm" href="/wall">' + t('اندازهٔ واقعی، تمام‌صفحه', 'True size, full screen') + '</a></div>' +
      '<ol class="lv-how">' +
        '<li><b>' + t('فضا را می‌خوانیم', 'We read the space') + '</b>' + t('لبه‌ها، سطح صاف دیوار، و شدت، گرمی و جهت نور، روی همین دستگاه تحلیل می‌شوند.', 'Edges, the flat surface of the wall, and the strength, warmth and direction of the light are analysed on this device.') + '</li>' +
        '<li><b>' + t('اثر را روی دیوار می‌گذاریم', 'We hang the work on the wall') + '</b>' + t('اثر در مرکز دیوار می‌نشیند و نور و سایه‌اش با اتاق هماهنگ می‌شود. می‌توانید جابه‌جایش کنید.', 'The work sits at the centre of the wall, its light and shadow matched to the room. You can move it.') + '</li>' +
        '<li><b>' + t('شما تصمیم می‌گیرید', 'You decide') + '</b>' + t('اگر به فضا نشست، درخواست بازدید خصوصی بفرستید. تصویر شما از دستگاهتان خارج نمی‌شود.', 'If it suits the space, request a private viewing. Your picture never leaves your device.') + '</li></ol>';

    const $ = (s) => root.querySelector(s);
    const stage = $('.lv-stage'), bg = $('.lv-bg'), video = $('.lv-video'), art = $('.lv-art'), artImg = art.querySelector('img'), tint = $('.lv-tint');
    const edgesCv = $('.lv-edges'), cellsEl = $('.lv-cells'), wallEl = $('.lv-wall'), tag = $('.lv-tag'), step = $('.lv-step'), again = $('.lv-again'), size = $('.lv-size input');
    const S = { x: 0.5, y: 0.4, w: 0.25, stream: null, own: null, wall: null, touched: false, run: 0, space: 0 };
    const lay = () => { art.style.left = S.x * 100 + '%'; art.style.top = S.y * 100 + '%'; art.style.width = S.w * 100 + '%'; size.value = S.w * 100; };
    const press = (sel, el) => root.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    const say = (fa, en) => { step.innerHTML = fa ? t(fa, en) : ''; step.hidden = !fa; };
    function stopCam() { if (S.stream) S.stream.getTracks().forEach((x) => x.stop()); S.stream = null; video.hidden = true; video.srcObject = null; }
    function clearScan() { stage.classList.remove('lv-scan', 'lv-found', 'lv-lit', 'lv-placed'); cellsEl.innerHTML = ''; }

    // Light the work like the room: brightness from the wall, a faint wash of its colour, the shadow away from the light.
    function light(a) {
      art.style.setProperty('--lb', Math.max(0.78, Math.min(1.06, 0.68 + a.lum * 0.45)).toFixed(3));
      tint.style.background = 'rgb(' + a.rgb.join(',') + ')';
      art.style.setProperty('--sx', (a.dir * -12) + 'px');
    }
    function describe(a) {
      const warm = a.warm > 0.05 ? ['گرم', 'warm'] : a.warm < -0.02 ? ['سرد', 'cool'] : ['خنثی', 'neutral'];
      const dir = a.dir > 0 ? ['از راست', 'from the right'] : a.dir < 0 ? ['از چپ', 'from the left'] : ['یکنواخت', 'even'];
      const lvl = a.lum > 0.62 ? ['روشن', 'bright'] : a.lum > 0.38 ? ['ملایم', 'soft'] : ['کم', 'low'];
      tag.innerHTML = '<b>' + t('دیوار', 'Wall') + '</b> ' + t('نور ' + lvl[0] + '، ' + warm[0] + '، ' + dir[0], lvl[1] + ' ' + warm[1] + ' light, ' + dir[1]);
    }
    // The analysis, step by step on screen.
    async function scan(src, place) {
      const run = ++S.run, aspect = stage.clientWidth / stage.clientHeight || 1.5;
      const roi = place ? place.roi : null;
      const a = analyse(src, aspect, roi);
      if (!a || run !== S.run) return;
      clearScan(); again.hidden = true; art.classList.add('out');
      edgesCv.width = a.edges.width; edgesCv.height = a.edges.height; edgesCv.getContext('2d').drawImage(a.edges, 0, 0);
      cellsEl.innerHTML = a.cells.map(([x, y], i) => '<i style="left:' + x * 100 + '%;top:' + y * 100 + '%;--d:' + (i % 24) * 18 + 'ms"></i>').join('');
      wallEl.style.left = a.box[0] * 100 + '%'; wallEl.style.top = a.box[1] * 100 + '%'; wallEl.style.width = (a.box[2] - a.box[0]) * 100 + '%'; wallEl.style.height = (a.box[3] - a.box[1]) * 100 + '%';
      describe(a); light(a);
      void stage.offsetWidth; stage.classList.add('lv-scan');
      say('تحلیل فضا: یافتن لبه‌ها', 'Analysing the space: finding edges');
      await sleep(1250); if (run !== S.run) return;
      stage.classList.add('lv-found'); say('یافتن سطح صاف دیوار', 'Finding the flat wall surface');
      await sleep(900); if (run !== S.run) return;
      stage.classList.add('lv-lit'); say('خواندن نور اتاق', 'Reading the light in the room');
      await sleep(800); if (run !== S.run) return;
      if (place) { S.x = place.x; S.y = place.y; S.w = place.w; }
      else {
        const bw = a.box[2] - a.box[0], bh = a.box[3] - a.box[1], r = (works[S.work] && works[S.work].ratio) || 1.5;
        S.w = Math.max(0.12, Math.min(0.5, bw * 0.55, (bh * 0.62 * stage.clientHeight * r) / stage.clientWidth));
        S.x = (a.box[0] + a.box[2]) / 2; S.y = a.box[1] + bh * 0.45;
      }
      lay(); say('جای‌گذاری اثر', 'Hanging the work');
      stage.classList.add('lv-placed'); art.classList.remove('out');
      await sleep(1400); if (run !== S.run) return;
      stage.classList.remove('lv-scan'); say(); again.hidden = false;
    }
    function whenReady(img, fn) { if (img.complete && img.naturalWidth) fn(); else img.onload = () => { img.onload = null; fn(); }; }
    function setSpace(i) {
      const s = SPACES[i]; S.space = i; stopCam(); bg.hidden = false; $('.lv-credit').hidden = false; press('.lv-spaces button', $('[data-space="' + i + '"]'));
      bg.src = s.img; whenReady(bg, () => scan(bg, s));
    }
    function setWork(i) { S.work = i; artImg.src = works[i].img; press('.lv-strip button', $('[data-work="' + i + '"]')); }
    async function cam(btn) {
      // phones go to the full-screen tool, which has the true-size measurement; a desktop webcam runs here
      if (matchMedia('(pointer:coarse)').matches) { location.href = '/wall'; return; }
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
        stopCam(); S.stream = st; video.srcObject = st; await video.play(); video.hidden = false; bg.hidden = true; $('.lv-credit').hidden = true; press('.lv-spaces button', btn); S.space = -1;
        setTimeout(() => { if (S.stream) scan(video, null); }, 700);
      } catch { clearScan(); say('دوربین باز نشد. اجازهٔ دوربین را بدهید، یا عکسی از دیوارتان انتخاب کنید.', "The camera didn't open. Allow camera access, or choose a photo of your wall."); }
    }
    function touched() { if (!S.touched) { S.touched = true; track('wall'); } }
    root.addEventListener('click', (e) => {
      const sp = e.target.closest('[data-space]'); if (sp) return setSpace(+sp.dataset.space);
      const c = e.target.closest('[data-cam]'); if (c) return cam(c);
      if (e.target.closest('[data-again]')) return S.stream ? scan(video, null) : S.space >= 0 ? scan(bg, SPACES[S.space]) : scan(bg, null);
      const w = e.target.closest('[data-work]'); if (w) { setWork(+w.dataset.work); touched(); }
    });
    root.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (e.target.matches('[data-wall]')) {
        stopCam(); if (S.wall) URL.revokeObjectURL(S.wall); S.wall = URL.createObjectURL(f); S.space = -1;
        bg.hidden = false; $('.lv-credit').hidden = true; press('.lv-spaces button', null); bg.src = S.wall; whenReady(bg, () => scan(bg, null)); touched();
      }
      if (e.target.matches('[data-own]')) { if (S.own) URL.revokeObjectURL(S.own); S.own = URL.createObjectURL(f); artImg.src = S.own; press('.lv-strip button', null); track('own'); }
      e.target.value = '';
    });
    size.addEventListener('input', () => { S.w = size.value / 100; lay(); touched(); });
    let drag = null;
    art.addEventListener('pointerdown', (e) => { const r = stage.getBoundingClientRect(); drag = { dx: e.clientX - (r.left + S.x * r.width), dy: e.clientY - (r.top + S.y * r.height) }; art.setPointerCapture(e.pointerId); art.classList.add('drag'); touched(); });
    art.addEventListener('pointermove', (e) => { if (!drag) return; const r = stage.getBoundingClientRect(); S.x = Math.max(0.03, Math.min(0.97, (e.clientX - drag.dx - r.left) / r.width)); S.y = Math.max(0.05, Math.min(0.95, (e.clientY - drag.dy - r.top) / r.height)); lay(); });
    const up = () => { drag = null; art.classList.remove('drag'); };
    art.addEventListener('pointerup', up); art.addEventListener('pointercancel', up);
    art.tabIndex = 0; art.setAttribute('role', 'img');
    art.addEventListener('keydown', (e) => { const k = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key]; if (!k) return; e.preventDefault(); S.x = Math.max(0.03, Math.min(0.97, S.x + k[0])); S.y = Math.max(0.05, Math.min(0.95, S.y + k[1])); lay(); });
    addEventListener('pagehide', stopCam);
    setWork(0);
    // start the first analysis when the tool comes into view, so the visitor sees it happen
    const start = () => setSpace(0);
    if ('IntersectionObserver' in window && !still) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { threshold: 0.45 }); io.observe(stage); bg.src = SPACES[0].img; }
    else start();
  }
  return { mount };
})();
