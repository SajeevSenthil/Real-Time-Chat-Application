const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e30, // Allow large files (10 GB)
});

const PORT = process.env.PORT || 3000;

// Predefined user colors for chat messages
const colors = ["#FFCDD2", "#E1BEE7", "#BBDEFB", "#C8E6C9", "#FFECB3", "#D7CCC8", "#F8BBD0", "#DCEDC8", "#FFAB91"];
const userColors = {}; // Store colors for each user
const usernameToSocket = {}; // Map usernames to their socket IDs

// Create and serve the uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files
app.use(express.static('public')); // Serve static files (e.g., HTML, CSS, JS)

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle username assignment
  socket.on('username', (username) => {
    usernameToSocket[username] = socket.id; // Map username to socket ID
    if (!userColors[username]) {
      // Assign a unique color
      userColors[username] = colors[Object.keys(userColors).length % colors.length];
    }
    console.log(`Username "${username}" assigned to socket ID: ${socket.id}`);
  });

  // Handle chat messages
  socket.on('chat message', ({ username, msg }) => {
    if (msg.charAt(0) === '\\') {
      // Private message handling
      const parts = msg.slice(1).split(' ');
      const targetUsername = parts[0]; // Extract target username
      const privateMsg = parts.slice(1).join(' '); // Extract the message text
  
      const toSocketId = usernameToSocket[targetUsername];
      if (toSocketId) {
        // Send the private message to the receiver
        io.to(toSocketId).emit('chat message', {
          username,
          msg: privateMsg,
          color: "#FFFFFF",
          private: true, // Indicate it's a private message
        });
  
        // Also send the message back to the sender
        const PrivMsg = `to ${targetUsername}: ${privateMsg}`;
        socket.emit('chat message', {
          username,
          msg: PrivMsg,
          color: "#FFFFFF",
          private: true, // Indicate it's a private message
        });
  
        console.log(`Private message from "${username}" to "${targetUsername}": ${privateMsg}`);
      } else {
        // Notify the sender if the target user is not connected
        socket.emit('error', `User "${targetUsername}" is not connected.`);
        console.log(`Failed to send private message: User "${targetUsername}" not connected.`);
      }
    } else {
      // Broadcast public messages
      io.emit('chat message', { username, msg, color: userColors[username] });
      console.log(`Public message from "${username}": ${msg}`);
    }
  });
  

  // Handle file uploads
  socket.on('file upload', ({ username, fileName, fileData }) => {
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(fileData, 'base64');

    fs.writeFile(filePath, buffer, (err) => {
      if (!err) {
        io.emit('file message', {
          username,
          fileName,
          fileUrl: `/uploads/${fileName}`,
          color: userColors[username],
        });
        console.log(`File "${fileName}" uploaded by "${username}".`);
      } else {
        socket.emit('file upload error', 'Failed to save file.');
        console.error(`Error saving file "${fileName}":`, err);
      }
    });
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    const disconnectedUsername = Object.keys(usernameToSocket).find(
      (username) => usernameToSocket[username] === socket.id
    );
    if (disconnectedUsername) {
      delete usernameToSocket[disconnectedUsername];
      console.log(`User "${disconnectedUsername}" disconnected.`);
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
