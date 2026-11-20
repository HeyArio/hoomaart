'use strict';
// Shared by the entrance and the audience pages: language switch, remembered across the site.
window.HoomaLite = (() => {
  const subs = [];
  let lang = 'fa';
  function set(l, save) {
    lang = l === 'en' ? 'en' : 'fa';
    const h = document.documentElement; h.lang = lang; h.dir = lang === 'fa' ? 'rtl' : 'ltr';
    if (save) try { localStorage.setItem('hooma-lang', lang); } catch {}
    document.querySelectorAll('#langBtn [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    subs.forEach((f) => f(lang));
  }
  const btn = document.getElementById('langBtn');
  if (btn) btn.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== lang) set(b.dataset.lang, true); });
  let l0 = 'fa'; try { l0 = new URLSearchParams(location.search).get('lang') || localStorage.getItem('hooma-lang') || 'fa'; } catch {}
  set(l0);
  return { get lang() { return lang; }, onLang(f) { subs.push(f); f(lang); } };
})();
