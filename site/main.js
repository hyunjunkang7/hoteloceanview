(() => {
  const root = document.documentElement;
  const cfg = window.SITE_CONFIG || {};

  // ---- Language (ko default, ?lang=en or saved choice) ----
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang');
  if (!lang) { try { lang = localStorage.getItem('lang'); } catch (e) {} }
  // First visit: foreign browsers get English automatically.
  if (!lang) lang = (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  setLang(lang === 'en' ? 'en' : 'ko');
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l;
    document.querySelectorAll('option[data-ko]').forEach(o => { o.textContent = o.dataset[l]; });
    document.querySelectorAll('[data-ph-ko]').forEach(el => { el.placeholder = el.dataset[l === 'ko' ? 'phKo' : 'phEn']; });
    document.querySelectorAll('[data-set-lang]').forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.setLang === l));
    try { localStorage.setItem('lang', l); } catch (e) {}
  }
  document.querySelectorAll('[data-set-lang]').forEach(btn => btn.addEventListener('click', () => setLang(btn.dataset.setLang)));

  // ---- Nav: solid background after scrolling, mobile menu ----
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const menuBtn = document.getElementById('menuToggle');
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  // ---- Reveal on scroll ----
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ---- Lightbox galleries (data-gallery="name1,name2") ----
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  let gallery = [], idx = 0;
  const show = i => { idx = (i + gallery.length) % gallery.length; lbImg.src = `images/${gallery[idx]}.webp`; };
  document.querySelectorAll('[data-gallery]').forEach(el => el.addEventListener('click', () => {
    gallery = el.dataset.gallery.split(',');
    show(0);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }));
  const close = () => { lb.hidden = true; document.body.style.overflow = ''; };
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); show(idx - 1); });
  lb.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); show(idx + 1); });
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  // ---- Reservation form ----
  const form = document.getElementById('reserveForm');
  const status = document.getElementById('formStatus');
  const today = new Date().toISOString().slice(0, 10);
  form.checkin.min = today;
  form.checkout.min = today;
  form.checkin.addEventListener('change', () => {
    form.checkout.min = form.checkin.value;
    if (form.checkout.value && form.checkout.value <= form.checkin.value) form.checkout.value = '';
  });
  document.querySelectorAll('[data-room]').forEach(a => a.addEventListener('click', () => { form.room.value = a.dataset.room; }));

  const msg = (ko, en) => (root.dataset.lang === 'en' ? en : ko);
  const setStatus = (text, cls) => { status.textContent = text; status.className = 'form-status ' + (cls || ''); };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.website.value) return; // spam bot
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (form.checkout.value <= form.checkin.value) {
      setStatus(msg('체크아웃 날짜를 체크인 이후로 선택해 주세요.', 'Check-out must be after check-in.'), 'err');
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    data.roomLabel = form.room.options[form.room.selectedIndex].dataset.ko;
    data.lang = root.dataset.lang;
    delete data.website;

    if (!cfg.reservationEndpoint) {
      const body = [
        `체크인: ${data.checkin}`, `체크아웃: ${data.checkout}`, `객실: ${data.roomLabel} x ${data.rooms}`,
        `인원: ${data.guests}`, `성함: ${data.name}`, `연락처: ${data.phone}`, `이메일: ${data.email || '-'}`, '', data.message || '',
      ].join('\n');
      location.href = `mailto:${cfg.reservationEmail}?subject=${encodeURIComponent('[홈페이지 예약문의] ' + data.name + ' ' + data.checkin)}&body=${encodeURIComponent(body)}`;
      return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    setStatus(msg('보내는 중…', 'Sending…'));
    try {
      // Apps Script web apps don't return CORS headers; a no-cors POST still delivers the data.
      await fetch(cfg.reservationEndpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(data) });
      form.reset();
      setStatus(msg('예약 문의가 접수되었습니다. 확인 후 연락드리겠습니다. 감사합니다!', 'Thank you! We received your request and will contact you shortly.'), 'ok');
    } catch (err) {
      setStatus(msg('전송에 실패했습니다. 052-235-7777로 전화 주세요.', 'Sending failed. Please call +82-52-235-7777.'), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
