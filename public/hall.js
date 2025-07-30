function getCookie(name) {
    const arr = document.cookie.split('; ');
    for (let i = 0; i < arr.length; i++) {
        const kv = arr[i].split('=');
        if (kv[0] === name) return decodeURIComponent(kv[1]);
    }
    return '';
}
const nickname = getCookie('nickname');
if (!nickname) window.location.href = 'index.html';

// 显示加载状态
function showLoading() {
    const list = document.getElementById('room-list');
    list.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            正在加载聊天室列表...
        </div>
    `;
}

// 显示空状态
function showEmptyState() {
    const list = document.getElementById('room-list');
    list.innerHTML = `
        <div class="empty-state">
            <div class="icon">🏠</div>
            <div class="message">暂无聊天室</div>
            <div class="subtitle">创建第一个聊天室开始聊天吧！</div>
        </div>
    `;
}

// 显示错误状态
function showError(message) {
    const list = document.getElementById('room-list');
    list.innerHTML = `
        <div class="empty-state">
            <div class="icon">⚠️</div>
            <div class="message">加载失败</div>
            <div class="subtitle">${message}</div>
            <button class="room-btn" onclick="fetchRoomList()" style="margin-top: 16px;">重试</button>
        </div>
    `;
}

function fetchRoomList() {
    showLoading();
    fetch('/api/rooms')
        .then(r => r.json())
        .then(data => {
            renderRoomList(data.rooms || []);
        })
        .catch(error => {
            console.error('获取房间列表失败:', error);
            showError('网络连接失败，请检查网络后重试');
        });
}

function renderRoomList(rooms) {
    const list = document.getElementById('room-list');
    list.innerHTML = '';

    if (rooms.length === 0) {
        showEmptyState();
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('li');

        const roomInfo = document.createElement('div');
        roomInfo.className = 'room-info';

        const roomName = document.createElement('div');
        roomName.className = 'room-name';
        roomName.textContent = room.name;

        const roomCreator = document.createElement('div');
        roomCreator.className = 'room-creator';
        roomCreator.textContent = `创建者: ${room.creator}`;

        const roomUserCount = document.createElement('div');
        roomUserCount.className = 'room-user-count';
        roomUserCount.textContent = `${room.userCount || 0}人在线`;

        roomInfo.appendChild(roomName);
        roomInfo.appendChild(roomCreator);
        roomInfo.appendChild(roomUserCount);

        const roomActions = document.createElement('div');
        roomActions.className = 'room-actions';

        const enterBtn = document.createElement('button');
        enterBtn.className = 'room-btn';
        enterBtn.textContent = '进入';
        enterBtn.onclick = () => enterRoom(room.name);

        roomActions.appendChild(enterBtn);

        if (room.creator === nickname) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => deleteRoom(room.name);
            roomActions.appendChild(deleteBtn);
        }

        roomElement.appendChild(roomInfo);
        roomElement.appendChild(roomActions);
        list.appendChild(roomElement);
    });
}

// 自动刷新房间列表
let refreshInterval;
function startAutoRefresh() {
    refreshInterval = setInterval(fetchRoomList, 10000); // 每10秒刷新一次
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// 页面加载时开始自动刷新
fetchRoomList();
startAutoRefresh();

// 页面卸载时停止自动刷新
window.addEventListener('beforeunload', stopAutoRefresh);

function logout() {
    if (!confirm('确定要退出登录吗？')) return;

    try {
        const ws = new WebSocket(`ws://${location.host}`);
        ws.onopen = function () {
            ws.send(JSON.stringify({ type: 'logout', nickname }));
            ws.close();
            setTimeout(() => { window.location.href = 'index.html'; }, 200);
        };
    } catch {
        window.location.href = 'index.html';
    }
    document.cookie = 'nickname=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
}

function createRoom() {
    const nameInput = document.getElementById('room-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('请输入聊天室名称');
        nameInput.focus();
        return;
    }

    if (name.length > 20) {
        alert('聊天室名称不能超过20个字符');
        nameInput.focus();
        return;
    }

    // 禁用创建按钮防止重复提交
    const createBtn = document.querySelector('.create-area .room-btn');
    const originalText = createBtn.textContent;
    createBtn.textContent = '创建中...';
    createBtn.disabled = true;

    fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creator: nickname })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                nameInput.value = '';
                fetchRoomList();
                // 显示成功提示
                showToast('聊天室创建成功！', 'success');
            } else {
                alert(data.msg || '创建失败');
            }
        })
        .catch(error => {
            console.error('创建房间失败:', error);
            alert('创建失败，请检查网络连接');
        })
        .finally(() => {
            createBtn.textContent = originalText;
            createBtn.disabled = false;
        });
}

function deleteRoom(name) {
    if (!confirm(`确定要删除聊天室"${name}"吗？\n删除后无法恢复！`)) return;

    fetch('/api/rooms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creator: nickname })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                fetchRoomList();
                showToast('聊天室删除成功！', 'success');
            } else {
                alert(data.msg || '删除失败');
            }
        })
        .catch(error => {
            console.error('删除房间失败:', error);
            alert('删除失败，请检查网络连接');
        });
}

function enterRoom(room) {
    window.location.href = `chat.html?room=${encodeURIComponent(room)}`;
}

// 添加提示消息功能
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);' :
            type === 'error' ? 'background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);' :
                'background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);'}
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 显示动画
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 添加回车键创建房间功能
document.addEventListener('DOMContentLoaded', function () {
    const nameInput = document.getElementById('room-name');
    nameInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            createRoom();
        }
    });
}); 