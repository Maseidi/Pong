const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusElement = document.getElementById("status");
const scoreElement = document.getElementById("score");

// Connect to your Node.js server
const socket = io("http://localhost:3000", {
  transports: ["websocket", "polling"],
  timeout: 20000,
  forceNew: true,
});

let gameState = null;
let playerRole = null;
let keys = {};
let mousePos = { x: 0, y: 0 };

// Socket connection events
socket.on("connect", () => {
  console.log("Connected to server");
  statusElement.textContent = "Connected! Waiting for player assignment...";
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  statusElement.textContent =
    "Connection error. Make sure the server is running on localhost:3000";
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  statusElement.textContent = "Disconnected from server. Reconnecting...";
});

socket.on("reconnect", (attemptNumber) => {
  console.log("Reconnected after", attemptNumber, "attempts");
  statusElement.textContent = "Reconnected! Waiting for game state...";
});

socket.on("reconnect_error", (error) => {
  console.error("Reconnection error:", error);
  statusElement.textContent =
    "Failed to reconnect. Make sure the server is running.";
});

// Game events
socket.on("playerAssigned", (role) => {
  playerRole = role;
  console.log("Assigned as:", role);
  const side = role === "player1" ? "Left" : "Right";
  statusElement.textContent = `You are ${side} Paddle (${role.toUpperCase()}) - Waiting for another player...`;
});

socket.on("gameState", (state) => {
  gameState = state;
  updateScore();
  render();

  // Update status if game is running
  if (Object.keys(state.paddles).length === 2) {
    const currentStatus = statusElement.textContent;
    if (currentStatus.includes("Waiting for another player")) {
      const side = playerRole === "player1" ? "Left" : "Right";
      statusElement.textContent = `You are ${side} Paddle (${playerRole.toUpperCase()}) - Game Active!`;
    }
  }
});

socket.on("gameFull", () => {
  statusElement.textContent = "Game is full. Please try again later.";
});

// Input handling
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Mouse controls for both X and Y movement
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;

  if (playerRole && gameState && socket.connected) {
    const paddleX = mousePos.x - gameState.paddles[playerRole].width / 2;
    const paddleY = mousePos.y - gameState.paddles[playerRole].height / 2;

    socket.emit("paddleMove", { x: paddleX, y: paddleY });
  }
});

// Touch controls for both X and Y movement
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (playerRole && gameState && socket.connected) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    const paddleX = touchX - gameState.paddles[playerRole].width / 2;
    const paddleY = touchY - gameState.paddles[playerRole].height / 2;

    socket.emit("paddleMove", { x: paddleX, y: paddleY });
  }
});

// Game loop for keyboard input
function gameLoop() {
  if (playerRole && gameState && socket.connected) {
    const paddle = gameState.paddles[playerRole];
    const speed = paddle.speed;
    let newX = paddle.x;
    let newY = paddle.y;
    let moved = false;

    // Y movement
    if (keys["w"] || keys["arrowup"]) {
      newY = Math.max(0, paddle.y - speed);
      moved = true;
    }

    if (keys["s"] || keys["arrowdown"]) {
      newY = Math.min(
        gameState.canvas.height - paddle.height,
        paddle.y + speed
      );
      moved = true;
    }

    // X movement
    if (keys["a"] || keys["arrowleft"]) {
      newX = paddle.x - speed;
      moved = true;
    }

    if (keys["d"] || keys["arrowright"]) {
      newX = paddle.x + speed;
      moved = true;
    }

    if (moved) {
      socket.emit("paddleMove", { x: newX, y: newY });
    }
  }

  requestAnimationFrame(gameLoop);
}

// Rendering function with enhanced visuals
function render() {
  if (!gameState) return;

  // Clear canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw center line
  ctx.strokeStyle = "#333";
  ctx.setLineDash([5, 15]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw play areas (visual guides)
  ctx.strokeStyle = "#111";
  ctx.strokeRect(10, 10, canvas.width / 2 - 60, canvas.height - 20); // Player 1 area
  ctx.strokeRect(
    canvas.width / 2 + 50,
    10,
    canvas.width / 2 - 60,
    canvas.height - 20
  ); // Player 2 area

  // Draw paddles
  ctx.fillStyle = "#fff";

  // Player 1 paddle
  const p1 = gameState.paddles.player1;
  ctx.fillRect(p1.x, p1.y, p1.width, p1.height);

  // Player 2 paddle
  const p2 = gameState.paddles.player2;
  ctx.fillRect(p2.x, p2.y, p2.width, p2.height);

  // Highlight current player's paddle
  if (playerRole) {
    ctx.fillStyle = playerRole === "player1" ? "#00ff00" : "#ff4444";
    const currentPaddle = gameState.paddles[playerRole];
    ctx.fillRect(
      currentPaddle.x,
      currentPaddle.y,
      currentPaddle.width,
      currentPaddle.height
    );
  }

  // Draw ball with glow effect
  const ball = gameState.ball;

  // Ball glow
  const gradient = ctx.createRadialGradient(
    ball.x,
    ball.y,
    0,
    ball.x,
    ball.y,
    ball.radius * 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius * 2, 0, Math.PI * 2);
  ctx.fill();

  // Ball
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Ball trail effect
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  ctx.arc(
    ball.x - ball.dx * 2,
    ball.y - ball.dy * 2,
    ball.radius * 0.8,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.arc(
    ball.x - ball.dx * 4,
    ball.y - ball.dy * 4,
    ball.radius * 0.6,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Draw ball speed indicator
  if (gameState.gameActive) {
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const speedPercent = (speed / gameState.ball.maxSpeed) * 100;

    ctx.fillStyle = `hsl(${120 - speedPercent}, 70%, 50%)`;
    ctx.font = "14px Arial";
    ctx.fillText(`Ball Speed: ${speed.toFixed(1)}`, 10, canvas.height - 10);
  }
}

function updateScore() {
  if (gameState) {
    scoreElement.textContent = `Player 1: ${gameState.paddles.player1.score} - Player 2: ${gameState.paddles.player2.score}`;
  }
}

// Start the game loop
gameLoop();

// Initial render
render();
