/**
 * history.js — 撤销/重做栈管理
 * 基于 body.innerHTML 的快照式历史记录
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before history.js');

  /** 保存当前状态到历史栈 */
  $.saveStateToHistory = function () {
    try {
      const clone = document.body.cloneNode(true);
      $.cleanClone(clone);
      $.undoStack.push(clone.innerHTML);
      if ($.undoStack.length > $.MAX_HISTORY) $.undoStack.shift();
      $.redoStack = [];
      $.updateUndoRedoButtons();

      $.editCount++;
      const slides = $.detectSlides();
      chrome.storage.local.set({ slideCount: slides.length, editCount: $.editCount });
    } catch (e) {
      console.error('[Editor] saveStateToHistory:', e);
    }
  };

  /** 清理克隆 DOM 中的编辑器注入 */
  $.cleanClone = function (bodyClone) {
    bodyClone
      .querySelectorAll(
        '#html-editor-toolbar, #html-editor-sidebar, #html-editor-notification, .wb-tag-label'
      )
      .forEach(el => el.remove());

    bodyClone.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.cursor = '';
    });

    bodyClone.querySelectorAll('[style]').forEach(el => {
      if (el.style.position === 'relative') el.style.position = '';
    });

    bodyClone.querySelectorAll('[data-wb-editable-img]').forEach(el => {
      el.removeAttribute('data-wb-editable-img');
    });
  };

  /** 撤销 */
  $.undo = function () {
    if ($.undoStack.length <= 1) {
      $.showNotification('⚠ 没有可撤销的操作');
      return;
    }
    try {
      const currentState = $.undoStack.pop();
      $.redoStack.push(currentState);
      if ($.redoStack.length > $.MAX_HISTORY) $.redoStack.shift();

      document.body.innerHTML = $.undoStack[$.undoStack.length - 1];
      $.reInjectEditControls();
      $.showNotification('↩ 已撤销');
      $.updateUndoRedoButtons();
    } catch (e) {
      console.error('[Editor] undo:', e);
      $.showNotification('✗ 撤销失败');
    }
  };

  /** 重做 */
  $.redo = function () {
    if ($.redoStack.length === 0) {
      $.showNotification('⚠ 没有可重做的操作');
      return;
    }
    try {
      const nextState = $.redoStack.pop();
      $.undoStack.push(nextState);
      document.body.innerHTML = nextState;
      $.reInjectEditControls();
      $.showNotification('↪ 已重做');
      $.updateUndoRedoButtons();
    } catch (e) {
      console.error('[Editor] redo:', e);
      $.showNotification('✗ 重做失败');
    }
  };

  /** 更新工具栏撤销/重做按钮状态 */
  $.updateUndoRedoButtons = function () {
    const host = document.getElementById('html-editor-toolbar');
    if (!host || !host.shadowRoot) return;
    const root = host.shadowRoot;
    const ub = root.getElementById('btn-undo');
    const rb = root.getElementById('btn-redo');
    if (ub) ub.disabled = $.undoStack.length <= 1;
    if (rb) rb.disabled = $.redoStack.length === 0;
  };
})();
