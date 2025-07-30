function getCookie(name) {
    const arr = document.cookie.split('; ');
    for (let i = 0; i < arr.length; i++) {
        const kv = arr[i].split('=');
        if (kv[0] === name) return decodeURIComponent(kv[1]);
    }
    return '';
}
function getQuery(name) {
    const m = location.search.match(new RegExp('(?:[?&])' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : '';
}
const nickname = getCookie('nickname');
const room = getQuery('room');
if (!nickname) window.location.href = 'index.html';
if (!room) window.location.href = 'hall.html';
document.title = room + ' - liteLANchat';
const roomTitleDiv = document.getElementById('room-title');
if (roomTitleDiv) roomTitleDiv.innerText = '房间：' + room + ' (0人)';
window.NICKNAME = nickname;
window.ROOM = room; 