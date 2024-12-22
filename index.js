const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Game constants
const GAME_WIDTH = 1080;
const GAME_HEIGHT = 720;
const PLAYER_SIZE = 30;
const BASE_MOVEMENT_SPEED = 200; // Base speed in pixels per second
const HOLDER_SPEED_MULTIPLIER = 0.75; // Holder moves 25% slower
const STUN_DURATION = 3000; // 3 seconds in milliseconds
const BASE_RADIUS = 60;
const ORB_THROW_SPEED = 400; // pixels per second
const ORB_THROW_DISTANCE = 300; // maximum throw distance
let orbVelocity = { x: 0, y: 0 };
let orbMoving = false;
const WIN_TIME = 50000; // 50 seconds in milliseconds
const SCORE_RADIUS = 80; // Radius to check if orb is in base
const BARRIER_HEALTH = 3;
const BARRIER_COOLDOWN = 10000;

// Game state
const players = {};
const orb = { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, holder: null };

// Add movement states tracking
const playerMovements = {};

// Team bases
const bases = {
    red: { x: 100, y: GAME_HEIGHT/2 },
    blue: { x: GAME_WIDTH - 100, y: GAME_HEIGHT/2 }
};

const TEAMS = {
    RED: 'red',
    BLUE: 'blue'
};

// Add to game state
const teamProgress = {
    red: 0,
    blue: 0
};

const barriers = [];

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    players[socket.id] = {
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE),
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        score: 0,
        team: Math.random() < 0.5 ? TEAMS.RED : TEAMS.BLUE,
        lastMoveTime: Date.now(),
        stunned: false,
        stunEndTime: 0,
        lastBarrierTime: 0
    };

    // Initialize movement state for new player
    playerMovements[socket.id] = {
        dx: 0,
        dy: 0,
        isMoving: false
    };

    io.emit('gameState', { players, orb, bases, teamProgress, barriers });

    socket.on('moveStart', (data) => {
        if (!playerMovements[socket.id]) return;
        playerMovements[socket.id].dx = data.dx;
        playerMovements[socket.id].dy = data.dy;
        playerMovements[socket.id].isMoving = true;
    });

    socket.on('moveEnd', (data) => {
        if (!playerMovements[socket.id]) return;
        playerMovements[socket.id].isMoving = false;
    });

    socket.on('orbAction', () => {
        const player = players[socket.id];
        if (!player || player.stunned) return;

        // If player has the orb, they can throw it
        if (orb.holder === socket.id) {
            orb.holder = null;
            // Throwing logic will be implemented later
        } else {
            const orbHolder = Object.entries(players).find(([id, p]) => id === orb.holder);
            
            if (orbHolder) {
                const [holderId, holderPlayer] = orbHolder;
                
                // Check if holder is from opposite team and player is close enough
                if (holderPlayer.team !== player.team && 
                    Math.hypot(player.x - holderPlayer.x, player.y - holderPlayer.y) < PLAYER_SIZE * 1.5) {
                    // Steal the orb and stun the holder
                    orb.holder = socket.id;
                    orb.x = player.x;
                    orb.y = player.y;
                    
                    // Stun the previous holder
                    holderPlayer.stunned = true;
                    holderPlayer.stunEndTime = Date.now() + STUN_DURATION;
                    
                    // Remove stun after duration
                    setTimeout(() => {
                        if (players[holderId]) {
                            players[holderId].stunned = false;
                            io.emit('gameState', { players, orb, bases, teamProgress, barriers });
                        }
                    }, STUN_DURATION);
                }
            } else if (Math.hypot(player.x - orb.x, player.y - orb.y) < 30) {
                // Normal orb pickup if no one holds it
                orb.holder = socket.id;
                orb.x = player.x;
                orb.y = player.y;
            }
        }
        
        io.emit('gameState', { players, orb, bases, teamProgress, barriers });
    });

    socket.on('switchTeam', () => {
        const player = players[socket.id];
        if (player) {
            player.team = player.team === TEAMS.RED ? TEAMS.BLUE : TEAMS.RED;
            io.emit('gameState', { players, orb, bases, teamProgress, barriers });
        }
    });

    socket.on('throwOrb', (data) => {
        const player = players[socket.id];
        if (!player || orb.holder !== socket.id) return;

        const dx = data.targetX - orb.x;
        const dy = data.targetY - orb.y;
        const distance = Math.hypot(dx, dy);
        
        orbVelocity.x = (dx / distance) * ORB_THROW_SPEED;
        orbVelocity.y = (dy / distance) * ORB_THROW_SPEED;
        
        orb.holder = null;
        orbMoving = true;
    });

    socket.on('createBarrier', (position) => {
        const player = players[socket.id];
        const currentTime = Date.now();
        
        if (!player || player.stunned || 
            currentTime - player.lastBarrierTime < BARRIER_COOLDOWN || 
            orb.holder === socket.id) return;

        const barrier = {
            x: player.x,
            y: player.y,
            team: player.team,
            health: BARRIER_HEALTH,
            id: Date.now()
        };

        barriers.push(barrier);
        player.lastBarrierTime = currentTime;
        
        io.emit('gameState', { players, orb, bases, teamProgress, barriers });
    });

    socket.on('hitBarrier', (barrierId) => {
        const barrier = barriers.find(b => b.id === barrierId);
        const player = players[socket.id];
        
        if (!barrier || !player || barrier.team === player.team) return;
        
        barrier.health--;
        if (barrier.health <= 0) {
            barriers.splice(barriers.indexOf(barrier), 1);
        }
        
        io.emit('gameState', { players, orb, bases, teamProgress, barriers });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (orb.holder === socket.id) orb.holder = null;
        io.emit('gameState', { players, orb, bases, teamProgress, barriers });
        delete playerMovements[socket.id];
    });
});

// Add continuous movement update loop
setInterval(() => {
    const currentTime = Date.now();
    const deltaTime = 1/60; // 60 FPS

    // Update all moving players
    Object.keys(playerMovements).forEach(playerId => {
        const movement = playerMovements[playerId];
        const player = players[playerId];
        
        if (!player || !movement.isMoving || player.stunned) return;
        if (currentTime < player.stunEndTime) return;

        // Apply speed modifications
        let currentSpeed = BASE_MOVEMENT_SPEED;
        if (orb.holder === playerId) {
            currentSpeed *= HOLDER_SPEED_MULTIPLIER;
        }

        const moveAmount = currentSpeed * deltaTime;
        let newX = player.x + (movement.dx * moveAmount);
        let newY = player.y + (movement.dy * moveAmount);

        // Keep player within bounds
        newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(GAME_HEIGHT - PLAYER_SIZE, newY));

        // Check barrier collisions
        const canMove = !barriers.some(barrier => {
            if (barrier.team === player.team) return false;
            
            const playerBox = {
                left: newX - PLAYER_SIZE/2,
                right: newX + PLAYER_SIZE/2,
                top: newY - PLAYER_SIZE/2,
                bottom: newY + PLAYER_SIZE/2
            };
            
            const barrierBox = {
                left: barrier.x - 15,
                right: barrier.x + 15,
                top: barrier.y - 30,
                bottom: barrier.y + 30
            };
            
            return !(playerBox.left > barrierBox.right || 
                    playerBox.right < barrierBox.left || 
                    playerBox.top > barrierBox.bottom || 
                    playerBox.bottom < barrierBox.top);
        });

        if (canMove) {
            player.x = newX;
            player.y = newY;

            if (orb.holder === playerId) {
                orb.x = newX;
                orb.y = newY;
            }
        }
    });

    // Emit game state if any players are moving
    if (Object.values(playerMovements).some(m => m.isMoving)) {
        io.emit('gameState', { players, orb, bases, teamProgress, barriers });
    }

    // Update orb position if it's moving
    if (orbMoving && !orb.holder) {
        orb.x += orbVelocity.x * deltaTime;
        orb.y += orbVelocity.y * deltaTime;

        // Check if orb hit any walls
        if (orb.x <= 0 || orb.x >= GAME_WIDTH) {
            orbVelocity.x *= -0.5;
            orb.x = Math.max(0, Math.min(GAME_WIDTH, orb.x));
        }
        if (orb.y <= 0 || orb.y >= GAME_HEIGHT) {
            orbVelocity.y *= -0.5;
            orb.y = Math.max(0, Math.min(GAME_HEIGHT, orb.y));
        }

        // Apply friction
        orbVelocity.x *= 0.99;
        orbVelocity.y *= 0.99;

        // Stop moving if velocity is very low
        if (Math.abs(orbVelocity.x) < 1 && Math.abs(orbVelocity.y) < 1) {
            orbMoving = false;
            orbVelocity = { x: 0, y: 0 };
        }
    }

    // Update team progress
    if (!orb.holder && !orbMoving) {
        const redDistance = Math.hypot(orb.x - bases.red.x, orb.y - bases.red.y);
        const blueDistance = Math.hypot(orb.x - bases.blue.x, orb.y - bases.blue.y);

        if (redDistance < SCORE_RADIUS) {
            teamProgress.red += deltaTime * 1000;
            if (teamProgress.red >= WIN_TIME) {
                io.emit('gameOver', { winner: 'red' });
                // Reset game state here
            }
        } else if (blueDistance < SCORE_RADIUS) {
            teamProgress.blue += deltaTime * 1000;
            if (teamProgress.blue >= WIN_TIME) {
                io.emit('gameOver', { winner: 'blue' });
                // Reset game state here
            }
        }
    }

    // Include progress in gameState emissions
    io.emit('gameState', { players, orb, bases, teamProgress, barriers });
}, 1000/60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
