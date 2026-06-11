/**
 * format.js — 文本格式化（纯 Selection/Range API，零 execCommand）
 *
 * 所有格式化操作通过原生 Range API 实现：
 *   - 加粗/斜体/下划线：toggle 式，选中范围内若已有格式则祛除，否则包裹
 *   - 颜色/字号：span + inline style
 *   - 对齐：块级祖先 text-align
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before format.js');

  // ===================================================================
  //  加粗 / 斜体 / 下划线（toggle 模式）
  // ===================================================================

  /** 通用内联格式切换（strong / em / u） */
  function toggleInlineFormat(tagName) {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return false;

    const range = sel.getRangeAt(0);

    // —— 检查选区是否已在该格式标签内 ——
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
    const formatted = container.closest(tagName);

    if (formatted) {
      // 选区已在格式标签内 → 祛除格式（unwrap）
      unwrapElement(formatted);
      return true;
    }

    // —— 否则包裹格式 ——
    const tag = document.createElement(tagName);
    try {
      range.surroundContents(tag);
      sel.removeAllRanges();
    } catch (_) {
      // 跨节点选区 → extractContents 方案
      const fragment = range.extractContents();
      tag.appendChild(fragment);
      range.insertNode(tag);
      sel.removeAllRanges();
      // 光标放到包裹元素之后
      const nr = document.createRange();
      nr.setStartAfter(tag);
      nr.collapse(true);
      sel.addRange(nr);
    }
    return true;
  }

  /**
   * 祛除一个元素的包裹（将子节点提升到父级，移除自身）
   * 保留直接文本子节点；对于跨节点的情况靠 DOM normalize 合并相邻文本
   */
  function unwrapElement(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
    parent.normalize();
  }

  $.applyBold = function () {
    if (!$.ensureSelection()) return;
    toggleInlineFormat('strong');
    $.showNotification('✓ 已加粗');
    $.saveStateToHistory();
  };

  $.applyItalic = function () {
    if (!$.ensureSelection()) return;
    toggleInlineFormat('em');
    $.showNotification('✓ 已斜体');
    $.saveStateToHistory();
  };

  $.applyUnderline = function () {
    if (!$.ensureSelection()) return;
    toggleInlineFormat('u');
    $.showNotification('✓ 已添加下划线');
    $.saveStateToHistory();
  };

  // ===================================================================
  //  颜色（纯 span + inline style）
  // ===================================================================

  $.applyColor = function (color) {
    if (!$.ensureSelection()) return;
    $.wrapSelectionWithSpan(window.getSelection().getRangeAt(0), { color: color });
    $.showNotification('✓ 颜色已修改为 ' + color);
    $.saveStateToHistory();
  };

  // ===================================================================
  //  字号（纯 span + inline style）
  // ===================================================================

  $.applyFontSize = function (size) {
    if (!$.ensureSelection()) return;
    $.wrapSelectionWithSpan(window.getSelection().getRangeAt(0), { fontSize: size });
    $.showNotification('✓ 字号已修改为 ' + size);
    $.saveStateToHistory();
  };

  // ===================================================================
  //  对齐（块级 text-align）
  // ===================================================================

  $.applyAlign = function (alignment) {
    const sel = window.getSelection();
    $.restoreSelection();

    const alignLabels = { left: '左', center: '居中', right: '右' };

    // 有选区时：找选区所在的块级祖先
    if (sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      const block = $.findBlockAncestor(sel.getRangeAt(0).commonAncestorContainer);
      if (block) {
        block.style.setProperty('text-align', alignment, 'important');
        $.showNotification('✓ 已' + alignLabels[alignment] + '对齐');
        $.saveStateToHistory();
        return;
      }
    }

    // 无选区时：使用当前焦点元素
    const ae = document.activeElement;
    if (ae && ae.contentEditable === 'true') {
      ae.style.setProperty('text-align', alignment, 'important');
      $.showNotification('✓ 已' + alignLabels[alignment] + '对齐');
      $.saveStateToHistory();
      return;
    }

    $.showNotification('⚠ 请将光标放在段落中');
  };

  // ===================================================================
  //  内部辅助
  // ===================================================================

  /** 找到选区所在的最内层块级祖先 */
  $.findBlockAncestor = function (node) {
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    while (node && node !== document.body) {
      const display = window.getComputedStyle(node).display;
      if (
        display === 'block' ||
        display === 'flex' ||
        /^(DIV|P|H[1-6]|LI|SECTION|ARTICLE)$/i.test(node.tagName)
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  };

  /** 用 span 包裹选区并设置内联样式 */
  $.wrapSelectionWithSpan = function (range, styles) {
    const sel = window.getSelection();
    try {
      const span = document.createElement('span');
      if (styles.color) span.style.setProperty('color', styles.color, 'important');
      if (styles.fontSize) span.style.setProperty('font-size', styles.fontSize, 'important');
      range.surroundContents(span);
      sel.removeAllRanges();
    } catch (_) {
      // surroundContents 失败（跨节点选区）→ extractContents 方案
      const fragment = range.extractContents();
      const span = document.createElement('span');
      if (styles.color) span.style.setProperty('color', styles.color, 'important');
      if (styles.fontSize) span.style.setProperty('font-size', styles.fontSize, 'important');
      span.appendChild(fragment);
      range.insertNode(span);
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.setStartAfter(span);
      nr.collapse(true);
      sel.addRange(nr);
    }
  };
})();
