/**
 * toolbar.js — Shadow DOM 工具栏
 * 完全隔离页面 CSS，确保按钮精确对齐
 */
(function () {
  'use strict';
  const $ = window.__WB_EDITOR__;
  if (!$) throw new Error('core.js must load before toolbar.js');

  $.createToolbar = function () {
    const existing = document.getElementById('html-editor-toolbar');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'html-editor-toolbar';
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { margin:0;padding:0;box-sizing:border-box; }
        .bar {
          position:fixed;top:16px;right:16px;z-index:99999;
          background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
          box-shadow:0 6px 20px rgba(0,0,0,0.18);border-radius:8px;
          padding:4px 8px;
          display:flex;align-items:center;gap:3px;
          flex-wrap:nowrap;white-space:nowrap;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }
        .ico { height:26px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:13px;line-height:1; }
        .sep { width:1px;height:26px;flex-shrink:0;background:rgba(255,255,255,0.25); }
        button {
          height:26px;min-width:26px;display:inline-flex;align-items:center;justify-content:center;
          border:none;border-radius:5px;cursor:pointer;flex-shrink:0;
          padding:0 6px;font-size:13px;line-height:1;font-family:inherit;
          box-shadow:0 1px 3px rgba(0,0,0,0.08);transition:all 0.15s;
        }
        button:hover { transform:translateY(-1px);box-shadow:0 3px 6px rgba(0,0,0,0.15); }
        button:disabled { opacity:0.4;cursor:not-allowed; }
        button:disabled:hover { transform:none;box-shadow:0 1px 3px rgba(0,0,0,0.08); }
        .btn-light { background:rgba(255,255,255,0.92);color:#4B5563; }
        .btn-biu { background:rgba(255,255,255,0.92);color:#1F2937; }
        .btn-bold { font-weight:bold; }
        .btn-italic { font-style:italic;min-width:22px; }
        .btn-underline { text-decoration:underline;min-width:22px; }
        .btn-action { font-weight:600;padding:0 8px; }
        .btn-export { background:#10B981;color:#fff; }
        .btn-exit { background:#EF4444;color:#fff; }
        .btn-undo,.btn-redo { font-size:15px; }
        .inp-color { width:22px;height:22px;border:2px solid rgba(255,255,255,0.7);border-radius:4px;cursor:pointer;padding:0;flex-shrink:0;background:#fff; }
        .inp-fontsize { width:42px;height:26px;border:none;border-radius:5px;padding:0 4px;font-size:11px;flex-shrink:0;outline:none;font-family:inherit;line-height:26px; }
      </style>
      <div class="bar">
        <span class="ico">✏️</span>
        <div class="sep"></div>
        <button id="btn-undo" class="btn-light btn-undo" title="撤销 Ctrl+Z">↩</button>
        <button id="btn-redo" class="btn-light btn-redo" title="重做 Ctrl+Y">↪</button>
        <div class="sep"></div>
        <button id="btn-bold" class="btn-biu btn-bold" title="加粗 Ctrl+B">B</button>
        <button id="btn-italic" class="btn-biu btn-italic" title="斜体 Ctrl+I">I</button>
        <button id="btn-underline" class="btn-biu btn-underline" title="下划线 Ctrl+U">U</button>
        <div class="sep"></div>
        <input id="btn-color" type="color" value="#000000" title="文字颜色" class="inp-color">
        <input id="btn-fontsize" type="text" placeholder="字号" title="输入字号回车应用" class="inp-fontsize">
        <div class="sep"></div>
        <button id="btn-align-left" class="btn-light" title="左对齐">⇤</button>
        <button id="btn-align-center" class="btn-light" title="居中">⇔</button>
        <button id="btn-align-right" class="btn-light" title="右对齐">⇥</button>
        <div class="sep"></div>
        <button id="btn-export" class="btn-action btn-export" title="导出 Ctrl+S">📥 导出</button>
        <button id="btn-exit" class="btn-action btn-exit" title="退出 Esc">✕ 退出</button>
      </div>
    `;

    document.body.appendChild(host);

    // mousedown 捕获阶段保存选区（blur 前抢救）
    host.addEventListener(
      'mousedown',
      e => {
        $.saveSelection();
      },
      true
    );

    // 绑定事件
    const $s = id => root.getElementById(id);
    $s('btn-undo').addEventListener('click', $.undo);
    $s('btn-redo').addEventListener('click', $.redo);
    $s('btn-bold').addEventListener('click', $.applyBold);
    $s('btn-italic').addEventListener('click', $.applyItalic);
    $s('btn-underline').addEventListener('click', $.applyUnderline);
    $s('btn-color').addEventListener('change', e => $.applyColor(e.target.value));
    $s('btn-fontsize').addEventListener('change', e => {
      let val = e.target.value.trim();
      if (!val) return;
      if (/^\d+$/.test(val)) val += 'px';
      $.applyFontSize(val);
      e.target.value = '';
    });
    $s('btn-align-left').addEventListener('click', () => $.applyAlign('left'));
    $s('btn-align-center').addEventListener('click', () => $.applyAlign('center'));
    $s('btn-align-right').addEventListener('click', () => $.applyAlign('right'));
    $s('btn-export').addEventListener('click', $.exportHTML);
    $s('btn-exit').addEventListener('click', $.disableEditMode);

    $.updateUndoRedoButtons();
  };
})();
