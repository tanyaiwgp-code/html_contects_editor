/**
 * editable.js — 编辑模式启用/禁用、元素编辑化、清理
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before editable.js');

  const INLINE_TAGS = new Set([
    'B', 'I', 'U', 'STRONG', 'EM', 'SPAN', 'A', 'CODE', 'SUB', 'SUP', 'MARK', 'SMALL',
  ]);
  const BLOCK_TAGS = ['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  // ==================== Enter 键处理 ====================
  // 纯 Selection/Range API，不依赖 execCommand
  $.enterKeyHandler = function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const el = e.target;
    // 用 isContentEditable 替代 contentEditable === 'true'，正确处理 inherit 情况
    if (!el || !el.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents(); // 清除可能存在的选区

    // 在光标处插入 <br>
    const br = document.createElement('br');
    range.insertNode(br);

    // 光标移到 <br> 之后，确保后续输入在换行后
    range.setStartAfter(br);
    range.setEndAfter(br);
    sel.removeAllRanges();
    sel.addRange(range);

    $.saveStateToHistory();
  };

  /** 判断元素是否仅含文本/内联子节点 */
  function isTextLike(el) {
    if (el.children.length === 0) return true;
    for (const child of el.children) {
      if (!INLINE_TAGS.has(child.tagName)) return false;
    }
    return true;
  }

  /** 为单个元素注入编辑能力 */
  $.setupEditableElement = function (el) {
    el.setAttribute('contenteditable', 'true');
    el.style.outline = '2px dashed #4F46E5';
    el.style.outlineOffset = '2px';
    el.style.cursor = 'text';
    $.addTagLabel(el);
    el.addEventListener('keyup', () => $.saveStateToHistory());
    el.addEventListener('keydown', $.enterKeyHandler);
  };

  /** 标记幻灯片中所有可编辑元素 */
  $.makeSlideEditable = function (slide) {
    const safe = el =>
      !el.closest('#html-editor-toolbar') &&
      !el.closest('#html-editor-sidebar') &&
      !el.hasAttribute('contenteditable');

    // 阶段1：文本叶子元素
    slide
      .querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, li, span, div, td, th, a, blockquote, code, pre, strong, em, label, dt, dd'
      )
      .forEach(el => {
        if (!safe(el)) return;
        const directText = Array.from(el.childNodes).some(
          n => n.nodeType === 3 && n.textContent.trim()
        );
        if (el.children.length === 0 || directText || isTextLike(el)) {
          $.setupEditableElement(el);
        }
      });

    // 阶段2：块级元素兜底
    BLOCK_TAGS.forEach(tag => {
      slide.querySelectorAll(tag).forEach(el => {
        if (!safe(el)) return;
        const text = el.textContent.trim();
        if (text !== '') {
          $.setupEditableElement(el);
        } else if (el.children.length === 0) {
          $.setupEditableElement(el);
          el.innerHTML = '<br>';
        }
      });
    });

    // 标记图片
    slide.querySelectorAll('img').forEach(img => {
      img.setAttribute('data-wb-editable-img', 'true');
      img.style.outline = '2px dashed #10B981';
      img.style.outlineOffset = '2px';
      img.style.cursor = 'pointer';
    });
  };

  // ==================== 启用编辑模式 ====================
  $.enableEditMode = function () {
    const slides = $.detectSlides();
    $.undoStack = [];
    $.redoStack = [];
    $.editCount = 0;

    slides.forEach((slide, index) => {
      slide.setAttribute('data-slide-index', index);
      $.makeSlideEditable(slide);
    });

    // 保存初始状态
    const initClone = document.body.cloneNode(true);
    $.cleanClone(initClone);
    $.undoStack.push(initClone.innerHTML);

    $.createToolbar();
    $.createSidebar(slides);
    $.editMode = true;

    chrome.storage.local.set({ slideCount: slides.length, editCount: 0 });
    $.showNotification('✓ 已启用编辑模式 - ' + slides.length + ' 张幻灯片');
  };

  // ==================== 重新注入（撤销/重做后） ====================
  $.reInjectEditControls = function () {
    $.cleanupOrphanedElements();
    const slides = $.detectSlides();
    slides.forEach((slide, index) => {
      slide.setAttribute('data-slide-index', index);
      $.makeSlideEditable(slide);
    });
    $.createToolbar();
    $.createSidebar(slides);
    $.editMode = true;
    $.registerDocListeners();
  };

  /** 清理不在任何幻灯片内的孤立空块元素 */
  $.cleanupOrphanedElements = function () {
    const slides = $.detectSlides();
    document.querySelectorAll('div, p').forEach(el => {
      if (
        el.closest('#html-editor-toolbar') ||
        el.closest('#html-editor-sidebar') ||
        el.closest('.wb-tag-label')
      )
        return;

      const inSlide = slides.some(s => s.contains(el));
      if (inSlide) return;

      if (el.textContent.trim() === '' && el.children.length <= 1) {
        el.remove();
      }
    });
  };

  // ==================== 禁用编辑模式 ====================
  $.disableEditMode = function () {
    $.undoStack = [];
    $.redoStack = [];
    $.savedSelection = null;

    document.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = '';
      el.style.position = '';
    });

    $.removeAllTagLabels();

    document.querySelectorAll('img[data-wb-editable-img]').forEach(el => {
      el.removeAttribute('data-wb-editable-img');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = '';
    });

    document
      .querySelectorAll('#html-editor-toolbar, #html-editor-sidebar')
      .forEach(el => el.remove());

    $.editMode = false;
    chrome.storage.local.set({ slideCount: 0, editCount: $.editCount });
    $.showNotification('✓ 已退出编辑模式');
  };
})();
