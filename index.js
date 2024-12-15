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
const PLAYER_SIZE = 20; // Assuming player is 20x20px

// Game state
const players = {}; // List of players
const orb = { x: GAME_WIDTH/2, y: GAME_HEIGHT/2, holder: null }; // Orb coordinates

// Teams
const TEAMS = {
    RED: 'red',
    BLUE: 'blue'
};

// When client connects
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Add new player with random team
    players[socket.id] = {
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE), // Initial coordinates
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        score: 0,
        team: Math.random() < 0.5 ? TEAMS.RED : TEAMS.BLUE
    };

    // Send game state to all players
    io.emit('gameState', { players, orb });

    // Handle player movement
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            // Calculate new position
            let newX = player.x + data.dx;
            let newY = player.y + data.dy;

            // Keep player within bounds
            newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, newX));
            newY = Math.max(0, Math.min(GAME_HEIGHT - PLAYER_SIZE, newY));

            player.x = newX;
            player.y = newY;

            // If player is holding orb, move it with player
            if (orb.holder === socket.id) {
                orb.x = newX;
                orb.y = newY;
            }
        }
        io.emit('gameState', { players, orb });
    });

    // Handle orb interaction (pickup/drop)
    socket.on('orbAction', () => {
        const player = players[socket.id];
        if (player) {
            if (orb.holder === socket.id) {
                // Drop the orb
                orb.holder = null;
            } else if (!orb.holder && Math.hypot(player.x - orb.x, player.y - orb.y) < 30) {
                // Pick up the orb if close enough and not held
                orb.holder = socket.id;
                orb.x = player.x;
                orb.y = player.y;
            }
            io.emit('gameState', { players, orb });
        }
    });

    // Handle team switch
    socket.on('switchTeam', () => {
        const player = players[socket.id];
        if (player) {
            player.team = player.team === TEAMS.RED ? TEAMS.BLUE : TEAMS.RED;
            io.emit('gameState', { players, orb });
        }
    });

    // When player disconnects
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (orb.holder === socket.id) orb.holder = null;
        io.emit('gameState', { players, orb });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
