const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messagesDiv = document.getElementById('messages');
const joinSection = document.getElementById('joinSection');
const controlsDiv = document.getElementById('controls');

// Increase canvas size
canvas.width = 1200;
canvas.height = 800;

// Emoji icons for animals
const animalEmojis = {
  rabbit: '🐰',
  sheep: '🐑',
  pig: '🐷',
  cow: '🐮',
  horse: '🐎',
  smallDog: '🐕',
  bigDog: '🦮'
};

let gameState = null;
let joined = false;

// Handle join game button
document.getElementById('joinGameBtn').addEventListener('click', () => {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) {
    alert('Please enter a name.');
    return;
  }
  socket.emit('joinGame', { gameId: 'game1', name });
  joined = true;
  joinSection.style.display = 'none';
  controlsDiv.style.display = 'block';
});

socket.on('gameState', (state) => {
  gameState = state;
  renderGameState();
});

socket.on('message', (msg) => {
  const p = document.createElement('p');
  p.textContent = msg;
  messagesDiv.appendChild(p);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Exchange button
document.getElementById('exchangeBtn').addEventListener('click', () => {
  socket.emit('exchange', {
    gameId: 'game1',
    exchangeType: document.getElementById('exchangeSelect').value
  });
});

// Finish exchange phase
document.getElementById('finishExchangeBtn').addEventListener('click', () => {
  socket.emit('finishExchange', { gameId: 'game1' });
});

// Roll dice button
document.getElementById('rollDiceBtn').addEventListener('click', () => {
  socket.emit('rollDice', { gameId: 'game1' });
});

function drawBankBox(x, y, animal, count, boxWidth = 150, boxHeight = 150) {
  // Draw box with green background
  ctx.fillStyle = '#90EE90'; // Light green
  ctx.fillRect(x, y, boxWidth, boxHeight);
  
  // Add darker green border
  ctx.strokeStyle = '#228B22'; // Forest green
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Draw large emoji
  ctx.font = '40px Arial';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText(animalEmojis[animal], x + boxWidth/2, y + boxHeight/2);
  
  // Draw count (removed "x")
  ctx.font = 'bold 24px Comic Sans MS';
  ctx.fillText(count, x + boxWidth/2, y + boxHeight/2 + 40);
  ctx.textAlign = 'left'; // Reset alignment
}

function drawPlayerBox(x, y, player, isCurrentTurn, boxWidth = 200, boxHeight = 250) {
  // Draw player name above the box
  ctx.fillStyle = '#5c3c10';
  ctx.font = 'bold 24px Comic Sans MS';
  const nameText = player.name + (isCurrentTurn ? ' 👈' : '');
  ctx.fillText(nameText, x, y);
  
  // Adjust y position to add space between name and box
  y += 30;
  
  // Draw box with light background
  ctx.fillStyle = '#f9f9f9';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Draw animals in two columns
  const colWidth = boxWidth / 2;
  let leftY = y + 30;
  let rightY = y + 30;
  let count = 0;
  
  for (let animal in player.animals) {
    const isRightColumn = count % 2;
    const currentY = isRightColumn ? rightY : leftY;
    const currentX = x + (isRightColumn ? colWidth : 10);
    
    // Draw emoji and count
    ctx.font = '30px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(animalEmojis[animal], currentX, currentY);
    ctx.font = '18px Comic Sans MS';
    ctx.fillText(player.animals[animal], currentX + 40, currentY); // Removed "x"
    
    if (isRightColumn) {
      rightY += 40;
    } else {
      leftY += 40;
    }
    count++;
  }
}

function renderGameState() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!gameState) return;
  
  // Draw background
  ctx.fillStyle = '#fff5e6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw bank section
  ctx.fillStyle = '#5c3c10';
  ctx.font = 'bold 28px Comic Sans MS';
  ctx.fillText('🏦 Bank', 20, 40);
  
  // Draw bank boxes
  let x = 20, y = 60;
  const bankBoxWidth = 120;
  const bankBoxHeight = 120;
  const boxesPerRow = Math.floor((canvas.width - 40) / (bankBoxWidth + 10));
  
  Object.entries(gameState.bank).forEach(([animal, count], index) => {
    drawBankBox(x, y, animal, count, bankBoxWidth, bankBoxHeight);
    x += bankBoxWidth + 10;
    if ((index + 1) % boxesPerRow === 0) {
      x = 20;
      y += bankBoxHeight + 10;
    }
  });
  
  // Increased spacing between Bank and Farmers sections
  y += bankBoxHeight + 80; // Changed from 40 to 80
  
  // Draw players section
  ctx.fillStyle = '#5c3c10';
  ctx.font = 'bold 28px Comic Sans MS';
  ctx.fillText('👨‍🌾 Farmers', 20, y);
  
  // Increased spacing here
  y += 50; // Changed from 20 to 50
  x = 20;
  const playerBoxWidth = 200;
  const playerBoxHeight = 250;
  
  gameState.turnOrder.forEach((pid, index) => {
    const player = gameState.players[pid];
    const isCurrentTurn = pid === gameState.currentTurn;
    
    drawPlayerBox(x, y, player, isCurrentTurn, playerBoxWidth, playerBoxHeight);
    
    x += playerBoxWidth + 20;
    if (x + playerBoxWidth > canvas.width - 20) {
      x = 20;
      y += playerBoxHeight + 20;
    }
  });
  
  // Draw game phase at the bottom
  const statusY = canvas.height - 60;
  ctx.fillStyle = '#5c3c10';
  ctx.font = 'bold 20px Comic Sans MS';
  ctx.fillText(`🎮 Phase: ${gameState.phase}`, 20, statusY);
  
  if (gameState.lastDice) {
    ctx.fillText(
      `🎲 Last Roll → Red: ${gameState.lastDice.red}, Blue: ${gameState.lastDice.blue}`,
      20,
      statusY + 30
    );
  }
}
