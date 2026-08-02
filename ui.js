/* ============================================================
   Master Chess - UI layer (DOM wiring, rendering, interaction)
   Depends on chess.js loaded first (engine).
   ============================================================ */

'use strict';

(function () {
    const $ = (id) => document.getElementById(id);

    /* ------------------------- Elements ------------------------- */
    const boardEl = $('chessboard');
    const statusEl = $('status-message');
    const checkAlertEl = $('check-alert');
    const movesListEl = $('moves-list');
    const topCapturedEl = $('top-captured');
    const bottomCapturedEl = $('bottom-captured');
    const topNameEl = $('top-player-name');
    const bottomNameEl = $('bottom-player-name');
    const topAvatarEl = $('top-player-avatar');
    const bottomAvatarEl = $('bottom-player-avatar');
    const modeSelect = $('game-mode');
    const difficultySelect = $('ai-difficulty');
    const colorSelect = $('player-color');
    const newGameBtn = $('new-game-btn');
    const undoBtn = $('undo-btn');
    const flipBtn = $('flip-board-btn');
    const promoModal = $('promotion-modal');
    const promoChoices = $('promotion-choices');

    /* ------------------------- Game state ------------------------- */
    let state = null;          // { board, castling, turn, status, lastMove }
    let history = [];          // states after each move
    let selected = null;       // { r, c }
    let legalTargets = [];     // moves from selected (promotion variants deduped)
    let boardFlipped = false;
    let pendingPromotion = null; // { move } waiting for piece choice
    let aiThinking = false;
    let gameOver = false;
    let drag = null;             // active drag: { r, c, startX, startY, active, ghost }

    const PLAYER_NAMES = {
        ai: { w: 'White (AI)', b: 'Black (AI)' },
        human: { w: 'White (You)', b: 'Black (You)' }
    };

    /* ------------------------- Initialization ------------------------- */
    function newGame() {
        state = {
            board: startBoard(),
            castling: { w: { kingside: true, queenside: true }, b: { kingside: true, queenside: true }, ep: null, check: false },
            turn: 'w',
            status: null,
            lastMove: null,
            halfmove: 0,
            posKeys: [],
            repetitionCount: 1
        };
        state.posKeys = [positionKey(state.board, state.turn, state.castling)];
        history = [];
        selected = null;
        legalTargets = [];
        pendingPromotion = null;
        drag = null;
        aiThinking = false;
        gameOver = false;
        hidePromotionModal();
        updatePlayerCards();
        render();
        updateStatus();
        // If the AI side is to move first (AI == White, human == Black),
        // start the AI turn. maybeAiTurn() no-ops when it's the human's turn.
        maybeAiTurn();
    }

    // FEN-like key uniquely identifying a position (board + turn + rights + ep).
    function positionKey(board, turn, castling) {
        let placement = '';
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) { empty++; continue; }
                if (empty) { placement += empty; empty = 0; }
                placement += p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
            }
            if (empty) placement += empty;
            if (r < 7) placement += '/';
        }
        const rights = (castling.w.kingside ? 'K' : '') + (castling.w.queenside ? 'Q' : '') +
                       (castling.b.kingside ? 'k' : '') + (castling.b.queenside ? 'q' : '') || '-';
        const ep = castling.ep ? sqName(castling.ep.r, castling.ep.c) : '-';
        return placement + ' ' + turn + ' ' + rights + ' ' + ep;
    }

    function updatePlayerCards() {
        const mode = modeSelect.value;
        const playerColor = colorSelect.value;

        if (mode === 'pvp') {
            topNameEl.textContent = 'Black (Player 2)';
            bottomNameEl.textContent = 'White (Player 1)';
        } else {
            const human = playerColor === 'w' ? 'White (You)' : 'Black (You)';
            const ai = playerColor === 'w' ? 'Black (AI)' : 'White (AI)';
            topNameEl.textContent = playerColor === 'w' ? ai : human;
            bottomNameEl.textContent = playerColor === 'w' ? human : ai;
        }
    }

    /* ------------------------- Rendering ------------------------- */
    function render() {
        boardEl.innerHTML = '';
        const flipped = boardFlipped;

        for (let d = 0; d < 8; d++) {          // display row
            for (let e = 0; e < 8; e++) {      // display col
                const r = flipped ? 7 - d : d;
                const c = flipped ? 7 - e : e;

                const sq = document.createElement('div');
                sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
                sq.dataset.r = r;
                sq.dataset.c = c;

                const piece = state.board[r][c];
                if (piece) {
                    const span = document.createElement('span');
                    span.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
                    span.textContent = GLYPHS[piece.color][piece.type];
                    sq.appendChild(span);
                }

                // Coordinates
                if (d === 7) { // bottom row -> file letter
                    const f = document.createElement('span');
                    f.className = 'coord coord-file';
                    f.textContent = FILES[c];
                    sq.appendChild(f);
                }
                if (e === 0) { // left column -> rank number
                    const rk = document.createElement('span');
                    rk.className = 'coord coord-rank';
                    rk.textContent = RANKS[r];
                    sq.appendChild(rk);
                }

                // Highlights
                if (selected && selected.r === r && selected.c === c) {
                    sq.classList.add('selected');
                }
                if (state.lastMove &&
                    ((state.lastMove.fromR === r && state.lastMove.fromC === c) ||
                     (state.lastMove.toR === r && state.lastMove.toC === c))) {
                    sq.classList.add('last-move');
                }
                if (state.castling.check && state.turn === (state.board[r][c] && state.board[r][c].color) &&
                    state.board[r][c] && state.board[r][c].type === 'k') {
                    sq.classList.add('in-check');
                }

                // Legal move targets
                for (const m of legalTargets) {
                    if (m.toR === r && m.toC === c) {
                        const ind = document.createElement('div');
                        if (m.captured || m.flags.enPassant) {
                            ind.className = 'target-ring';
                        } else {
                            ind.className = 'target-dot';
                        }
                        sq.appendChild(ind);
                        break;
                    }
                }

                sq.addEventListener('click', () => onSquareClick(r, c));
                sq.addEventListener('pointerdown', (e) => onPointerDown(r, c, e));
                boardEl.appendChild(sq);
            }
        }

        renderCaptured();
        renderMoves();
    }

    function renderCaptured() {
        // Pieces captured by each side
        const wCaptured = [], bCaptured = [];
        for (const s of history) {
            const m = s.lastMove;
            if (m && m.captured) {
                if (m.piece.color === 'w') wCaptured.push(m.captured); // white captured a black piece
                else bCaptured.push(m.captured);
            }
        }
        const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
        const sortFn = (a, b) => (order[a.type] ?? 5) - (order[b.type] ?? 5);
        wCaptured.sort(sortFn);
        bCaptured.sort(sortFn);

        const glyph = (p) => GLYPHS[p.color][p.type];
        topCapturedEl.innerHTML = wCaptured.map(glyph).join(' ');
        bottomCapturedEl.innerHTML = bCaptured.map(glyph).join(' ');
    }

    function renderMoves() {
        movesListEl.innerHTML = '';
        const played = history.filter(s => s.lastMove);
        let moveNo = 0;
        for (let i = 0; i < played.length; i++) {
            const m = played[i].lastMove;
            const row = document.createElement('tr');
            if (m.piece.color === 'w') {
                moveNo++;
                const n = document.createElement('td');
                n.textContent = moveNo;
                const w = document.createElement('td');
                w.textContent = m.notation || '';
                row.appendChild(n);
                row.appendChild(w);
                row.appendChild(document.createElement('td'));
            } else {
                // find the last row that has an empty black cell
                const rows = movesListEl.querySelectorAll('tr');
                if (rows.length > 0) {
                    const lastRow = rows[rows.length - 1];
                    const tds = lastRow.querySelectorAll('td');
                    if (tds.length === 3 && tds[2].textContent === '') {
                        tds[2].textContent = m.notation || '';
                        continue;
                    }
                }
                const n = document.createElement('td');
                n.textContent = moveNo + 1;
                const b = document.createElement('td');
                b.textContent = m.notation || '';
                row.appendChild(n);
                row.appendChild(document.createElement('td'));
                row.appendChild(b);
            }
            movesListEl.appendChild(row);
        }
        // Auto-scroll to bottom
        const container = $('moves-log');
        if (container) container.scrollTop = container.scrollHeight;
    }

    function updateStatus() {
        if (!state) return;
        const s = state.status || getGameStatus(state.board, state.turn, state.castling,
            { halfmove: state.halfmove, posCount: state.repetitionCount });
        state.status = s;

        const turnName = state.turn === 'w' ? 'White' : 'Black';
        checkAlertEl.classList.add('hidden');
        statusEl.classList.remove('status-win');

        if (s.over) {
            gameOver = true;
            if (s.result === 'checkmate') {
                const winner = s.winner === 'w' ? 'White' : 'Black';
                statusEl.textContent = `Checkmate — ${winner} wins! 🏆`;
                statusEl.classList.add('status-win');
            } else if (s.result === 'stalemate') {
                statusEl.textContent = 'Stalemate — Draw';
            } else if (s.result === 'insufficient material') {
                statusEl.textContent = 'Draw — Insufficient material';
            } else if (s.result === '50-move rule') {
                statusEl.textContent = 'Draw — 50-move rule';
            } else if (s.result === 'threefold repetition') {
                statusEl.textContent = 'Draw — Threefold repetition';
            } else {
                statusEl.textContent = 'Game Over — Draw';
            }
        } else if (s.check) {
            statusEl.textContent = `${turnName}'s turn`;
            checkAlertEl.classList.remove('hidden');
        } else {
            statusEl.textContent = `${turnName}'s turn`;
        }
    }

    /* ------------------------- Interaction ------------------------- */
    function isHumanTurn() {
        if (gameOver || pendingPromotion) return false;
        const mode = modeSelect.value;
        if (mode === 'pvp') return true;
        return colorSelect.value === state.turn;
    }

    /* ------------------------- Drag & drop ------------------------- */
    const DRAG_THRESHOLD = 5; // px of movement before a drag starts

    function onPointerDown(r, c, ev) {
        if (aiThinking || pendingPromotion || gameOver) return;
        if (!isHumanTurn()) return;
        const pieceOn = state.board[r][c];
        if (!pieceOn || pieceOn.color !== state.turn) return;

        // Pre-select the piece and compute legal targets (shared with click).
        selected = { r, c };
        legalTargets = legalMovesFor(state.board, r, c, state.castling);
        if (legalTargets.length === 0) return; // not a movable piece; let click logic run

        drag = { r, c, startX: ev.clientX, startY: ev.clientY, active: false, ghost: null };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onDragCancel);
        ev.preventDefault(); // keep click intact is fine; prevents native image/drag quirks
    }

    function onPointerMove(ev) {
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;

        if (!drag.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            drag.active = true;
            const p = state.board[drag.r][drag.c];
            drag.ghost = document.createElement('div');
            drag.ghost.className = 'piece-ghost piece ' + (p.color === 'w' ? 'white-piece' : 'black-piece');
            drag.ghost.textContent = GLYPHS[p.color][p.type];
            document.body.appendChild(drag.ghost);
            // reveal legal targets while dragging
            boardEl.classList.add('dragging');
            render();
        }
        if (drag.active && drag.ghost) {
            drag.ghost.style.transform =
                'translate(' + (ev.clientX) + 'px,' + (ev.clientY) + 'px)';
        }
    }

    function onPointerUp(ev) {
        if (!drag) return;
        const d = drag;
        drag = null;
        detachDragListeners();

        if (d.ghost) { d.ghost.remove(); d.ghost = null; }
        boardEl.classList.remove('dragging');

        if (!d.active) {
            // Pure click (no movement): selection was set in onPointerDown;
            // the click event will drive the move. Nothing else to do.
            return;
        }

        const t = hitTestSquare(ev.clientX, ev.clientY);
        const moved = t ? attemptMoveTo(t.r, t.c) : false;
        if (!moved) {
            selected = null;
            legalTargets = [];
            render();
        }
    }

    function onDragCancel(ev) {
        if (!drag) return;
        drag = null;
        detachDragListeners();
        boardEl.classList.remove('dragging');
        selected = null;
        legalTargets = [];
        render();
    }

    function detachDragListeners() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onDragCancel);
    }

    // Convert a client (viewport) point into board coordinates {r, c} or null.
    function hitTestSquare(clientX, clientY) {
        const rect = boardEl.getBoundingClientRect();
        if (clientX < rect.left || clientX > rect.right ||
            clientY < rect.top || clientY > rect.bottom) return null;
        const size = rect.width / 8;
        const d = Math.floor((clientY - rect.top) / size);
        const e = Math.floor((clientX - rect.left) / size);
        return {
            r: boardFlipped ? 7 - d : d,
            c: boardFlipped ? 7 - e : e
        };
    }

    function onSquareClick(r, c) {
        if (aiThinking) return;
        if (!isHumanTurn()) return;

        const piece = state.board[r][c];

        // Clicking a target -> make the move (shared with drag-and-drop).
        if (attemptMoveTo(r, c)) return;

        // Otherwise (re)select own piece
        if (piece && piece.color === state.turn) {
            selected = { r, c };
            legalTargets = legalMovesFor(state.board, r, c, state.castling);
            render();
        } else {
            selected = null;
            legalTargets = [];
            render();
        }
    }

    // Execute a move to the given square if it's a legal target of the currently
    // selected piece. Returns true if the move (or promotion) was started.
    function attemptMoveTo(toR, toC) {
        if (!selected) return false;
        const targetMove = legalTargets.find(m => m.toR === toR && m.toC === toC);
        if (!targetMove) return false;

        if (targetMove.flags.promote) {
            const variants = legalTargets.filter(m => m.toR === toR && m.toC === toC && m.flags.promote);
            pendingPromotion = {
                fromR: targetMove.fromR, fromC: targetMove.fromC,
                toR: toR, toC: toC,
                captured: targetMove.captured,
                flags: { ...targetMove.flags }
            };
            openPromotionModal(variants);
            return true;
        }
        doMove(targetMove);
        return true;
    }

    function doMove(move) {
        // Recompute legality against the CURRENT state (should be valid).
        move.piece = state.board[move.fromR][move.fromC];
        const newState = makeRealMove(state, move);
        // Draw-clock bookkeeping (50-move rule + threefold repetition)
        newState.halfmove = (move.captured || move.piece.type === 'p') ? 0 : (state.halfmove || 0) + 1;
        const key = positionKey(newState.board, newState.turn, newState.castling);
        newState.posKeys = (state.posKeys || []).concat([key]);
        newState.repetitionCount = newState.posKeys.filter(k => k === key).length;
        history.push(newState);
        state = newState;
        selected = null;
        legalTargets = [];
        render();
        updateStatus();

        if (!gameOver) maybeAiTurn();
    }

    function maybeAiTurn() {
        const mode = modeSelect.value;
        if (mode !== 'ai') return;
        if (gameOver) return;
        if (colorSelect.value === state.turn) return; // human's turn

        aiThinking = true;
        statusEl.textContent = 'AI is thinking…';
        const diff = parseInt(difficultySelect.value, 10) || 2;

        // Defer so the UI paints before heavy computation
        setTimeout(() => {
            const move = aiMove(state.board, state.turn, state.castling, diff);
            if (!move) {
                aiThinking = false;
                updateStatus();
                return;
            }
            doMove(move);
            aiThinking = false;
        }, 50);
    }

    /* ------------------------- Promotion modal ------------------------- */
    function openPromotionModal(variants) {
        promoChoices.querySelectorAll('.promo-btn').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.piece;
                const mv = variants.find(v => v.flags.promote === type) || variants[0];
                const move = {
                    fromR: mv.fromR, fromC: mv.fromC, toR: mv.toR, toC: mv.toC,
                    captured: mv.captured,
                    flags: { ...mv.flags, promote: type }
                };
                pendingPromotion = null;
                hidePromotionModal();
                doMove(move);
            };
        });
        promoModal.classList.remove('hidden');
    }

    function hidePromotionModal() {
        promoModal.classList.add('hidden');
    }

    /* ------------------------- Controls ------------------------- */
    function undoMove() {
        if (aiThinking) return;
        if (pendingPromotion) {
            pendingPromotion = null;
            hidePromotionModal();
            selected = null;
            legalTargets = [];
            render();
            return;
        }
        if (history.length === 0) return;

        const mode = modeSelect.value;
        const pliesToUndo = mode === 'ai' ? 2 : 1;

        for (let i = 0; i < pliesToUndo && history.length > 0; i++) {
            history.pop();
        }
        state = history.length > 0 ? history[history.length - 1] : null;
        if (!state) {
            newGame();
            return;
        }
        state.status = null;
        selected = null;
        legalTargets = [];
        gameOver = false;
        render();
        updateStatus();
    }

    function flipBoard() {
        boardFlipped = !boardFlipped;
        render();
    }

    /* ------------------------- Wiring ------------------------- */
    newGameBtn.addEventListener('click', newGame);
    undoBtn.addEventListener('click', undoMove);
    flipBtn.addEventListener('click', flipBoard);

    modeSelect.addEventListener('change', () => {
        updatePlayerCards();
        // Mode switch always restarts cleanly
        newGame();
    });
    colorSelect.addEventListener('change', () => {
        updatePlayerCards();
        newGame();
    });
    difficultySelect.addEventListener('change', () => {
        // Takes effect for the next AI move; no reset needed
    });

    // Start
    newGame();
})();
