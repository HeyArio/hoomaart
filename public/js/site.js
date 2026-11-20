'use strict';
// One header and one footer for every public page. Pages carry empty <header id="top"> and <footer id="foot">.
(() => {
  const t = (fa, en) => '<span class="fa">' + fa + '</span><span class="en">' + en + '</span>';
  const here = location.pathname;
  const links = [['/for/collectors', 'مجموعه‌دار', 'Collectors'], ['/for/artists', 'هنرمند', 'Artists'], ['/for/investors', 'سرمایه‌گذار', 'Investors'], ['/gallery', 'مجموعه', 'Collection']];
  const mark = '<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 31C8 16 18 6 34 5c-1 15-10 25-25 27l12-13"/></svg>';
  const top = document.getElementById('top');
  if (top) {
    top.className = 'top';
    top.innerHTML = '<a class="brand" href="/" aria-label="Hooma Art">' + mark + t('هوما آرت', 'Hooma Art') + '</a>' +
      '<nav class="nav" id="nav" aria-label="Main">' + links.map(([h, fa, en]) => '<a href="' + h + '"' + (here === h ? ' aria-current="page"' : '') + '>' + t(fa, en) + '</a>').join('') + '</nav>' +
      '<div class="seg" id="langBtn" role="group" aria-label="Language"><button type="button" data-lang="fa" aria-label="فارسی">FA</button><button type="button" data-lang="en" aria-label="English">EN</button></div>' +
      '<button class="menu" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav"><i></i><i></i></button>';
    const btn = top.querySelector('#menuBtn');
    const setMenu = (o) => { top.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); };
    btn.addEventListener('click', () => setMenu(!top.classList.contains('open')));
    top.querySelector('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    const onScroll = () => top.classList.toggle('solid', scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const foot = document.getElementById('foot');
  if (foot) {
    foot.className = 'foot';
    foot.innerHTML = '<div class="wrap"><div class="fcols">' +
      '<div><a class="brand" href="/">' + mark + t('هوما آرت', 'Hooma Art') + '</a><p>' + t('خریدار منتخب، اثر گزیده و فضای خاص، در یک شب.', 'Selected buyers, selected works and a remarkable space, in one evening.') + '</p></div>' +
      '<div><b>' + t('برای شما', 'For you') + '</b>' + links.slice(0, 3).map(([h, fa, en]) => '<a href="' + h + '">' + t(fa, en) + '</a>').join('') + '</div>' +
      '<div><b>' + t('هوما آرت', 'Hooma Art') + '</b><a href="/gallery">' + t('مجموعه', 'Collection') + '</a><a href="/wall">' + t('اثر روی دیوار شما', 'A work on your wall') + '</a><a href="/join">' + t('همکاری', 'Work with us') + '</a></div>' +
      '<div><b>' + t('تماس', 'Contact') + '</b><a href="https://wa.me/989123800864" target="_blank" rel="noopener">' + t('واتس‌اپ: نیوشا نیکزاد', 'WhatsApp: Niusha Nikzad') + '</a><a href="mailto:info@nazarbanai.com" dir="ltr">info@nazarbanai.com</a></div>' +
      '</div><div class="fend"><span>' + t('تهران', 'Tehran') + '</span><span dir="ltr">hoomaart.ir</span></div></div>';
  }
})();
