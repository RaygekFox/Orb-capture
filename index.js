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

// Game state
const players = {};
const orb = { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, holder: null };

// Team bases
const bases = {
    red: { x: 100, y: GAME_HEIGHT/2 },
    blue: { x: GAME_WIDTH - 100, y: GAME_HEIGHT/2 }
};

const TEAMS = {
    RED: 'red',
    BLUE: 'blue'
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    players[socket.id] = {
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE),
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        score: 0,
        team: Math.random() < 0.5 ? TEAMS.RED : TEAMS.BLUE,
        lastMoveTime: Date.now(),
        stunned: false,
        stunEndTime: 0
    };

    io.emit('gameState', { players, orb, bases });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player || player.stunned) return;

        const currentTime = Date.now();
        if (currentTime < player.stunEndTime) return;

        const deltaTime = (currentTime - player.lastMoveTime) / 1000;
        player.lastMoveTime = currentTime;

        // Apply speed modifications
        let currentSpeed = BASE_MOVEMENT_SPEED;
        if (orb.holder === socket.id) {
            currentSpeed *= HOLDER_SPEED_MULTIPLIER;
        }

        const moveAmount = currentSpeed * deltaTime;
        let newX = player.x + (data.dx * moveAmount);
        let newY = player.y + (data.dy * moveAmount);

        // Keep player within bounds
        newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(GAME_HEIGHT - PLAYER_SIZE, newY));

        player.x = newX;
        player.y = newY;

        if (orb.holder === socket.id) {
            orb.x = newX;
            orb.y = newY;
        }

        io.emit('gameState', { players, orb, bases });
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
                            io.emit('gameState', { players, orb, bases });
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
        
        io.emit('gameState', { players, orb, bases });
    });

    socket.on('switchTeam', () => {
        const player = players[socket.id];
        if (player) {
            player.team = player.team === TEAMS.RED ? TEAMS.BLUE : TEAMS.RED;
            io.emit('gameState', { players, orb, bases });
        }
    });

    socket.on('throwOrb', (data) => {
        const player = players[socket.id];
        if (!player || orb.holder !== socket.id) return;

        const dx = data.targetX - orb.x;
        const dy = data.targetY - orb.y;
        const distance = Math.hypot(dx, dy);
        
        // Normalize direction and apply throw speed
        orbVelocity.x = (dx / distance) * ORB_THROW_SPEED;
        orbVelocity.y = (dy / distance) * ORB_THROW_SPEED;
        
        orb.holder = null;
        orbMoving = true;
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (orb.holder === socket.id) orb.holder = null;
        io.emit('gameState', { players, orb, bases });
    });
});

// Add an update loop for orb movement
setInterval(() => {
    if (orbMoving && !orb.holder) {
        const deltaTime = 1/60; // 60 FPS
        
        // Move orb
        orb.x += orbVelocity.x * deltaTime;
        orb.y += orbVelocity.y * deltaTime;
        
        // Apply friction
        const friction = 0.95;
        orbVelocity.x *= friction;
        orbVelocity.y *= friction;
        
        // Stop if moving too slow
        if (Math.abs(orbVelocity.x) < 0.1 && Math.abs(orbVelocity.y) < 0.1) {
            orbMoving = false;
            orbVelocity.x = 0;
            orbVelocity.y = 0;
        }
        
        // Keep orb within bounds
        orb.x = Math.max(10, Math.min(GAME_WIDTH - 10, orb.x));
        orb.y = Math.max(10, Math.min(GAME_HEIGHT - 10, orb.y));
        
        io.emit('gameState', { players, orb, bases });
    }
}, 1000/60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
