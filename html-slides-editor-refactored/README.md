# ⚡ HTML Slides Editor

> Chrome 浏览器扩展，可视化编辑 AI 生成的 HTML 演示文稿

## 功能

| 功能 | 说明 |
|------|------|
| 📝 文本编辑 | 点击即可编辑，支持所有常见 HTML 标签（h1-h6/p/li/div/span） |
| **B** /*I*/ / <u>U</u> | 加粗 / 斜体 / 下划线（快捷键 Ctrl+B/I/U） |
| 🎨 颜色 | 颜色选择器修改文字颜色 |
| 🔤 字号 | 自由输入字号（如 14px / 1.5em） |
| ⇤⇔⇥ 对齐 | 左对齐 / 居中 / 右对齐 |
| ↩↪ 撤销/重做 | 无限次撤销（Ctrl+Z/Y），基于 body 快照 |
| 🖼 图片替换 | 点击图片即可替换为本地文件 |
| 📥 导出 | 一键导出干净 HTML（Ctrl+S） |
| 📑 导航 | 左侧边栏幻灯片列表，点击跳转 |
| 🏷 元素标签 | 每个可编辑元素左上角显示标签名 |

## 安装

1. 克隆或下载本项目到本地
2. 打开 Chrome → `chrome://extensions` → 开启 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"** → 选择项目目录
4. 在扩展详情中勾选 **"允许访问文件网址"**（用于编辑本地 HTML 文件）

> 💡 图标文件需要 PNG 格式。可以在 `icons/` 目录放置 `icon16.png`、`icon48.png`、`icon128.png`，或使用任意 128x128 图片生成。

## 项目结构（v3.0 模块化重构）

```
html-slides-editor-refactored/
├── manifest.json          # 扩展配置（v3.0，模块加载顺序）
├── popup.html / popup.js  # 弹出面板
├── editor.css             # 编辑器样式
├── content/
│   ├── core.js            # 全局状态、消息监听
│   ├── utils.js           # 工具函数（通知、选区、幻灯片检测）
│   ├── history.js         # 撤销/重做栈
│   ├── format.js          # 格式化命令（B/I/U/颜色/字号/对齐）
│   ├── editable.js        # 编辑模式启停、元素标记
│   ├── toolbar.js         # Shadow DOM 工具栏
│   ├── sidebar.js         # 幻灯片侧边栏导航
│   ├── image.js           # 图片点击替换
│   └── export.js          # 导出 HTML + 键盘快捷键
├── icons/                 # 扩展图标
├── test-presentation.html # 测试用演示文稿
└── README.md
```

模块通过 `window.__WB_EDITOR__` 命名空间共享状态，按依赖顺序在 manifest.json 中加载。

## 使用

1. 打开任意 HTML 演示文稿（或使用 `test-presentation.html` 测试）
2. 点击浏览器工具栏中的扩展图标 → **"启动编辑模式"**
3. 选中文字 → 使用右上角工具栏编辑样式
4. 点击图片 → 选择新图片替换
5. 按 `Ctrl+S` 或点击"导出"保存编辑后的 HTML

## 快捷键

| 键 | 功能 |
|----|------|
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+S` | 导出 HTML |
| `Esc` | 退出编辑模式 |

## 技术

- **Chrome Extension Manifest V3**
- **Shadow DOM** 工具栏隔离页面 CSS
- **contentEditable** + `execCommand` 语义标签
- **快照式撤销**（body `.innerHTML` 保存/恢复，head 不动）
- 纯前端，无需服务器，无外部依赖

## 许可证

MIT License
