# ♟️ Master Chess

A complete chess game with **full rules**, an **AI opponent** (3 difficulty levels), and a clean dark UI — built with vanilla HTML, CSS, and JavaScript. No dependencies, no frameworks.

## Features

### Full Chess Rules
- ✅ All piece movements (pawn, knight, bishop, rook, queen, king)
- ✅ **Castling** (kingside & queenside, with all legality checks)
- ✅ **En passant** capture
- ✅ **Pawn promotion** (choose Q/R/B/N via a modal; AI promotes automatically)
- ✅ **Check & Checkmate** detection (king highlighted red)
- ✅ **Stalemate** detection
- ✅ **Insufficient material** draws (K vs K, K+B vs K, K+N vs K, K+B vs K+B same color)
- ✅ **50-move rule** draw
- ✅ **Threefold repetition** draw
- ✅ Legal-move validation — you can never make an illegal move
- ✅ Algebraic notation with disambiguation (e.g. `Nbd2`, `exd5`)

### Game Modes
- 🤖 **Play vs Computer** — 3 AI levels (Easy / Medium / Hard), play as White or Black
- 👥 **Pass & Play** — two players on one screen

### UI Features
- Click-to-move with **move hints** (dots = quiet moves, rings = captures)
- Selected square, last-move, and king-in-check highlights
- **Undo** (undoes both your move and the AI's reply in AI mode)
- **Flip board** orientation
- Captured-piece trays for both sides
- Full **move history log** in algebraic notation
- Responsive layout (works on mobile)

### AI Engine
- Minimax with **alpha-beta pruning**
- Piece-square tables for positional evaluation
- Depth 1 / 2 / 3 search for Easy / Medium / Hard (Easy also plays random moves 50% of the time)
- MVV-LVA move ordering + alpha-beta pruning for fast, effective search

## Getting Started

Open `index.html` in any modern browser. That's it — no build step, no dependencies.

Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html` | Page structure (board, panels, modal) |
| `style.css` | Styling, layout, board colors, highlights |
| `chess.js` | Chess rules engine (pure logic, Node-testable) |
| `ui.js` | UI layer: rendering, interaction, AI turns |

## Testing

The engine (`chess.js`) is dependency-free and exports a Node API for testing:

```bash
node -e "const c = require('./chess.js'); console.log('engine loads OK')"
```

## License

MIT
