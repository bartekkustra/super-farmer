const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messagesDiv = document.getElementById('messages');
const joinSection = document.getElementById('joinSection');
const controlsDiv = document.getElementById('controls');
const startGameBtn = document.getElementById('startGameBtn');
const gameControls = document.getElementById('gameControls');

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

// Create room list container
const roomListDiv = document.createElement('div');
roomListDiv.id = 'roomList';
roomListDiv.className = 'room-list';

// Create form elements container
const formContainer = document.createElement('div');
formContainer.innerHTML = `
  <input type="text" id="nameInput" placeholder="Enter your farmer name" />
  <input type="text" id="roomInput" placeholder="Enter room code (optional)" />
  <button id="joinGameBtn">Start Farming</button>
  <button id="createGameBtn">Create New Game</button>
`;

// Clear and rebuild join section
joinSection.innerHTML = '';
joinSection.appendChild(roomListDiv);
joinSection.appendChild(formContainer);

// Add styles to the head
const additionalStyles = `
  .status-in-progress {
    color: #d35400;
    font-style: italic;
  }
  
  .status-waiting {
    color: #27ae60;
    font-style: italic;
  }
`;

const style = document.createElement('style');
style.textContent = `
  .room-list {
    margin-bottom: 20px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .room-item {
    background: white;
    border: 2px solid #8b4513;
    border-radius: 5px;
    padding: 10px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .room-info {
    flex: 1;
  }
  
  .join-room-btn {
    background: #8b4513;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 5px;
    cursor: pointer;
    margin-left: 10px;
    width: auto;
  }
  
  .join-room-btn:hover {
    background: #a0522d;
  }
  
  ${additionalStyles}
`;
document.head.appendChild(style);

function updateRoomList(rooms) {
  roomListDiv.innerHTML = '<h3>Available Rooms:</h3>';
  if (Object.keys(rooms).length === 0) {
    roomListDiv.innerHTML += '<p>No active rooms. Create a new one!</p>';
    return;
  }
  
  for (const [roomId, room] of Object.entries(rooms)) {
    const roomElement = document.createElement('div');
    roomElement.className = 'room-item';
    
    const playerList = Object.values(room.players)
      .map(p => p.name)
      .join(', ');
    
    const statusText = room.started ? 
      `In Progress (${room.phase} phase, ${room.currentTurn}'s turn)` : 
      'Waiting for players';
    
    roomElement.innerHTML = `
      <div class="room-info">
        <strong>Room: ${roomId}</strong> (${Object.keys(room.players).length} players)
        <br>
        <small>Players: ${playerList}</small>
        <br>
        <small class="${room.started ? 'status-in-progress' : 'status-waiting'}">${statusText}</small>
      </div>
      ${!room.started ? `<button class="join-room-btn" data-room="${roomId}">Join Room</button>` : ''}
    `;
    
    roomListDiv.appendChild(roomElement);
  }
  
  // Add event listeners to join buttons
  document.querySelectorAll('.join-room-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('roomInput').value = btn.dataset.room;
    });
  });
}

// Socket event handlers
socket.on('roomList', (rooms) => {
  console.log('Received room list:', rooms); // Debug log
  updateRoomList(rooms);
});

// Add room input or generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Wait for DOM to be fully loaded
window.addEventListener('load', () => {
  // Check URL for room code
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode) {
    document.getElementById('roomInput').value = roomCode;
  }

  // Set up all event listeners
  document.getElementById('createGameBtn').addEventListener('click', () => {
    const roomCode = generateRoomCode();
    document.getElementById('roomInput').value = roomCode;
  });

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
    
    window.history.pushState({}, '', `?room=${roomCode}`);
  });

  document.getElementById('startGameBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomInput').value;
    socket.emit('startGame', { gameId: roomCode });
  });

  document.getElementById('exchangeBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomInput').value;
    const exchangeType = document.getElementById('exchangeSelect').value;
    socket.emit('exchange', { gameId: roomCode, exchangeType });
  });

  document.getElementById('finishExchangeBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomInput').value;
    socket.emit('finishExchange', { gameId: roomCode });
  });

  document.getElementById('rollDiceBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomInput').value;
    socket.emit('rollDice', { gameId: roomCode });
  });
});

// Socket event handlers
socket.on('gameState', (state) => {
  console.log('Received game state:', {
    started: state.started,
    phase: state.phase,
    players: Object.keys(state.players).length,
    fullState: state
  });
  
  gameState = state;
  
  // Show/hide appropriate controls based on game state
  const startGameBtn = document.getElementById('startGameBtn');
  const gameControls = document.getElementById('gameControls');
  
  if (gameState.started) {
    console.log('Game started, showing game controls');
    startGameBtn.style.display = 'none';
    gameControls.style.display = 'block';
  } else {
    console.log('Game not started, showing start button');
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
