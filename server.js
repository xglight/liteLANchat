const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 创建logs文件夹
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

// 日志级别颜色映射
const levelColors = {
    'INFO': colors.green,
    'ERROR': colors.red,
    'WARNING': colors.yellow,
    'DEBUG': colors.cyan
};

// 日志功能
function writeLog(level, message) {
    const timestamp = new Date().toISOString();
    const color = levelColors[level] || colors.white;
    const coloredLevel = `${color}${level}${colors.reset}`;
    const coloredMessage = `${colors.gray}[${timestamp}]${colors.reset} [${coloredLevel}] ${message}`;

    // 控制台输出（带颜色）
    originalConsoleLog(coloredMessage);

    // 写入文件（无颜色）
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    const logFileName = `${new Date().toISOString().split('T')[0]}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            originalConsoleLog(`${colors.red}写入日志文件失败:${colors.reset}`, err);
        }
    });
}

// 重写console.log以同时写入文件
const originalConsoleLog = console.log;
console.log = function (...args) {
    const message = args.join(' ');
    writeLog('INFO', message);
};

// 专门的日志函数
function logInfo(message) {
    writeLog('INFO', message);
}

function logError(message) {
    writeLog('ERROR', message);
}

function logWarning(message) {
    writeLog('WARNING', message);
}

function logDebug(message) {
    writeLog('DEBUG', message);
}

// 特殊日志函数（带颜色高亮）
function logSuccess(message) {
    const coloredMessage = `${colors.bright}${colors.green}${message}${colors.reset}`;
    writeLog('INFO', coloredMessage);
}

function logImportant(message) {
    const coloredMessage = `${colors.bright}${colors.blue}${message}${colors.reset}`;
    writeLog('INFO', coloredMessage);
}

function logSystem(message) {
    const coloredMessage = `${colors.magenta}${message}${colors.reset}`;
    writeLog('INFO', coloredMessage);
}

// 初始化 Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静态资源
app.use(express.static(path.join(__dirname, 'public')));

// 检查用户名是否已被使用的API
app.get('/api/check-nickname', (req, res) => {
    const nickname = req.query.nickname;
    if (!nickname) {
        return res.json({ available: false, message: '用户名不能为空' });
    }
    const existingUser = Array.from(onlineUsers.values()).find(user => user.nickname === nickname);
    res.json({ available: !existingUser, message: existingUser ? '该用户名已被使用' : '用户名可用' });
});

// 初始化 SQLite
const db = new sqlite3.Database('chat.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT,
    content TEXT,
    time INTEGER,
    room TEXT DEFAULT '默认聊天室'
  )`);
});

// 在线用户管理
let onlineUsers = new Map(); // ws => {nickname, room}

// 聊天室管理（内存房间列表，含创建者、公告）
let chatRooms = [{ name: '默认聊天室', creator: '系统', notice: '' }];

// 获取聊天室列表
app.get('/api/rooms', (req, res) => {
    // 计算每个房间的用户数量
    const roomsWithUserCount = chatRooms.map(room => {
        const userCount = Array.from(onlineUsers.values()).filter(user => user.room === room.name).length;
        return { ...room, userCount };
    });
    res.json({ rooms: roomsWithUserCount });
});

// 创建聊天室
app.post('/api/rooms', express.json(), (req, res) => {
    const { name, creator } = req.body;
    if (!name || typeof name !== 'string' || name.length > 32) {
        return res.json({ success: false, msg: '名称不合法' });
    }
    if (chatRooms.find(r => r.name === name)) {
        return res.json({ success: false, msg: '聊天室已存在' });
    }
    chatRooms.push({ name, creator: creator || '未知', notice: '' });
    res.json({ success: true });
});

// 删除聊天室（仅创建者可删，默认聊天室不可删）
app.delete('/api/rooms', express.json(), (req, res) => {
    const { name, creator } = req.body;
    if (name === '默认聊天室') return res.json({ success: false, msg: '默认聊天室不可删除' });
    const idx = chatRooms.findIndex(r => r.name === name);
    if (idx === -1) return res.json({ success: false, msg: '聊天室不存在' });
    if (chatRooms[idx].creator !== creator) return res.json({ success: false, msg: '只有创建者可删除' });
    chatRooms.splice(idx, 1);
    // 删除该房间所有消息
    db.run('DELETE FROM messages WHERE room = ?', [name]);
    res.json({ success: true });
});

// 房主转让
app.post('/api/rooms/transfer', express.json(), (req, res) => {
    const { name, from, to } = req.body;
    logInfo(`[房主转让] 请求: 房间=${name}, 转让者=${from}, 接收者=${to}`);

    const room = chatRooms.find(r => r.name === name);
    if (!room) {
        logError(`[房主转让] 失败: 房间 ${name} 不存在`);
        return res.json({ success: false, msg: '房间不存在' });
    }
    if (room.creator !== from) {
        logWarning(`[房主转让] 失败: ${from} 不是房主，当前房主是 ${room.creator}`);
        return res.json({ success: false, msg: '只有房主可转让' });
    }

    room.creator = to;
    logSuccess(`[房主转让] 成功: 房间 ${name} 房主从 ${from} 转让给 ${to}`);

    // 通知房间所有人房主变更
    broadcastHex({ type: 'owner_changed', room: name, newOwner: to }, name);
    res.json({ success: true });
});

// 设置公告
app.post('/api/rooms/notice', express.json(), (req, res) => {
    const { name, creator, notice } = req.body;
    logInfo(`[设置公告] 请求: 房间=${name}, 设置者=${creator}, 公告=${notice}`);

    const room = chatRooms.find(r => r.name === name);
    if (!room) {
        logError(`[设置公告] 失败: 房间 ${name} 不存在`);
        return res.json({ success: false, msg: '房间不存在' });
    }
    if (room.creator !== creator) {
        logWarning(`[设置公告] 失败: ${creator} 不是房主，当前房主是 ${room.creator}`);
        return res.json({ success: false, msg: '只有房主可设置公告' });
    }

    room.notice = notice || '';
    logSuccess(`[设置公告] 成功: 房间 ${name} 公告已更新为 "${room.notice}"`);

    // 通知房间所有人公告变更
    broadcastHex({ type: 'notice', room: name, notice: room.notice }, name);
    res.json({ success: true });
});

// 踢人
app.post('/api/rooms/kick', express.json(), (req, res) => {
    const { name, creator, target } = req.body;
    logInfo(`[踢人] 请求: 房间=${name}, 操作者=${creator}, 目标=${target}`);

    const room = chatRooms.find(r => r.name === name);
    if (!room) {
        logError(`[踢人] 失败: 房间 ${name} 不存在`);
        return res.json({ success: false, msg: '房间不存在' });
    }
    if (room.creator !== creator) {
        logWarning(`[踢人] 失败: ${creator} 不是房主，当前房主是 ${room.creator}`);
        return res.json({ success: false, msg: '只有房主可踢人' });
    }

    logSuccess(`[踢人] 成功: 房主 ${creator} 将 ${target} 踢出房间 ${name}`);

    // 通知被踢用户
    wss.clients.forEach(client => {
        const user = onlineUsers.get(client);
        if (user && user.room === name && user.nickname === target && client.readyState === WebSocket.OPEN) {
            const hex = strToHex(JSON.stringify({ type: 'kicked', room: name }));
            client.send(hex);
            logInfo(`[踢人] 已发送踢出通知给用户 ${target}`);
        }
    });
    res.json({ success: true });
});

// 工具：字符串转16进制
function strToHex(str) {
    return Buffer.from(str, 'utf8').toString('hex');
}
function hexToStr(hex) {
    return Buffer.from(hex, 'hex').toString('utf8');
}

// 检查房间是否需要自动转让房主
function checkRoomOwnership(roomName) {
    const room = chatRooms.find(r => r.name === roomName);
    if (!room || room.name === '默认聊天室') return;

    // 检查房主是否还在房间
    const ownerInRoom = Array.from(onlineUsers.values()).some(user =>
        user.room === roomName && user.nickname === room.creator
    );

    if (!ownerInRoom) {
        logWarning(`[房主检查] 房间 ${roomName} 的房主 ${room.creator} 已不在房间`);

        // 房主不在房间，寻找下一位用户作为新房主
        const usersInRoom = Array.from(onlineUsers.values()).filter(user => user.room === roomName);
        if (usersInRoom.length > 0) {
            // 选择第一个用户作为新房主
            const newOwner = usersInRoom[0].nickname;
            room.creator = newOwner;
            // 通知房间所有人房主变更
            broadcastHex({ type: 'owner_changed', room: roomName, newOwner }, roomName);
            logSuccess(`[房主自动转让] 房间 ${roomName} 房主自动转让给 ${newOwner}`);
        } else {
            logWarning(`[房主检查] 房间 ${roomName} 已无用户，无法转让房主`);
        }
    } else {
        logDebug(`[房主检查] 房间 ${roomName} 房主 ${room.creator} 仍在房间`);
    }
}

// 检查房间是否为空，如果为空则删除
function checkEmptyRoom(roomName) {
    const room = chatRooms.find(r => r.name === roomName);
    if (!room || room.name === '默认聊天室') return;

    const usersInRoom = Array.from(onlineUsers.values()).filter(user => user.room === roomName);
    logDebug(`[空房间检查] 房间 ${roomName} 当前用户数: ${usersInRoom.length}`);

    if (usersInRoom.length === 0) {
        // 房间为空，删除房间
        const idx = chatRooms.findIndex(r => r.name === roomName);
        if (idx !== -1) {
            chatRooms.splice(idx, 1);
            // 删除该房间所有消息
            db.run('DELETE FROM messages WHERE room = ?', [roomName]);
            logSuccess(`[空房间删除] 房间 ${roomName} 已无人，自动删除`);
        }
    }
}

// 广播房间用户数量更新
function broadcastRoomUserCounts() {
    const roomUserCounts = chatRooms.map(r => ({
        name: r.name,
        count: Array.from(onlineUsers.values()).filter(u => u.room === r.name).length
    }));

    logDebug(`[用户数量广播] 当前房间用户数量:`, roomUserCounts.map(r => `${r.name}: ${r.count}人`).join(', '));

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            const hex = strToHex(JSON.stringify({ type: 'room_user_counts', roomUserCounts }));
            client.send(hex);
        }
    });
}

// WebSocket 连接
wss.on('connection', (ws) => {
    logSystem(`[WebSocket] 新连接建立`);
    let nickname = '';
    let room = '';

    ws.on('message', (hexMsg) => {
        let msg = hexToStr(hexMsg.toString());
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }
        if (data.type === 'login') {
            nickname = data.nickname;
            room = data.room || '默认聊天室';

            // 检查昵称是否已被使用
            const existingUser = Array.from(onlineUsers.values()).find(user => user.nickname === nickname);
            if (existingUser) {
                logWarning(`[用户登录] 昵称冲突: ${nickname} 已被使用`);
                const errorMsg = strToHex(JSON.stringify({
                    type: 'login_error',
                    error: '该用户名已被使用，请更换一个用户名'
                }));
                ws.send(errorMsg);
                return;
            }

            logInfo(`[用户登录] ${nickname} 进入房间 ${room}`);

            let roomObj = chatRooms.find(r => r.name === room);
            if (!roomObj) {
                roomObj = { name: room, creator: '未知', notice: '' };
                chatRooms.push(roomObj);
                logImportant(`[房间创建] 自动创建房间 ${room}`);
            }
            onlineUsers.set(ws, { nickname, room });

            // 检查房间房主状态
            checkRoomOwnership(room);

            broadcastUserList(room);
            sendHistory(ws, room);
            broadcastRoomUserCounts();

            // 登录时推送公告
            if (roomObj.notice) {
                const hex = strToHex(JSON.stringify({ type: 'notice', room, notice: roomObj.notice }));
                ws.send(hex);
            }
        } else if (data.type === 'chat') {
            const time = Date.now();
            const msgRoom = data.room || room || '默认聊天室';
            db.run('INSERT INTO messages (nickname, content, time, room) VALUES (?, ?, ?, ?)', [nickname, data.content, time, msgRoom]);
            const chatMsg = { type: 'chat', nickname, content: data.content, time, room: msgRoom };
            broadcastHex(chatMsg, msgRoom);
        } else if (data.type === 'logout') {
            logSystem(`[用户登出] ${nickname} 主动登出`);
            handleUserLogout(nickname);
        }
    });

    ws.on('close', () => {
        const user = onlineUsers.get(ws);
        if (user) {
            const userRoom = user.room;
            logWarning(`[连接断开] ${user.nickname} 断开连接，房间: ${userRoom}`);
            onlineUsers.delete(ws);

            // 检查房间房主状态
            checkRoomOwnership(userRoom);

            // 检查房间是否为空
            checkEmptyRoom(userRoom);

            // 更新用户列表和房间用户数量
            broadcastUserList(userRoom);
            broadcastRoomUserCounts();
        }
    });
});

function handleUserLogout(nickname) {
    logInfo(`[用户登出处理] 处理用户 ${nickname} 的登出请求`);

    // 找到所有该用户创建的房间（排除默认聊天室）
    const toDelete = chatRooms.filter(r => r.creator === nickname && r.name !== '默认聊天室');
    logInfo(`[用户登出处理] 用户 ${nickname} 创建的房间: ${toDelete.map(r => r.name).join(', ')}`);

    toDelete.forEach(roomObj => {
        logImportant(`[房间删除] 删除用户 ${nickname} 创建的房间 ${roomObj.name}`);

        // 通知所有在该房间的用户强制跳转
        wss.clients.forEach(client => {
            const user = onlineUsers.get(client);
            if (user && user.room === roomObj.name && client.readyState === WebSocket.OPEN) {
                const hex = strToHex(JSON.stringify({ type: 'room_deleted', room: roomObj.name }));
                client.send(hex);
                logInfo(`[房间删除] 通知用户 ${user.nickname} 房间 ${roomObj.name} 已被删除`);
            }
        });
        // 删除房间和消息
        const idx = chatRooms.findIndex(r => r.name === roomObj.name);
        if (idx !== -1) chatRooms.splice(idx, 1);
        db.run('DELETE FROM messages WHERE room = ?', [roomObj.name]);
    });
}

// 广播消息（仅限房间）
function broadcastHex(obj, room) {
    const hex = strToHex(JSON.stringify(obj));
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            const user = onlineUsers.get(client);
            if (user && user.room === room) {
                client.send(hex);
            }
        }
    });
}

// 广播在线用户列表（仅限房间）
function broadcastUserList(room) {
    const users = Array.from(onlineUsers.values()).filter(u => u.room === room).map(u => u.nickname);
    broadcastHex({ type: 'users', users }, room);
}

// 发送历史消息（仅限房间）
function sendHistory(ws, room) {
    db.all('SELECT * FROM messages WHERE room = ? ORDER BY time ASC LIMIT 100', [room], (err, rows) => {
        if (!err) {
            const history = rows.map(row => ({
                nickname: row.nickname,
                content: row.content,
                time: row.time
            }));
            const hex = strToHex(JSON.stringify({ type: 'history', history }));
            ws.send(hex);
        }
    });
}

// 启动服务器
const PORT = 3000;
server.listen(PORT, () => {
    logSystem(`[服务器启动] 服务器运行在 http://localhost:${PORT}`);
    logSuccess(`[服务器启动] 房主权限控制功能已启用`);
    logSuccess(`[服务器启动] 自动房主转让功能已启用`);
    logSuccess(`[服务器启动] 空房间自动删除功能已启用`);
    logImportant(`[服务器启动] 日志文件将保存在 logs/ 文件夹中`);
});