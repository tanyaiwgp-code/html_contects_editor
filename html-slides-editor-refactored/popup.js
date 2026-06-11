// 弹出窗口逻辑
let editMode = false;
let stats = {
  slideCount: 0,
  editCount: 0
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  // 同时主动向当前页面查询实时统计
  queryCurrentTabStats();
  updateUI();
});

// 加载统计信息
function loadStats() {
  chrome.storage.local.get(['slideCount', 'editCount'], (result) => {
    stats.slideCount = result.slideCount || 0;
    stats.editCount = result.editCount || 0;
    updateStats();
  });
}

// 主动向当前 tab 的 content script 查询实时统计
function queryCurrentTabStats() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
      if (chrome.runtime.lastError) return; // content script 未注入，忽略
      if (response) {
        if (response.slideCount !== undefined) stats.slideCount = response.slideCount;
        if (response.editCount !== undefined) stats.editCount = response.editCount;
        updateStats();
        saveStats();
      }
    });
  });
}

// 更新统计显示
function updateStats() {
  document.getElementById('slideCount').textContent = stats.slideCount;
  document.getElementById('editCount').textContent = stats.editCount;
}

// 保存统计信息
function saveStats() {
  chrome.storage.local.set({
    slideCount: stats.slideCount,
    editCount: stats.editCount
  });
}

// 更新UI状态
function updateUI() {
  const button = document.getElementById('toggleEdit');
  const status = document.getElementById('status');
  
  if (editMode) {
    button.textContent = '退出编辑模式';
    button.classList.add('editing');
    status.textContent = '编辑中...';
  } else {
    button.textContent = '启动编辑模式';
    button.classList.remove('editing');
    status.textContent = '就绪';
  }
}

// 切换编辑模式
document.getElementById('toggleEdit').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleEdit' }, (response) => {
        if (chrome.runtime.lastError) {
          // 内容脚本未加载
          showError('请在HTML页面上使用该插件');
          return;
        }
        
        if (response) {
          editMode = response.editMode;
          if (response.slideCount !== undefined) {
            stats.slideCount = response.slideCount;
          }
          if (response.editCount !== undefined) {
            stats.editCount = response.editCount;
          }
          updateUI();
          updateStats();
          saveStats();
        }
      });
    }
  });
});

// 显示错误提示
function showError(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = '#FCD34D';
  setTimeout(() => {
    status.textContent = '就绪';
    status.style.color = 'white';
  }, 3000);
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    if (request.slideCount !== undefined) {
      stats.slideCount = request.slideCount;
    }
    if (request.editCount !== undefined) {
      stats.editCount = request.editCount;
    }
    updateStats();
    saveStats();
  }
});
