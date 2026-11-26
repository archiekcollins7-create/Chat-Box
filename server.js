const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const users = {}; // username -> password
const rooms = { General: { code: '' } }; // roomName -> { code }
const roomHistory = { General: [] }; // roomName -> [messages]

io.on('connection', (socket) => {
  
  // Authentication handler
  socket.on('auth', ({ username, password, action }) => {
    if (!username || !password) {
      socket.emit('auth-error', '[ERROR] ALL FIELDS REQUIRED.');
      return;
    }

    if (action === 'register') {
      if (users[username]) {
        socket.emit('auth-error', '[ERROR] USERNAME ALREADY EXISTS.');
      } else {
        users[username] = password;
        socket.emit('auth-success', username);
      }
    } else if (action === 'login') {
      if (users[username] && users[username] === password) {
        socket.emit('auth-success', username);
      } else {
        socket.emit('auth-error', '[ERROR] INVALID CREDENTIALS.');
      }
    }
  });

  // Fetch initial room list
  socket.on('get-rooms', () => {
    socket.emit('update-rooms', rooms);
  });

  // Create custom room
  socket.on('create-room', ({ name, code }) => {
    if (!name) return;
    if (rooms[name]) {
      socket.emit('room-error', '[ERROR] ROOM ALREADY EXISTS.');
      return;
    }

    rooms[name] = { code: code || '' };
    roomHistory[name] = [];
    
    // Broadcast updated room list to everyone online
    io.emit('update-rooms', rooms);
    
    // Join the creator directly
    socket.join(name);
    socket.emit('room-joined', { room: name, code: rooms[name].code });
    socket.emit('load-history', roomHistory[name]);
  });

  // Join existing room (with code verification)
  socket.on('join-room', ({ room, code }) => {
    if (!rooms[room]) {
      socket.emit('room-error', '[ERROR] ROOM DOES NOT EXIST.');
      return;
    }

    if (rooms[room].code && rooms[room].code !== code) {
      socket.emit('room-error', '[ACCESS DENIED] INVALID CODE.');
      return;
    }

    // Leave previous rooms
    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    
    socket.join(room);
    socket.emit('room-joined', { room: room, code: rooms[room].code });
    socket.emit('load-history', roomHistory[room] || []);
  });

  // Real-time chat messages
  template = socket.on('chat-message', ({ room, username, text }) => {
    if (!text || !roomHistory[room]) return;
    const msgData = { user: username, text };
    roomHistory[room].push(msgData);
    io.to(room).emit('message', msgData);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cyber chat server running on port ${PORT}`);
});
