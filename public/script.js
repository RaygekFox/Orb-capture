const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1080;
canvas.height = 720;

// Add colors object
const colors = {
    red: { fill: '#ff6b6b', stroke: '#fa5252' },
    blue: { fill: '#4dabf7', stroke: '#339af0' }
};

const socket = io();
let players = {};
let orb = {};
let bases = {};
let barriers = [];
let currentMovement = { dx: 0, dy: 0 };

// Add team switch button with styling
const teamSwitchButton = document.createElement('button');
teamSwitchButton.textContent = 'Switch Team';
teamSwitchButton.className = 'team-switch-btn';
document.body.appendChild(teamSwitchButton);

// Add new styles
const gameStyles = document.createElement('style');
gameStyles.textContent = `
    .score-container {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        width: 400px;
        z-index: 1000;
    }

    .team-progress {
        flex: 1;
        height: 20px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 10px;
        overflow: hidden;
        border: 2px solid rgba(255, 255, 255, 0.2);
    }

    .progress-fill {
        width: 0%;
        height: 100%;
        transition: width 0.3s ease;
    }

    .red-team .progress-fill {
        background-color: #ff6b6b;
    }

    .blue-team .progress-fill {
        background-color: #4dabf7;
    }
`;
document.head.appendChild(gameStyles);

socket.on('gameState', (data) => {
    players = data.players;
    orb = data.orb;
    bases = data.bases;
    barriers = data.barriers || [];
    
    // Update progress bars with new selectors
    const redFill = document.querySelector('.red-team .progress-fill');
    const blueFill = document.querySelector('.blue-team .progress-fill');
    
    if (redFill && blueFill) {
        redFill.style.width = `${(data.teamProgress.red / 50000) * 100}%`;
        blueFill.style.width = `${(data.teamProgress.blue / 50000) * 100}%`;
    }
    
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

    // Draw barriers with fading effect
    barriers.forEach(barrier => {
        const age = Date.now() - barrier.createdAt;
        const opacity = Math.max(0, 1 - (age / 10000)); // 10 seconds lifetime
        ctx.fillStyle = colors[barrier.team].fill + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = colors[barrier.team].stroke;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.rect(barrier.x - 15, barrier.y - 30, 30, 60);
        ctx.fill();
        ctx.stroke();
    });
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
    ctx.fillStyle = colors[player.team].fill;
    ctx.strokeStyle = colors[player.team].stroke;
    ctx.lineWidth = 2;

    // Draw rounded rectangle
    roundRect(ctx, player.x - 15, player.y - 15, 30, 30, 8);

    if (isHolder) {
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 3;
        roundRect(ctx, player.x - 15, player.y - 15, 30, 30, 8, false, true);
    }

    // Show stun effect
    if (player.stunned) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
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

window.addEventListener('keydown', (e) => {
    let movementChanged = false;
    
    switch(e.key.toLowerCase()) {
        case 'w':
            if (currentMovement.dy !== -1) {
                currentMovement.dy = -1;
                movementChanged = true;
            }
            break;
        case 's':
            if (currentMovement.dy !== 1) {
                currentMovement.dy = 1;
                movementChanged = true;
            }
            break;
        case 'a':
            if (currentMovement.dx !== -1) {
                currentMovement.dx = -1;
                movementChanged = true;
            }
            break;
        case 'd':
            if (currentMovement.dx !== 1) {
                currentMovement.dx = 1;
                movementChanged = true;
            }
            break;
        case 'e':
            socket.emit('orbAction');
            break;
        case 'f':
            socket.emit('createBarrier');
            break;
    }

    if (movementChanged) {
        socket.emit('moveStart', currentMovement);
    }
});

window.addEventListener('keyup', (e) => {
    let movementChanged = false;

    switch(e.key.toLowerCase()) {
        case 'w':
            if (currentMovement.dy === -1) {
                currentMovement.dy = 0;
                movementChanged = true;
            }
            break;
        case 's':
            if (currentMovement.dy === 1) {
                currentMovement.dy = 0;
                movementChanged = true;
            }
            break;
        case 'a':
            if (currentMovement.dx === -1) {
                currentMovement.dx = 0;
                movementChanged = true;
            }
            break;
        case 'd':
            if (currentMovement.dx === 1) {
                currentMovement.dx = 0;
                movementChanged = true;
            }
            break;
    }

    if (movementChanged) {
        if (currentMovement.dx === 0 && currentMovement.dy === 0) {
            socket.emit('moveEnd');
        } else {
            socket.emit('moveStart', currentMovement);
        }
    }
});

teamSwitchButton.onclick = () => socket.emit('switchTeam');

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    socket.emit('throwOrb', { targetX: clickX, targetY: clickY });
});

// Add styles to your CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = `
.progress-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 30px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 15px;
    overflow: hidden;
    display: flex;
    border: 2px solid rgba(255, 255, 255, 0.2);
}

.progress-bar {
    height: 100%;
    transition: width 0.3s ease;
}

.progress-bar.red {
    background: #ff6b6b;
}

.progress-bar.blue {
    background: #4dabf7;
}

.team-switch-btn {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 20px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    transition: background 0.3s;
}

.team-switch-btn:hover {
    background: rgba(0, 0, 0, 0.5);
}
`;
document.head.appendChild(styleSheet);

// Add collision detection to player movement
function checkBarrierCollision(x, y, team) {
    return barriers.some(barrier => {
        if (barrier.team === team) return false;
        
        return x > barrier.x - 45 && x < barrier.x + 45 &&
               y > barrier.y - 60 && y < barrier.y + 60;
    });
}
