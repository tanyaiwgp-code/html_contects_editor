/**
 * utils.js — 工具函数：幻灯片检测、选区管理、通知、标签
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before utils.js');

  /** 检测页面中的幻灯片元素 */
  $.detectSlides = function () {
    const selectors = ['section', 'div.slide', '.slide-container', '[class*="slide"]', 'article'];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 1) return Array.from(elements);
    }
    return [document.body];
  };

  /** 保存当前选区 */
  $.saveSelection = function () {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
      $.savedSelection = {
        range: sel.getRangeAt(0).cloneRange(),
        startParent: sel.getRangeAt(0).startContainer.parentNode,
        text: sel.toString(),
      };
    }
  };

  /** 恢复保存的选区 */
  $.restoreSelection = function () {
    if (!$.savedSelection) return false;
    try {
      if (!document.contains($.savedSelection.startParent)) return false;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange($.savedSelection.range);
      return true;
    } catch (e) {
      return false;
    }
  };

  /** 确保有有效选区，无选区时弹提示 */
  $.ensureSelection = function () {
    if (!$.restoreSelection()) {
      $.showNotification('⚠ 请先选中要修改的文字');
      return false;
    }
    const sel = window.getSelection();
    if (sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
      $.showNotification('⚠ 请先选中要修改的文字');
      return false;
    }
    return true;
  };

  /** Toast 通知 */
  $.showNotification = function (msg) {
    const existing = document.getElementById('html-editor-notification');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'html-editor-notification';
    el.textContent = msg;
    el.style.cssText = [
      'position:fixed;bottom:30px;right:30px;',
      'background:linear-gradient(135deg,#1F2937,#374151);',
      'color:white;padding:12px 20px;border-radius:8px;',
      'z-index:100000;font-size:14px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'box-shadow:0 10px 25px rgba(0,0,0,0.3);',
      'animation:wb-slide-in 0.3s ease-out;',
    ].join('');

    const style = document.createElement('style');
    style.textContent =
      '@keyframes wb-slide-in{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  /** 给可编辑元素添加类型标签 */
  $.addTagLabel = function (el) {
    const oldLabel = el.querySelector('.wb-tag-label');
    if (oldLabel) oldLabel.remove();

    const tag = el.tagName.toLowerCase();
    const label = document.createElement('span');
    label.className = 'wb-tag-label';
    label.textContent = tag;
    label.contentEditable = 'false'; // 禁止光标进入标签内部
    label.style.cssText = [
      'position:absolute;top:-10px;left:-2px;font-size:9px;font-weight:700;',
      'background:#4F46E5;color:white;padding:1px 5px;border-radius:3px;',
      'z-index:99990;pointer-events:none;line-height:1.4;letter-spacing:0.5px;',
      'font-family:monospace;white-space:nowrap;user-select:none;',
    ].join('');

    if (window.getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(label);
  };

  $.removeAllTagLabels = function () {
    document.querySelectorAll('.wb-tag-label').forEach(el => el.remove());
  };

  /** 注册文档级事件监听器（撤销/重做后需重注册） */
  $.registerDocListeners = function () {
    if ($.docListenersRegistered) {
      document.removeEventListener('selectionchange', $.onSelectionChange);
      document.removeEventListener('keydown', $.onDocKeydown);
      document.removeEventListener('click', $.onDocClickImg, true);
    }
    document.addEventListener('selectionchange', $.onSelectionChange);
    document.addEventListener('keydown', $.onDocKeydown);
    document.addEventListener('click', $.onDocClickImg, true);
    $.docListenersRegistered = true;
  };
})();
