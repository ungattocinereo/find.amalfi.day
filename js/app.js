/* ==========================================================================
   find.amalfi.day — Main Application
   ========================================================================== */

(function () {
  'use strict';

  /* --- Configuration --- */
  const SUPPORTED_LANGS = ['en', 'it', 'de', 'fr'];
  const DEFAULT_LANG = 'en';
  const LANG_COOKIE = 'lang';
  const TTS_AUTO_COOKIE = 'tts_auto';
  const SCROLL_KEY_PREFIX = 'scroll_';
  const TTS_BCP47 = { en: 'en-US', it: 'it-IT', de: 'de-DE', fr: 'fr-FR' };

  /* --- State --- */
  let currentLang = DEFAULT_LANG;
  let translations = {};
  let currentStep = 1;
  let totalSteps = 0;
  let railSegments = [];
  let ttsAutoEnabled = false;

  /* ========================================================================
     Lucide Icons
     ======================================================================== */

  function initLucideIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  /* ========================================================================
     i18n Module
     ======================================================================== */

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
      if (lang !== DEFAULT_LANG) {
        return loadTranslations(DEFAULT_LANG);
      }
    }
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = getNestedValue(translations, key);
      if (!value) return;
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      const value = getNestedValue(translations, key);
      if (value) el.alt = value;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const value = getNestedValue(translations, key);
      if (value) el.setAttribute('aria-label', value);
    });

    document.documentElement.lang = currentLang;
    initLucideIcons();
    updateRailSegmentLabel();
  }

  function updateLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  async function switchLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    saveLangPreference(lang);
    await loadTranslations(lang);
    applyTranslations();
    updateLangButtons();
  }

  function initLangSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
  }

  /* ========================================================================
     Hero Language Migration
     Detects when the prominent hero language strip leaves the viewport,
     then toggles `body.lang-migrated` so CSS reveals the compact header
     switcher. Used on landing pages (.hero) and route pages (.lang-hero).
     ======================================================================== */

  function initLangMigration() {
    const sentinel =
      document.querySelector('.lang-hero-sentinel') ||
      document.querySelector('.lang-bar') ||
      document.querySelector('.hero');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        document.body.classList.toggle('lang-migrated', !entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '0px 0px -90% 0px' });

    observer.observe(sentinel);
  }

  /* ========================================================================
     Segmented Progress Rail
     ======================================================================== */

  function initSegmentedProgress() {
    const rail = document.getElementById('progress-rail');
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
    document.querySelectorAll('.rail-node').forEach(node => {
      const isActive = active && node.dataset.segment === active.id;
      const stepThreshold = parseInt(node.dataset.segmentStep, 10);
      const isPassed = currentStep >= stepThreshold;
      node.classList.toggle('active', !!isActive);
      node.classList.toggle('passed', isPassed);
    });
    updateRailSegmentLabel();
  }

  function updateRailSegmentLabel() {
    const labelEl = document.getElementById('rail-segment-label');
    if (!labelEl) return;
    const active = getCurrentSegment();
    if (!active) {
      labelEl.textContent = '';
      return;
    }
    const translated = getNestedValue(translations, active.i18nKey);
    labelEl.textContent = translated || active.label || '';
  }

  /* ========================================================================
     Navigation Module (Route Pages)
     ======================================================================== */

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
            if (ttsAutoEnabled && previousStep !== stepNum) {
              speakStep(entry.target);
            }
          }
        }
      });
    }, { threshold: 0.5 });

    steps.forEach(step => stepObserver.observe(step));

    function scrollToStep(num) {
      const target = document.getElementById('step-' + num);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    window.__amalfiScrollToStep = scrollToStep;

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentStep > 1) scrollToStep(currentStep - 1);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentStep < totalSteps) scrollToStep(currentStep + 1);
      });
    }

    document.addEventListener('keydown', (e) => {
      // Don't hijack arrow keys when a dialog/drawer is open
      if (document.body.classList.contains('drawer-open')) return;
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
    try {
      sessionStorage.setItem(SCROLL_KEY_PREFIX + routeId, String(currentStep));
    } catch (e) { /* ignore */ }
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
    } catch (e) { /* ignore */ }
  }

  /* ========================================================================
     Steps Drawer (bottom-sheet step navigator)
     ======================================================================== */

  function initStepsDrawer() {
    const drawer = document.getElementById('steps-drawer');
    const fab = document.getElementById('drawer-fab');
    if (!drawer || !fab) return;

    function open() {
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
      highlightDrawerItem();
      // Scroll the active item into view inside the drawer
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
    drawer.querySelectorAll('[data-drawer-close]').forEach(el => {
      el.addEventListener('click', close);
    });

    drawer.querySelectorAll('.drawer-item').forEach(item => {
      item.addEventListener('click', () => {
        const stepNum = parseInt(item.dataset.jumpStep, 10);
        if (window.__amalfiScrollToStep) window.__amalfiScrollToStep(stepNum);
        close();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
        close();
      }
    });

    // Swipe down on handle to close
    const sheet = drawer.querySelector('.drawer-sheet');
    const handle = drawer.querySelector('.drawer-handle');
    if (handle && sheet) {
      let startY = null;
      handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });
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

  /* ========================================================================
     TTS — Web Speech API
     ======================================================================== */

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
    utter.rate = 1.0;
    utter.pitch = 1.0;
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
      // Hide TTS controls if unsupported
      document.querySelectorAll('.step-tts, .header-tts-toggle').forEach(el => el.style.display = 'none');
      return;
    }

    // Per-step buttons
    document.querySelectorAll('.step-tts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const step = btn.closest('.step');
        if (!step) return;
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        } else {
          speakStep(step);
        }
      });
    });

    // Header auto-read toggle
    const toggle = document.getElementById('tts-toggle');
    if (toggle) {
      ttsAutoEnabled = getCookie(TTS_AUTO_COOKIE) === '1';
      toggle.classList.toggle('active', ttsAutoEnabled);
      toggle.addEventListener('click', () => {
        ttsAutoEnabled = !ttsAutoEnabled;
        setCookie(TTS_AUTO_COOKIE, ttsAutoEnabled ? '1' : '0');
        toggle.classList.toggle('active', ttsAutoEnabled);
        if (!ttsAutoEnabled) window.speechSynthesis.cancel();
      });
    }

    // Voices may load asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => { /* warmup */ };
    }
  }

  /* ========================================================================
     PDF Download Module
     ======================================================================== */

  function initPdfDownload() {
    const btn = document.getElementById('btn-pdf');
    if (!btn) return;

    const stepsContainer = document.querySelector('.steps');
    if (!stepsContainer) return;

    const routeId = stepsContainer.dataset.route;

    btn.addEventListener('click', () => {
      const pdfUrl = `/pdf/${routeId}-${currentLang}.pdf`;
      window.open(pdfUrl, '_blank');
    });
  }

  /* ========================================================================
     Service Worker / Offline Module
     ======================================================================== */

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

  /* ========================================================================
     Copy to Clipboard
     ======================================================================== */

  function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.dataset.copy;
        var span = btn.querySelector('span');
        var original = span.textContent;
        navigator.clipboard.writeText(text).then(function () {
          span.textContent = 'Copied!';
          setTimeout(function () { span.textContent = original; }, 2000);
        });
      });
    });
  }

  /* ========================================================================
     Init
     ======================================================================== */

  async function init() {
    currentLang = detectLanguage();

    initLangSwitcher();
    updateLangButtons();
    await loadTranslations(currentLang);

    initSegmentedProgress();
    applyTranslations();
    initLucideIcons();

    initLangMigration();
    initNavigation();
    initStepsDrawer();
    initTTS();
    initPdfDownload();
    initCopyButtons();

    initServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
