const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const PORT = process.env.PORT || 3000;

// Game state
let gameState = {
  canvas: { width: 800, height: 600 },
  ball: {
    x: 400,
    y: 300,
    dx: 5,
    dy: 3,
    radius: 10,
    baseSpeed: 5, // Base speed for normalization
    acceleration: 1.02, // Speed multiplier after paddle hit
    maxSpeed: 15 // Maximum speed cap
  },
  paddles: {
    player1: {
      x: 50,
      y: 250,
      width: 15,
      height: 100,
      score: 0,
      speed: 8
    },
    player2: {
      x: 735,
      y: 250,
      width: 15,
      height: 100,
      score: 0,
      speed: 8
    }
  },
  players: {},
  gameActive: false
};

// Helper function to normalize ball speed
function normalizeBallSpeed() {
  const currentSpeed = Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy);
  if (currentSpeed > 0) {
    gameState.ball.dx = (gameState.ball.dx / currentSpeed) * gameState.ball.baseSpeed;
    gameState.ball.dy = (gameState.ball.dy / currentSpeed) * gameState.ball.baseSpeed;
  }
}

// Helper function to accelerate ball after paddle hit
function accelerateBall() {
  const currentSpeed = Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy);
  const newSpeed = Math.min(currentSpeed * gameState.ball.acceleration, gameState.ball.maxSpeed);
  
  if (currentSpeed > 0) {
    gameState.ball.dx = (gameState.ball.dx / currentSpeed) * newSpeed;
    gameState.ball.dy = (gameState.ball.dy / currentSpeed) * newSpeed;
    gameState.ball.baseSpeed = newSpeed;
  }
}

function resetBall() {
  gameState.ball.x = gameState.canvas.width / 2;
  gameState.ball.y = gameState.canvas.height / 2;
  
  // Random direction
  const angle = (Math.random() - 0.5) * Math.PI / 3; // ±30 degrees
  const direction = Math.random() < 0.5 ? 1 : -1;
  
  gameState.ball.baseSpeed = 5; // Reset to base speed
  gameState.ball.dx = Math.cos(angle) * gameState.ball.baseSpeed * direction;
  gameState.ball.dy = Math.sin(angle) * gameState.ball.baseSpeed;
  
  normalizeBallSpeed();
}

function updateGame() {
  if (!gameState.gameActive || Object.keys(gameState.players).length < 2) return;

  // Move ball
  gameState.ball.x += gameState.ball.dx;
  gameState.ball.y += gameState.ball.dy;

  // Ball collision with top and bottom walls
  if (gameState.ball.y - gameState.ball.radius <= 0 || 
      gameState.ball.y + gameState.ball.radius >= gameState.canvas.height) {
    gameState.ball.dy = -gameState.ball.dy;
  }

  // Ball collision with paddles
  const ball = gameState.ball;
  const p1 = gameState.paddles.player1;
  const p2 = gameState.paddles.player2;

  // Player 1 paddle collision
  if (ball.x - ball.radius <= p1.x + p1.width &&
      ball.x + ball.radius >= p1.x &&
      ball.y - ball.radius <= p1.y + p1.height &&
      ball.y + ball.radius >= p1.y &&
      ball.dx < 0) {
    
    // Calculate hit position relative to paddle center (-1 to 1)
    const hitPos = (ball.y - (p1.y + p1.height / 2)) / (p1.height / 2);
    
    ball.dx = Math.abs(ball.dx); // Ensure ball goes right
    ball.dy = hitPos * Math.abs(ball.dx) * 0.8; // Add spin based on hit position
    
    accelerateBall();
    normalizeBallSpeed();
  }

  // Player 2 paddle collision
  if (ball.x + ball.radius >= p2.x &&
      ball.x - ball.radius <= p2.x + p2.width &&
      ball.y - ball.radius <= p2.y + p2.height &&
      ball.y + ball.radius >= p2.y &&
      ball.dx > 0) {
    
    // Calculate hit position relative to paddle center (-1 to 1)
    const hitPos = (ball.y - (p2.y + p2.height / 2)) / (p2.height / 2);
    
    ball.dx = -Math.abs(ball.dx); // Ensure ball goes left
    ball.dy = hitPos * Math.abs(ball.dx) * 0.8; // Add spin based on hit position
    
    accelerateBall();
    normalizeBallSpeed();
  }

  // Scoring
  if (ball.x < 0) {
    gameState.paddles.player2.score++;
    resetBall();
  } else if (ball.x > gameState.canvas.width) {
    gameState.paddles.player1.score++;
    resetBall();
  }
}

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Assign player role
  const playerCount = Object.keys(gameState.players).length;
  
  if (playerCount >= 2) {
    socket.emit('gameFull');
    return;
  }

  const playerRole = playerCount === 0 ? 'player1' : 'player2';
  gameState.players[socket.id] = playerRole;
  
  socket.emit('playerAssigned', playerRole);
  socket.emit('gameState', gameState);

  // Start game when 2 players connected
  if (Object.keys(gameState.players).length === 2) {
    gameState.gameActive = true;
    resetBall();
  }

  // Handle paddle movement
  socket.on('paddleMove', (data) => {
    const playerRole = gameState.players[socket.id];
    if (playerRole && gameState.paddles[playerRole]) {
      const paddle = gameState.paddles[playerRole];
      
      // Update Y position
      if (data.y !== undefined) {
        paddle.y = Math.max(0, Math.min(gameState.canvas.height - paddle.height, data.y));
      }
      
      // Update X position with bounds checking
      if (data.x !== undefined) {
        if (playerRole === 'player1') {
          // Player 1 can move in left half of screen
          paddle.x = Math.max(10, Math.min(gameState.canvas.width / 2 - paddle.width - 50, data.x));
        } else {
          // Player 2 can move in right half of screen
          paddle.x = Math.max(gameState.canvas.width / 2 + 50, Math.min(gameState.canvas.width - paddle.width - 10, data.x));
        }
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
    
    if (Object.keys(gameState.players).length < 2) {
      gameState.gameActive = false;
    }
  });
});

// Game loop
setInterval(() => {
  updateGame();
  io.emit('gameState', gameState);
}, 1000 / 60); // 60 FPS

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
