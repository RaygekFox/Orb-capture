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
const PLAYER_SIZE = 30; // Increased player size
const MOVEMENT_SPEED = 200; // pixels per second
const BASE_RADIUS = 60;

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
    
    let lastUpdateTime = Date.now();
    
    players[socket.id] = {
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE),
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        score: 0,
        team: Math.random() < 0.5 ? TEAMS.RED : TEAMS.BLUE,
        lastMoveTime: Date.now()
    };

    io.emit('gameState', { players, orb, bases });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            const currentTime = Date.now();
            const deltaTime = (currentTime - player.lastMoveTime) / 1000; // Convert to seconds
            player.lastMoveTime = currentTime;

            // Calculate movement with constant speed
            const moveAmount = MOVEMENT_SPEED * deltaTime;
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
        }
        io.emit('gameState', { players, orb, bases });
    });

    // Rest of the socket handlers remain the same
    socket.on('orbAction', () => {
        const player = players[socket.id];
        if (player) {
            if (orb.holder === socket.id) {
                orb.holder = null;
            } else if (!orb.holder && Math.hypot(player.x - orb.x, player.y - orb.y) < 30) {
                orb.holder = socket.id;
                orb.x = player.x;
                orb.y = player.y;
            }
            io.emit('gameState', { players, orb, bases });
        }
    });

    socket.on('switchTeam', () => {
        const player = players[socket.id];
        if (player) {
            player.team = player.team === TEAMS.RED ? TEAMS.BLUE : TEAMS.RED;
            io.emit('gameState', { players, orb, bases });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (orb.holder === socket.id) orb.holder = null;
        io.emit('gameState', { players, orb, bases });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
