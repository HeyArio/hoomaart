'use strict';
// The wall tool, live on the page. A visitor picks a space (a client space, their own camera, or a photo of
// their wall), picks a work, then drags and resizes it. Nothing leaves the device.
window.HoomaLive = (() => {
  const t = (fa, en) => '<span class="fa">' + fa + '</span><span class="en">' + en + '</span>';
  // where a work sits by default in each space: centre x, centre y, width (fractions of the picture)
  const SPACES = [
    { img: '/img/spaces/room-living.jpg', fa: 'نشیمن', en: 'Living room', x: 0.492, y: 0.375, w: 0.25 },
    { img: '/img/spaces/hall-empty.jpg', fa: 'سالن', en: 'Hall', x: 0.17, y: 0.55, w: 0.13 },
    { img: '/img/spaces/room-classic.jpg', fa: 'تالار', en: 'Classical hall', x: 0.78, y: 0.6, w: 0.2 },
  ];
  const track = (k) => { try { const b = JSON.stringify({ t: k, w: '' }); if (!(navigator.sendBeacon && navigator.sendBeacon('/api/event', new Blob([b], { type: 'application/json' })))) fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b, keepalive: true }).catch(() => {}); } catch {} };

  function mount(root, works, opts) {
    if (!root || !works.length) return;
    opts = opts || {};
    root.classList.add('live');
    root.innerHTML =
      '<div class="lv-stage" id="lvStage"><img class="lv-bg" alt=""><video class="lv-video" playsinline muted hidden></video>' +
        '<div class="lv-art"><img alt="" draggable="false"></div>' +
        '<div class="lv-spaces glass" role="group">' + SPACES.map((s, i) => '<button type="button" data-space="' + i + '">' + t(s.fa, s.en) + '</button>').join('') +
          '<button type="button" data-cam>' + t('دوربین من', 'My camera') + '</button>' +
          '<label>' + t('عکس دیوار من', 'A photo of my wall') + '<input type="file" accept="image/*" hidden data-wall></label></div>' +
        '<p class="lv-hint glass" hidden></p>' +
        '<p class="lv-credit">' + t('فضا: Divan Development', 'Space: Divan Development') + '</p></div>' +
      '<div class="lv-bar"><div class="lv-strip">' +
          (opts.own ? '<label class="lv-own">' + t('+ اثر خودم', '+ My own work') + '<input type="file" accept="image/*" hidden data-own></label>' : '') +
          works.map((w, i) => '<button type="button" data-work="' + i + '"><img loading="lazy" src="' + w.img + '" alt=""></button>').join('') + '</div>' +
        '<label class="lv-size">' + t('اندازه', 'Size') + '<input type="range" min="6" max="60" step="0.5"></label>' +
        '<a class="btn sm" href="/wall">' + t('اندازهٔ واقعی، تمام‌صفحه', 'True size, full screen') + '</a></div>' +
      '<ol class="lv-how">' +
        '<li><b>' + t('فضا را انتخاب کنید', 'Choose the space') + '</b>' + t('یکی از فضاهای ما، دوربین خودتان، یا عکسی از دیوار خانه‌تان.', 'One of our spaces, your own camera, or a photo of your wall at home.') + '</li>' +
        '<li><b>' + t('اثر را بگذارید', 'Place the work') + '</b>' + t('اثر را انتخاب کنید، با انگشت یا ماوس جابه‌جا کنید و اندازه‌اش را تغییر دهید.', 'Pick a work, drag it with a finger or the mouse, and change its size.') + '</li>' +
        '<li><b>' + t('تصمیم بگیرید', 'Decide') + '</b>' + t('اگر به فضا نشست، درخواست بازدید خصوصی بفرستید. تصویر شما روی دستگاه خودتان می‌ماند.', 'If it suits the space, request a private viewing. Your picture stays on your own device.') + '</li></ol>';

    const $ = (s) => root.querySelector(s);
    const stage = $('.lv-stage'), bg = $('.lv-bg'), video = $('.lv-video'), art = $('.lv-art'), artImg = art.firstChild, size = $('.lv-size input'), hint = $('.lv-hint');
    const S = { x: 0.5, y: 0.4, w: 0.25, stream: null, own: null, wall: null, touched: false };
    const lay = () => { art.style.left = S.x * 100 + '%'; art.style.top = S.y * 100 + '%'; art.style.width = S.w * 100 + '%'; size.value = S.w * 100; };
    const press = (sel, el) => root.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    const say = (fa, en) => { hint.innerHTML = fa ? t(fa, en) : ''; hint.hidden = !fa; };
    function stopCam() { if (S.stream) S.stream.getTracks().forEach((x) => x.stop()); S.stream = null; video.hidden = true; video.srcObject = null; }
    function setSpace(i) {
      const s = SPACES[i]; stopCam(); say(); bg.hidden = false; bg.src = s.img; S.x = s.x; S.y = s.y; S.w = s.w; lay();
      $('.lv-credit').hidden = false; press('.lv-spaces button', $('[data-space="' + i + '"]'));
    }
    function setWork(i) { artImg.src = works[i].img; press('.lv-strip button', $('[data-work="' + i + '"]')); }
    async function cam(btn) {
      // phones get the full-screen tool, which has the true-size measurement; a desktop webcam runs here
      if (matchMedia('(pointer:coarse)').matches) { location.href = '/wall'; return; }
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
        stopCam(); S.stream = st; video.srcObject = st; await video.play(); video.hidden = false; bg.hidden = true; $('.lv-credit').hidden = true;
        S.x = 0.5; S.y = 0.42; S.w = 0.3; lay(); press('.lv-spaces button', btn); say('دوربین را رو به دیوار بگیرید و اثر را جابه‌جا کنید.', 'Point the camera at a wall and move the work.');
      } catch { say('دوربین باز نشد. اجازهٔ دوربین را بدهید، یا عکسی از دیوارتان انتخاب کنید.', "The camera didn't open. Allow camera access, or choose a photo of your wall."); }
    }
    root.addEventListener('click', (e) => {
      const sp = e.target.closest('[data-space]'); if (sp) return setSpace(+sp.dataset.space);
      const c = e.target.closest('[data-cam]'); if (c) return cam(c);
      const w = e.target.closest('[data-work]'); if (w) { setWork(+w.dataset.work); touched(); }
    });
    root.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (e.target.matches('[data-wall]')) { stopCam(); if (S.wall) URL.revokeObjectURL(S.wall); S.wall = URL.createObjectURL(f); bg.hidden = false; bg.src = S.wall; S.x = 0.5; S.y = 0.42; S.w = 0.3; lay(); $('.lv-credit').hidden = true; press('.lv-spaces button', null); say(); }
      if (e.target.matches('[data-own]')) { if (S.own) URL.revokeObjectURL(S.own); S.own = URL.createObjectURL(f); artImg.src = S.own; press('.lv-strip button', null); track('own'); }
      e.target.value = '';
    });
    function touched() { if (!S.touched) { S.touched = true; track('wall'); } }
    size.addEventListener('input', () => { S.w = size.value / 100; lay(); touched(); });
    let drag = null;
    art.addEventListener('pointerdown', (e) => { const r = stage.getBoundingClientRect(); drag = { dx: e.clientX - (r.left + S.x * r.width), dy: e.clientY - (r.top + S.y * r.height) }; art.setPointerCapture(e.pointerId); art.classList.add('drag'); touched(); });
    art.addEventListener('pointermove', (e) => { if (!drag) return; const r = stage.getBoundingClientRect(); S.x = Math.max(0.03, Math.min(0.97, (e.clientX - drag.dx - r.left) / r.width)); S.y = Math.max(0.05, Math.min(0.95, (e.clientY - drag.dy - r.top) / r.height)); lay(); });
    const up = () => { drag = null; art.classList.remove('drag'); };
    art.addEventListener('pointerup', up); art.addEventListener('pointercancel', up);
    art.tabIndex = 0; art.setAttribute('role', 'img');
    art.addEventListener('keydown', (e) => { const k = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key]; if (!k) return; e.preventDefault(); S.x = Math.max(0.03, Math.min(0.97, S.x + k[0])); S.y = Math.max(0.05, Math.min(0.95, S.y + k[1])); lay(); });
    addEventListener('pagehide', stopCam);
    setSpace(0); setWork(0);
  }
  return { mount };
})();
