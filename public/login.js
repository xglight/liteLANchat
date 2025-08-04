function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
}

// 创建用户名状态提示元素
const statusElement = document.createElement('div');
statusElement.id = 'nickname-status';
statusElement.style.marginBottom = '10px';
statusElement.style.fontSize = '14px';
statusElement.style.transition = 'all 0.3s';
const nicknameInput = document.getElementById('nickname');
nicknameInput.parentNode.insertBefore(statusElement, document.getElementById('login-btn'));

// 检查用户名是否可用
let nicknameAvailable = false;
let checkTimeout;

function checkNickname(nickname) {
    if (!nickname) {
        statusElement.textContent = '';
        nicknameAvailable = false;
        return;
    }
    
    statusElement.textContent = '检查用户名...';
    statusElement.style.color = '#666';
    
    fetch(`/api/check-nickname?nickname=${encodeURIComponent(nickname)}`)
        .then(response => response.json())
        .then(data => {
            if (data.available) {
                statusElement.textContent = '✓ ' + data.message;
                statusElement.style.color = '#4CAF50';
                nicknameAvailable = true;
            } else {
                statusElement.textContent = '✗ ' + data.message;
                statusElement.style.color = '#F44336';
                nicknameAvailable = false;
            }
        })
        .catch(error => {
            statusElement.textContent = '检查失败，请重试';
            statusElement.style.color = '#FF9800';
            nicknameAvailable = false;
        });
}

// 用户名输入事件
document.getElementById('nickname').addEventListener('input', function() {
    const nick = this.value.trim();
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => checkNickname(nick), 300);
});

// 登录按钮点击事件
document.getElementById('login-btn').onclick = function () {
    const nick = document.getElementById('nickname').value.trim();
    if (!nick) {
        alert('请输入昵称');
        return;
    }
    
    if (!nicknameAvailable) {
        // 再次检查用户名是否可用
        fetch(`/api/check-nickname?nickname=${encodeURIComponent(nick)}`)
            .then(response => response.json())
            .then(data => {
                if (data.available) {
                    setCookie('nickname', nick, 7);
                    window.location.href = 'hall.html';
                } else {
                    alert(data.message + '，请更换一个用户名');
                }
            })
            .catch(error => {
                alert('检查用户名失败，请重试');
            });
    } else {
        setCookie('nickname', nick, 7);
        window.location.href = 'hall.html';
    }
};

document.getElementById('nickname').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
});