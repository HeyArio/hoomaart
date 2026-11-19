'use strict';
(() => {
  const tool = $('#scanTool'), stage = $('#scanStage'), video = $('#scanVideo'), hint = $('#scanHint');
  const TX = {
    fa: { aim: 'اثر را داخل کادر قرار دهید.', looking: 'در حال جست‌وجو در مجموعه…', found: 'اثر پیدا شد.' },
    en: { aim: 'Fit the work inside the frame.', looking: 'Searching the collection…', found: 'Work found.' },
  };
  const t = (k) => TX[Hooma.lang][k];
  const N = 16, c16 = document.createElement('canvas'); c16.width = c16.height = N; const x16 = c16.getContext('2d', { willReadFrequently: true });
  const qc = document.createElement('canvas'); const qx = qc.getContext('2d', { willReadFrequently: true });
  let stream = null, timer = null, sigs = null, streak = { id: null, n: 0 }, current = null;

  /* A small signature of an image region: a coarse colour histogram plus an 8x8 brightness layout. */
  function sig(src, sx, sy, sw, sh) {
    x16.drawImage(src, sx, sy, sw, sh, 0, 0, N, N); const d = x16.getImageData(0, 0, N, N).data;
    const hist = new Float32Array(64), lum = new Float32Array(64); let mean = 0;
    for (let i = 0; i < N * N; i++) mean += (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / (N * N);
    const gain = 118 / Math.max(mean, 12); // even out exposure before comparing colours
    for (let i = 0; i < N * N; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const q = (v) => { const u = Math.min(255, v * gain) / 64 - 0.5; const lo = Math.max(0, Math.min(3, Math.floor(u))); return [lo, Math.min(3, lo + 1), Math.max(0, Math.min(1, u - lo))]; };
      const [r0, r1, rf] = q(r), [g0, g1, gf] = q(g), [b0, b1, bf] = q(b); const wgt = 1 / (N * N);
      for (const [ri, rw] of [[r0, 1 - rf], [r1, rf]]) for (const [gi, gw] of [[g0, 1 - gf], [g1, gf]]) for (const [bi, bw] of [[b0, 1 - bf], [b1, bf]]) hist[ri * 16 + gi * 4 + bi] += wgt * rw * gw * bw;
      lum[((i / N | 0) >> 1) * 8 + ((i % N) >> 1)] += (0.299 * r + 0.587 * g + 0.114 * b) / 4;
    }
    let norm = 0; for (let i = 0; i < 64; i++) { lum[i] -= mean; norm += lum[i] * lum[i]; } norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 64; i++) lum[i] /= norm;
    return { hist, lum, contrast: norm / 8 };
  }
  function score(a, b) {
    let h = 0, c = 0; for (let i = 0; i < 64; i++) { h += Math.min(a.hist[i], b.hist[i]); c += a.lum[i] * b.lum[i]; }
    return 0.35 * h + 0.65 * Math.max(0, c);
  }
  async function buildSigs() {
    const out = [];
    for (const w of Hooma.works) {
      try { const img = new Image(); img.src = w.img; await img.decode(); out.push({ id: w.id, ratio: img.naturalWidth / img.naturalHeight, s: sig(img, 0, 0, img.naturalWidth, img.naturalHeight) }); } catch {}
    }
    return out;
  }
  /* Compare the centre of a frame against every work, cropping to each work's own proportions at a few sizes. */
  const SCALES = [0.74, 0.86, 1, 1.14];
  function matchFrame(src, fw, fh, box) {
    const per = [];
    for (const w of sigs) {
      let bw = box.w, bh = bw / w.ratio; if (bh > box.h) { bh = box.h; bw = bh * w.ratio; }
      let v = 0;
      for (const k of SCALES) { const s = sig(src, box.cx - bw * k / 2, box.cy - bh * k / 2, bw * k, bh * k); if (s.contrast >= 6) v = Math.max(v, score(s, w.s)); }
      per.push({ id: w.id, v });
    }
    per.sort((a, b) => b.v - a.v);
    return per[0] && per[0].v >= TH && per[0].v - (per[1] ? per[1].v : 0) >= MARGIN ? per[0] : null;
  }
  const TH = 0.72, MARGIN = 0.12;
  Hooma._scan = { sig, score, buildSigs, matchFrame, setSigs: (s) => { sigs = s; } };

  function visibleBox() { // the part of the camera frame that sits inside the on-screen brackets
    const vw = video.videoWidth, vh = video.videoHeight, r = stage.getBoundingClientRect(); const k = Math.max(r.width / vw, r.height / vh);
    const f = $('.frame', stage).getBoundingClientRect();
    return { cx: vw / 2, cy: vh / 2, w: f.width / k, h: f.height / k };
  }
  function tick() {
    if (!stream || current || video.readyState < 2 || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (window.jsQR) { // the marker beside a work
      const k = Math.min(1, 640 / Math.max(vw, vh)); qc.width = vw * k | 0; qc.height = vh * k | 0; qx.drawImage(video, 0, 0, qc.width, qc.height);
      const code = jsQR(qx.getImageData(0, 0, qc.width, qc.height).data, qc.width, qc.height, { inversionAttempts: 'dontInvert' });
      const m = code && /\/w\/([a-z0-9-]+)/.exec(code.data); if (m && Hooma.find(m[1])) return show(m[1]);
    }
    if (!sigs) return;
    const hit = matchFrame(video, vw, vh, visibleBox());
    if (hit && hit.id === streak.id) streak.n++; else streak = { id: hit ? hit.id : null, n: hit ? 1 : 0 };
    hint.textContent = streak.n ? t('looking') : t('aim');
    if (streak.n >= 4) show(streak.id);
  }
  function show(id) {
    const w = Hooma.find(id); if (!w) return; current = id; streak = { id: null, n: 0 }; hint.textContent = t('found');
    $('#scanFoundImg').src = w.img; $('#scanFoundTitle').textContent = Hooma.L(w.title); $('#scanFoundBy').textContent = Hooma.by(w);
    $('#scanFound').hidden = false; $('#scanNoCam').hidden = true; if (navigator.vibrate) navigator.vibrate(40); $('#scanView').focus();
  }
  $('#scanView').addEventListener('click', () => { const id = current; Hooma.openWork(id); });
  $('#scanAgain').addEventListener('click', () => { current = null; $('#scanFound').hidden = true; if (!stream) noCam(); else hint.textContent = t('aim'); });
  function noCam() {
    $('#scanNoCam').hidden = false; hint.textContent = ''; $('.frame', stage).hidden = true;
    $('#scanStrip').innerHTML = Hooma.works.map((w) => `<button type="button" data-scanpick="${w.id}" aria-label="${Hooma.esc(Hooma.L(w.title))}"><img src="${w.img}" alt=""></button>`).join('');
  }
  $('#scanStrip').addEventListener('click', (e) => { const b = e.target.closest('[data-scanpick]'); if (b) show(b.dataset.scanpick); });
  function stop() { clearInterval(timer); timer = null; if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; video.classList.remove('on'); video.srcObject = null; }
  tool.addEventListener('hooma:close', stop);

  Hooma.openScan = async () => {
    Hooma.hideAll(false); Hooma.show(tool); current = null; streak = { id: null, n: 0 };
    $('#scanFound').hidden = true; $('#scanNoCam').hidden = true; $('.frame', stage).hidden = false; hint.textContent = '';
    if (!sigs) buildSigs().then((s) => { sigs = s; });
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (tool.hidden) { s.getTracks().forEach((x) => x.stop()); return; }
      stream = s; video.srcObject = s; await video.play(); video.classList.add('on'); hint.textContent = t('aim'); timer = setInterval(tick, 220);
    } catch { stop(); noCam(); }
  };
})();
