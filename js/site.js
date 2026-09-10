(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = $('.header'), menu = $('#main-nav'), toggle = $('.menu-toggle');
  const closeMenu = (focus = false) => {
    menu?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (focus) toggle?.focus();
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
  });
  menu?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (toggle?.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') closeMenu(true);
    if (event.key === 'Tab') {
      const items = [toggle, ...$$('a', menu)], first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  matchMedia('(min-width: 981px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  const scrollState = () => header?.classList.toggle('scrolled', window.scrollY > 15);
  addEventListener('scroll', scrollState, { passive: true }); scrollState();
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  // Content stays readable if JavaScript or observers are unavailable.
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    $$('.reveal').forEach(el => { el.classList.add('ready'); observer.observe(el); });
    const counter = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      counter.unobserve(entry.target);
      const target = Number(entry.target.dataset.count), start = performance.now();
      const tick = time => {
        const progress = Math.min((time - start) / 1000, 1);
        entry.target.textContent = '+' + Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.4 });
    $$('[data-count]').forEach(el => counter.observe(el));
  }

  const filters = $$('[data-filter]'), groups = $$('[data-category]');
  function filterServices(category) {
    if (!filters.some(button => button.dataset.filter === category)) category = 'all';
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    groups.forEach(group => { group.hidden = category !== 'all' && group.dataset.category !== category; });
    const count = groups.filter(g => !g.hidden).reduce((sum,g) => sum + $$('.catalog-card',g).length, 0);
    const status = $('.filter-status');
    if (status) status.textContent = `${count} servicios disponibles`;
  }
  if (filters.length) {
    filterServices(location.hash.slice(1) || 'all');
    filters.forEach(button => button.addEventListener('click', () => {
      filterServices(button.dataset.filter);
      history.replaceState(null, '', button.dataset.filter === 'all' ? location.pathname : '#' + button.dataset.filter);
    }));
    addEventListener('hashchange', () => filterServices(location.hash.slice(1) || 'all'));
  }

  // No analytics requests occur before an affirmative choice.
  const key = 'lc-analytics-consent-v1', panel = $('.cookie-panel');
  const readConsent = () => { try { return localStorage.getItem(key); } catch { return null; } };
  let consent = readConsent(), analyticsLoaded = false;
  function enableAnalytics() {
    if (analyticsLoaded || !['lc.com.pe','www.lc.com.pe'].includes(location.hostname)) return;
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window['ga-disable-G-NLF0179R9F'] = false;
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date()); window.gtag('config', 'G-NLF0179R9F');
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-NLF0179R9F'; document.head.append(script);
  }
  function rejectAnalytics() {
    window['ga-disable-G-NLF0179R9F'] = true;
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.trim().split('=')[0];
      if (!name.startsWith('_ga')) return;
      ['', location.hostname, '.lc.com.pe'].forEach(domain => { document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ' domain=' + domain + ';' : ''} SameSite=Lax`; });
    });
  }
  if (consent === 'accepted') enableAnalytics();
  else if (!consent && panel && ['lc.com.pe','www.lc.com.pe'].includes(location.hostname)) panel.hidden = false;
  $$('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => { panel.hidden = false; $('[data-cookie]', panel)?.focus(); }));
  $$('[data-cookie]').forEach(button => button.addEventListener('click', () => {
    consent = button.dataset.cookie;
    try { localStorage.setItem(key, consent); } catch { /* Current-session preference still applies. */ }
    panel.hidden = true;
    if (consent === 'accepted') enableAnalytics(); else rejectAnalytics();
  }));

  $$('.contact-form').forEach(form => {
    const status = $('.form-status', form), emailButton = $('[data-email-button]', form);
    const emailMode = document.body.dataset.emailMode;
    if (emailMode === 'draft') emailButton.textContent = 'Preparar correo →';
    const interest = new URLSearchParams(location.search).get('servicio');
    if (interest) {
      const select = $('select[name=subject]',form);
      const option = document.createElement('option'); option.value = interest.slice(0,150); option.textContent = option.value; option.selected = true; select.append(option);
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity() || form.dataset.pending === 'true') return;
      const data = new FormData(form), values = Object.fromEntries(data);
      if (values.website) return;
      const body = `Hola, soy ${values.name}.\nCorreo: ${values.email}\nServicio: ${values.subject}\n\n${values.message}`;
      const channel = event.submitter?.value || 'whatsapp';
      if (channel === 'whatsapp') {
        const url = 'https://wa.me/51969200366?text=' + encodeURIComponent(body);
        const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Abrir WhatsApp';
        status.replaceChildren('Tu mensaje está preparado. Revísalo y envíalo en WhatsApp. ', link);
        window.open(url, '_blank', 'noopener,noreferrer'); return;
      }
      if (emailMode === 'draft') {
        const url = 'mailto:comercial@lc.com.pe?subject=' + encodeURIComponent(values.subject) + '&body=' + encodeURIComponent(body);
        const link = document.createElement('a'); link.href = url; link.textContent = 'Abrir mi aplicación de correo';
        status.replaceChildren('El correo está preparado; aún debes enviarlo desde tu aplicación. ', link);
        location.href = url; return;
      }
      const buttons = $$('button[type=submit]', form), original = emailButton.textContent;
      form.dataset.pending = 'true'; buttons.forEach(button => { button.disabled = true; });
      emailButton.textContent = 'Enviando…'; status.textContent = 'Estamos procesando tu consulta.';
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
      try {
        const response = await fetch(form.action, { method: 'POST', body: data, signal: abort.signal, headers: { Accept: 'application/json' } });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('El envío por correo no está disponible aquí. Puedes continuar por WhatsApp.');
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'No se pudo enviar. Inténtalo de nuevo o continúa por WhatsApp.');
        status.textContent = result.message; form.reset();
      } catch (error) {
        status.textContent = error.name === 'AbortError' ? 'No pudimos confirmar el envío. Puedes contactarnos por WhatsApp.' : error.message;
      } finally { clearTimeout(timer); delete form.dataset.pending; buttons.forEach(button => { button.disabled = false; }); emailButton.textContent = original; }
    });
  });
})();
