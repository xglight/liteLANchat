// client.js
document.addEventListener('DOMContentLoaded', function () {
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('send');
    const history = document.getElementById('history');
    const previewArea = document.getElementById('preview-area');
    const previewBtn = document.getElementById('btn-preview');
    const toolbar = document.getElementById('toolbar');
    const imageBtn = document.getElementById('btn-image');
    const imageUpload = document.getElementById('image-upload');
    const userList = document.getElementById('user-list');
    const noticeBar = document.getElementById('notice-bar');
    const exitRoomBtn = document.getElementById('exit-room-btn');
    let ws;
    let isCurrentUserOwner = false; // 全局变量跟踪当前用户是否为房主

    // 连接 WebSocket
    function connectWS() {
        ws = new WebSocket(`ws://${location.host}`);
        ws.binaryType = 'arraybuffer';

        ws.onopen = function () {
            ws.send(strToHex(JSON.stringify({
                type: 'login',
                nickname: window.NICKNAME,
                room: window.ROOM
            })));

            // 连接建立后检查房主状态
            setTimeout(() => {
                checkOwnerStatus();
            }, 1000);
        };

        ws.onmessage = function (event) {
            let msg;
            try {
                msg = JSON.parse(hexToStr(event.data));
            } catch {
                return;
            }
            if (msg.type === 'history') {
                history.innerHTML = '';
                msg.history.forEach(m => appendMsg(m.nickname, m.content, m.time));
                history.scrollTop = history.scrollHeight;
            } else if (msg.type === 'chat') {
                appendMsg(msg.nickname, msg.content, msg.time);
                // 新消息自动滚动到底部
                history.scrollTop = history.scrollHeight;
            } else if (msg.type === 'users') {
                renderUserList(msg.users);
            } else if (msg.type === 'notice') {
                noticeBar.textContent = msg.notice || '';
            } else if (msg.type === 'kicked') {
                alert('你已被房主移出房间');
                window.location.href = 'hall.html';
            } else if (msg.type === 'room_deleted') {
                alert('房间已被房主解散');
                window.location.href = 'hall.html';
            } else if (msg.type === 'owner_changed') {
                alert('房主已变更为：' + msg.newOwner);
                // 重新检查房主状态以更新UI
                checkOwnerStatus();
            } else if (msg.type === 'room_user_counts') {
                // 更新房间用户数量显示
                updateRoomUserCounts(msg.roomUserCounts);
            }
        };

        ws.onclose = function () {
            setTimeout(connectWS, 2000); // 自动重连
        };
    }
    connectWS();

    // 页面加载完成后自动滚动到底部
    setTimeout(() => {
        history.scrollTop = history.scrollHeight;
    }, 100);

    // 初始检查房主状态
    setTimeout(() => {
        checkOwnerStatus();
    }, 500);

    // 发送按钮启用逻辑
    messageInput.addEventListener('input', function () {
        const hasText = messageInput.value.trim();
        const hasImage = document.querySelector('.img-preview img');
        sendBtn.disabled = !hasText && !hasImage;
        // 实时渲染 markdown 预览
        previewArea.style.display = 'block';
        previewArea.innerHTML = marked.parse(messageInput.value);

        // 渲染LaTeX
        renderMathInElement(previewArea, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false,
            errorColor: '#cc0000'
        });

        hljs.highlightAll();
    });

    // 图片上传
    imageBtn.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            // 在输入框上方显示图片预览
            const imgPreview = document.createElement('div');
            imgPreview.className = 'img-preview';
            imgPreview.innerHTML = `
                <img src="${e.target.result}" alt="预览图片" style="max-width: 120px; max-height: 80px; border-radius: 4px; margin: 8px 0;">
                <button type="button" class="remove-img" style="margin-left: 8px; padding: 2px 6px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer;">删除</button>
            `;

            // 插入到输入框之前
            const inputRow = document.querySelector('.input-row');
            inputRow.parentNode.insertBefore(imgPreview, inputRow);

            // 删除按钮事件
            imgPreview.querySelector('.remove-img').addEventListener('click', function () {
                imgPreview.remove();
                // 更新发送按钮状态
                messageInput.dispatchEvent(new Event('input'));
            });

            // 不在文本框中显示任何内容，只显示预览
            messageInput.focus();
            // 更新发送按钮状态
            messageInput.dispatchEvent(new Event('input'));
        };
        reader.readAsDataURL(file);
        this.value = '';
    });

    // 发送消息
    function sendMessage(imgUrl) {
        let text = messageInput.value.trim();

        // 检查是否有图片预览
        const imgPreview = document.querySelector('.img-preview img');
        let content = '';

        if (imgPreview) {
            const imgSrc = imgPreview.src;
            if (text) {
                // 有图片和文字：图片在上，文字在下（确保换行）
                content = `![](${imgSrc})\n\n${text}`;
            } else {
                // 只有图片
                content = `![](${imgSrc})`;
            }
        } else {
            // 只有文字
            content = text;
        }

        if (!text && !imgPreview) return;

        ws.send(strToHex(JSON.stringify({
            type: 'chat',
            content: content,
            room: window.ROOM
        })));
        messageInput.value = '';
        sendBtn.disabled = true;
        messageInput.focus();
        previewArea.style.display = 'none';

        // 发送后删除图片预览
        if (imgPreview) {
            imgPreview.closest('.img-preview').remove();
        }
    }

    sendBtn.addEventListener('click', () => sendMessage());

    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            if (e.ctrlKey) {
                // Ctrl+Enter 换行
                e.preventDefault();
                messageInput.value += '\n';
            } else if (e.shiftKey) {
                // Shift+Enter 换行
                e.preventDefault();
                messageInput.value += '\n';
            } else {
                // 普通 Enter 发送消息
                e.preventDefault();
                sendMessage();
            }
        }
    });

    // 添加键盘快捷键支持
    document.addEventListener('keydown', function (e) {
        // Ctrl+Q 或 Esc 退出房间
        if ((e.ctrlKey && e.key === 'q') || e.key === 'Escape') {
            e.preventDefault();
            exitRoomBtn.click();
        }
    });

    // Markdown 预览按钮（不再切换显示，仅手动刷新）
    previewBtn.addEventListener('click', function () {
        previewArea.style.display = 'block';
        previewArea.innerHTML = marked.parse(messageInput.value);

        // 渲染LaTeX
        renderMathInElement(previewArea, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false,
            errorColor: '#cc0000'
        });

        hljs.highlightAll();
    });

    // 工具栏按钮（加粗、斜体、代码等）
    toolbar.addEventListener('click', function (e) {
        if (e.target.id === 'btn-bold') {
            insertMarkdown(messageInput, '**', '**');
        }
        if (e.target.id === 'btn-italic') {
            insertMarkdown(messageInput, '*', '*');
        }
        if (e.target.id === 'btn-code') {
            insertMarkdown(messageInput, '```\n', '\n```');
        }
        if (e.target.id === 'btn-latex') {
            showLatexDialog();
        }
    });

    function insertMarkdown(input, prefix, suffix) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selectedText = input.value.substring(start, end);

        if (selectedText) {
            // 有选中文本，在前后添加标记
            const value = input.value;
            input.value = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
            input.selectionStart = start + prefix.length;
            input.selectionEnd = start + prefix.length + selectedText.length;
        } else {
            // 无选中文本，只插入标记
            const value = input.value;
            input.value = value.substring(0, start) + prefix + suffix + value.substring(end);
            input.selectionStart = start + prefix.length;
            input.selectionEnd = start + prefix.length;
        }

        input.focus();
        messageInput.dispatchEvent(new Event('input'));
    }

    // 渲染消息
    function appendMsg(nickname, content, time) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg';
        let html = `<b>${nickname}：</b>`;
        html += marked.parse(content);
        html += `<div class="msg-meta">${formatTime(time)}</div>`;
        msgDiv.innerHTML = html;
        history.appendChild(msgDiv);
        history.scrollTop = history.scrollHeight;

        // 渲染LaTeX
        renderMathInElement(msgDiv, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false,
            errorColor: '#cc0000'
        });

        hljs.highlightAll();
    }

    // 渲染用户列表
    function renderUserList(users) {
        userList.innerHTML = '';
        users.forEach(u => {
            const li = document.createElement('li');
            li.textContent = u;
            li.className = (u === window.NICKNAME) ? 'online' : '';

            // 房主功能：右键菜单
            if (u !== window.NICKNAME) {
                li.addEventListener('contextmenu', function (e) {
                    e.preventDefault();
                    showUserMenu(e, u);
                });
            }

            userList.appendChild(li);
        });

        // 检查是否为房主，显示房主操作按钮
        checkOwnerStatus();
    }

    // 显示用户右键菜单
    function showUserMenu(e, username) {
        // 移除现有菜单
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            padding: 4px 0;
        `;

        // 只有房主才能看到踢人和转让房主选项
        if (isCurrentUserOwner) {
            const kickBtn = document.createElement('div');
            kickBtn.textContent = '踢出房间';
            kickBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; hover: background: #f0f0f0;';
            kickBtn.addEventListener('click', () => {
                kickUser(username);
                menu.remove();
            });

            const transferBtn = document.createElement('div');
            transferBtn.textContent = '转让房主';
            transferBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; hover: background: #f0f0f0;';
            transferBtn.addEventListener('click', () => {
                transferOwnership(username);
                menu.remove();
            });

            menu.appendChild(kickBtn);
            menu.appendChild(transferBtn);
        } else {
            // 非房主用户显示提示信息
            const infoDiv = document.createElement('div');
            infoDiv.textContent = '只有房主可以管理用户';
            infoDiv.style.cssText = 'padding: 8px 16px; color: #666; font-style: italic;';
            menu.appendChild(infoDiv);
        }

        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }

    // 踢出用户
    function kickUser(username) {
        if (confirm(`确定要踢出 ${username} 吗？`)) {
            fetch('/api/rooms/kick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: window.ROOM,
                    creator: window.NICKNAME,
                    target: username
                })
            });
        }
    }

    // 转让房主
    function transferOwnership(username) {
        if (confirm(`确定要将房主转让给 ${username} 吗？`)) {
            fetch('/api/rooms/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: window.ROOM,
                    from: window.NICKNAME,
                    to: username
                })
            });
        }
    }

    // 检查房主状态并显示操作按钮
    function checkOwnerStatus() {
        const roomOps = document.getElementById('room-ops');
        roomOps.innerHTML = '';

        // 从服务端获取房主信息
        fetch('/api/rooms')
            .then(r => r.json())
            .then(data => {
                const currentRoom = data.rooms.find(r => r.name === window.ROOM);
                isCurrentUserOwner = currentRoom && currentRoom.creator === window.NICKNAME;

                if (isCurrentUserOwner) {
                    const noticeBtn = document.createElement('button');
                    noticeBtn.textContent = '设置公告';
                    noticeBtn.className = 'room-op-btn';
                    noticeBtn.addEventListener('click', setNotice);

                    roomOps.appendChild(noticeBtn);
                }
            })
            .catch(error => {
                console.error('获取房主信息失败:', error);
            });
    }

    // 更新房间用户数量显示
    function updateRoomUserCounts(roomUserCounts) {
        // 更新房间标题显示用户数量
        const currentRoom = roomUserCounts.find(r => r.name === window.ROOM);
        if (currentRoom) {
            const titleElement = document.querySelector('.room-title');
            if (titleElement) {
                titleElement.textContent = `${window.ROOM} (${currentRoom.count}人)`;
            }
        }
    }

    // 设置公告
    function setNotice() {
        const notice = prompt('请输入房间公告：');
        if (notice !== null) {
            fetch('/api/rooms/notice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: window.ROOM,
                    creator: window.NICKNAME,
                    notice: notice
                })
            });
        }
    }

    // 时间格式
    function formatTime(t) {
        if (!t) return '';
        const d = new Date(Number(t));
        return d.toLocaleTimeString('zh-CN', { hour12: false });
    }

    // 退出房间功能
    exitRoomBtn.addEventListener('click', function () {
        showExitConfirm();
    });

    // 显示LaTeX公式对话框
    function showLatexDialog() {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'latex-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'latex-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #333;">插入LaTeX公式</h3>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">公式类型：</label>
                <select id="latex-type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="inline">行内公式 ($...$)</option>
                    <option value="display">块级公式 ($$...$$)</option>
                </select>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">LaTeX代码：</label>
                <textarea id="latex-input" placeholder="输入LaTeX公式，例如：x^2 + y^2 = z^2" style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;"></textarea>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">预览：</label>
                <div id="latex-preview" style="padding: 12px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; min-height: 60px;"></div>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">常用公式：</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                    <button class="latex-template" data-formula="x^2 + y^2 = z^2" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">勾股定理</button>
                    <button class="latex-template" data-formula="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">二次方程</button>
                    <button class="latex-template" data-formula="\\sum_{i=1}^{n} x_i" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">求和</button>
                    <button class="latex-template" data-formula="\\int_{a}^{b} f(x) dx" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">积分</button>
                    <button class="latex-template" data-formula="\\lim_{x \\to \\infty} f(x)" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">极限</button>
                    <button class="latex-template" data-formula="\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">矩阵</button>
                </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="cancel-latex" style="
                    padding: 10px 20px;
                    border: 1px solid #ddd;
                    background: #f8f9fa;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
                <button id="insert-latex" style="
                    padding: 10px 20px;
                    border: none;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                ">插入公式</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 获取元素
        const latexInput = document.getElementById('latex-input');
        const latexPreview = document.getElementById('latex-preview');
        const latexType = document.getElementById('latex-type');

        // 实时预览
        function updatePreview() {
            const formula = latexInput.value.trim();
            if (formula) {
                const isDisplay = latexType.value === 'display';
                const delimiter = isDisplay ? '$$' : '$';
                latexPreview.innerHTML = marked.parse(`${delimiter}${formula}${delimiter}`);

                // 渲染LaTeX
                renderMathInElement(latexPreview, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false,
                    errorColor: '#cc0000'
                });
            } else {
                latexPreview.innerHTML = '<em style="color: #999;">预览将在这里显示</em>';
            }
        }

        // 绑定事件
        latexInput.addEventListener('input', updatePreview);
        latexType.addEventListener('change', updatePreview);

        // 模板按钮事件
        document.querySelectorAll('.latex-template').forEach(btn => {
            btn.addEventListener('click', () => {
                latexInput.value = btn.dataset.formula;
                updatePreview();
            });
        });

        // 取消按钮
        document.getElementById('cancel-latex').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // 插入按钮
        document.getElementById('insert-latex').addEventListener('click', () => {
            const formula = latexInput.value.trim();
            if (formula) {
                const isDisplay = latexType.value === 'display';
                const delimiter = isDisplay ? '$$' : '$';
                const latexCode = `${delimiter}${formula}${delimiter}`;

                // 插入到输入框
                const start = messageInput.selectionStart;
                const end = messageInput.selectionEnd;
                const value = messageInput.value;
                messageInput.value = value.substring(0, start) + latexCode + value.substring(end);
                messageInput.selectionStart = start + latexCode.length;
                messageInput.selectionEnd = start + latexCode.length;
                messageInput.focus();

                // 触发输入事件更新预览
                messageInput.dispatchEvent(new Event('input'));
            }
            document.body.removeChild(overlay);
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // 初始预览
        updatePreview();
    }

    // 显示退出确认对话框
    function showExitConfirm() {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        // 创建确认对话框
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;

        dialog.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🚪</div>
            <h3 style="margin: 0 0 16px 0; color: #333;">退出房间</h3>
            <p style="margin: 0 0 24px 0; color: #666;">确定要退出当前房间吗？</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="cancel-exit" style="
                    padding: 10px 20px;
                    border: 1px solid #ddd;
                    background: #f8f9fa;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
                <button id="confirm-exit" style="
                    padding: 10px 20px;
                    border: none;
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                ">确定退出</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // 绑定事件
        document.getElementById('cancel-exit').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        document.getElementById('confirm-exit').addEventListener('click', () => {
            // 发送退出消息到服务器
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(strToHex(JSON.stringify({
                    type: 'logout',
                    nickname: window.NICKNAME
                })));
            }
            // 跳转回大厅
            window.location.href = 'hall.html';
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    // 16进制工具
    function strToHex(str) {
        return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function hexToStr(hex) {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        return new TextDecoder().decode(bytes);
    }
});