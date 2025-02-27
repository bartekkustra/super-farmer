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

// Add room input or generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Modify the join section in the HTML
joinSection.innerHTML = `
  <input type="text" id="nameInput" placeholder="Enter your farmer name" />
  <input type="text" id="roomInput" placeholder="Enter room code (optional)" />
  <button id="joinGameBtn">Start Farming</button>
  <button id="createGameBtn">Create New Game</button>
`;

// Handle create game button
document.getElementById('createGameBtn').addEventListener('click', () => {
  const roomCode = generateRoomCode();
  document.getElementById('roomInput').value = roomCode;
});

// Modify join game button handler
document.getElementById('joinGameBtn').addEventListener('click', () => {
  const name = document.getElementById('nameInput').value.trim();
  let roomCode = document.getElementById('roomInput').value.trim();
  
  if (!name) {
    alert('Please enter a name.');
    return;
  }
  
  if (!roomCode) {
    roomCode = generateRoomCode();
    document.getElementById('roomInput').value = roomCode;
  }
  
  socket.emit('joinGame', { gameId: roomCode, name });
  joined = true;
  joinSection.style.display = 'none';
  controlsDiv.style.display = 'block';
  
  // Update URL with room code
  window.history.pushState({}, '', `?room=${roomCode}`);
});

// Check URL for room code on page load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode) {
    document.getElementById('roomInput').value = roomCode;
  }
});

socket.on('gameState', (state) => {
  gameState = state;
  
  // Show/hide appropriate controls based on game state
  const startGameBtn = document.getElementById('startGameBtn');
  const gameControls = document.getElementById('gameControls');
  
  if (gameState.started) {
    startGameBtn.style.display = 'none';
    gameControls.style.display = 'block';
  } else {
    startGameBtn.style.display = 'block';
    gameControls.style.display = 'none';
  }
  
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

// Add start game button to the controls
controlsDiv.innerHTML = `
  <button id="startGameBtn">Start Game</button>
  <div id="gameControls" style="display: none;">
    <div class="section-title">🔄 Exchange Animals</div>
    <select id="exchangeSelect">
      <optgroup label="🐰 Rabbits ↔ Sheep 🐑">
        <option value="rabbitToSheep">6 Rabbits → 1 Sheep</option>
        <option value="sheepToRabbit">1 Sheep → 6 Rabbits</option>
      </optgroup>
      
      <optgroup label="🐑 Sheep ↔ Pig 🐷">
        <option value="sheepToPig">2 Sheep → 1 Pig</option>
        <option value="pigToSheep">1 Pig → 2 Sheep</option>
      </optgroup>
      
      <optgroup label="🐷 Pig ↔ Cow 🐮">
        <option value="pigToCow">3 Pigs → 1 Cow</option>
        <option value="cowToPig">1 Cow → 3 Pigs</option>
      </optgroup>
      
      <optgroup label="🐮 Cow ↔ Horse 🐎">
        <option value="cowToHorse">2 Cows → 1 Horse</option>
        <option value="horseToCow">1 Horse → 2 Cows</option>
      </optgroup>
      
      <optgroup label="🐕 Guard Dogs">
        <option value="sheepToSmallDog">1 Sheep → 1 Small Dog</option>
        <option value="smallDogToSheep">1 Small Dog → 1 Sheep</option>
        <option value="cowToBigDog">1 Cow → 1 Big Dog</option>
        <option value="bigDogToCow">1 Big Dog → 1 Cow</option>
      </optgroup>
    </select>
    <button id="exchangeBtn">Make Exchange</button>
    <button id="finishExchangeBtn">End Exchange Phase</button>
    
    <div class="dice-section">
      <div class="section-title">🎲 Roll Dice</div>
      <button id="rollDiceBtn">Roll Dice</button>
    </div>
  </div>
`;

// Add event listener for start game button
document.getElementById('startGameBtn').addEventListener('click', () => {
  const roomCode = document.getElementById('roomInput').value;
  socket.emit('startGame', { gameId: roomCode });
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
  if (!gameState) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
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
