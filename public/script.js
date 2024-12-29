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
const gameUI = document.createElement('div');
gameUI.innerHTML = `
    <div class="score-container">
        <div class="team-progress red-team">
            <div class="progress-fill"></div>
        </div>
        <div class="team-progress blue-team">
            <div class="progress-fill"></div>
        </div>
    </div>
`;
document.body.appendChild(gameUI);

// Add at the top with other constants
const PLAYER_SIZE = 45;
const EYE_RADIUS = PLAYER_SIZE * 0.3;
const EYE_FLARE_RADIUS = EYE_RADIUS * 0.4;
const LEG_LENGTH = PLAYER_SIZE * 0.4;
const LEG_WIDTH = PLAYER_SIZE * 0.15;
const MAX_EYE_OFFSET = 3;
const LEG_ANIMATION_SPEED = 0.005;

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
    const time = Date.now();
    
    // Debug movement values
    console.log('Player movement:', {
        dx: player.dx,
        dy: player.dy,
        speed: Math.sqrt(player.dx * player.dx + player.dy * player.dy)
    });
    
    // Calculate eye offset based on movement
    const eyeOffsetX = player.dx * MAX_EYE_OFFSET;
    const eyeOffsetY = player.dy * MAX_EYE_OFFSET;
    
    // Calculate leg animation - only animate if actually moving
    const speed = Math.sqrt(player.dx * player.dx + player.dy * player.dy);
    const isMoving = speed > 0.1; // Add threshold to prevent tiny movements
    const legOffset = isMoving ? Math.sin(time * LEG_ANIMATION_SPEED) * LEG_LENGTH * 0.3 : 0;
    
    // Debug animation values
    console.log('Animation values:', {
        isMoving,
        legOffset,
        time,
        sinValue: Math.sin(time * LEG_ANIMATION_SPEED)
    });
    
    // Draw legs
    ctx.fillStyle = colors[player.team].fill;
    ctx.strokeStyle = colors[player.team].stroke;
    ctx.lineWidth = 2;
    
    // Debug drawing positions
    console.log('Drawing positions:', {
        playerX: player.x,
        playerY: player.y,
        eyeCenter: {
            x: player.x + eyeOffsetX,
            y: player.y + eyeOffsetY
        },
        eyeRadius: EYE_RADIUS,
        playerSize: PLAYER_SIZE
    });
    
    // Left leg
    ctx.fillRect(
        player.x - PLAYER_SIZE/4 - LEG_WIDTH/2,
        player.y + PLAYER_SIZE/2,
        LEG_WIDTH,
        LEG_LENGTH - legOffset
    );
    
    // Right leg
    ctx.fillRect(
        player.x + PLAYER_SIZE/4 - LEG_WIDTH/2,
        player.y + PLAYER_SIZE/2,
        LEG_WIDTH,
        LEG_LENGTH + legOffset
    );
    
    // Draw main body (rounded rectangle)
    ctx.fillStyle = colors[player.team].fill;
    ctx.strokeStyle = colors[player.team].stroke;
    roundRect(ctx, 
        player.x - PLAYER_SIZE/2,
        player.y - PLAYER_SIZE/2,
        PLAYER_SIZE,
        PLAYER_SIZE,
        12
    );
    
    // Draw eye (black circle)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(
        player.x + eyeOffsetX,
        player.y + eyeOffsetY,
        EYE_RADIUS,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // Draw eye flare (white circle)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(
        player.x + eyeOffsetX + EYE_RADIUS * 0.3,
        player.y + eyeOffsetY - EYE_RADIUS * 0.3,
        EYE_FLARE_RADIUS,
        0,
        Math.PI * 2
    );
    ctx.fill();

    if (isHolder) {
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 3;
        roundRect(ctx,
            player.x - PLAYER_SIZE/2,
            player.y - PLAYER_SIZE/2,
            PLAYER_SIZE,
            PLAYER_SIZE,
            12,
            false,
            true
        );
    }

    // Show stun effect
    if (player.stunned) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE * 0.8, 0, Math.PI * 2);
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


function checkBarrierCollision(x, y, team) {
    return barriers.some(barrier => {
        if (barrier.team === team) return false;
        
        return x > barrier.x - 45 && x < barrier.x + 45 &&
               y > barrier.y - 60 && y < barrier.y + 60;
    });
}
