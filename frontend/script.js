const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 500;
canvas.height = 500;

const socket = io('http://localhost:3000'); // Змінити на URL бекенду після хостингу
let players = {};
let orb = {};

// Отримуємо стан гри від сервера
socket.on('gameState', (data) => {
    players = data.players;
    orb = data.orb;
    render();
});

// Малюємо гру
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Малюємо орб
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Малюємо гравців
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = id === orb.holder ? 'gold' : 'blue';
        ctx.fillRect(player.x, player.y, 20, 20);
    }
}

// Відправка руху гравця на сервер
window.addEventListener('keydown', (e) => {
    const moves = {
        ArrowUp: { dx: 0, dy: -5 },
        ArrowDown: { dx: 0, dy: 5 },
        ArrowLeft: { dx: -5, dy: 0 },
        ArrowRight: { dx: 5, dy: 0 },
    };
    if (moves[e.key]) socket.emit('move', moves[e.key]);
});
