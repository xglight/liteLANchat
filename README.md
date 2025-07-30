# liteLANchat 局域网聊天系统

一个简单易用的局域网聊天系统，支持多房间聊天、图片发送和 Markdown 语法。

## 功能特性

- 多房间聊天
- 实时消息同步
- 在线用户列表
- 图片发送（本地图片和网络图片）
- Markdown 语法支持
- Latex 公式支持
- 代码高亮显示
- 聊天记录保存

## 快速开始

### 安装和启动
```bash
npm install
node server.js
```

### 使用步骤
1. 打开浏览器访问 `http://localhost:3000`
2. 输入昵称进入大厅
3. 创建或加入聊天室
4. 开始聊天！

## Markdown 支持

- **粗体**：`**文字**`
- *斜体*：`*文字*`
- `行内代码`：`` `代码` ``
- [链接](https://example.com)：`[链接文字](URL)`
- 图片：`![描述](图片URL)` 或点击🖼️按钮上传本地图片
- 代码块：使用三个反引号包裹代码

## 技术栈

- 前端：HTML5、CSS3、JavaScript
- 后端：Node.js、Express
- 数据库：SQLite
- 实时通信：WebSocket
- Markdown 渲染：marked
- Latex 渲染：KaTeX

## 注意事项

- 图片大小限制为 5MB
- 支持常见图片格式（JPG、PNG、GIF、WebP 等）
- 建议使用现代浏览器 