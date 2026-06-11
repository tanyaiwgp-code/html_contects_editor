/**
 * sidebar.js — 幻灯片侧边栏列表与智能导航
 * 支持垂直滚动、横向 scroll-snap、CSS transform 三种翻页模式
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before sidebar.js');

  /** 创建侧边栏 */
  $.createSidebar = function (slides) {
    const existing = document.getElementById('html-editor-sidebar');
    if (existing) existing.remove();

    const sidebar = document.createElement('div');
    sidebar.id = 'html-editor-sidebar';
    sidebar.innerHTML =
      `<div style="position:fixed;left:20px;top:20px;width:180px;background:white;box-shadow:0 10px 25px rgba(0,0,0,0.15);border-radius:12px;padding:16px;z-index:99999;max-height:80vh;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <h4 style="margin:0 0 12px 0;font-size:14px;color:#374151;font-weight:600;">📑 幻灯片 (${slides.length})</h4>
        ${slides
          .map(
            (_, i) =>
              `<div class="slide-nav-item" data-index="${i}"
                style="padding:8px 12px;margin:4px 0;background:#F9FAFB;border-radius:6px;cursor:pointer;font-size:13px;color:#4B5563;transition:all 0.2s;border:2px solid transparent;">
                第 ${i + 1} 页
              </div>`
          )
          .join('')}
      </div>`;
    document.body.appendChild(sidebar);

    sidebar.querySelectorAll('.slide-nav-item').forEach(item => {
      const idx = parseInt(item.getAttribute('data-index'), 10);
      item.addEventListener('click', () => $.navigateToSlide(idx, slides.length));
      item.addEventListener('mouseenter', function () {
        this.style.background = '#EEF2FF';
        this.style.borderColor = '#4F46E5';
        this.style.color = '#312E81';
      });
      item.addEventListener('mouseleave', function () {
        this.style.background = '#F9FAFB';
        this.style.borderColor = 'transparent';
        this.style.color = '#4B5563';
      });
    });
  };

  /** 智能幻灯片导航 — 3 层降级策略 */
  $.navigateToSlide = function (slideIndex, totalSlides) {
    const el = document.querySelector(`[data-slide-index="${slideIndex}"]`);
    if (!el) return;

    // 策略1：scrollIntoView（适用大多数情况）
    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });

    // 400ms 后检测是否可见
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const visible =
        rect.left > -50 &&
        rect.right < window.innerWidth + 50 &&
        rect.top > -50 &&
        rect.bottom < window.innerHeight + 50;
      if (visible) return;

      // 策略2a：全局导航函数
      if (typeof window.goToSlide === 'function') {
        window.goToSlide(slideIndex);
        return;
      }
      if (typeof window.slideTo === 'function') {
        window.slideTo(slideIndex);
        return;
      }

      // 策略2b：页面自身的导航控件（点状/条状指示器）
      const navPatterns = [
        '[class*="dot"]',
        '[class*="bullet"]',
        '[class*="indicator"]',
        '[class*="pagination"] > *',
        '[class*="nav-dot"]',
        '[role="tab"]',
        'nav [class*="item"]',
      ];
      for (const sel of navPatterns) {
        const items = document.querySelectorAll(sel);
        if (items.length === totalSlides && items[slideIndex]) {
          items[slideIndex].click();
          return;
        }
      }

      // 策略2c：方向键模拟逐页跳转
      let currentIdx = -1;
      for (let i = 0; i < totalSlides; i++) {
        const s = document.querySelector(`[data-slide-index="${i}"]`);
        if (s) {
          const r = s.getBoundingClientRect();
          if (
            r.left > -50 &&
            r.right < window.innerWidth + 50 &&
            r.top > -50 &&
            r.bottom < window.innerHeight + 50
          ) {
            currentIdx = i;
            break;
          }
        }
      }
      if (currentIdx >= 0 && currentIdx !== slideIndex) {
        const key = slideIndex > currentIdx ? 'ArrowRight' : 'ArrowLeft';
        const steps = Math.abs(slideIndex - currentIdx);
        for (let s = 0; s < steps; s++) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        }
        $.showNotification(`📑 跳转到第 ${slideIndex + 1} 页`);
      }
    }, 400);
  };
})();
