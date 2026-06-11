/**
 * export.js — 导出 HTML 与键盘快捷键监听
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before export.js');

  /** 选区变化监听 */
  $.onSelectionChange = function () {
    if (!$.editMode) return;
    $.saveSelection();
  };

  /** 键盘快捷键分发 */
  $.onDocKeydown = function (e) {
    if (!$.editMode) return;

    // Ctrl+S → 导出
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      $.exportHTML();
      return;
    }

    // Ctrl+Z → 撤销
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      $.undo();
      return;
    }

    // Ctrl+Y 或 Ctrl+Shift+Z → 重做
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      $.redo();
      return;
    }

    // Esc → 退出编辑模式
    if (e.key === 'Escape') {
      $.disableEditMode();
      return;
    }
  };

  /** 导出干净 HTML */
  $.exportHTML = function () {
    const clone = document.documentElement.cloneNode(true);

    // 移除编辑器注入
    clone
      .querySelectorAll(
        '#html-editor-toolbar, #html-editor-sidebar, #html-editor-notification, .wb-tag-label'
      )
      .forEach(el => el.remove());

    // 清理 contentEditable 属性
    clone.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = '';
      el.style.position = '';
    });

    // 清理图片标记
    clone.querySelectorAll('[data-wb-editable-img]').forEach(el => {
      el.removeAttribute('data-wb-editable-img');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = '';
    });

    const html = '<!DOCTYPE html>\n' + clone.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-slides.html';
    a.click();
    URL.revokeObjectURL(url);
    $.showNotification('✓ HTML文件已导出！');
  };
})();
