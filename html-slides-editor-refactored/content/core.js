/**
 * core.js — 全局状态、消息监听、初始化
 * 所有模块通过 window.__WB_EDITOR__ 共享状态
 */
(function () {
  'use strict';

  const STATE = {
    editMode: false,
    savedSelection: null,
    editCount: 0,
    undoStack: [],
    redoStack: [],
    MAX_HISTORY: 50,
    docListenersRegistered: false,
  };

  // 暴露到全局命名空间
  window.__WB_EDITOR__ = STATE;

  console.log('[HTML Slides Editor] Content script loaded v3.0 (modular)');

  // ==================== 消息监听（popup 通信） ====================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEdit') {
      if (STATE.editMode) {
        window.__WB_EDITOR__.disableEditMode();
        sendResponse({ editMode: false, slideCount: 0, editCount: STATE.editCount });
      } else {
        window.__WB_EDITOR__.enableEditMode();
        const slides = window.__WB_EDITOR__.detectSlides();
        sendResponse({ editMode: true, slideCount: slides.length, editCount: STATE.editCount });
      }
    }
    if (request.action === 'getStats') {
      const slides = window.__WB_EDITOR__.detectSlides();
      sendResponse({ slideCount: slides.length, editCount: STATE.editCount });
    }
    return true;
  });

  // 挂载调试接口
  window.undo = () => STATE.undo();
  window.redo = () => STATE.redo();
})();
