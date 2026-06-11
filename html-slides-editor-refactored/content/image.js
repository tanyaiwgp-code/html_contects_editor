/**
 * image.js — 图片点击替换为本地文件
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before image.js');

  /** 全局图片点击处理（注册在 document 捕获阶段） */
  $.onDocClickImg = function (e) {
    if (!$.editMode) return;
    const img = e.target.closest('img[data-wb-editable-img]');
    if (!img) return;

    e.preventDefault();
    e.stopPropagation();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function (ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (re) {
        img.src = re.target.result;
        $.showNotification('✓ 图片已替换');
        $.saveStateToHistory();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
})();
