/* ==========================================================================
   find.amalfi.day — Lightbox
   Tap any step photo for a fullscreen view with pinch-zoom and swipe.
   ========================================================================== */

(function () {
  'use strict';

  let images = [];
  let currentIndex = 0;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  // Pointer state for pan
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panStartTranslateX = 0;
  let panStartTranslateY = 0;

  // Pinch state
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  const activePointers = new Map();

  // Swipe between images (only when not zoomed)
  let swipeStartX = null;
  let swipeStartY = null;

  let overlay, imgEl, captionEl, counterEl;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Photo viewer');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
      <button class="lightbox-prev" type="button" aria-label="Previous">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button class="lightbox-next" type="button" aria-label="Next">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <div class="lightbox-stage">
        <img class="lightbox-img" alt="">
      </div>
      <div class="lightbox-meta">
        <span class="lightbox-counter"></span>
        <span class="lightbox-caption"></span>
      </div>
    `;
    document.body.appendChild(overlay);

    imgEl = overlay.querySelector('.lightbox-img');
    captionEl = overlay.querySelector('.lightbox-caption');
    counterEl = overlay.querySelector('.lightbox-counter');

    overlay.querySelector('.lightbox-close').addEventListener('click', close);
    overlay.querySelector('.lightbox-prev').addEventListener('click', () => navigate(-1));
    overlay.querySelector('.lightbox-next').addEventListener('click', () => navigate(1));

    const stage = overlay.querySelector('.lightbox-stage');
    stage.addEventListener('click', (e) => {
      if (e.target === stage) close();
    });

    // Pointer-based pan + pinch
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('pointerleave', onPointerUp);

    // Double-tap to toggle zoom
    let lastTap = 0;
    stage.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 300 && e.target === imgEl) {
        if (scale > 1) {
          resetTransform();
        } else {
          scale = 2.5;
          applyTransform();
        }
      }
      lastTap = now;
    });

    // Wheel zoom (desktop)
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        scale = Math.min(5, Math.max(1, scale + delta));
        if (scale === 1) resetTransform();
        else applyTransform();
      }
    }, { passive: false });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (overlay.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
    });
  }

  function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function onPointerDown(e) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 1) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartTranslateX = translateX;
      panStartTranslateY = translateY;
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartScale = scale;
      isPanning = false;
    }
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const newDist = dist(pts[0], pts[1]);
      if (pinchStartDist > 0) {
        scale = Math.min(5, Math.max(1, pinchStartScale * (newDist / pinchStartDist)));
        applyTransform();
      }
    } else if (isPanning && scale > 1) {
      translateX = panStartTranslateX + (e.clientX - panStartX);
      translateY = panStartTranslateY + (e.clientY - panStartY);
      applyTransform();
    }
  }

  function onPointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStartDist = 0;
    if (activePointers.size === 0) {
      // If we weren't zoomed and the gesture was mostly horizontal, treat as swipe
      if (scale === 1 && swipeStartX !== null) {
        const dx = e.clientX - swipeStartX;
        const dy = Math.abs(e.clientY - (swipeStartY || 0));
        if (Math.abs(dx) > 60 && dy < 80) {
          if (dx > 0) navigate(-1);
          else navigate(1);
        }
      }
      if (scale < 1.05) resetTransform();
      isPanning = false;
      swipeStartX = null;
      swipeStartY = null;
    }
  }

  function applyTransform() {
    imgEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function navigate(delta) {
    if (!images.length) return;
    currentIndex = (currentIndex + delta + images.length) % images.length;
    showCurrent();
  }

  function showCurrent() {
    if (!images.length) return;
    const src = images[currentIndex];
    imgEl.src = src.full;
    imgEl.alt = src.alt || '';
    captionEl.textContent = src.caption || '';
    counterEl.textContent = `${currentIndex + 1} / ${images.length}`;
    resetTransform();
  }

  function open(index) {
    if (!overlay) buildOverlay();
    currentIndex = index;
    showCurrent();
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
  }

  function close() {
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    resetTransform();
  }

  function init() {
    const stepPhotos = Array.from(document.querySelectorAll('.step-photo'));
    if (!stepPhotos.length) return;

    images = stepPhotos.map(photo => {
      const img = photo.querySelector('img');
      return {
        full: img ? img.src : '',
        alt: img ? img.alt : '',
        caption: '',
        photoEl: photo,
      };
    });

    function refreshCaptions() {
      stepPhotos.forEach((photo, i) => {
        const step = photo.closest('.step');
        const cap = step ? step.querySelector('.step-caption') : null;
        const img = photo.querySelector('img');
        images[i].caption = cap ? cap.textContent.trim() : '';
        if (img) {
          images[i].alt = img.alt;
          images[i].full = img.src;
        }
      });
    }

    stepPhotos.forEach((photo, i) => {
      photo.style.cursor = 'zoom-in';
      photo.addEventListener('click', (e) => {
        // Don't trigger if click came from a button overlay
        if (e.target.closest('button')) return;
        refreshCaptions();
        open(i);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
