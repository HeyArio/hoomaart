'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WA = '989123800864';

const Hooma = window.Hooma = {
  works: [], lang: 'fa', ready: null,
  T: {
    fa: { collection: 'مجموعهٔ هوما آرت', medium: 'تکنیک', year: 'سال', size: 'ابعاد', price: 'قیمت', status: 'وضعیت', avail: 'موجود', sold: 'فروخته‌شده', onreq: 'با درخواست', cm: 'سانتی‌متر',
      attached: 'عکس اثرتان پیوست شد. نام و شمارهٔ تماس را بنویسید و بفرستید.', sending: 'در حال ارسال…', sent: 'درخواست شما ثبت شد. به‌زودی با شما تماس می‌گیریم.', missing: 'نام و شمارهٔ تماس را وارد کنید.', failed: 'ارسال نشد. اتصال اینترنت را بررسی کنید و دوباره بفرستید.', rate: 'چند درخواست پشت سر هم فرستاده‌اید. کمی بعد دوباره امتحان کنید.', big: 'حجم عکس زیاد است. عکس کوچک‌تری انتخاب کنید.',
      askWork: (t) => `درخواست بازدید خصوصی برای اثر «${t}»`, waWork: (t, u) => `سلام، دربارهٔ اثر «${t}» در هوما آرت سؤال دارم.\n${u}`, waHello: 'سلام، از سایت هوما آرت پیام می‌دهم.' },
    en: { collection: 'Hooma Art collection', medium: 'Medium', year: 'Year', size: 'Size', price: 'Price', status: 'Status', avail: 'Available', sold: 'Sold', onreq: 'On request', cm: 'cm',
      attached: 'Your photo is attached. Add your name and phone number and send it.', sending: 'Sending…', sent: 'Your request is saved. We will call you soon.', missing: 'Enter your name and phone number.', failed: "It didn't send. Check your connection and send it again.", rate: 'You sent several requests in a row. Try again a little later.', big: 'That photo is too large. Choose a smaller one.',
      askWork: (t) => `Private viewing request for "${t}"`, waWork: (t, u) => `Hello, I have a question about "${t}" at Hooma Art.\n${u}`, waHello: 'Hello, I am writing from the Hooma Art website.' },
  },
  t(k, ...a) { const v = this.T[this.lang][k]; return typeof v === 'function' ? v(...a) : v; },
  L(o) { return (o && (o[this.lang] || o.fa || o.en)) || ''; },
  num(n) { return this.lang === 'fa' ? String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(n); },
  by(w) { return this.L(w.artist) || this.t('collection'); },
  find(id) { return this.works.find((w) => w.id === id); },
};

/* ---- language */
function setLang(l, save) {
  Hooma.lang = l; const h = document.documentElement; h.lang = l; h.dir = l === 'fa' ? 'rtl' : 'ltr';
  if (save) try { localStorage.setItem('hooma-lang', l); } catch {}
  document.title = l === 'fa' ? 'هوما آرت | Hooma Art' : 'Hooma Art | هوما آرت';
  render(); document.dispatchEvent(new CustomEvent('hooma:lang'));
}
$('#langBtn').addEventListener('click', () => setLang(Hooma.lang === 'fa' ? 'en' : 'fa', true));

/* ---- rendering */
let heroIx = 0, elevIx = 2, heroTimer = 0, ambOn = 0, heroShown = '', heroHold = false;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mod = (n, m) => ((n % m) + m) % m;

// The hero room takes its light from the work: a heavily blurred copy of the image sits behind it.
function heroAuto(ms) {
  clearTimeout(heroTimer);
  heroTimer = setTimeout(() => { if (!document.hidden && !heroHold) { heroIx++; paintHero(); } else heroAuto(1500); }, ms);
}
function paintHero(first) {
  const n = Hooma.works.length, hw = Hooma.works[mod(heroIx, n)], hang = $('#heroHang'), img = $('#heroImg'), label = $('#heroLabel');
  $('#heroCap').textContent = Hooma.L(hw.title);
  $('#heroMeta').textContent = [Hooma.L(hw.medium), Hooma.by(hw)].filter(Boolean).join(Hooma.lang === 'fa' ? '، ' : ', ');
  $('#heroCount').textContent = Hooma.num(mod(heroIx, n) + 1) + (Hooma.lang === 'fa' ? ' از ' : ' / ') + Hooma.num(n);
  img.alt = Hooma.L(hw.title);
  if (heroShown === hw.id) return;
  heroShown = hw.id;
  const show = () => {
    img.src = hw.img; hang.style.setProperty('--r', hw.ratio || 1.5);
    const go = () => {
      img.onload = img.onerror = null;
      if (heroShown !== hw.id) return;
      hang.classList.remove('swap');
      const next = $(ambOn ? '#ambA' : '#ambB'), prev = $(ambOn ? '#ambB' : '#ambA');
      next.style.backgroundImage = 'url("' + hw.img + '")'; next.classList.add('on'); prev.classList.remove('on'); ambOn = ambOn ? 0 : 1;
    };
    if (img.complete && img.naturalWidth) go(); else { img.onload = go; img.onerror = go; }
  };
  if (first || still) show(); else { hang.classList.add('swap'); setTimeout(show, 420); }
  label.classList.remove('run');
  if (!still && n > 1) { void label.offsetWidth; label.classList.add('run'); heroAuto(7000); }
}
const heroWork = $('.hero-work');
['pointerenter', 'focusin'].forEach((e) => heroWork.addEventListener(e, () => { heroHold = true; }));
['pointerleave', 'focusout'].forEach((e) => heroWork.addEventListener(e, () => { heroHold = false; }));
$('#heroNext').addEventListener('click', () => { heroIx++; paintHero(); });
$('#heroPrev').addEventListener('click', () => { heroIx--; paintHero(); });
$('#heroOpen').addEventListener('click', () => Hooma.openWork(Hooma.works[mod(heroIx, Hooma.works.length)].id));

// Elevation drawing: 1 cm is a fixed fraction of the wall, so the work keeps its true proportion to the door.
function paintElev() {
  const w = Hooma.works[mod(elevIx, Hooma.works.length)]; if (!w) return;
  const cm = +$('#elevSize').value, r = w.ratio || 1.5, el = $('#elev'), img = $('#demoImg');
  if (img.getAttribute('src') !== w.img) img.src = w.img;
  img.alt = Hooma.L(w.title);
  el.style.setProperty('--cm', Math.min(cm, 215 * r)); el.style.setProperty('--r', r);
  $('#elevW').textContent = Hooma.num(cm) + ' × ' + Hooma.num(Math.round(cm / r)) + ' ' + Hooma.t('cm');
}
$('#elevSize').addEventListener('input', paintElev);
$('#elevNext').addEventListener('click', () => { elevIx++; paintElev(); });

function render() {
  if (!Hooma.works.length) return;
  paintHero(!heroShown); paintElev();
  $('#scanDemoImg').src = (Hooma.works[1] || Hooma.works[0]).img;
  $('#salon').innerHTML = Hooma.works.map((w) => '<figure class="hang"><button type="button" class="hang-btn" data-work="' + w.id + '"><img loading="lazy" width="1000" height="' + Math.round(1000 / (w.ratio || 1.5)) + '" src="' + w.img + '" alt="' + esc(Hooma.L(w.title)) + '"></button><figcaption><b>' + esc(Hooma.L(w.title)) + '</b><span' + (w.available ? '' : ' class="dotted"') + '>' + esc(w.available ? Hooma.L(w.medium) : Hooma.t('sold')) + '</span></figcaption></figure>').join('');
  if (openId) fillWork(Hooma.find(openId));
  reveal();
}

/* ---- header, menu, scroll entrances */
const topBar = $('#top'), menuBtn = $('#menuBtn');
const onScroll = () => topBar.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const setMenu = (o) => { topBar.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', String(o)); };
menuBtn.addEventListener('click', () => setMenu(!topBar.classList.contains('open')));
$('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
let io = null;
function reveal() {
  if (still || !('IntersectionObserver' in window)) return;
  io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.sec-head, .terms > div, .elev-grid > *, .scan-grid > *, .salon figure, .steps li, .promise > *, .join-grid > *').forEach((el) => {
    if (el.classList.contains('rv')) return;
    if (el.getBoundingClientRect().top < innerHeight) return; // never hide what is already on screen
    el.classList.add('rv'); io.observe(el);
  });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
Hooma.esc = esc;

/* ---- overlays */
let openId = null, lastFocus = null;
function show(el) { lastFocus = document.activeElement; el.hidden = false; document.body.style.overflow = 'hidden'; const x = $('[data-close]', el); x && x.focus(); }
function hideAll(push) {
  $$('.sheet,.tool').forEach((e) => { if (!e.hidden) { e.hidden = true; e.dispatchEvent(new CustomEvent('hooma:close')); } });
  document.body.style.overflow = ''; openId = null;
  if (push && location.pathname !== '/') history.pushState({}, '', '/');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
Hooma.hideAll = hideAll; Hooma.show = show;
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]'); if (c) return hideAll(true);
  const w = e.target.closest('[data-work]'); if (w) return Hooma.openWork(w.dataset.work);
  const o = e.target.closest('[data-open]'); if (o) { if (o.dataset.open === 'wall') Hooma.openWall(null, !!o.dataset.own); else Hooma.openScan(); return; }
  const r = e.target.closest('[data-role]'); if (r) { const i = $(`#joinForm input[value="${r.dataset.role}"]`); if (i) { i.checked = true; roleChanged(); } }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideAll(true); });
window.addEventListener('popstate', route);

function fillWork(w) {
  if (!w) return;
  $('#wImg').src = w.img; $('#wImg').alt = Hooma.L(w.title);
  $('#wTitle').textContent = Hooma.L(w.title); $('#wBy').textContent = Hooma.by(w);
  const rows = [];
  if (Hooma.L(w.medium)) rows.push([Hooma.t('medium'), Hooma.L(w.medium)]);
  if (w.year) rows.push([Hooma.t('year'), Hooma.num(w.year)]);
  if (w.w && w.h) rows.push([Hooma.t('size'), `${Hooma.num(w.w)} × ${Hooma.num(w.h)} ${Hooma.t('cm')}`]);
  rows.push([Hooma.t('price'), Hooma.L(w.price) || Hooma.t('onreq')]);
  rows.push([Hooma.t('status'), w.available ? Hooma.t('avail') : Hooma.t('sold')]);
  $('#wMeta').innerHTML = rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');
  $('#wStory').textContent = Hooma.L(w.story);
  $('#wWa').href = `https://wa.me/${WA}?text=${encodeURIComponent(Hooma.t('waWork', Hooma.L(w.title), location.origin + '/w/' + w.id))}`;
}
Hooma.openWork = (id, noPush) => {
  const w = Hooma.find(id); if (!w) return;
  hideAll(false); openId = id; fillWork(w); show($('#workSheet')); $('#workSheet').scrollTop = 0;
  if (!noPush) history.pushState({}, '', '/w/' + id);
};
$('#wWall').addEventListener('click', () => { const id = openId; Hooma.openWall(id); });
$('#wAsk').addEventListener('click', () => {
  const w = Hooma.find(openId); hideAll(true); if (!w) return;
  const f = $('#joinForm'); f.role.value = 'collector'; roleChanged(); f.work.value = w.id;
  if (!f.message.value) f.message.value = Hooma.t('askWork', Hooma.L(w.title));
  $('#join').scrollIntoView(); f.name.focus({ preventScroll: true });
});

/* ---- form */
const form = $('#joinForm');
// Carry a photo from the wall tool into the artist request. Nothing is uploaded until the visitor presses send.
Hooma.sendOwnWork = (file) => {
  hideAll(true); form.role.value = 'artist'; roleChanged();
  let ok = false; try { const d = new DataTransfer(); d.items.add(file); form.image.files = d.files; ok = form.image.files.length === 1; } catch {}
  const note = $('#formNote'); note.textContent = ok ? Hooma.t('attached') : ''; note.hidden = !ok; pickedChanged();
  $('#join').scrollIntoView(); form.name.focus({ preventScroll: true });
};
function roleChanged() { $('#fileRow').hidden = form.role.value !== 'artist'; }
function pickedChanged() { const f = form.image.files[0]; $('#pickedName').textContent = f ? f.name : ''; }
form.image.addEventListener('change', pickedChanged);
form.addEventListener('change', (e) => { if (e.target.name === 'role') roleChanged(); });
function shrink(file, max = 1600) {
  return new Promise((ok, bad) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(u); bad(new Error('img')); }; img.src = u;
  });
}
Hooma.shrink = shrink;
form.addEventListener('submit', async (e) => {
  e.preventDefault(); const msg = $('#formMsg'); const f = form;
  const say = (k, cls) => { msg.textContent = Hooma.t(k); msg.className = 'form-msg ' + cls; };
  const nameOk = f.name.value.trim().length > 1, phoneOk = f.phone.value.replace(/\D/g, '').length >= 7;
  f.name.closest('.f').classList.toggle('bad', !nameOk); f.phone.closest('.f').classList.toggle('bad', !phoneOk);
  if (!nameOk || !phoneOk) { say('missing', 'bad'); (nameOk ? f.phone : f.name).focus(); return; }
  const btn = $('button[type=submit]', f); btn.disabled = true; say('sending', '');
  try {
    const data = { role: f.role.value, name: f.name.value, phone: f.phone.value, city: f.city.value, link: f.link.value, message: f.message.value, work: f.work.value, website: f.website.value, lang: Hooma.lang };
    if (f.role.value === 'artist' && f.image.files[0]) { try { data.image = await shrink(f.image.files[0]); } catch {} }
    const r = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (r.ok) { f.reset(); roleChanged(); pickedChanged(); $('#formNote').hidden = true; say('sent', 'ok'); }
    else say(r.status === 429 ? 'rate' : r.status === 413 ? 'big' : r.status === 400 ? 'missing' : 'failed', 'bad');
  } catch { say('failed', 'bad'); }
  btn.disabled = false;
});

/* ---- routing + boot */
function route() {
  const p = location.pathname; let m;
  if ((m = /^\/w\/([a-z0-9-]+)/.exec(p))) return Hooma.openWork(m[1], true);
  hideAll(false);
  if (p === '/wall') Hooma.openWall(); else if (p === '/scan') Hooma.openScan(); else if (p === '/join' || p === '/artists') $('#' + p.slice(1)).scrollIntoView({ behavior: 'instant' });
}
Hooma.ready = fetch('/api/works').then((r) => r.json()).then((w) => { Hooma.works = w; }).catch(() => { Hooma.works = []; });
document.addEventListener('DOMContentLoaded', async () => {
  let l = 'fa'; try { l = localStorage.getItem('hooma-lang') || (new URLSearchParams(location.search).get('lang')) || 'fa'; } catch {}
  await Hooma.ready; setLang(l === 'en' ? 'en' : 'fa'); roleChanged(); route();
  $('#waBtn').href = `https://wa.me/${WA}?text=${encodeURIComponent(Hooma.t('waHello'))}`;
});
