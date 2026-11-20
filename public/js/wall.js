'use strict';
(() => {
  const tool = $('#wallTool'), stage = $('#wallStage'), video = $('#wallVideo'), photo = $('#wallPhoto'), art = $('#wallArt'), artImg = $('#wallArtImg');
  const size = $('#wallSize'), out = $('#wallSizeOut'), hint = $('#wallHint'), marks = $('#wallMarks'), strip = $('#wallStrip'), ownIn = $('#ownIn');
  const TX = {
    fa: { approx: 'تقریبی', exact: 'اندازهٔ واقعی', own: 'اثر خودم', drag: 'اثر را با انگشت جابه‌جا کنید. برای اندازهٔ واقعی، یک برگهٔ A4 را روی دیوار بگیرید.', cal1: 'یک برگهٔ A4 را صاف روی دیوار بگیرید و روی یک سرِ ضلع بلند آن بزنید.', cal2: 'حالا روی سرِ دیگرِ همان ضلع بزنید.', calOk: 'اندازه تنظیم شد. اثر حالا در اندازهٔ واقعی است، تا وقتی از همین فاصله نگاه کنید.', nocam: 'دوربین باز نشد. اجازهٔ دوربین را بدهید، یا یک عکس از دیوارتان انتخاب کنید.', saved: 'تصویر ذخیره شد.' },
    en: { approx: 'approximate', exact: 'true size', own: 'My own work', drag: 'Drag the work with your finger. For true size, hold an A4 sheet on the wall.', cal1: 'Hold an A4 sheet flat on the wall and tap one end of its long side.', cal2: 'Now tap the other end of the same side.', calOk: 'Size is set. The work is now at true size, as long as you stay at this distance.', nocam: "The camera didn't open. Allow camera access, or choose a photo of your wall.", saved: 'Picture saved.' },
  };
  const t = (k) => TX[Hooma.lang][k];
  // the space analysis, drawn over the camera or the wall photo
  stage.insertAdjacentHTML('beforeend', '<div class="lv-dim"></div><canvas class="lv-edges"></canvas><div class="lv-scanline"></div><div class="lv-cells"></div><div class="lv-wall"><span class="lv-tag glass"></span></div><p class="lv-step glass" aria-live="polite" hidden></p>');
  const fx = { edges: stage.querySelector('.lv-edges'), cells: stage.querySelector('.lv-cells'), wall: stage.querySelector('.lv-wall'), tag: stage.querySelector('.lv-tag'), step: stage.querySelector('.lv-step'), run: 0 };
  const FX = {
    fa: { s1: 'تحلیل فضا: یافتن لبه‌ها', s2: 'یافتن سطح صاف دیوار', s3: 'خواندن نور اتاق', s4: 'جای‌گذاری اثر', wall: 'دیوار', light: (l, w, d) => 'نور ' + l + '، ' + w + '، ' + d, lv: ['روشن', 'ملایم', 'کم'], wm: ['گرم', 'سرد', 'خنثی'], dr: ['از راست', 'از چپ', 'یکنواخت'] },
    en: { s1: 'Analysing the space: finding edges', s2: 'Finding the flat wall surface', s3: 'Reading the light in the room', s4: 'Hanging the work', wall: 'Wall', light: (l, w, d) => l + ' ' + w + ' light, ' + d, lv: ['bright', 'soft', 'low'], wm: ['warm', 'cool', 'neutral'], dr: ['from the right', 'from the left', 'even'] },
  };
  const fxWait = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
  const fxSay = (k) => { fx.step.textContent = k ? FX[Hooma.lang][k] : ''; fx.step.hidden = !k; };
  async function analyse(src) {
    if (!window.HoomaLive || !HoomaLive.analyse) return;
    const run = ++fx.run, a = HoomaLive.analyse(src, stage.clientWidth / stage.clientHeight || 0.6, null);
    if (!a) return;
    const T = FX[Hooma.lang]; say('');
    stage.classList.remove('lv-scan', 'lv-found', 'lv-lit', 'lv-placed'); art.style.opacity = '0';
    fx.edges.width = a.edges.width; fx.edges.height = a.edges.height; fx.edges.getContext('2d').drawImage(a.edges, 0, 0);
    fx.cells.innerHTML = a.cells.map(([x, y], i) => '<i style="left:' + x * 100 + '%;top:' + y * 100 + '%;--d:' + (i % 24) * 18 + 'ms"></i>').join('');
    Object.assign(fx.wall.style, { left: a.box[0] * 100 + '%', top: a.box[1] * 100 + '%', width: (a.box[2] - a.box[0]) * 100 + '%', height: (a.box[3] - a.box[1]) * 100 + '%' });
    const lv = a.lum > 0.62 ? 0 : a.lum > 0.38 ? 1 : 2, wm = a.warm > 0.05 ? 0 : a.warm < -0.02 ? 1 : 2, dr = a.dir > 0 ? 0 : a.dir < 0 ? 1 : 2;
    fx.tag.innerHTML = '<b>' + T.wall + '</b> ' + T.light(T.lv[lv], T.wm[wm], T.dr[dr]);
    void stage.offsetWidth; stage.classList.add('lv-scan'); fxSay('s1');
    await fxWait(1250); if (run !== fx.run) return;
    stage.classList.add('lv-found'); fxSay('s2');
    await fxWait(900); if (run !== fx.run) return;
    stage.classList.add('lv-lit'); fxSay('s3');
    await fxWait(800); if (run !== fx.run) return;
    // hang the work at the centre of the wall, sized to fit it, unless the visitor has calibrated true size
    const bw = a.box[2] - a.box[0];
    S.x = (a.box[0] + a.box[2]) / 2; S.y = (a.box[1] + a.box[3]) / 2;
    if (!S.calibrated) { const bh = (a.box[3] - a.box[1]) * stage.clientHeight / (stage.clientWidth / 300); S.cm = Math.max(30, Math.min(220, bw * 300 * 0.78, bh * 0.78 * S.ratio)); size.value = S.cm; }
    layout(); fxSay('s4'); stage.classList.add('lv-placed'); art.style.opacity = '';
    await fxWait(1400); if (run !== fx.run) return;
    stage.classList.remove('lv-scan'); fxSay(); say('drag', 6000);
  }
  function stopFx() { fx.run++; stage.classList.remove('lv-scan', 'lv-found', 'lv-lit', 'lv-placed'); art.style.opacity = ''; fxSay(); }
  const S = { ppc: 0, calibrated: false, cm: 100, ratio: 1.5, x: 0.5, y: 0.42, src: '', id: null, own: null, stream: null, cal: null, title: '' };

  const basePpc = () => stage.clientWidth / 300; // assume about 3 m of wall in view until calibrated
  function layout() {
    const ppc = S.calibrated ? S.ppc : basePpc(); const w = S.cm * ppc, h = w / S.ratio;
    art.style.width = w + 'px'; art.style.height = h + 'px'; art.style.left = S.x * 100 + '%'; art.style.top = S.y * 100 + '%';
    out.textContent = `${Hooma.num(Math.round(S.cm))} × ${Hooma.num(Math.round(S.cm / S.ratio))} ${Hooma.t('cm')} · ${S.calibrated ? t('exact') : t('approx')}`;
  }
  function say(k, ms) { hint.textContent = k ? t(k) : ''; clearTimeout(say.t); if (ms) say.t = setTimeout(() => { hint.textContent = ''; }, ms); }

  function setWork(id) {
    const w = Hooma.find(id) || Hooma.works[0]; if (!w) return;
    S.id = w.id; S.src = w.img; S.ratio = w.ratio || 1.5; S.title = Hooma.L(w.title); if (w.w) S.cm = w.w;
    artImg.src = w.img; artImg.onload = () => { S.ratio = artImg.naturalWidth / artImg.naturalHeight; layout(); };
    size.value = S.cm; buildStrip(); layout();
  }
  function setOwn(file) {
    if (S.own) URL.revokeObjectURL(S.own); S.own = URL.createObjectURL(file); S.ownFile = file; S.id = 'own'; S.src = S.own; S.title = t('own');
    artImg.onload = () => { S.ratio = artImg.naturalWidth / artImg.naturalHeight; layout(); }; artImg.src = S.own; buildStrip();
  }
  function buildStrip() {
    strip.innerHTML = `<button type="button" class="own" data-pick="own" aria-pressed="${S.id === 'own'}">${S.own ? `<img src="${S.own}" alt="">` : '+ ' + Hooma.esc(t('own'))}</button>` +
      Hooma.works.map((w) => `<button type="button" data-pick="${w.id}" aria-pressed="${S.id === w.id}" aria-label="${Hooma.esc(Hooma.L(w.title))}"><img src="${w.img}" alt=""></button>`).join('');
    if (S.own) strip.firstChild.classList.remove('own');
    $('#wallSend').hidden = S.id !== 'own';
  }
  strip.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; if (b.dataset.pick === 'own') { if (S.own && S.id !== 'own') { S.id = 'own'; S.src = S.own; artImg.src = S.own; buildStrip(); } else ownIn.click(); } else setWork(b.dataset.pick); });
  $('#wallSend').addEventListener('click', () => { if (S.ownFile) Hooma.sendOwnWork(S.ownFile); });
  ownIn.addEventListener('change', () => { if (ownIn.files[0]) setOwn(ownIn.files[0]); ownIn.value = ''; });
  size.addEventListener('input', () => { S.cm = +size.value; layout(); });

  /* drag + pinch */
  const pts = new Map(); let pinch0 = 0, cm0 = 0, drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (S.cal) return; pts.set(e.pointerId, e);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); cm0 = S.cm; drag = null; }
    else if (e.target.closest('#wallArt')) { const r = stage.getBoundingClientRect(); drag = { dx: e.clientX - (r.left + S.x * r.width), dy: e.clientY - (r.top + S.y * r.height) }; art.classList.add('dragging'); stage.setPointerCapture(e.pointerId); }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); S.cm = Math.max(20, Math.min(250, cm0 * d / pinch0)); size.value = S.cm; layout(); }
    else if (drag) { const r = stage.getBoundingClientRect(); S.x = Math.max(0.02, Math.min(0.98, (e.clientX - drag.dx - r.left) / r.width)); S.y = Math.max(0.02, Math.min(0.98, (e.clientY - drag.dy - r.top) / r.height)); layout(); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; if (!pts.size) { drag = null; art.classList.remove('dragging'); } };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);

  /* calibration with an A4 sheet (long side 29.7 cm) */
  $('#wallCal').addEventListener('click', () => { stopFx(); S.cal = []; marks.innerHTML = ''; art.style.pointerEvents = 'none'; art.style.opacity = .35; $('#wallCal').setAttribute('aria-pressed', 'true'); say('cal1'); });
  stage.addEventListener('click', (e) => {
    if (!S.cal) return; const r = stage.getBoundingClientRect(); const p = { x: e.clientX - r.left, y: e.clientY - r.top }; S.cal.push(p);
    const m = document.createElement('i'); m.style.left = p.x + 'px'; m.style.top = p.y + 'px'; marks.appendChild(m);
    if (S.cal.length === 1) return say('cal2');
    const d = Math.hypot(S.cal[0].x - S.cal[1].x, S.cal[0].y - S.cal[1].y); endCal();
    if (d > 12) { S.ppc = d / 29.7; S.calibrated = true; say('calOk', 6000); } layout();
  });
  function endCal() { S.cal = null; art.style.pointerEvents = ''; art.style.opacity = ''; $('#wallCal').setAttribute('aria-pressed', 'false'); setTimeout(() => { marks.innerHTML = ''; }, 1200); }

  /* camera / photo */
  function stopCam() { if (S.stream) S.stream.getTracks().forEach((x) => x.stop()); S.stream = null; video.classList.remove('on'); video.srcObject = null; $('#wallCam').setAttribute('aria-pressed', 'false'); }
  async function startCam() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
      if (tool.hidden) { s.getTracks().forEach((x) => x.stop()); return; }
      S.stream = s; video.srcObject = s; await video.play(); video.classList.add('on'); photo.hidden = true; S.calibrated = false; $('#wallCam').setAttribute('aria-pressed', 'true'); layout(); setTimeout(() => { if (S.stream) analyse(video); }, 700);
    } catch { stopCam(); say('nocam', 9000); }
  }
  $('#wallCam').addEventListener('click', () => (S.stream ? stopCam() : startCam()));
  $('#wallPhotoIn').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; stopCam(); if (photo.src) URL.revokeObjectURL(photo.src); photo.src = URL.createObjectURL(f); photo.hidden = false; S.calibrated = false; layout(); photo.onload = () => { photo.onload = null; analyse(photo); }; e.target.value = ''; });

  /* save a picture */
  function cover(ctx, el, sw, sh, W, H) { const k = Math.max(W / sw, H / sh); ctx.drawImage(el, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k); }
  $('#wallSave').addEventListener('click', async () => {
    const r = stage.getBoundingClientRect(); const k = Math.min(3, Math.max(2, window.devicePixelRatio || 1)); const W = Math.round(r.width * k), H = Math.round(r.height * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (S.stream && video.videoWidth) cover(x, video, video.videoWidth, video.videoHeight, W, H);
    else if (!photo.hidden && photo.naturalWidth) cover(x, photo, photo.naturalWidth, photo.naturalHeight, W, H);
    else { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dcd9d0'); g.addColorStop(.72, '#bdbab1'); g.addColorStop(1, '#8d8a82'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    const a = art.getBoundingClientRect(); const ax = (a.left - r.left) * k, ay = (a.top - r.top) * k, aw = a.width * k, ah = a.height * k, pad = aw * 0.016;
    x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 26 * k; x.shadowOffsetY = 14 * k; x.fillStyle = '#fff'; x.fillRect(ax, ay, aw, ah); x.restore();
    x.drawImage(artImg, ax + pad, ay + pad, aw - 2 * pad, ah - 2 * pad);
    x.font = `600 ${15 * k}px Vazir, sans-serif`; x.fillStyle = 'rgba(255,255,255,.92)'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 6 * k; x.textAlign = 'left'; x.fillText('hoomaart.ir', 14 * k, H - 14 * k);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9)); if (!blob) return;
    const file = new File([blob], 'hooma-art-wall.jpg', { type: 'image/jpeg' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) { await navigator.share({ files: [file], title: 'Hooma Art' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = file.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); say('saved', 3000);
  });

  tool.addEventListener('hooma:close', () => { stopCam(); stopFx(); if (S.cal) endCal(); say(''); });
  window.addEventListener('resize', () => { if (!tool.hidden) layout(); });
  document.addEventListener('hooma:lang', () => { if (!tool.hidden) { buildStrip(); layout(); } });

  Hooma.openWall = (id, own) => {
    Hooma.hideAll(false); Hooma.show(tool); S.x = 0.5; S.y = 0.42; S.calibrated = false; S.cm = 100; Hooma.track(own ? 'own' : 'wall', own ? '' : (id || ''));
    if (own && !S.own) { setWork(id || S.id); ownIn.click(); } else if (own && S.own) { S.id = 'own'; artImg.src = S.own; buildStrip(); layout(); } else setWork(id || (S.id !== 'own' && S.id) || null);
    startCam();
  };
  Hooma._wall = S;
})();
