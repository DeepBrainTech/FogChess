# CLAUDE.md - AI Assistant Guide for FogChess

## Project Overview

**FogChess** is a real-time online chess platform with a unique **Fog of War** mechanic where players can only see squares their pieces can reach. This creates an exciting asymmetric information game similar to fog of war in strategy games.

**Tech Stack:**
- **Frontend**: Vue 3 + TypeScript + Vite + Pinia + Socket.io-client
- **Backend**: Node.js + Express + TypeScript + Socket.io + Chess.js
- **Database**: PostgreSQL (user profiles, game history) + Redis (optional, room persistence)

---

## Critical Architecture Concepts

### Fog of War Implementation

**Core Principle**: Players only see squares they control + pieces on those squares.

**Server-Side** (`backend/src/services/ChessService.ts`):
- Uses `applyGeometricMove()` instead of `chess.move()` to **bypass check validation**
- King can enter check (players don't see threats in fog)
- Game ends when king is **captured**, not checkmated
- `computeFog()` calculates visible squares based on pseudo-legal moves
- Castling allowed even if king passes through attacked squares

**Client-Side** (`frontend/src/services/chess.ts`):
- Receives full board state + fog data from server
- `applyFogFor(color)` hides opponent pieces in non-visible squares
- Spectators can toggle "god mode" (no fog) or alternating view

### Real-Time Communication

**Socket.io Events Flow**:
```
Client → Server:
- create-room, join-room, make-move, request-undo, surrender, etc.

Server → Client (broadcasts):
- move-made, game-updated, legal-moves, undo-requested, etc.
```

All game state synchronization happens via Socket.io. The server is the single source of truth.

---

## Key Files & Responsibilities

### Backend

| File | Purpose |
|------|---------|
| `backend/src/services/ChessService.ts` | Chess logic with fog of war modifications |
| `backend/src/services/RoomService.ts` | Room lifecycle, player management, game modes |
| `backend/src/services/AIService.ts` | AI opponent (3 difficulty levels: Easy/Standard/Hard) |
| `backend/src/services/TimerService.ts` | Chess clocks (Unlimited/Classical/Rapid/Bullet) |
| `backend/src/services/UserService.ts` | User profiles, ratings, game archiving |
| `backend/src/server.ts` | Express + Socket.io server setup |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/components/chess/ChessBoard.vue` | Main chessboard UI with drag-and-drop |
| `frontend/src/components/chess/ChessPiece.vue` | Individual piece rendering |
| `frontend/src/services/socket.ts` | Socket.io client wrapper |
| `frontend/src/services/chess.ts` | Client-side board state + fog rendering |
| `frontend/src/stores/game.ts` | Pinia store for game state |
| `frontend/src/stores/room.ts` | Pinia store for room/lobby state |
| `frontend/src/views/Game.vue` | Main game view layout |
| `frontend/src/views/Lobby.vue` | Room browser |

---

## Important Implementation Details

### 1. Modified Chess Rules

**Standard Chess** → **Fog Chess** differences:
- ❌ No check/checkmate validation
- ✅ King can be moved into check
- ✅ Castling allowed if path is clear (ignores attacks from fog)
- ✅ Game ends on king capture
- ✅ Undo system: 2 attempts max per move

### 2. Move Validation

**Server validates moves using**:
```typescript
generatePseudoLegalMoves(square) // instead of chess.moves()
applyGeometricMove(from, to)     // instead of chess.move()
```

This bypasses chess.js's king safety checks while maintaining piece movement rules.

### 3. AI Opponent

**Difficulty Levels**:
- **Easy (1-3)**: 50% random moves, 25% blunders, 25% material-only eval
- **Standard (4-6)**: 1-ply minimax with positional evaluation
- **Hard (7-10)**: 2-ply early game, 1-ply endgame (designed for 400-1500 Elo)

AI uses the same `ChessService` instance for consistency. Responds with 1-second delay.

### 4. Layout & Styling Architecture

**IMPORTANT - Recent Fixes (2026-08)**:

The game view had a **bottom row cutoff issue** on both desktop and mobile. Root causes:
1. Conflicting padding between `#app` and `.game-container`
2. Fixed `height: 100vh` didn't account for mobile browser UI
3. Aggressive `vh` values for chessboard sizing
4. `overflow: hidden` prevented scrolling

**Current Layout Structure**:
```
body (flex-direction: column, align-items: center)
└── #app (padding: 0)
    └── .game-container (min-height: 100vh, overflow: auto)
        ├── .game-content (flex: 1, overflow: visible)
        │   ├── .chess-container
        │   │   └── ChessBoard (padding: 20px desktop, 10px mobile)
        │   │       └── .board-container (55vh on both desktop/mobile)
        │   ├── .game-sidebar (280px)
        │   └── .chat-sidebar (280px)
        └── .game-header (order: 2, at bottom)
```

**Key CSS Values**:
- Desktop board: `min(55vh, 81vw, 540px)` - was 63vh
- Mobile board: `min(55vh, 85.5vw, 450px)` - was 72vh
- Game container: `min-height: 100vh` + `overflow: auto` - was `height: 100vh` + `overflow: hidden`

**Rules**:
- ✅ Use conservative `vh` values (55vh max for board)
- ✅ Use `min-height` instead of `height` for containers
- ✅ Allow scrolling with `overflow: auto` on containers
- ✅ Never use negative margins as layout workarounds
- ✅ `#app` padding should remain 0 to avoid Game view conflicts

### 5. Mobile Touch Handling

**ChessBoard.vue** uses Pointer Events API:
- Unified touch/mouse handling via `pointerdown`, `pointermove`, `pointerup`
- Higher drag threshold for touch (15px vs 5px)
- `touch-action: none` on board prevents scroll conflicts
- Ghost piece offset upward to avoid finger occlusion

### 6. Spectator Features

- Can join any room regardless of status
- Toggle between:
  - **Alternating view**: See fog from current player's perspective
  - **God mode**: See full board with no fog
- Real-time move history with replay controls
- Can switch to player role if room has <2 players (except AI rooms)

### 7. Authentication Flow

**JWT-based session cookies** (`fogchess.sid`):
- Production: Token exchange with main portal
- Development: `/auth/dev-login` endpoint for testing
- Mobile-friendly: `SameSite=lax` in dev, `none` in prod
- User data stored in both localStorage (mobile) and server session

---

## Development Guidelines

### When Working on Layout/CSS

1. **Never add padding to `#app`** in `style.css` - it breaks Game view
2. **Test on multiple viewport sizes**:
   - Desktop: 1920x1080, 1366x768, small windows
   - Mobile: iPhone 12 (844px), iPhone SE (667px), Android
3. **Use conservative `vh` values** - account for browser UI (address bars, toolbars)
4. **Prefer `min-height` over `height`** for containers
5. **Enable scrolling** with `overflow: auto` when content might exceed viewport

### When Working on Game Logic

1. **Server is source of truth** - all validation happens server-side
2. **Never trust client state** - clients can be in different fog states
3. **Test fog visibility** - ensure pieces hidden/shown correctly
4. **Check special moves**: castling, en passant, pawn promotion in fog
5. **Undo attempts tracked** - max 2 per move, reset on undo execution

### When Adding Features

1. **Maintain fog consistency** - new features must respect fog of war
2. **Update both client and server** - keep synchronized
3. **Add Socket.io events** for real-time updates if needed
4. **Test with spectators** - ensure they receive proper updates
5. **Consider AI mode** - does feature work with AI opponents?

### Common Pitfalls

❌ **Don't** use `chess.move()` - bypasses fog mechanics
❌ **Don't** validate check/checkmate client-side
❌ **Don't** assume players see the same board
❌ **Don't** use `overflow: hidden` on main containers
❌ **Don't** hardcode viewport-dependent sizes without `min()`

✅ **Do** use `applyGeometricMove()` for moves
✅ **Do** use `computeFog()` after state changes
✅ **Do** test with 2 players in separate browsers
✅ **Do** allow scrolling when content might overflow
✅ **Do** use responsive sizing with `min(vh, vw, px)`

---

## Common Tasks

### Adding a New Socket.io Event

1. Define event in `backend/src/server.ts`:
   ```typescript
   socket.on('new-event', (data) => {
     // Validate
     // Process
     io.to(roomId).emit('event-response', result);
   });
   ```

2. Add client listener in `frontend/src/services/socket.ts`:
   ```typescript
   socket.on('event-response', (data) => {
     // Update store or trigger callback
   });
   ```

3. Add method to emit event:
   ```typescript
   emitNewEvent(roomId: string, data: any) {
     this.ensureSocket();
     this.socket!.emit('new-event', { roomId, ...data });
   }
   ```

### Debugging Fog Issues

1. Enable god mode in spectator view to see full board
2. Check `fogOfWar` object in browser devtools (gameState)
3. Verify `computeFog()` is called after move
4. Test with console.log in `applyFogFor()` to see hidden squares
5. Compare server-side visible squares with client rendering

### Running Locally

```bash
# Install dependencies
npm run install:all

# Development (both frontend + backend)
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Build for production
npm run build

# Start production server
npm start
```

**Environment Variables**:
- `VITE_API_URL` - Backend API URL for frontend
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis URL (optional)
- `PORT` - Backend server port (default: 3001)

---

## Recent Changes & Known Issues

### Recent Fixes (2026-08)

✅ **Fixed chessboard bottom row cutoff** on desktop and mobile browsers
- Reduced board sizing from 63vh/72vh to 55vh
- Changed container from fixed `height: 100vh` to `min-height: 100vh`
- Enabled scrolling with `overflow: auto`
- Removed conflicting `#app` padding

### Known Issues

1. **Mobile UI Optimization**: Interface needs further mobile refinement
2. **Error Handling**: Exception handling needs strengthening
3. **Reconnection**: Players disconnected mid-game cannot rejoin (must spectate)

### Future Enhancements

- [ ] Online matchmaking system
- [ ] User authentication expansion
- [ ] Game statistics and analysis
- [ ] Tournament mode
- [ ] Rated play with ELO system
- [ ] Mobile app (React Native or PWA)

---

## Testing Checklist

When making changes, verify:

- [ ] Desktop browser (Chrome, Firefox, Safari)
- [ ] Mobile browser (Safari iOS, Chrome Android)
- [ ] Small window sizes (1366x768 or smaller)
- [ ] Both player perspectives (white and black)
- [ ] Spectator view (alternating + god mode)
- [ ] AI mode (easy, standard, hard)
- [ ] Timer modes (unlimited, classical, rapid, bullet)
- [ ] Special moves (castling, en passant, promotion)
- [ ] Fog visibility correctness
- [ ] Undo functionality
- [ ] Room creation and joining
- [ ] Multiple simultaneous rooms
- [ ] Chat functionality

---

## Useful Commands

```bash
# Frontend
cd frontend
npm run dev          # Dev server
npm run build        # Production build
npm run preview      # Preview production build

# Backend
cd backend
npm run dev          # Dev server with nodemon
npm run build        # Compile TypeScript
npm start            # Production server

# Docker
docker-compose up --build        # Full stack
docker-compose up -d             # Detached mode
docker-compose logs -f backend   # View backend logs
```

---

## Contact & Resources

- **Repository**: FogChess
- **License**: MIT
- **Primary Language**: Chinese (中文)
- **Backend Port**: 3001
- **Frontend Port**: 3000

---

*Last Updated: 2026-08-17*
*AI Assistant: This document is specifically designed for Claude Code and other AI assistants working on this codebase.*
