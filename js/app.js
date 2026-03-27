/* ==========================================================================
   find.amalfi.day — Main Application
   ========================================================================== */

(function () {
  'use strict';

  /* --- Configuration --- */
  const SUPPORTED_LANGS = ['en', 'it', 'de', 'fr'];
  const DEFAULT_LANG = 'en';
  const LANG_COOKIE = 'lang';
  const SCROLL_KEY_PREFIX = 'scroll_';

  /* --- State --- */
  let currentLang = DEFAULT_LANG;
  let translations = {};
  let currentStep = 1;
  let totalSteps = 0;

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
    // 1. URL parameter
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;

    // 2. Cookie
    const cookie = document.cookie.split('; ').find(c => c.startsWith(LANG_COOKIE + '='));
    if (cookie) {
      const cookieLang = cookie.split('=')[1];
      if (SUPPORTED_LANGS.includes(cookieLang)) return cookieLang;
    }

    // 3. Browser language
    const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

    // 4. Default
    return DEFAULT_LANG;
  }

  function saveLangPreference(lang) {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
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
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = getNestedValue(translations, key);
      if (!value) return;
      // Use innerHTML for keys that contain HTML markup (e.g. save_hint)
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    });

    // Alt text
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      const value = getNestedValue(translations, key);
      if (value) el.alt = value;
    });

    // Update html lang
    document.documentElement.lang = currentLang;

    // Re-init Lucide icons (translations may have replaced icon elements)
    initLucideIcons();
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
     Navigation Module (Route Pages)
     ======================================================================== */

  function initNavigation() {
    const stepsContainer = document.querySelector('.steps');
    if (!stepsContainer) return;

    totalSteps = parseInt(stepsContainer.dataset.total, 10) || 0;
    const routeId = stepsContainer.dataset.route;

    const steps = document.querySelectorAll('.step');
    const progressFill = document.getElementById('progress-fill');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Make all steps visible for no-JS fallback handled by CSS
    // Observe steps for visibility animation
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          visibilityObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 100px 0px' });

    steps.forEach(step => visibilityObserver.observe(step));

    // Track current step via IntersectionObserver
    const stepObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const stepNum = parseInt(entry.target.id.replace('step-', ''), 10);
          if (stepNum && stepNum !== currentStep) {
            currentStep = stepNum;
            updateProgress();
            saveScrollPosition(routeId);
          }
        }
      });
    }, { threshold: 0.5 });

    steps.forEach(step => stepObserver.observe(step));

    function updateProgress() {
      const pct = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
      if (progressFill) progressFill.style.width = pct + '%';
      if (btnPrev) btnPrev.disabled = currentStep <= 1;
      if (btnNext) btnNext.disabled = currentStep >= totalSteps;
    }

    function scrollToStep(num) {
      const target = document.getElementById('step-' + num);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

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

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentStep > 1) scrollToStep(currentStep - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < totalSteps) scrollToStep(currentStep + 1);
      }
    });

    // Restore scroll position
    restoreScrollPosition(routeId);

    // Initial progress update
    updateProgress();
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
          // Small delay to let page render
          setTimeout(() => {
            const target = document.getElementById('step-' + stepNum);
            if (target) {
              target.scrollIntoView({ block: 'start' });
              currentStep = stepNum;
            }
          }, 100);
        }
      }
    } catch (e) { /* ignore */ }
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
      .then(reg => {
        console.log('SW registered:', reg.scope);
      })
      .catch(err => {
        console.warn('SW registration failed:', err);
      });

    // Listen for messages from SW
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
        text.textContent = getNestedValue(translations, 'common.downloading') || 'Downloading guide for offline use...';
        if (progressBar) progressBar.style.display = 'block';
        if (progressFill) progressFill.style.width = progress + '%';
      }

      if (type === 'CACHE_COMPLETE') {
        banner.classList.add('visible');
        banner.classList.remove('downloading');
        text.textContent = getNestedValue(translations, 'common.offline_ready') || 'Ready for offline use!';
        if (progressBar) progressBar.style.display = 'none';
        // Hide after 5 seconds
        setTimeout(() => banner.classList.remove('visible'), 5000);
      }
    });
  }

  /* ========================================================================
     Init
     ======================================================================== */

  async function init() {
    currentLang = detectLanguage();

    // Init language
    initLangSwitcher();
    updateLangButtons();
    await loadTranslations(currentLang);
    applyTranslations();

    // Init Lucide icons
    initLucideIcons();

    // Init route page features
    initNavigation();
    initPdfDownload();

    // Init copy buttons
    initCopyButtons();

    // Init offline
    initServiceWorker();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
