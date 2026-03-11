# FogChess Backend

Node.js + Express backend for FogChess, handling game logic, rooms, and WebSocket communication.

## Stack

- **Node.js** + TypeScript
- **Express** – HTTP API
- **Socket.io** – real-time WebSocket
- **Chess.js** – chess rules + fog-of-war extensions

## Services

- `ChessService` – chess rules and fog-of-war logic
- `RoomService` – room lifecycle and matchmaking
- `UserService` – user and profile operations
- `TimerService` – game clock management
- `AIService` – AI opponent (optional)

## Development

```bash
npm install
npm run dev
```

API runs on port 3001 by default. Health check: `GET /health`.
