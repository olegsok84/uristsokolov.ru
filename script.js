(() => {
  const config = window.SITE_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  document.documentElement.classList.add('js');
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const navToggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    $$("a", nav).forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const cookie = $('[data-cookie]');
  const cookieAccept = $('[data-cookie-accept]');
  const cookieNoticeEnabled = Boolean(config.showCookieNotice || config.yandexMetrikaId);
  if (cookie && cookieNoticeEnabled && !localStorage.getItem('cookie-ok')) cookie.hidden = false;
  if (cookieAccept) cookieAccept.addEventListener('click', () => {
    localStorage.setItem('cookie-ok', '1');
    cookie.hidden = true;
  });

  function track(goal) {
    if (!goal) return;
    const id = config.yandexMetrikaId;
    if (id && window.ym) window.ym(id, 'reachGoal', goal);
  }
  $$('[data-goal]').forEach((link) => link.addEventListener('click', () => track(link.dataset.goal)));

  function collectForm(form) {
    const data = new FormData(form);
    const payload = {
      form: form.dataset.formName || 'form',
      page: location.href,
      date: new Date().toISOString(),
      utm: Object.fromEntries(new URLSearchParams(location.search).entries()),
      fields: {}
    };
    for (const [key, value] of data.entries()) {
      if (value instanceof File) {
        if (!value.name) continue;
        payload.fields[key] = payload.fields[key] || [];
        payload.fields[key].push({ name: value.name, size: value.size, type: value.type });
      } else if (payload.fields[key]) {
        payload.fields[key] = Array.isArray(payload.fields[key]) ? [...payload.fields[key], value] : [payload.fields[key], value];
      } else {
        payload.fields[key] = value;
      }
    }
    return payload;
  }

  function validateFiles(form) {
    const max = 20 * 1024 * 1024;
    const fileInputs = $$('input[type="file"]', form);
    for (const input of fileInputs) {
      for (const file of input.files || []) {
        if (file.size > max) {
          input.setCustomValidity(`Файл «${file.name}» больше 20 МБ`);
          input.reportValidity();
          input.setCustomValidity('');
          return false;
        }
      }
    }
    return true;
  }

  async function submitLead(form) {
    const status = $('.form-status', form);
    if (!form.reportValidity()) return;
    if (!validateFiles(form)) return;
    const payload = collectForm(form);
    if (status) status.textContent = 'Отправляю заявку…';
    track(payload.form === 'quiz' ? 'quiz_finish' : 'form_submit');
    try {
      if (config.leadEndpoint) {
        const response = await fetch(config.leadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } else {
        sessionStorage.setItem('lastLead', JSON.stringify(payload));
      }
      form.reset();
      location.href = '/thank-you/';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'Не удалось отправить заявку автоматически. Пожалуйста, напишите в мессенджер или попробуйте позже.';
    }
  }

  $$('.js-lead-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitLead(form);
    });
  });

  $$('.js-quiz').forEach((quiz) => {
    const steps = $$('[data-step]', quiz);
    const progress = $('[data-quiz-progress]', quiz);
    const prev = $('[data-quiz-prev]', quiz);
    const next = $('[data-quiz-next]', quiz);
    let current = 0;

    function show(index) {
      current = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, i) => step.classList.toggle('is-active', i === current));
      quiz.classList.toggle('is-last', current === steps.length - 1);
      if (prev) prev.disabled = current === 0;
      if (progress) progress.style.width = `${((current + 1) / steps.length) * 100}%`;
    }

    function validateStep() {
      const fields = $$('input, select, textarea', steps[current]);
      for (const field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }
      return true;
    }

    if (prev) prev.addEventListener('click', () => show(current - 1));
    if (next) next.addEventListener('click', () => {
      if (validateStep()) show(current + 1);
    });
    show(0);
  });

  $$('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', anchor.getAttribute('href'));
    });
  });
})();
