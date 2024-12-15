const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1080;
canvas.height = 720;

const socket = io();
let players = {};
let orb = {};

// Add team switch button
const teamSwitchButton = document.createElement('button');
teamSwitchButton.textContent = 'Switch Team';
teamSwitchButton.onclick = () => socket.emit('switchTeam');
document.body.appendChild(teamSwitchButton);

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
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Малюємо гравців
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.team; // Using team color
        ctx.fillRect(player.x, player.y, 20, 20);
        
        // Add golden outline if holding the orb
        if (id === orb.holder) {
            ctx.strokeStyle = 'gold';
            ctx.lineWidth = 2;
            ctx.strokeRect(player.x, player.y, 20, 20);
        }
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
    
    // Handle orb pickup/drop with 'E' key
    if (e.key.toLowerCase() === 'e') {
        socket.emit('orbAction');
    }
});
