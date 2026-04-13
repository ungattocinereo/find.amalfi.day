/* ==========================================================================
   find.amalfi.day — Main Application
   ========================================================================== */

(function () {
  'use strict';

  const SUPPORTED_LANGS = ['en', 'it', 'de', 'fr', 'ru', 'zh'];
  const LANG_NATIVE = { en: 'English', it: 'Italiano', de: 'Deutsch', fr: 'Français', ru: 'Русский', zh: '中文' };
  const DEFAULT_LANG = 'en';
  const LANG_COOKIE = 'lang';
  const TTS_AUTO_COOKIE = 'tts_auto';
  const SCROLL_KEY_PREFIX = 'scroll_';
  const TTS_BCP47 = { en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU', zh: 'zh-CN' };

  let currentLang = DEFAULT_LANG;
  let translations = {};
  let currentStep = 1;
  let totalSteps = 0;
  let railSegments = [];
  let ttsAutoEnabled = false;

  /* === Icons === */
  function initLucideIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  /* === i18n === */
  function detectLanguage() {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;

    const cookie = document.cookie.split('; ').find(c => c.startsWith(LANG_COOKIE + '='));
    if (cookie) {
      const cookieLang = cookie.split('=')[1];
      if (SUPPORTED_LANGS.includes(cookieLang)) return cookieLang;
    }

    const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

    return DEFAULT_LANG;
  }

  function saveLangPreference(lang) {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function getCookie(name) {
    const c = document.cookie.split('; ').find(x => x.startsWith(name + '='));
    return c ? decodeURIComponent(c.split('=')[1]) : null;
  }
  function setCookie(name, value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
  }

  async function loadTranslations(lang) {
    try {
      const response = await fetch(`/i18n/${lang}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      translations = await response.json();
    } catch (e) {
      console.warn(`Failed to load ${lang} translations, falling back to ${DEFAULT_LANG}`);
      if (lang !== DEFAULT_LANG) return loadTranslations(DEFAULT_LANG);
    }
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = getNestedValue(translations, key);
      if (!value) return;
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const value = getNestedValue(translations, el.getAttribute('data-i18n-alt'));
      if (value) el.alt = value;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const value = getNestedValue(translations, el.getAttribute('data-i18n-aria'));
      if (value) el.setAttribute('aria-label', value);
    });

    document.documentElement.lang = currentLang;
    initLucideIcons();
    updateRail();
  }

  function updateLangChip() {
    const chipCode = document.getElementById('nav-lang-code');
    if (chipCode) chipCode.textContent = currentLang.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  async function switchLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    saveLangPreference(lang);
    await loadTranslations(lang);
    applyTranslations();
    updateLangChip();
  }

  /* === Language Picker (bottom-sheet) === */
  function initLangPicker() {
    const picker = document.getElementById('lang-picker');
    const trigger = document.getElementById('nav-lang-chip');
    if (!picker || !trigger) return;

    function open() {
      picker.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('lang-picker-open');
    }
    function close() {
      picker.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('lang-picker-open');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (picker.getAttribute('aria-hidden') === 'false') close();
      else open();
    });

    picker.querySelectorAll('[data-lang-close]').forEach(el => {
      el.addEventListener('click', close);
    });

    picker.querySelectorAll('.lang-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = btn.dataset.lang;
        close();
        await switchLanguage(lang);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && picker.getAttribute('aria-hidden') === 'false') close();
    });
  }

  /* === Progress Rail === */
  function initRail() {
    const rail = document.getElementById('rail');
    if (!rail) return;
    try {
      railSegments = JSON.parse(rail.dataset.segments || '[]');
    } catch (e) {
      railSegments = [];
    }
  }

  function getCurrentSegment() {
    if (!railSegments.length) return null;
    let active = railSegments[0];
    for (const seg of railSegments) {
      if (currentStep >= seg.step) active = seg;
    }
    return active;
  }

  function updateRail() {
    const fill = document.getElementById('rail-fill');
    const stepNumEl = document.getElementById('rail-step-num');
    if (fill && totalSteps > 0) {
      fill.style.width = ((currentStep - 1) / Math.max(totalSteps - 1, 1) * 100) + '%';
    }
    if (stepNumEl) stepNumEl.textContent = String(currentStep);

    const active = getCurrentSegment();
    document.querySelectorAll('.rail-seg').forEach(seg => {
      const isActive = active && seg.dataset.segment === active.id;
      const stepThreshold = parseInt(seg.dataset.segmentStep, 10);
      const isPassed = currentStep >= stepThreshold;
      seg.classList.toggle('active', !!isActive);
      seg.classList.toggle('passed', isPassed);
    });
  }

  /* === Navigation (steps on route pages) === */
  function initNavigation() {
    const stepsContainer = document.querySelector('.steps');
    if (!stepsContainer) return;

    totalSteps = parseInt(stepsContainer.dataset.total, 10) || 0;
    const routeId = stepsContainer.dataset.route;

    const steps = document.querySelectorAll('.step');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          visibilityObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 100px 0px' });

    steps.forEach(step => visibilityObserver.observe(step));

    const stepObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const stepNum = parseInt(entry.target.id.replace('step-', ''), 10);
          if (stepNum && stepNum !== currentStep) {
            const previousStep = currentStep;
            currentStep = stepNum;
            updateRail();
            saveScrollPosition(routeId);
            highlightDrawerItem();
            if (btnPrev) btnPrev.disabled = currentStep <= 1;
            if (btnNext) btnNext.disabled = currentStep >= totalSteps;
            if (ttsAutoEnabled && previousStep !== stepNum) speakStep(entry.target);
          }
        }
      });
    }, { threshold: 0.5 });

    steps.forEach(step => stepObserver.observe(step));

    function scrollToStep(num) {
      const target = document.getElementById('step-' + num);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.__amalfiScrollToStep = scrollToStep;

    if (btnPrev) btnPrev.addEventListener('click', () => { if (currentStep > 1) scrollToStep(currentStep - 1); });
    if (btnNext) btnNext.addEventListener('click', () => { if (currentStep < totalSteps) scrollToStep(currentStep + 1); });

    document.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('drawer-open')) return;
      if (document.body.classList.contains('lang-picker-open')) return;
      if (document.body.classList.contains('lightbox-open')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentStep > 1) scrollToStep(currentStep - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < totalSteps) scrollToStep(currentStep + 1);
      }
    });

    restoreScrollPosition(routeId);
    updateRail();
  }

  function saveScrollPosition(routeId) {
    try { sessionStorage.setItem(SCROLL_KEY_PREFIX + routeId, String(currentStep)); } catch (e) {}
  }

  function restoreScrollPosition(routeId) {
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY_PREFIX + routeId);
      if (saved) {
        const stepNum = parseInt(saved, 10);
        if (stepNum > 1) {
          setTimeout(() => {
            const target = document.getElementById('step-' + stepNum);
            if (target) {
              target.scrollIntoView({ block: 'start' });
              currentStep = stepNum;
              updateRail();
            }
          }, 100);
        }
      }
    } catch (e) {}
  }

  /* === Steps Drawer === */
  function initStepsDrawer() {
    const drawer = document.getElementById('steps-drawer');
    const fab = document.getElementById('drawer-fab');
    if (!drawer || !fab) return;

    function open() {
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
      highlightDrawerItem();
      requestAnimationFrame(() => {
        const active = drawer.querySelector('.drawer-item.active');
        if (active) active.scrollIntoView({ block: 'center' });
      });
    }
    function close() {
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
    }

    fab.addEventListener('click', open);
    drawer.querySelectorAll('[data-drawer-close]').forEach(el => el.addEventListener('click', close));

    drawer.querySelectorAll('.drawer-item').forEach(item => {
      item.addEventListener('click', () => {
        const stepNum = parseInt(item.dataset.jumpStep, 10);
        if (window.__amalfiScrollToStep) window.__amalfiScrollToStep(stepNum);
        close();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) close();
    });

    const sheet = drawer.querySelector('.drawer-sheet');
    const handle = drawer.querySelector('.drawer-handle');
    if (handle && sheet) {
      let startY = null;
      handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
      handle.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      handle.addEventListener('touchend', (e) => {
        const dy = (e.changedTouches[0].clientY - (startY || 0));
        sheet.style.transform = '';
        startY = null;
        if (dy > 80) close();
      });
    }
  }

  function highlightDrawerItem() {
    const drawer = document.getElementById('steps-drawer');
    if (!drawer) return;
    drawer.querySelectorAll('.drawer-item').forEach(item => {
      const stepNum = parseInt(item.dataset.jumpStep, 10);
      item.classList.toggle('active', stepNum === currentStep);
    });
  }

  /* === TTS === */
  function ttsSupported() {
    return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function pickVoice(langCode) {
    if (!ttsSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const exact = voices.find(v => v.lang === langCode);
    if (exact) return exact;
    const prefix = langCode.split('-')[0];
    return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix)) || null;
  }

  function speakText(text) {
    if (!ttsSupported() || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const langCode = TTS_BCP47[currentLang] || 'en-US';
    utter.lang = langCode;
    const voice = pickVoice(langCode);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }

  function speakStep(stepEl) {
    const captionEl = stepEl.querySelector('.step-caption');
    if (!captionEl) return;
    const text = captionEl.textContent.trim();
    if (text) speakText(text);
  }

  function initTTS() {
    if (!ttsSupported()) {
      document.querySelectorAll('.step-tts, .nav-tts').forEach(el => el.style.display = 'none');
      return;
    }

    document.querySelectorAll('.step-tts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const step = btn.closest('.step');
        if (!step) return;
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        else speakStep(step);
      });
    });

    const toggle = document.getElementById('tts-toggle');
    if (toggle) {
      ttsAutoEnabled = getCookie(TTS_AUTO_COOKIE) === '1';
      toggle.classList.toggle('active', ttsAutoEnabled);
      toggle.setAttribute('aria-pressed', String(ttsAutoEnabled));
      toggle.addEventListener('click', () => {
        ttsAutoEnabled = !ttsAutoEnabled;
        setCookie(TTS_AUTO_COOKIE, ttsAutoEnabled ? '1' : '0');
        toggle.classList.toggle('active', ttsAutoEnabled);
        toggle.setAttribute('aria-pressed', String(ttsAutoEnabled));
        if (!ttsAutoEnabled) window.speechSynthesis.cancel();
      });
    }

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => { /* warmup */ };
    }
  }

  /* === PDF === */
  function initPdfDownload() {
    const btn = document.getElementById('btn-pdf');
    if (!btn) return;
    const stepsContainer = document.querySelector('.steps');
    if (!stepsContainer) return;
    const routeId = stepsContainer.dataset.route;
    btn.addEventListener('click', () => {
      window.open(`/pdf/${routeId}-${currentLang}.pdf`, '_blank');
    });
  }

  /* === Service Worker / Offline === */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(reg => { console.log('SW registered:', reg.scope); })
      .catch(err => { console.warn('SW registration failed:', err); });

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, progress } = event.data || {};
      const banner = document.getElementById('offline-banner');
      const text = document.getElementById('offline-text');
      const progressBar = document.getElementById('download-progress');
      const progressFill = document.getElementById('download-progress-fill');
      if (!banner) return;

      if (type === 'CACHE_PROGRESS') {
        banner.classList.add('visible', 'downloading');
        banner.classList.remove('cached');
        if (text) text.textContent = getNestedValue(translations, 'common.downloading') || 'Downloading guide for offline use...';
        if (progressBar) progressBar.style.display = 'block';
        if (progressFill) progressFill.style.width = progress + '%';
      }
      if (type === 'CACHE_COMPLETE') {
        banner.classList.add('visible');
        banner.classList.remove('downloading');
        if (text) text.textContent = getNestedValue(translations, 'common.offline_ready') || 'Ready for offline use!';
        if (progressBar) progressBar.style.display = 'none';
        setTimeout(() => banner.classList.remove('visible'), 5000);
      }
    });
  }

  /* === Copy to Clipboard === */
  function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const text = btn.dataset.copy;
        navigator.clipboard.writeText(text).then(function () {
          btn.classList.add('copied');
          setTimeout(function () { btn.classList.remove('copied'); }, 1800);
        }).catch(function (err) {
          console.warn('Clipboard write failed:', err);
        });
      });
    });
  }

  /* === Nav scroll state (landing: overlay → solid once content scrolls up) === */
  function initNavScrollState() {
    const nav = document.getElementById('nav');
    if (!nav || !nav.classList.contains('nav--overlay')) return;

    function update() {
      const solid = window.scrollY > 80;
      nav.classList.toggle('nav--solid', solid);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* === Init === */
  async function init() {
    currentLang = detectLanguage();

    await loadTranslations(currentLang);

    initRail();
    initLangPicker();
    applyTranslations();
    updateLangChip();
    initLucideIcons();

    initNavigation();
    initStepsDrawer();
    initTTS();
    initPdfDownload();
    initCopyButtons();
    initNavScrollState();

    initServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
