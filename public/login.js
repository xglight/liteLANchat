function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
}
document.getElementById('login-btn').onclick = function () {
    const nick = document.getElementById('nickname').value.trim();
    if (!nick) return alert('请输入昵称');
    setCookie('nickname', nick, 7);
    window.location.href = 'hall.html';
};
document.getElementById('nickname').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
}); 