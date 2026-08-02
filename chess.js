/* ============================================================
   Master Chess - Full chess rules engine + AI + UI
   Piece encoding (object): { type, color }
     type:  'k' | 'q' | 'r' | 'b' | 'n' | 'p'
     color: 'w' | 'b'
   Board: 8x8 array of rows; board[0][0] is a8 (rank 8), board[7][0] is a1.
   ============================================================ */

'use strict';

/* ------------------------- Unicode Pieces ------------------------- */
const GLYPHS = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const sqIndex = (r, c) => r * 8 + c;
const sqName = (r, c) => FILES[c] + RANKS[r];
const parseSq = (name) => [RANKS.indexOf(name[1]), FILES.indexOf(name[0])];

const opp = (color) => (color === 'w' ? 'b' : 'w');

/* ------------------------- Move object ------------------------- */
function makeMove(fromR, fromC, toR, toC, captured, flags) {
    return {
        fromR, fromC, toR, toC,
        piece: null,           // set by makeMove()
        captured,              // captured piece or null
        flags: flags || {}     // { double, enPassant, castle, promote, check, mate }
    };
}

/* ------------------------- Board creation ------------------------- */
function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function startBoard() {
    const b = emptyBoard();
    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
        b[0][c] = { type: backRank[c], color: 'b' };
        b[1][c] = { type: 'p', color: 'b' };
        b[6][c] = { type: 'p', color: 'w' };
        b[7][c] = { type: backRank[c], color: 'w' };
    }
    return b;
}

/* ------------------------- Move generation ------------------------- */
const KNIGHT_D = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_D = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_D = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_D = [[-1,0],[1,0],[0,-1],[0,1]];

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function genMoves(board, r, c, castling) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;

    const addStd = (tr, tc) => {
        if (!inBounds(tr, tc)) return;
        const target = board[tr][tc];
        if (!target) moves.push(makeMove(r, c, tr, tc, null));
        else if (target.color !== color) moves.push(makeMove(r, c, tr, tc, target));
    };

    switch (piece.type) {
        case 'p': {
            const dir = color === 'w' ? -1 : 1;
            const startRank = color === 'w' ? 6 : 1;
            const promoRank = color === 'w' ? 0 : 7;

            const one = r + dir;
            if (inBounds(one, c) && !board[one][c]) {
                if (one === promoRank) {
                    ['q', 'r', 'b', 'n'].forEach(t =>
                        moves.push(makeMove(r, c, one, c, null, { promote: t })));
                } else {
                    moves.push(makeMove(r, c, one, c, null));
                }
                if (r === startRank) {
                    const two = r + 2 * dir;
                    if (!board[two][c]) moves.push(makeMove(r, c, two, c, null, { double: true }));
                }
            }
            // captures
            for (const dc of [-1, 1]) {
                const tr = r + dir, tc = c + dc;
                if (!inBounds(tr, tc)) continue;
                const target = board[tr][tc];
                if (target && target.color !== color) {
                    if (tr === promoRank) {
                        ['q', 'r', 'b', 'n'].forEach(t =>
                            moves.push(makeMove(r, c, tr, tc, target, { promote: t })));
                    } else {
                        moves.push(makeMove(r, c, tr, tc, target));
                    }
                }
                // en passant
                if (castling && castling.ep && castling.ep.r === tr && castling.ep.c === tc) {
                    const capturedPawn = board[r][tc];
                    if (capturedPawn && capturedPawn.type === 'p' && capturedPawn.color !== color) {
                        moves.push(makeMove(r, c, tr, tc, capturedPawn, { enPassant: true }));
                    }
                }
            }
            break;
        }
        case 'n':
            for (const [dr, dc] of KNIGHT_D) addStd(r + dr, c + dc);
            break;
        case 'b':
            for (const [dr, dc] of BISHOP_D) {
                let tr = r + dr, tc = c + dc;
                while (inBounds(tr, tc)) {
                    const t = board[tr][tc];
                    if (t) {
                        if (t.color !== color) moves.push(makeMove(r, c, tr, tc, t));
                        break;
                    }
                    moves.push(makeMove(r, c, tr, tc, null));
                    tr += dr; tc += dc;
                }
            }
            break;
        case 'r':
            for (const [dr, dc] of ROOK_D) {
                let tr = r + dr, tc = c + dc;
                while (inBounds(tr, tc)) {
                    const t = board[tr][tc];
                    if (t) {
                        if (t.color !== color) moves.push(makeMove(r, c, tr, tc, t));
                        break;
                    }
                    moves.push(makeMove(r, c, tr, tc, null));
                    tr += dr; tc += dc;
                }
            }
            break;
        case 'q':
            for (const [dr, dc] of BISHOP_D.concat(ROOK_D)) {
                let tr = r + dr, tc = c + dc;
                while (inBounds(tr, tc)) {
                    const t = board[tr][tc];
                    if (t) {
                        if (t.color !== color) moves.push(makeMove(r, c, tr, tc, t));
                        break;
                    }
                    moves.push(makeMove(r, c, tr, tc, null));
                    tr += dr; tc += dc;
                }
            }
            break;
        case 'k': {
            for (const [dr, dc] of KING_D) addStd(r + dr, c + dc);
            // Castling
            if (castling && !castling.check && !isAttacked(board, r, c, opp(color))) {
                const rank = color === 'w' ? 7 : 0;
                if (r === rank && c === 4) {
                    // Kingside: king to g-file
                    if (castling[color].kingside &&
                        !board[rank][5] && !board[rank][6] &&
                        board[rank][7] && board[rank][7].type === 'r' && board[rank][7].color === color &&
                        !isAttacked(board, rank, 5, opp(color)) &&
                        !isAttacked(board, rank, 6, opp(color))) {
                        moves.push(makeMove(r, c, rank, 6, null, { castle: 'k' }));
                    }
                    // Queenside: king to c-file
                    if (castling[color].queenside &&
                        !board[rank][1] && !board[rank][2] && !board[rank][3] &&
                        board[rank][0] && board[rank][0].type === 'r' && board[rank][0].color === color &&
                        !isAttacked(board, rank, 3, opp(color)) &&
                        !isAttacked(board, rank, 2, opp(color))) {
                        moves.push(makeMove(r, c, rank, 2, null, { castle: 'q' }));
                    }
                }
            }
            break;
        }
    }
    return moves;
}

/* ------------------------- Attack detection ------------------------- */
function isAttacked(board, r, c, byColor) {
    // Pawns: a pawn of byColor at (pr, pc) attacks (pr + dir, pc ± 1), so
    // square (r,c) is attacked if a pawn sits at (r - dir, c ± 1).
    const dir = byColor === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
        const tr = r - dir, tc = c + dc;
        if (inBounds(tr, tc) && board[tr][tc] && board[tr][tc].type === 'p' && board[tr][tc].color === byColor) {
            return true;
        }
    }
    // Knights
    for (const [dr, dc] of KNIGHT_D) {
        const tr = r + dr, tc = c + dc;
        if (inBounds(tr, tc) && board[tr][tc] && board[tr][tc].type === 'n' && board[tr][tc].color === byColor) {
            return true;
        }
    }
    // King (adjacent)
    for (const [dr, dc] of KING_D) {
        const tr = r + dr, tc = c + dc;
        if (inBounds(tr, tc) && board[tr][tc] && board[tr][tc].type === 'k' && board[tr][tc].color === byColor) {
            return true;
        }
    }
    // Sliding pieces
    for (const [dr, dc] of BISHOP_D.concat(ROOK_D)) {
        let tr = r + dr, tc = c + dc;
        while (inBounds(tr, tc)) {
            const t = board[tr][tc];
            if (t) {
                const diag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
                const isSliding = diag ? (t.type === 'b' || t.type === 'q') : (t.type === 'r' || t.type === 'q');
                if (isSliding && t.color === byColor) return true;
                break;
            }
            tr += dr; tc += dc;
        }
    }
    return false;
}

/* ------------------------- Legal move filtering ------------------------- */
function squareOfKing(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === 'k' && p.color === color) return [r, c];
        }
    }
    return null;
}

function applyMove(board, move) {
    // Returns a NEW board with move applied (also handles castling + en passant).
    const nb = board.map(row => row.slice());
    const piece = nb[move.fromR][move.fromC];
    nb[move.fromR][move.fromC] = null;
    nb[move.toR][move.toC] = piece;

    if (move.flags.enPassant) {
        nb[move.fromR][move.toC] = null; // remove captured pawn
    }
    if (move.flags.castle === 'k') {
        nb[move.toR][5] = nb[move.toR][7];
        nb[move.toR][7] = null;
    }
    if (move.flags.castle === 'q') {
        nb[move.toR][3] = nb[move.toR][0];
        nb[move.toR][0] = null;
    }
    if (move.flags.promote) {
        nb[move.toR][move.toC] = { type: move.flags.promote, color: piece.color };
    }
    return nb;
}

function kingInCheck(board, color) {
    const k = squareOfKing(board, color);
    if (!k) return false;
    return isAttacked(board, k[0], k[1], opp(color));
}

function isLegalMove(board, move, castling) {
    const boardAfter = applyMove(board, move);
    return !kingInCheck(boardAfter, move.piece.color);
}

function legalMovesFor(board, r, c, castling) {
    const piece = board[r][c];
    if (!piece) return [];
    const all = genMoves(board, r, c, castling);
    return all.filter(m => {
        m.piece = piece;
        const ok = isLegalMove(board, m, castling);
        m.piece = null;
        return ok;
    });
}

function allLegalMoves(board, color, castling) {
    const out = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === color) {
                const moves = legalMovesFor(board, r, c, castling);
                for (const m of moves) {
                    m.piece = p;
                    out.push(m);
                }
            }
        }
    }
    return out;
}

/* ------------------------- Game state helper ------------------------- */
function getGameStatus(board, colorToMove, castling, extras) {
    // Returns { over, result, check, stalemate, checkmate }
    // extras: { halfmove, posCount } for 50-move rule & threefold repetition.
    const moves = allLegalMoves(board, colorToMove, castling);
    const inCheck = kingInCheck(board, colorToMove);
    if (moves.length === 0) {
        if (inCheck) return { over: true, result: 'checkmate', winner: opp(colorToMove), check: true, stalemate: false };
        return { over: true, result: 'stalemate', winner: null, check: false, stalemate: true };
    }
    if (extras) {
        if ((extras.halfmove || 0) >= 100) {
            return { over: true, result: '50-move rule', winner: null, check: inCheck, stalemate: false };
        }
        if ((extras.posCount || 0) >= 3) {
            return { over: true, result: 'threefold repetition', winner: null, check: inCheck, stalemate: false };
        }
    }
    // Insufficient material detection
    const pieces = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c]) pieces.push(board[r][c]);
    const nonKings = pieces.filter(p => p.type !== 'k');
    let insufficient = false;
    if (nonKings.length === 0) {
        insufficient = true; // K vs K
    } else if (nonKings.length === 1 && (nonKings[0].type === 'b' || nonKings[0].type === 'n')) {
        insufficient = true; // K+B vs K or K+N vs K
    } else if (nonKings.length === 2 && nonKings.every(p => p.type === 'b') && nonKings[0].color !== nonKings[1].color) {
        // K+B vs K+B with bishops on the same color square
        const sqColor = (p) => {
            for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
                if (board[rr][cc] === p) return (rr + cc) % 2;
            }
            return -1;
        };
        if (sqColor(nonKings[0]) === sqColor(nonKings[1]) && sqColor(nonKings[0]) !== -1) {
            insufficient = true;
        }
    }
    if (insufficient) return { over: true, result: 'insufficient material', winner: null, check: false, stalemate: false };
    return { over: false, result: null, winner: null, check: inCheck, stalemate: false };
}

/* ------------------------- Engine (minimax + alpha-beta) ------------------------- */
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (from white's perspective; rows are white's rank 8 -> 1).
const PST = {
    p: [
        [0,0,0,0,0,0,0,0],
        [50,50,50,50,50,50,50,50],
        [10,10,20,30,30,20,10,10],
        [5,5,10,25,25,10,5,5],
        [0,0,0,20,20,0,0,0],
        [5,-5,-10,0,0,-10,-5,5],
        [5,10,10,-20,-20,10,10,5],
        [0,0,0,0,0,0,0,0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,0,0,0,0,-20,-40],
        [-30,0,10,15,15,10,0,-30],
        [-30,5,15,20,20,15,5,-30],
        [-30,0,15,20,20,15,0,-30],
        [-30,5,10,15,15,10,5,-30],
        [-40,-20,0,5,5,0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,0,0,0,0,0,0,-10],
        [-10,0,5,10,10,5,0,-10],
        [-10,5,5,10,10,5,5,-10],
        [-10,0,10,10,10,10,0,-10],
        [-10,10,10,10,10,10,10,-10],
        [-10,5,0,0,0,0,5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
        [0,0,0,0,0,0,0,0],
        [5,10,10,10,10,10,10,5],
        [-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],
        [0,0,0,5,5,0,0,0]
    ],
    q: [
        [-20,-10,-10,-5,-5,-10,-10,-20],
        [-10,0,0,0,0,0,0,-10],
        [-10,0,5,5,5,5,0,-10],
        [-5,0,5,5,5,5,0,-5],
        [0,0,5,5,5,5,0,-5],
        [-10,5,5,5,5,5,0,-10],
        [-10,0,5,0,0,0,0,-10],
        [-20,-10,-10,-5,-5,-10,-10,-20]
    ],
    k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20,20,0,0,0,0,20,20],
        [20,30,10,0,0,10,30,20]
    ]
};

function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const val = PIECE_VALUES[p.type];
            const pst = PST[p.type][r][c];
            score += p.color === 'w' ? (val + pst) : -(val + pst);
        }
    }
    return score;
}

function cloneCastling(castling) {
    return {
        w: { kingside: castling.w.kingside, queenside: castling.w.queenside },
        b: { kingside: castling.b.kingside, queenside: castling.b.queenside },
        ep: castling.ep ? { r: castling.ep.r, c: castling.ep.c } : null,
        check: castling.check
    };
}

function applyMoveState(state, move) {
    // state = { board, castling, turn }
    const board = applyMove(state.board, move);
    const castling = cloneCastling(state.castling);
    const color = move.piece.color;

    // Update castling rights
    if (move.piece.type === 'k') {
        castling[color].kingside = false;
        castling[color].queenside = false;
    }
    if (move.piece.type === 'r') {
        if (move.fromR === 7 && move.fromC === 0) castling.w.queenside = false;
        if (move.fromR === 7 && move.fromC === 7) castling.w.kingside = false;
        if (move.fromR === 0 && move.fromC === 0) castling.b.queenside = false;
        if (move.fromR === 0 && move.fromC === 7) castling.b.kingside = false;
    }
    // Rook captured -> lose that right
    if (move.toR === 7 && move.toC === 0 && move.captured && move.captured.type === 'r') castling.w.queenside = false;
    if (move.toR === 7 && move.toC === 7 && move.captured && move.captured.type === 'r') castling.w.kingside = false;
    if (move.toR === 0 && move.toC === 0 && move.captured && move.captured.type === 'r') castling.b.queenside = false;
    if (move.toR === 0 && move.toC === 7 && move.captured && move.captured.type === 'r') castling.b.kingside = false;

    // En passant square
    castling.ep = null;
    if (move.flags.double) {
        castling.ep = { r: (move.fromR + move.toR) / 2, c: move.fromC };
    }

    // Update check flag for next side
    const next = opp(color);
    castling.check = kingInCheck(board, next);

    return { board, castling, turn: next };
}

function makeRealMove(state, move) {
    // Returns state updated; also re-checks status. Used by the UI.
    const ns = applyMoveState(state, move);
    ns.status = getGameStatus(ns.board, ns.turn, ns.castling);
    ns.lastMove = move;
    // Notation needs the PRE-move board for disambiguation.
    move.notation = moveToNotation(state.board, move);
    move.flags.check = ns.castling.check;
    move.flags.mate = ns.status.over && ns.status.result === 'checkmate';
    return ns;
}

function countPseudoMoves(board, color, castling) {
    let n = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === color) {
                n += genMoves(board, r, c, castling).length;
            }
        }
    }
    return n;
}

function searchDepth(state, depth) {
    // Returns the best move for state.turn at a FIXED depth (minimax + alpha-beta).
    const moves = allLegalMoves(state.board, state.turn, state.castling);
    if (moves.length === 0) return null;

    // Order moves for better pruning
    moves.forEach(m => {
        let s = 0;
        if (m.captured) s += 10 * PIECE_VALUES[m.captured.type] - PIECE_VALUES[m.piece.type];
        if (m.flags.promote) s += PIECE_VALUES[m.flags.promote];
        m._score = s;
    });
    moves.sort((a, b) => b._score - a._score);

    const maximizing = state.turn === 'w';
    let best = null;
    let bestVal = maximizing ? -Infinity : Infinity;
    let alpha = -Infinity, beta = Infinity;

    for (const m of moves) {
        const ns = applyMoveState(state, m);
        const val = alphaBeta(ns, depth - 1, alpha, beta, !maximizing);
        if (maximizing) {
            if (val > bestVal) { bestVal = val; best = m; }
            alpha = Math.max(alpha, bestVal);
        } else {
            if (val < bestVal) { bestVal = val; best = m; }
            beta = Math.min(beta, bestVal);
        }
    }
    return best;
}

function enginePick(state, maxDepth, timeLimitMs) {
    // Iterative deepening: search depth 1..maxDepth, always keep the best move
    // from the last COMPLETED depth. If timeLimitMs is exceeded between depths,
    // stop and return that move — bounds worst-case latency.
    const t0 = Date.now();
    let best = null;
    for (let d = 1; d <= maxDepth; d++) {
        const m = searchDepth(state, d);
        if (!m) break;
        best = m;
        if (timeLimitMs && Date.now() - t0 > timeLimitMs) break;
    }
    return best;
}

function alphaBeta(state, depth, alpha, beta, maximizing) {
    // Generate moves once; derive terminal states from them.
    const moves = allLegalMoves(state.board, state.turn, state.castling);
    if (moves.length === 0) {
        // Checkmate or stalemate
        if (kingInCheck(state.board, state.turn)) {
            return state.turn === 'w' ? -99999 - depth : 99999 + depth; // prefer faster mates
        }
        return 0; // stalemate
    }
    if (depth <= 0) return evaluateBoard(state.board);

    // MVV-LVA move ordering (captures first) for much better alpha-beta pruning
    if (moves.length > 1) {
        for (const m of moves) {
            let s = 0;
            if (m.captured) s += 10 * PIECE_VALUES[m.captured.type] - PIECE_VALUES[m.piece.type];
            if (m.flags.promote) s += PIECE_VALUES[m.flags.promote] + 800;
            m._ord = s;
        }
        moves.sort((a, b) => b._ord - a._ord);
    }

    if (maximizing) {
        let best = -Infinity;
        for (const m of moves) {
            const ns = applyMoveState(state, m);
            best = Math.max(best, alphaBeta(ns, depth - 1, alpha, beta, false));
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            const ns = applyMoveState(state, m);
            best = Math.min(best, alphaBeta(ns, depth - 1, alpha, beta, true));
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

/* ------------------------- Engine facade ------------------------- */
function aiMove(board, turn, castling, difficulty) {
    // difficulty: 1 (easy), 2 (medium), 3 (hard)
    const state = { board, castling, turn };
    const depths = { 1: 1, 2: 2, 3: 3 };
    const depth = depths[difficulty] || 2;

    const moves = allLegalMoves(board, turn, castling);
    if (moves.length === 0) return null;

    // Easy mode: 50% chance to play a random move
    if (difficulty === 1 && Math.random() < 0.5) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // Hard gets a generous budget; Medium/Easy usually finish depth 2/1 fast.
    const timeLimit = difficulty >= 3 ? 1500 : 600;
    return enginePick(state, depth, timeLimit);
}

/* ------------------------- Notation ------------------------- */
function moveToNotation(board, move) {
    const piece = move.piece;
    let text = '';

    if (move.flags.castle === 'k') return 'O-O';
    if (move.flags.castle === 'q') return 'O-O-O';

    if (piece.type === 'p') {
        if (move.captured) text += FILES[move.fromC] + 'x';
        text += sqName(move.toR, move.toC);
        if (move.flags.promote) text += '=' + move.flags.promote.toUpperCase();
    } else {
        text += piece.type.toUpperCase();
        // Disambiguation: find other pieces of same type that can reach the same square
        const others = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r !== move.fromR || c !== move.fromC) &&
                    board[r][c] && board[r][c].type === piece.type && board[r][c].color === piece.color) {
                    const m = genMoves(board, r, c, null).find(x => x.toR === move.toR && x.toC === move.toC);
                    if (m) {
                        // must be legal too
                        m.piece = board[r][c];
                        if (isLegalMove(board, m, null)) others.push([r, c]);
                    }
                }
            }
        }
        if (others.length === 1 && others[0][0] === move.fromR) {
            // same rank -> disambiguate by file
            text += FILES[move.fromC];
        } else if (others.length === 1 && others[0][1] === move.fromC) {
            text += RANKS[move.fromR];
        } else if (others.length > 1) {
            text += FILES[move.fromC] + RANKS[move.fromR];
        }
        if (move.captured) text += 'x';
        text += sqName(move.toR, move.toC);
    }
    if (move.flags.check) text += '+';
    if (move.flags.mate) text += '#';
    return text;
}

/* ------------------------- Export for Node testing ------------------------- */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startBoard, emptyBoard, genMoves, isAttacked, kingInCheck, isLegalMove,
        legalMovesFor, allLegalMoves, applyMove, applyMoveState, makeRealMove,
        getGameStatus, aiMove, enginePick, evaluateBoard, moveToNotation,
        sqName, parseSq, squareOfKing, GLYPHS, PIECE_VALUES
    };
}
