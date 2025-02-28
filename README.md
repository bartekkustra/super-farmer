# [super-farmer.games.barts.work/](http://super-farmer.games.barts.work/)

# 🌾 Super Farmer 🐑

A multiplayer online implementation of the classic board game Super Farmer, where players compete to build the perfect farm through animal trading and dice rolling.

## 🎮 Game Overview

Super Farmer is a game of strategy and luck where players:
- Trade animals according to fixed exchange rates
- Roll special dice to acquire new animals
- Use guard dogs to protect against animal predators (fox and wolf)
- Compete to be the first to collect: 1 horse, 1 cow, 1 pig, 1 sheep, and 1 rabbit

## 🚀 Features

- Real-time multiplayer gameplay
- Room-based matchmaking
- Automatic turn management
- Animal trading system
- Special dice rolling mechanics
- Animal predator protection system
- (TODO) Score tracking
- (TODO) Draw voting system
- Multiple rounds support

## 🎲 Game Rules

### Starting the Game
- Each player starts with 1 rabbit
- Minimum 2 players required
- Players take turns in join order

### On Your Turn
1. **Exchange Phase**: Make up to 1 exchange using these rates:
   - 6 Rabbits ↔ 1 Sheep
   - 2 Sheep ↔ 1 Pig
   - 3 Pigs ↔ 1 Cow
   - 2 Cows ↔ 1 Horse
   - 1 Sheep ↔ 1 Small Dog
   - 1 Cow ↔ 1 Big Dog

2. **Roll Phase**: Roll both dice
   - Gain animals based on pairs assembled from player's animals and each dice roll
   - Protect against predators with dogs
   - Small Dog protects against Fox (saves rabbits)
   - Big Dog protects against Wolf (saves sheeps, pigs, and cows)

### Winning
- First player to collect one of each animal (rabbit, sheep, pig, cow, horse) wins
- Winner receives 3 points
- (TODO) Draw can be called by mutual agreement (1 point each)

## 🛠️ Technical Stack

- Frontend: HTML5 Canvas, JavaScript
- Backend: Node.js, Express
- Real-time Communication: Socket.IO
- Styling: CSS3 with Comic Sans MS font

## 🔧 Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

3. Open in browser:
```
http://localhost:3000
```

## 🎨 Game Interface

The game features:
- A central game board showing all players' animals
- Bank display showing available animals
- Trading interface with all possible exchanges
- Dice rolling controls
- Game status messages
- (TODO) Draw voting system
- (TODO) Score tracking

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📜 License

This project is open source and available under the MIT License.
