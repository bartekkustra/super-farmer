const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messagesDiv = document.getElementById('messages');
const joinSection = document.getElementById('joinSection');
const controlsDiv = document.getElementById('controls');

let gameState = null;
let joined = false;

// Handle join game button.
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

/**
 * Draws a labeled box at (x, y).
 * @param {number} x - The X coordinate of the box.
 * @param {number} y - The Y coordinate of the box.
 * @param {string} text - The text to display inside the box.
 * @param {number} boxWidth - The width of the box (default 80).
 * @param {number} boxHeight - The height of the box (default 80).
 */
function drawBox(x, y, text, boxWidth = 80, boxHeight = 80) {
  ctx.fillStyle = '#ccc';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Split text into lines
  const lines = text.split('\n');
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  
  // We start drawing text a bit down from the top.
  let lineY = y + 16;
  const lineHeight = 14;
  for (const line of lines) {
    ctx.fillText(line, x + 5, lineY);
    lineY += lineHeight;
  }
}

/**
 * Render the entire game state on the canvas.
 */
function renderGameState() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!gameState) return;
  
  // 1) Draw the Bank
  ctx.fillStyle = '#000';
  ctx.font = '18px Arial';
  ctx.fillText('Bank:', 10, 30);
  
  let x = 10, y = 40;
  let colCount = 0;
  for (let animal in gameState.bank) {
    // Bank boxes: 80x80
    drawBox(x, y, `${animal}:\n${gameState.bank[animal]}`, 80, 80);
    x += 90;
    colCount++;
    if (colCount % 6 === 0) { // move to a new row after 6 columns
      x = 10;
      y += 90;
    }
  }
  
  // 2) Draw Players
  y += 100; // leave some vertical space after the bank
  ctx.fillStyle = '#000';
  ctx.font = '18px Arial';
  ctx.fillText('Players:', 10, y);
  
  y += 10;
  x = 10;
  let playerBoxStartY = y;
  
  // For players, use bigger boxes (e.g., 120 wide x 140 high)
  const playerBoxWidth = 120;
  const playerBoxHeight = 140;
  colCount = 0;
  
  gameState.turnOrder.forEach((pid) => {
    const player = gameState.players[pid];
    let label = player.name;
    if (pid === gameState.currentTurn) {
      label += ' (current turn)';
    }
    // Build multi-line text for animals
    let animalsText = '';
    for (let a in player.animals) {
      animalsText += `${a}: ${player.animals[a]}\n`;
    }
    const fullText = label + '\n' + animalsText.trim();
    
    drawBox(x, y, fullText, playerBoxWidth, playerBoxHeight);
    
    x += (playerBoxWidth + 10);
    colCount++;
    // If we exceed the canvas width, move to next row
    if (x + playerBoxWidth > canvas.width - 20) {
      x = 10;
      y += (playerBoxHeight + 10);
      colCount = 0;
    }
  });
  
  // 3) Show Phase & Last Dice
  y = y + playerBoxHeight + 30;
  ctx.fillStyle = '#000';
  ctx.font = '16px Arial';
  ctx.fillText(`Phase: ${gameState.phase}`, 10, y);
  
  if (gameState.lastDice) {
    ctx.fillText(
      `Last Dice → Red: ${gameState.lastDice.red}, Blue: ${gameState.lastDice.blue}`,
      10,
      y + 20
    );
  }
}
