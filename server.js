const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = {};
const roomHistory = { General: [] };

io.on('connection', (socket) => {
  socket.on('auth', ({ username, password, action }) => {
    if (action === 'register') {
      if (users[username]) socket.emit('auth-error', 'Username taken!');
      else {
        users[username] = password;
        socket.emit('auth-success', { username, rooms: Object.keys(roomHistory) });
      }
    } else if (action === 'login') {
      if (users[username] && users[username] === password) {
        socket.emit('auth-success', { username, rooms: Object.keys(roomHistory) });
      } else {
        socket.emit('auth-error', 'Wrong password!');
      }
    }
  });

  socket.on('create-room', (name) => {
    if (!roomHistory[name]) {
      roomHistory[name] = [];
      io.emit('update-rooms', Object.keys(roomHistory));
    }
  });

  socket.on('join-room', ({ room, username }) => {
    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(room);
    if (!roomHistory[room]) roomHistory[room] = [];
    socket.emit('load-history', roomHistory[room]);
  });

  socket.on('chat-message', ({ room, username, text }) => {
    const data = { user: username, text };
    if (roomHistory[room]) roomHistory[room].push(data);
    io.to(room).emit('message', data);
  });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

server.listen(3000, '0.0.0.0', () => {
  console.log(`Server running! Open http://${getLocalIP()}:3000 on your network.`);
});
