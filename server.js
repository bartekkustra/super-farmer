const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files from "public"
app.use(express.static('public'));

// Global game storage (now using gameId as key)
const games = {};

const MAX_NUMBER_OF_EXCHANGES = 1;

function createNewGame() {
  return {
    bank: {
      rabbit: 60,
      sheep: 24,
      pig: 20,
      cow: 12,
      horse: 6,
      smallDog: 4,
      bigDog: 2
    },
    players: {},      // key: socket.id → { name, animals, exchangesUsed }
    turnOrder: [],    // array of socket ids in join order
    phase: 'waiting', // phases: 'waiting', 'exchange', 'roll', 'endTurn', 'gameOver'
    started: false,   // flag to track if game has started
    currentTurnIndex: 0,
    lastDice: null
  };
}

function canMakeAnyExchange(player) {
  for (let exchangeType in exchangeRules) {
    const rule = exchangeRules[exchangeType];
    let canMakeThis = true
    for (let animal in rule.cost) {
      if (player.animals[animal] < rule.cost[animal]) {
        canMakeThis = false;
        break;
      }
    }
    if (canMakeThis) {
      return true;
    }
  }
  return false;
}

// Exchange rules
const exchangeRules = {
  rabbitToSheep: { cost: { rabbit: 6 }, reward: { sheep: 1 } },
  sheepToPig: { cost: { sheep: 2 }, reward: { pig: 1 } },
  pigToCow: { cost: { pig: 3 }, reward: { cow: 1 } },
  cowToHorse: { cost: { cow: 2 }, reward: { horse: 1 } },
  sheepToSmallDog: { cost: { sheep: 1 }, reward: { smallDog: 1 } },
  cowToBigDog: { cost: { cow: 1 }, reward: { bigDog: 1 } },
  sheepToRabbit: { cost: { sheep: 1 }, reward: { rabbit: 6 } },
  pigToSheep: { cost: { pig: 1 }, reward: { sheep: 2 } },
  cowToPig: { cost: { cow: 1 }, reward: { pig: 3 } },
  horseToCow: { cost: { horse: 1 }, reward: { cow: 2 } },
  smallDogToSheep: { cost: { smallDog: 1 }, reward: { sheep: 1 } },
  bigDogToCow: { cost: { bigDog: 1 }, reward: { cow: 1 } },
};

// Custom dice faces
const redDieFaces = [
  'rabbit','rabbit','rabbit','rabbit','rabbit','rabbit',
  'fox',
  'pig','pig',
  'horse',
  'sheep','sheep'
];
const blueDieFaces = [
  'rabbit','rabbit','rabbit','rabbit','rabbit','rabbit',
  'pig',
  'sheep','sheep','sheep',
  'wolf',
  'cow'
];

function rollDie(faces) {
  const index = Math.floor(Math.random() * faces.length);
  return faces[index];
}

// Modify getAvailableRooms to include all rooms with their state
function getAvailableRooms() {
  const availableRooms = {};
  for (const [roomId, game] of Object.entries(games)) {
    availableRooms[roomId] = {
      players: game.players,
      started: game.started,
      phase: game.phase,
      currentTurn: game.players[game.turnOrder[game.currentTurnIndex]]?.name
    };
  }
  return availableRooms;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send initial room list to new connections
  const rooms = getAvailableRooms();
  console.log('Sending initial room list:', rooms); // Debug log
  socket.emit('roomList', rooms);
  
  socket.on('joinGame', (data) => {
    const { gameId, name } = data;
    const game = games[gameId];
    
    // Check if game exists and has started
    if (game && game.started) {
      socket.emit('message', 'Game already in progress. Cannot join.');
      return;
    }
    
    // Leave any previous rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    // Join the new room
    socket.join(gameId);
    
    // Create game if it doesn't exist
    if (!games[gameId]) {
      games[gameId] = createNewGame();
    }
    
    const currentGame = games[gameId];
    
    // Add player to game
    currentGame.players[socket.id] = {
      name: name,
      animals: {
        rabbit: 0,
        sheep: 0,
        pig: 0,
        cow: 0,
        horse: 0,
        smallDog: 0,
        bigDog: 0
      },
      exchangesUsed: 0
    };
    
    if (!currentGame.turnOrder.includes(socket.id)) {
      currentGame.turnOrder.push(socket.id);
    }
    
    io.to(gameId).emit('message', `${name} joined the game.`);
    io.to(gameId).emit('gameState', gameStateForClients(currentGame));
    
    // After updating game state, broadcast new room list to all clients
    io.emit('roomList', getAvailableRooms());
  });

  // New event handler for starting the game
  socket.on('startGame', (data) => {
    const { gameId } = data;
    const game = games[gameId];
    
    if (!game) return;
    if (game.started) {
      socket.emit('message', 'Game already started.');
      return;
    }
    
    // Need at least 2 players to start
    if (game.turnOrder.length < 2) {
      socket.emit('message', 'Need at least 2 players to start the game.');
      return;
    }
    
    // Start the game
    game.started = true;
    
    // Give each player their starting rabbit
    game.turnOrder.forEach(playerId => {
      game.players[playerId].animals.rabbit = 1;
      game.bank.rabbit--;
    });
    
    // Check if first player can make any exchanges
    const firstPlayer = game.players[game.turnOrder[0]];
    if (!canMakeAnyExchange(firstPlayer)) {
      game.phase = 'roll';
      io.to(gameId).emit('message', 
        `Game has started! Each player received 1 rabbit.\n${firstPlayer.name}'s turn (Exchange phase skipped - no possible exchanges).`
      );
    } else {
      game.phase = 'exchange';
      io.to(gameId).emit('message', 
        `Game has started! Each player received 1 rabbit.\n${firstPlayer.name}'s turn (Exchange phase).`
      );
    }
    
    io.to(gameId).emit('gameState', gameStateForClients(game));
    
    // After game starts, broadcast updated room list
    io.emit('roomList', getAvailableRooms());
  });
  
  // Handle an exchange request.
  socket.on('exchange', (data) => {
    const { gameId, exchangeType } = data;
    const game = games[gameId];
    if (!game) return;
    // Only allow current player during exchange phase.
    if (socket.id !== game.turnOrder[game.currentTurnIndex] || game.phase !== 'exchange') {
      socket.emit('message', 'Not your turn or wrong phase for exchange.');
      return;
    }
    if (game.players[socket.id].exchangesUsed >= MAX_NUMBER_OF_EXCHANGES) {
      socket.emit('message', 'Maximum exchanges used this turn.');
      return;
    }
    const rule = exchangeRules[exchangeType];
    if (!rule) {
      socket.emit('message', 'Invalid exchange type.');
      return;
    }
    // Verify the player has enough animals.
    const player = game.players[socket.id];
    for (let animal in rule.cost) {
      if (player.animals[animal] < rule.cost[animal]) {
        socket.emit('message', 'Not enough ' + animal + ' for this exchange.');
        return;
      }
      // Check if exchange would leave player with less than 1 rabbit
      if (animal === 'rabbit' && player.animals.rabbit - rule.cost[animal] < 1) {
        socket.emit('message', 'Must keep at least 1 rabbit after exchange.');
        return;
      }
    }
    // Verify bank availability.
    for (let animal in rule.reward) {
      if (game.bank[animal] <= 0) {
        socket.emit('message', 'Bank does not have enough ' + animal + '.');
        return;
      }
    }
    // Process exchange: subtract cost from player (and add cost animals back to the bank),
    // then remove reward from bank and add to player.
    for (let animal in rule.cost) {
      player.animals[animal] -= rule.cost[animal];
      game.bank[animal] += rule.cost[animal];
    }
    for (let animal in rule.reward) {
      game.bank[animal] -= rule.reward[animal];
      player.animals[animal] += rule.reward[animal];
    }
    player.exchangesUsed++;
    io.to(gameId).emit('gameState', gameStateForClients(game));
    socket.emit('message', `Exchange completed: ${exchangeType}.`);
    
    // After updating game state, broadcast new room list to all clients
    io.emit('roomList', getAvailableRooms());
  });
  
  // End the exchange phase and move to roll phase.
  socket.on('finishExchange', (data) => {
    const { gameId } = data;
    const game = games[gameId];
    if (!game) return;
    if (socket.id !== game.turnOrder[game.currentTurnIndex] || game.phase !== 'exchange') {
      socket.emit('message', 'Not your turn or wrong phase to finish exchange.');
      return;
    }
    game.phase = 'roll';
    io.to(gameId).emit('gameState', gameStateForClients(game));
    socket.emit('message', 'Exchange phase finished. Please roll the dice.');
    
    // After updating game state, broadcast new room list to all clients
    io.emit('roomList', getAvailableRooms());
  });
  
  // Handle dice roll.
  socket.on('rollDice', (data) => {
    const { gameId } = data;
    const game = games[gameId];
    if (!game) return;
    if (socket.id !== game.turnOrder[game.currentTurnIndex] || game.phase !== 'roll') {
      socket.emit('message', 'Not your turn or wrong phase to roll dice.');
      return;
    }
    
    const player = game.players[socket.id];
    const turnSummary = [];
    
    // Roll both dice.
    const redResult = rollDie(redDieFaces);
    const blueResult = rollDie(blueDieFaces);
    game.lastDice = { red: redResult, blue: blueResult };
    
    turnSummary.push(`${player.name} rolled: ${redResult} & ${blueResult}`);
    
    const rolledFox = (redResult === 'fox');
    const rolledWolf = (blueResult === 'wolf');
    
    // Handle predator attacks first
    if (rolledWolf && rolledFox) {
      // Handle wolf attack first
      if (player.animals.bigDog > 0) {
        player.animals.bigDog--;
        game.bank.bigDog++;
        turnSummary.push(`Wolf attacked! Big Dog protected your animals but was lost.`);
      } else {
        // Return only cows, sheep, and pigs to bank
        game.bank.cow += player.animals.cow;
        game.bank.sheep += player.animals.sheep;
        game.bank.pig += player.animals.pig;
        
        // Reset only cows, sheep, and pigs
        player.animals.cow = 0;
        player.animals.sheep = 0;
        player.animals.pig = 0;
        
        turnSummary.push(`Wolf attacked! You lost all cows, sheep, and pigs.`);
      }

      // Then handle fox attack
      if (player.animals.smallDog > 0) {
        player.animals.smallDog--;
        game.bank.smallDog++;
        turnSummary.push(`Fox attacked! Small Dog protected your rabbits but was lost.`);
      } else {
        if (player.animals.rabbit > 1) {
          const rabbitsLost = player.animals.rabbit - 1;
          game.bank.rabbit += rabbitsLost;
          turnSummary.push(`Fox attacked! You lost all rabbits except one.`);
          player.animals.rabbit = 1;
        } else {
          turnSummary.push(`Fox attacked! You only had one rabbit, so it remains.`);
        }
      }
    } else if (rolledFox) {
      if (player.animals.smallDog > 0) {
        player.animals.smallDog--;
        game.bank.smallDog++; // Return small dog to bank
        turnSummary.push(`Fox attacked! Small Dog protected your rabbits but was lost.`);
      } else {
        if (player.animals.rabbit > 1) {
          const rabbitsLost = player.animals.rabbit - 1;
          game.bank.rabbit += rabbitsLost; // Return lost rabbits to bank
          turnSummary.push(`Fox attacked! You lost all rabbits except one.`);
          player.animals.rabbit = 1;
        } else {
          turnSummary.push(`Fox attacked! You only had one rabbit, so it remains.`);
        }
      }
    } else if (rolledWolf) {
      if (player.animals.bigDog > 0) {
        player.animals.bigDog--;
        game.bank.bigDog++; // Return big dog to bank
        turnSummary.push(`Wolf attacked! Big Dog protected you but was lost.`);
      } else {
        console.log('Before wolf attack - Animals:', player.animals);
        
        // Return only cows, sheep, and pigs to bank
        game.bank.cow += player.animals.cow;
        game.bank.sheep += player.animals.sheep;
        game.bank.pig += player.animals.pig;
        
        // Reset only cows, sheep, and pigs
        player.animals.cow = 0;
        player.animals.sheep = 0;
        player.animals.pig = 0;
        
        console.log('After wolf attack - Animals:', player.animals);
        
        turnSummary.push(`Wolf attacked! You lost all cows, sheep, and pigs.`);
      }
    }
    
    // After handling predator attacks, calculate animals gained
    if (!rolledFox && !rolledWolf) {
      // Count animals on dice
      const diceAnimals = {};
      if (redResult !== 'fox') diceAnimals[redResult] = (diceAnimals[redResult] || 0) + 1;
      if (blueResult !== 'wolf') diceAnimals[blueResult] = (diceAnimals[blueResult] || 0) + 1;
      
      // For each animal type shown on dice
      for (const animal in diceAnimals) {
        // Calculate total count (animals on dice + animals player has)
        const totalCount = diceAnimals[animal] + (player.animals[animal] || 0);
        // Calculate number of pairs (floor division by 2)
        const pairs = Math.floor(totalCount / 2);
        
        // Give animals from bank based on number of pairs
        if (pairs > 0) {
          const availableInBank = game.bank[animal];
          const animalsToGive = Math.min(pairs, availableInBank);
          
          if (animalsToGive > 0) {
            player.animals[animal] += animalsToGive;
            game.bank[animal] -= animalsToGive;
            turnSummary.push(`Received ${animalsToGive} ${animal}${animalsToGive > 1 ? 's' : ''} from the bank (${pairs} pairs total).`);
          } else {
            turnSummary.push(`Had ${pairs} pairs of ${animal} but bank has none left.`);
          }
        }
      }
      
      if (Object.keys(diceAnimals).length === 0) {
        turnSummary.push('No animals gained this turn.');
      }
    }
    
    game.phase = 'endTurn';
    
    // Check win condition: player must have at least one of each of rabbit, sheep, pig, cow, and horse.
    const winAnimals = ['rabbit','sheep','pig','cow','horse'];
    let hasWon = winAnimals.every(animal => player.animals[animal] > 0);
    
    if (hasWon) {
      turnSummary.push(`${player.name} has at least one of each main animal. ${player.name} wins!`);
      game.phase = 'gameOver';
    } else {
      turnSummary.push(`${player.name}'s turn is over.`);
    }
    
    // Send turn summary as one multiline message
    io.to(gameId).emit('message', turnSummary.join('\n'));
    
    // If the game is not over, pass the turn
    if (game.phase !== 'gameOver') {
      io.to(gameId).emit('gameState', gameStateForClients(game));
      nextTurn(gameId);
    }
    
    io.to(gameId).emit('gameState', gameStateForClients(game));
    
    // After updating game state, broadcast new room list to all clients
    io.emit('roomList', getAvailableRooms());
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove player from their game
    for (let gameId in games) {
      const game = games[gameId];
      if (game.players[socket.id]) {
        const index = game.turnOrder.indexOf(socket.id);
        if (index !== -1) {
          game.turnOrder.splice(index, 1);
          if (game.currentTurnIndex >= game.turnOrder.length) {
            game.currentTurnIndex = 0;
          }
        }
        delete game.players[socket.id];
        io.to(gameId).emit('gameState', gameStateForClients(game));
        
        // Clean up empty games
        if (game.turnOrder.length === 0) {
          delete games[gameId];
        }
      }
    }
    
    // After player disconnects, broadcast updated room list
    io.emit('roomList', getAvailableRooms());
  });
});

// Pass turn to the next player.
function nextTurn(gameId) {
  const game = games[gameId];
  if (!game) return;
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  // Reset the exchange counter for the new current player.
  game.players[game.turnOrder[game.currentTurnIndex]].exchangesUsed = 0;
  
  const currentPlayer = game.players[game.turnOrder[game.currentTurnIndex]];
  
  // Check if player can make any exchanges
  if (!canMakeAnyExchange(currentPlayer)) {
    game.phase = 'roll';
    io.to(gameId).emit('message', 
      `${currentPlayer.name}'s turn (Exchange phase skipped - no possible exchanges).`
    );
  } else {
    game.phase = 'exchange';
    io.to(gameId).emit('message', 
      `It is now ${currentPlayer.name}'s turn (Exchange phase).`
    );
  }
  
  io.to(gameId).emit('gameState', gameStateForClients(game));
  
  // After updating game state, broadcast new room list to all clients
  io.emit('roomList', getAvailableRooms());
}

// Prepare a version of game state to send to clients.
function gameStateForClients(game) {
  return {
    bank: game.bank,
    players: game.players,
    turnOrder: game.turnOrder,
    currentTurn: game.turnOrder[game.currentTurnIndex],
    phase: game.phase,
    started: game.started,
    lastDice: game.lastDice || null
  };
}

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
