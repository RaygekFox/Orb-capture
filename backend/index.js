const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Стан гри
const players = {}; // Список гравців
const orb = { x: 250, y: 250, holder: null }; // Координати орба

// Коли клієнт підключається
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Додати нового гравця
    players[socket.id] = {
        x: Math.random() * 500, // Початкові координати
        y: Math.random() * 500,
        score: 0,
    };

    // Відправити всім гравцям стан гри
    io.emit('gameState', { players, orb });

    // Обробка руху гравця
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (player) {
            player.x += data.dx;
            player.y += data.dy;

            // Логіка захоплення орба
            if (!orb.holder && Math.hypot(player.x - orb.x, player.y - orb.y) < 20) {
                orb.holder = socket.id;
            }

            // Якщо гравець утримує орб, орб рухається разом з ним
            if (orb.holder === socket.id) {
                orb.x = player.x;
                orb.y = player.y;
            }
        }
        io.emit('gameState', { players, orb });
    });

    // Коли гравець відключається
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        if (orb.holder === socket.id) orb.holder = null;
        io.emit('gameState', { players, orb });
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
