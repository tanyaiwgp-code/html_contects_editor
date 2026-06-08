// ==================== 全局状态 ====================
let editMode = false;
let savedSelection = null;
let editCount = 0;

// 撤销/重做历史栈
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

// ==================== 初始化 ====================
console.log('[HTML Slides Editor] Content script loaded v2.4 (stable)');

// 挂载到 window 供调试
window.undo = undo;
window.redo = redo;

// 监听popup消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEdit') {
    if (editMode) {
      disableEditMode();
      sendResponse({ editMode: false, slideCount: 0, editCount });
    } else {
      enableEditMode();
      const slides = detectSlides();
      sendResponse({ editMode: true, slideCount: slides.length, editCount });
    }
  }
  if (request.action === 'getStats') {
    const slides = detectSlides();
    sendResponse({ slideCount: slides.length, editCount });
  }
  return true;
});

// ==================== 持续追踪选区 ====================
function onSelectionChange() {
  if (!editMode) return;
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
    savedSelection = {
      range: sel.getRangeAt(0).cloneRange(),
      startParent: sel.getRangeAt(0).startContainer.parentNode,
      text: sel.toString()
    };
  }
}

// 注册文档级事件监听器（撤销/重做后需重新注册）
let docListenersRegistered = false;
function registerDocListeners() {
  if (docListenersRegistered) {
    document.removeEventListener('selectionchange', onSelectionChange);
    document.removeEventListener('keydown', onDocKeydown);
    document.removeEventListener('click', onDocClickImg, true);
  }
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('keydown', onDocKeydown);
  document.addEventListener('click', onDocClickImg, true);
  docListenersRegistered = true;
}

// 初始化时注册
registerDocListeners();

// ==================== 工具函数 ====================
function detectSlides() {
  const selectors = ['section', 'div.slide', '.slide-container', '[class*="slide"]', 'article'];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 1) return Array.from(elements);
  }
  return [document.body];
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
    savedSelection = {
      range: sel.getRangeAt(0).cloneRange(),
      startParent: sel.getRangeAt(0).startContainer.parentNode,
      text: sel.toString()
    };
  }
}

function restoreSelection() {
  if (!savedSelection) return false;
  try {
    if (!document.contains(savedSelection.startParent)) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelection.range);
    return true;
  } catch (e) { return false; }
}

// ==================== Enter 键处理 ====================
// v2.1：放弃复杂的 DOM split，改用 execCommand('insertLineBreak')
// 这是 contentEditable 最标准的换行方式，不会产生野元素
//
// 对于幻灯片编辑器来说，Enter = 插入 <br>（同行换行）是最自然的行为。
// Shift+Enter 也是 <br>，保持一致。
// 如需拆分段落，使用工具栏或以后添加专用功能。

function enterKeyHandler(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;

  const el = e.target;
  if (!el || el.contentEditable !== 'true') return;

  e.preventDefault();
  e.stopPropagation();

  // 标准 contentEditable 换行：插入 <br>
  document.execCommand('insertLineBreak', false, null);

  saveStateToHistory();
}

// 为单个元素注入编辑控件
function setupEditableElement(el) {
  el.setAttribute('contenteditable', 'true');
  el.style.outline = '2px dashed #4F46E5';
  el.style.outlineOffset = '2px';
  el.style.cursor = 'text';
  addTagLabel(el);
  el.addEventListener('keyup', () => { saveStateToHistory(); });
  el.addEventListener('keydown', enterKeyHandler);
}

// ==================== 核心：格式化应用 ====================

function ensureSelection() {
  if (!restoreSelection()) {
    showNotification('⚠ 请先选中要修改的文字');
    return false;
  }
  const sel = window.getSelection();
  if (sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
    showNotification('⚠ 请先选中要修改的文字');
    return false;
  }
  return true;
}

function applyBold() {
  if (!ensureSelection()) return;
  document.execCommand('bold', false, null);
  showNotification('✓ 已加粗');
  saveStateToHistory();
}

function applyItalic() {
  if (!ensureSelection()) return;
  document.execCommand('italic', false, null);
  showNotification('✓ 已斜体');
  saveStateToHistory();
}

function applyUnderline() {
  if (!ensureSelection()) return;
  document.execCommand('underline', false, null);
  showNotification('✓ 已添加下划线');
  saveStateToHistory();
}

function applyColor(color) {
  if (!ensureSelection()) return;
  const success = document.execCommand('foreColor', false, color);
  if (!success) {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    try {
      const span = document.createElement('span');
      span.style.setProperty('color', color, 'important');
      range.surroundContents(span);
      sel.removeAllRanges();
    } catch (_) {
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.setProperty('color', color, 'important');
      span.appendChild(fragment);
      range.insertNode(span);
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.setStartAfter(span);
      nr.collapse(true);
      sel.addRange(nr);
    }
  }
  showNotification('✓ 颜色已修改为 ' + color);
  saveStateToHistory();
}

function applyFontSize(size) {
  if (!ensureSelection()) return;
  const sel = window.getSelection();
  const range = sel.getRangeAt(0);
  try {
    const span = document.createElement('span');
    span.style.setProperty('font-size', size, 'important');
    range.surroundContents(span);
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.setStartAfter(span);
    nr.collapse(true);
    sel.addRange(nr);
  } catch (_) {
    const fragment = range.extractContents();
    const span = document.createElement('span');
    span.style.setProperty('font-size', size, 'important');
    span.appendChild(fragment);
    range.insertNode(span);
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.setStartAfter(span);
    nr.collapse(true);
    sel.addRange(nr);
  }
  showNotification('✓ 字号已修改为 ' + size);
  saveStateToHistory();
}

// ==================== 对齐 ====================
function applyAlign(alignment) {
  const sel = window.getSelection();
  restoreSelection();

  if (sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== document.body) {
      const display = window.getComputedStyle(node).display;
      if (display === 'block' || display === 'flex' || /^(DIV|P|H[1-6]|LI|SECTION|ARTICLE)$/i.test(node.tagName)) {
        node.style.setProperty('text-align', alignment, 'important');
        showNotification('✓ 已' + ({ left: '左', center: '居中', right: '右' }[alignment]) + '对齐');
        saveStateToHistory();
        return;
      }
      node = node.parentNode;
    }
  }

  const ae = document.activeElement;
  if (ae && ae.contentEditable === 'true') {
    ae.style.setProperty('text-align', alignment, 'important');
    showNotification('✓ 已' + ({ left: '左', center: '居中', right: '右' }[alignment]) + '对齐');
    saveStateToHistory();
    return;
  }
  showNotification('⚠ 请将光标放在段落中');
}

// ==================== 撤销/重做 ====================
function saveStateToHistory() {
  try {
    // 只存储 body 内容（保留 head，避免破坏页面样式/脚本）
    const clone = document.body.cloneNode(true);
    cleanClone(clone);
    undoStack.push(clone.innerHTML);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();

    editCount++;
    const slides = detectSlides();
    chrome.storage.local.set({ slideCount: slides.length, editCount });
  } catch (e) { console.error('[Editor] saveStateToHistory:', e); }
}

function cleanClone(bodyClone) {
  // 移除编辑器注入的 DOM（工具栏/侧边栏/通知/标签）
  bodyClone.querySelectorAll('#html-editor-toolbar, #html-editor-sidebar, #html-editor-notification, .wb-tag-label').forEach(el => el.remove());
  // 移除 contentEditable 属性 + 清理编辑器注入的 inline styles
  bodyClone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.cursor = '';
  });
  // 清理 addTagLabel 设置的 position:relative（通过 style 对象而非属性选择器，避免浏览器序列化空格差异）
  bodyClone.querySelectorAll('[style]').forEach(el => {
    if (el.style.position === 'relative') {
      el.style.position = '';
    }
  });
  // 清理编辑器图片标记属性（保留图片本身）
  bodyClone.querySelectorAll('[data-wb-editable-img]').forEach(el => {
    el.removeAttribute('data-wb-editable-img');
  });
}

function undo() {
  if (undoStack.length <= 1) { showNotification('⚠ 没有可撤销的操作'); return; }

  try {
    // 将当前状态（栈顶）弹出到 redo
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    if (redoStack.length > MAX_HISTORY) redoStack.shift();

    // 恢复上一个状态（现在栈顶就是要恢复的）
    const prevHtml = undoStack[undoStack.length - 1];
    document.body.innerHTML = prevHtml;
    reInjectEditControls();
    showNotification('↩ 已撤销');
    updateUndoRedoButtons();
  } catch (e) { console.error('[Editor] undo:', e); showNotification('✗ 撤销失败'); }
}

function redo() {
  if (redoStack.length === 0) { showNotification('⚠ 没有可重做的操作'); return; }

  try {
    const nextState = redoStack.pop();
    undoStack.push(nextState);

    document.body.innerHTML = nextState;
    reInjectEditControls();
    showNotification('↪ 已重做');
    updateUndoRedoButtons();
  } catch (e) { console.error('[Editor] redo:', e); showNotification('✗ 重做失败'); }
}

function updateUndoRedoButtons() {
  const host = document.getElementById('html-editor-toolbar');
  if (!host || !host.shadowRoot) return;
  const root = host.shadowRoot;
  const ub = root.getElementById('btn-undo');
  const rb = root.getElementById('btn-redo');
  if (ub) { ub.disabled = undoStack.length <= 1; }
  if (rb) { rb.disabled = redoStack.length === 0; }
}

// ==================== 元素类型标签 ====================
function addTagLabel(el) {
  const oldLabel = el.querySelector('.wb-tag-label');
  if (oldLabel) oldLabel.remove();

  const tag = el.tagName.toLowerCase();
  const label = document.createElement('span');
  label.className = 'wb-tag-label';
  label.textContent = tag;
  label.style.cssText = `
    position:absolute;top:-10px;left:-2px;font-size:9px;font-weight:700;
    background:#4F46E5;color:white;padding:1px 5px;border-radius:3px;
    z-index:99990;pointer-events:none;line-height:1.4;letter-spacing:0.5px;
    font-family:monospace;white-space:nowrap;
  `;

  const computed = window.getComputedStyle(el);
  if (computed.position === 'static') {
    el.style.position = 'relative';
  }
  el.appendChild(label);
}

function removeAllTagLabels() {
  document.querySelectorAll('.wb-tag-label').forEach(el => el.remove());
}

// ==================== 启动编辑模式 ====================
function enableEditMode() {
  const slides = detectSlides();
  undoStack = [];
  redoStack = [];
  editCount = 0;

  slides.forEach((slide, index) => {
    slide.setAttribute('data-slide-index', index);
    makeSlideEditable(slide);
  });

  // 保存初始状态（只存 body）
  const initClone = document.body.cloneNode(true);
  cleanClone(initClone);
  undoStack.push(initClone.innerHTML);

  createToolbar();
  createSidebar(slides);
  editMode = true;

  // 同步初始统计到 storage
  chrome.storage.local.set({ slideCount: slides.length, editCount: 0 });
  showNotification('✓ 已启用编辑模式 - ' + slides.length + ' 张幻灯片');
}

function makeSlideEditable(slide) {
  // 允许出现在文本元素内的内联格式化标签
  const INLINE_TAGS = new Set(['B', 'I', 'U', 'STRONG', 'EM', 'SPAN', 'A', 'CODE', 'SUB', 'SUP', 'MARK', 'SMALL']);
  const BLOCK_TAGS = ['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  // 检查元素是否只有文本 + 内联格式化子元素（不应被跳过）
  function isTextLike(el) {
    if (el.children.length === 0) return true;
    for (const child of el.children) {
      if (!INLINE_TAGS.has(child.tagName)) return false;
    }
    return true;
  }

  // 阶段1：处理有文本的叶子元素
  const textElements = slide.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, span, div, td, th, a, blockquote, code, pre, strong, em, label, dt, dd');
  textElements.forEach(el => {
    if (el.closest('#html-editor-toolbar') || el.closest('#html-editor-sidebar')) return;
    if (el.hasAttribute('contenteditable')) return;

    const directText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    const hasOnlyTextChildren = el.children.length === 0 || directText || isTextLike(el);

    if (hasOnlyTextChildren) {
      setupEditableElement(el);
    }
  });

  // 阶段2：处理块级元素（包括 li，可能在阶段1因有内联子元素被跳过）
  BLOCK_TAGS.forEach(tag => {
    slide.querySelectorAll(tag).forEach(el => {
      if (el.closest('#html-editor-toolbar') || el.closest('#html-editor-sidebar')) return;
      if (el.hasAttribute('contenteditable')) return;

      const text = el.textContent.trim();
      if (text !== '') {
        setupEditableElement(el);
      } else if (el.children.length === 0) {
        setupEditableElement(el);
        el.innerHTML = '<br>';
      }
    });
  });

  // 标记图片为可替换
  slide.querySelectorAll('img').forEach(img => {
    img.setAttribute('data-wb-editable-img', 'true');
    img.style.outline = '2px dashed #10B981';
    img.style.outlineOffset = '2px';
    img.style.cursor = 'pointer';
  });
}

// ==================== 重新注入编辑控件（撤销/重做后） ====================
function reInjectEditControls() {
  // 先清理可能残留的浏览器野元素
  cleanupOrphanedElements();

  const slides = detectSlides();
  slides.forEach((slide, index) => {
    slide.setAttribute('data-slide-index', index);
    makeSlideEditable(slide);
  });
  createToolbar();
  createSidebar(slides);
  editMode = true;

  // 重新注册文档级事件监听器（innerHTML 替换后原有监听器会失效）
  registerDocListeners();
}

// 清理在幻灯片容器之外、或明显是浏览器 Enter 残留的空元素
function cleanupOrphanedElements() {
  const slides = detectSlides();
  const slideSet = new Set(slides);

  // 清理不在任何幻灯片内的孤立空块元素
  document.querySelectorAll('div, p').forEach(el => {
    if (el.closest('#html-editor-toolbar') || el.closest('#html-editor-sidebar')) return;
    if (el.closest('.wb-tag-label')) return;

    // 检查是否在某个幻灯片内
    let inSlide = false;
    for (const slide of slides) {
      if (slide.contains(el)) { inSlide = true; break; }
    }
    if (inSlide) return;

    // 孤立空元素 → 移除
    const text = el.textContent.trim();
    if (text === '' && el.children.length <= 1) {
      el.remove();
    }
  });
}

// ==================== 工具栏（单行版 v2.4 — Shadow DOM 隔离）====================
// 使用 Shadow DOM 完全隔离页面 CSS，确保所有元素精确对齐
function createToolbar() {
  const existing = document.getElementById('html-editor-toolbar');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'html-editor-toolbar';
  const root = host.attachShadow({ mode: 'open' });

  // 所有样式在 shadow DOM 内，不受页面 CSS 影响
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

  // mousedown 捕获阶段保存选区（blur 前最后抢救）
  host.addEventListener('mousedown', (e) => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
      savedSelection = {
        range: sel.getRangeAt(0).cloneRange(),
        startParent: sel.getRangeAt(0).startContainer.parentNode,
        text: sel.toString()
      };
    }
  }, true);

  // 从 shadow root 中查询元素并绑定事件
  const $ = (id) => root.getElementById(id);
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-bold').addEventListener('click', applyBold);
  $('btn-italic').addEventListener('click', applyItalic);
  $('btn-underline').addEventListener('click', applyUnderline);
  $('btn-color').addEventListener('change', (e) => { applyColor(e.target.value); });
  $('btn-fontsize').addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val) return;
    if (/^\d+$/.test(val)) val += 'px';
    applyFontSize(val);
    e.target.value = '';
  });
  $('btn-align-left').addEventListener('click', () => applyAlign('left'));
  $('btn-align-center').addEventListener('click', () => applyAlign('center'));
  $('btn-align-right').addEventListener('click', () => applyAlign('right'));
  $('btn-export').addEventListener('click', exportHTML);
  $('btn-exit').addEventListener('click', disableEditMode);

  updateUndoRedoButtons();
}

// ==================== 侧边栏 ====================
function createSidebar(slides) {
  const existing = document.getElementById('html-editor-sidebar');
  if (existing) existing.remove();

  const sidebar = document.createElement('div');
  sidebar.id = 'html-editor-sidebar';
  sidebar.innerHTML = `
    <div style="position:fixed;left:20px;top:20px;width:180px;background:white;box-shadow:0 10px 25px rgba(0,0,0,0.15);border-radius:12px;padding:16px;z-index:99999;max-height:80vh;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <h4 style="margin:0 0 12px 0;font-size:14px;color:#374151;font-weight:600;">📑 幻灯片 (${slides.length})</h4>
      ${slides.map((_, i) => `
        <div class="slide-nav-item" data-index="${i}"
          style="padding:8px 12px;margin:4px 0;background:#F9FAFB;border-radius:6px;cursor:pointer;font-size:13px;color:#4B5563;transition:all 0.2s;border:2px solid transparent;">
          第 ${i + 1} 页
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(sidebar);

  sidebar.querySelectorAll('.slide-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const el = document.querySelector(`[data-slide-index="${item.getAttribute('data-index')}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    item.addEventListener('mouseenter', function () { this.style.background = '#EEF2FF'; this.style.borderColor = '#4F46E5'; this.style.color = '#312E81'; });
    item.addEventListener('mouseleave', function () { this.style.background = '#F9FAFB'; this.style.borderColor = 'transparent'; this.style.color = '#4B5563'; });
  });
}

// ==================== 图片替换 ====================
function onDocClickImg(e) {
  if (!editMode) return;
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
      showNotification('✓ 图片已替换');
      saveStateToHistory();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ==================== 导出 ====================
function exportHTML() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('#html-editor-toolbar, #html-editor-sidebar, #html-editor-notification, .wb-tag-label').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.cursor = '';
    el.style.position = '';
  });
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
  a.href = url; a.download = 'edited-slides.html'; a.click();
  URL.revokeObjectURL(url);
  showNotification('✓ HTML文件已导出！');
}

// ==================== 退出编辑 ====================
function disableEditMode() {
  undoStack = []; redoStack = []; savedSelection = null;
  document.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.style.outline = ''; el.style.outlineOffset = ''; el.style.cursor = '';
    el.style.position = '';
  });
  removeAllTagLabels();
  document.querySelectorAll('img[data-wb-editable-img]').forEach(el => {
    el.removeAttribute('data-wb-editable-img');
    el.style.outline = ''; el.style.outlineOffset = ''; el.style.cursor = '';
  });
  document.querySelectorAll('#html-editor-toolbar, #html-editor-sidebar').forEach(el => el.remove());
  editMode = false;

  // 保存最终统计
  chrome.storage.local.set({ slideCount: 0, editCount });
  showNotification('✓ 已退出编辑模式');
}

// ==================== 通知 ====================
function showNotification(msg) {
  const existing = document.getElementById('html-editor-notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'html-editor-notification';
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;bottom:30px;right:30px;
    background:linear-gradient(135deg,#1F2937,#374151);
    color:white;padding:12px 20px;border-radius:8px;
    z-index:100000;font-size:14px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    box-shadow:0 10px 25px rgba(0,0,0,0.3);
    animation:wb-slide-in 0.3s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = '@keyframes wb-slide-in{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}';
  document.head.appendChild(style);

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==================== 键盘快捷键 ====================
function onDocKeydown(e) {
  if (!editMode) return;
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); exportHTML(); return; }
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape') { disableEditMode(); return; }
}
