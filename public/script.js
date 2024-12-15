const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1080;
canvas.height = 720;

const socket = io();
let players = {};
let orb = {};
let bases = {};

// Add team switch button with styling
const teamSwitchButton = document.createElement('button');
teamSwitchButton.textContent = 'Switch Team';
teamSwitchButton.className = 'team-switch-btn';
document.body.appendChild(teamSwitchButton);

socket.on('gameState', (data) => {
    players = data.players;
    orb = data.orb;
    bases = data.bases;
    render();
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bases
    drawBase(bases.red, '#ff6b6b');
    drawBase(bases.blue, '#4dabf7');

    // Draw orb
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#fab005';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw players
    for (const id in players) {
        const player = players[id];
        drawPlayer(player, id === orb.holder);
    }
}

function drawBase(base, color) {
    ctx.fillStyle = color + '40'; // Add transparency
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(base.x, base.y, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function drawPlayer(player, isHolder) {
    const colors = {
        red: { fill: '#ff6b6b', stroke: '#fa5252' },
        blue: { fill: '#4dabf7', stroke: '#339af0' }
    };

    ctx.fillStyle = colors[player.team].fill;
    ctx.strokeStyle = colors[player.team].stroke;
    ctx.lineWidth = 2;

    // Draw rounded rectangle
    roundRect(ctx, player.x, player.y, 30, 30, 8);

    if (isHolder) {
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 3;
        roundRect(ctx, player.x, player.y, 30, 30, 8, false, true);
    }

    // Show stun effect
    if (player.stunned) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(player.x + 15, player.y + 15, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius, fill = true, stroke = true) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

let currentMovement = { dx: 0, dy: 0 };

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            currentMovement.dy = -1;
            break;
        case 'ArrowDown':
            currentMovement.dy = 1;
            break;
        case 'ArrowLeft':
            currentMovement.dx = -1;
            break;
        case 'ArrowRight':
            currentMovement.dx = 1;
            break;
        case 'e':
        case 'E':
            socket.emit('orbAction');
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            if (currentMovement.dy === -1) currentMovement.dy = 0;
            break;
        case 'ArrowDown':
            if (currentMovement.dy === 1) currentMovement.dy = 0;
            break;
        case 'ArrowLeft':
            if (currentMovement.dx === -1) currentMovement.dx = 0;
            break;
        case 'ArrowRight':
            if (currentMovement.dx === 1) currentMovement.dx = 0;
            break;
    }
});

// Movement update at fixed rate
setInterval(() => {
    if (currentMovement.dx !== 0 || currentMovement.dy !== 0) {
        socket.emit('move', currentMovement);
    }
}, 1000 / 60);

teamSwitchButton.onclick = () => socket.emit('switchTeam');

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    socket.emit('throwOrb', { targetX: clickX, targetY: clickY });
});
