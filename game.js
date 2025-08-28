const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusElement = document.getElementById("status");
const scoreElement = document.getElementById("score");

const socket = io("http://localhost:3001");

let gameState = null;
let playerRole = null;
let keys = {};

// Socket events
socket.on("playerAssigned", (role) => {
  playerRole = role;
  statusElement.textContent = `You are ${
    role === "player1" ? "Left Paddle (Player 1)" : "Right Paddle (Player 2)"
  }`;
});

socket.on("gameState", (state) => {
  gameState = state;
  updateScore();
  render();
});

socket.on("gameFull", () => {
  statusElement.textContent = "Game is full. Please try again later.";
});

socket.on("disconnect", () => {
  statusElement.textContent = "Disconnected from server";
});

// Input handling
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Mouse controls for mobile/alternative input
canvas.addEventListener("mousemove", (e) => {
  if (playerRole && gameState) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const paddleY = mouseY - gameState.paddles[playerRole].height / 2;

    socket.emit("paddleMove", { y: paddleY });
  }
});

// Touch controls for mobile
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (playerRole && gameState) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchY = touch.clientY - rect.top;
    const paddleY = touchY - gameState.paddles[playerRole].height / 2;

    socket.emit("paddleMove", { y: paddleY });
  }
});

// Game loop for input
function gameLoop() {
  if (playerRole && gameState) {
    let moved = false;
    const paddle = gameState.paddles[playerRole];
    const speed = 8;

    if (keys["w"] || keys["arrowup"]) {
      const newY = Math.max(0, paddle.y - speed);
      socket.emit("paddleMove", { y: newY });
      moved = true;
    }

    if (keys["s"] || keys["arrowdown"]) {
      const newY = Math.min(
        gameState.canvas.height - paddle.height,
        paddle.y + speed
      );
      socket.emit("paddleMove", { y: newY });
      moved = true;
    }
  }

  requestAnimationFrame(gameLoop);
}

// Rendering
function render() {
  if (!gameState) return;

  // Clear canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw center line
  ctx.strokeStyle = "#fff";
  ctx.setLineDash([5, 15]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

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
    ctx.fillStyle = "#ff0";
    const currentPaddle = gameState.paddles[playerRole];
    ctx.fillRect(
      currentPaddle.x,
      currentPaddle.y,
      currentPaddle.width,
      currentPaddle.height
    );
  }

  // Draw ball
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(
    gameState.ball.x,
    gameState.ball.y,
    gameState.ball.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Draw ball trail effect
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  ctx.arc(
    gameState.ball.x - gameState.ball.dx,
    gameState.ball.y - gameState.ball.dy,
    gameState.ball.radius * 0.8,
    0,
    Math.PI * 2
  );
  ctx.fill();
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
