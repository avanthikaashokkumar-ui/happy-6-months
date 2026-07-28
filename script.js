'use strict';

const safeStorage = (() => {
  const memory = new Map();
  try {
    const real = window.localStorage;
    const testKey = "__game_hub_test__";
    real.setItem(testKey, "1");
    real.removeItem(testKey);
    return real;
  } catch (_error) {
    return {
      getItem(key) { return memory.has(key) ? memory.get(key) : null; },
      setItem(key, value) { memory.set(key, String(value)); },
      removeItem(key) { memory.delete(key); },
      clear() { memory.clear(); }
    };
  }
})();

const wordle = (() => {
const CUTE_MEMORIES = [
  { answer: "benny", clue: "Our fluffy little favorite 🐶" },
  { answer: "dates", clue: "The little adventures we share together 💌" },
  { answer: "smile", clue: "The look that makes every day better 😊" },
  { answer: "laugh", clue: "Those moments when we cannot stop giggling 😂" },
  { answer: "movie", clue: "A cozy screen-night memory 🍿" },
  { answer: "photo", clue: "A snapshot worth keeping forever 📸" },
  { answer: "night", clue: "Late talks and quiet time together 🌙" },
  { answer: "heart", clue: "What these six months are full of ❤️" },
  { answer: "music", clue: "Songs that bring a memory back instantly 🎵" },
  { answer: "sweet", clue: "The small thoughtful moments between us 🍓" },
  { answer: "happy", clue: "How these six months have felt ✨" },
  { answer: "dream", clue: "All the plans still waiting for us ☁️" }
];

const KEY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["enter","z","x","c","v","b","n","m","back"]
];
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
let memoryCursor = 0;

function makeState() {
  const memory = CUTE_MEMORIES[memoryCursor % CUTE_MEMORIES.length];
  memoryCursor += 1;
  return {
    memory,
    answer: memory.answer,
    rows: Array.from({ length: MAX_GUESSES }, () => ""),
    submitted: [],
    currentRow: 0,
    finished: false,
    keyStates: {},
    clueShown: false
  };
}

// This follows Wordle's duplicate-letter rules. Green letters are reserved first,
// then remaining unmatched answer letters may become yellow only once.
function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const letter = guess[i];
    if ((remaining[letter] || 0) > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return result;
}

function rankOf(state) {
  return { correct: 3, present: 2, absent: 1, unknown: 0 }[state] || 0;
}

return {
  _state: null,
  _root: null,
  _onKeydown: null,

  mount(root) {
    this._root = root;
    this._state = makeState();
    this._render();
    this._onKeydown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") this._handleKey("enter");
      else if (event.key === "Backspace") this._handleKey("back");
      else if (/^[a-zA-Z]$/.test(event.key)) this._handleKey(event.key.toLowerCase());
    };
    document.addEventListener("keydown", this._onKeydown);
  },

  unmount() {
    document.removeEventListener("keydown", this._onKeydown);
    this._onKeydown = null;
    this._root = null;
    this._state = null;
  },

  _handleKey(key) {
    const state = this._state;
    if (!state || state.finished) return;
    const row = state.rows[state.currentRow];

    if (key === "back") {
      state.rows[state.currentRow] = row.slice(0, -1);
      this._render();
      return;
    }

    if (key === "enter") {
      if (row.length !== WORD_LENGTH) {
        this._shakeCurrentRow();
        return this._flashStatus("Your guess needs five letters.");
      }

      // Accept every five-letter guess so the player can actually type and submit
      // guesses without being blocked by a tiny built-in dictionary.
      const result = scoreGuess(row, state.answer);
      state.submitted[state.currentRow] = result;

      row.split("").forEach((letter, index) => {
        if (rankOf(result[index]) > rankOf(state.keyStates[letter] || "unknown")) {
          state.keyStates[letter] = result[index];
        }
      });

      if (row === state.answer) {
        state.finished = true;
        this._render(`You got it in ${state.currentRow + 1}/${MAX_GUESSES} — ${state.answer.toUpperCase()}! ♥`);
        return;
      }

      if (state.currentRow === MAX_GUESSES - 1) {
        state.finished = true;
        this._render(`The memory word was ${state.answer.toUpperCase()}. ♥`);
        return;
      }

      state.currentRow += 1;
      this._render("Guess submitted — keep going!");
      return;
    }

    if (/^[a-z]$/.test(key) && row.length < WORD_LENGTH) {
      state.rows[state.currentRow] = row + key;
      this._render();
    }
  },

  _shakeCurrentRow() {
    const row = this._root?.querySelector(`.wordle-row[data-row="${this._state?.currentRow}"]`);
    if (!row) return;
    row.classList.remove("wordle-shake");
    void row.offsetWidth;
    row.classList.add("wordle-shake");
  },

  _flashStatus(message) {
    const status = this._root?.querySelector(".game-status");
    if (!status) return;
    status.textContent = message;
    window.setTimeout(() => {
      const current = this._root?.querySelector(".game-status");
      if (current && this._state && !this._state.finished) {
        current.textContent = this._state.clueShown
          ? `Memory clue: ${this._state.memory.clue}`
          : "Enter any five-letter guess, then press Enter.";
      }
    }, 1500);
  },

  _render(message = "") {
    const root = this._root;
    const state = this._state;
    if (!root || !state) return;

    const panel = document.createElement("div");
    panel.className = "game-panel";

    const controls = document.createElement("div");
    controls.className = "game-controls";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn secondary";
    nextBtn.textContent = "Next cute memory";
    nextBtn.addEventListener("click", () => {
      this._state = makeState();
      this._render("New memory word ready!");
    });

    const clueBtn = document.createElement("button");
    clueBtn.type = "button";
    clueBtn.className = "btn";
    clueBtn.textContent = state.clueShown ? "Clue shown" : "Show memory clue";
    clueBtn.disabled = state.clueShown;
    clueBtn.addEventListener("click", () => {
      state.clueShown = true;
      this._render(`Memory clue: ${state.memory.clue}`);
    });
    controls.append(nextBtn, clueBtn);

    const intro = document.createElement("p");
    intro.className = "wordle-intro";
    intro.textContent = "Guess the cute five-letter memory word in six tries. Type with your keyboard or tap the letters below.";

    const legend = document.createElement("div");
    legend.className = "wordle-legend";
    legend.innerHTML = `
      <span><i class="legend-box correct"></i> Right letter, right spot</span>
      <span><i class="legend-box present"></i> Right letter, wrong spot</span>
      <span><i class="legend-box absent"></i> Letter is not in the word</span>
    `;

    const status = document.createElement("p");
    status.className = "game-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = message || (state.clueShown
      ? `Memory clue: ${state.memory.clue}`
      : "Enter any five-letter guess, then press Enter.");

    const board = document.createElement("div");
    board.className = "wordle-board";

    for (let r = 0; r < MAX_GUESSES; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";
      rowEl.dataset.row = String(r);
      const letters = state.rows[r].split("");
      const result = state.submitted[r];

      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = document.createElement("div");
        tile.className = "wordle-tile";
        if (letters[c]) {
          tile.textContent = letters[c];
          tile.classList.add("filled");
        }
        if (result) tile.classList.add(result[c]);
        rowEl.appendChild(tile);
      }
      board.appendChild(rowEl);
    }

    const keyboard = document.createElement("div");
    keyboard.className = "wordle-keyboard";
    KEY_ROWS.forEach((keys) => {
      const row = document.createElement("div");
      row.className = "wordle-key-row";
      keys.forEach((key) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wordle-key";
        if (key === "enter" || key === "back") button.classList.add("wide");
        button.textContent = key === "back" ? "⌫" : key === "enter" ? "Enter" : key.toUpperCase();
        if (state.keyStates[key]) button.classList.add(state.keyStates[key]);
        button.addEventListener("click", () => this._handleKey(key));
        row.appendChild(button);
      });
      keyboard.appendChild(row);
    });

    panel.append(controls, intro, legend, status, board, keyboard);
    root.replaceChildren(panel);
  }
};

})();

const sudoku = (() => {
const SIZE = 9;
const BOX = 3;
const CLUES_TO_REMOVE = 34; // easy: 47 given cells

function shuffled(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isSafe(grid, row, col, num) {
  for (let i = 0; i < SIZE; i++) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  const boxRow = row - (row % BOX);
  const boxCol = col - (col % BOX);
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) {
      if (grid[boxRow + r][boxCol + c] === num) return false;
    }
  }
  return true;
}

function fillGrid(grid) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (grid[row][col] !== 0) continue;
      for (const num of shuffled([1,2,3,4,5,6,7,8,9])) {
        if (!isSafe(grid, row, col, num)) continue;
        grid[row][col] = num;
        if (fillGrid(grid)) return true;
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function generatePuzzle() {
  const solution = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  fillGrid(solution);
  const puzzle = solution.map((row) => row.slice());
  const cells = shuffled(Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]));
  cells.slice(0, CLUES_TO_REMOVE).forEach(([row, col]) => { puzzle[row][col] = 0; });
  return { puzzle, solution };
}

return {
  _root: null,
  _solution: null,
  _given: null,
  _values: null,
  _hinted: new Set(),
  _wrong: new Set(),

  mount(root) {
    this._root = root;
    this._newPuzzle();
  },

  unmount() {
    this._root = null;
  },

  _newPuzzle() {
    const { puzzle, solution } = generatePuzzle();
    this._solution = solution;
    this._given = puzzle.map((row) => row.map(Boolean));
    this._values = puzzle.map((row) => row.slice());
    this._hinted = new Set();
    this._wrong = new Set();
    this._render("Easy mode: lots of starter numbers and unlimited hints.");
  },

  _giveHint() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!this._values[r][c] || this._values[r][c] !== this._solution[r][c]) empty.push([r,c]);
      }
    }
    if (!empty.length) return this._render("The board is already complete. Beautiful work!");
    const [row, col] = empty[Math.floor(Math.random() * empty.length)];
    this._values[row][col] = this._solution[row][col];
    this._hinted.add(`${row}-${col}`);
    this._wrong.delete(`${row}-${col}`);
    this._render(`Hint added at row ${row + 1}, column ${col + 1}.`);
  },

  _checkAnswers() {
    this._wrong.clear();
    let missing = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!this._values[r][c]) missing += 1;
        else if (this._values[r][c] !== this._solution[r][c]) this._wrong.add(`${r}-${c}`);
      }
    }
    if (this._wrong.size) return this._render(`${this._wrong.size} square${this._wrong.size === 1 ? " is" : "s are"} incorrect. They are highlighted.`);
    if (missing) return this._render(`${missing} square${missing === 1 ? " is" : "s are"} still empty. Keep going.`);
    this._render("Solved! Easy, calm, and perfect. ♥");
  },

  _render(message = "") {
    if (!this._root) return;
    const panel = document.createElement("div");
    panel.className = "game-panel";

    const difficulty = document.createElement("div");
    difficulty.className = "sudoku-difficulty";
    difficulty.textContent = "Easy · 47 clues";

    const controls = document.createElement("div");
    controls.className = "game-controls";
    const newBtn = document.createElement("button");
    newBtn.className = "btn secondary";
    newBtn.textContent = "New easy puzzle";
    newBtn.addEventListener("click", () => this._newPuzzle());
    const hintBtn = document.createElement("button");
    hintBtn.className = "btn secondary";
    hintBtn.textContent = "Hint";
    hintBtn.addEventListener("click", () => this._giveHint());
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn";
    checkBtn.textContent = "Check";
    checkBtn.addEventListener("click", () => this._checkAnswers());
    controls.append(newBtn, hintBtn, checkBtn);

    const status = document.createElement("p");
    status.className = "game-status";
    status.textContent = message;

    const board = document.createElement("div");
    board.className = "sudoku-board";
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const key = `${row}-${col}`;
        const cell = document.createElement("div");
        cell.className = "sudoku-cell";
        if ((row + 1) % 3 === 0 && row !== 8) cell.classList.add("sudoku-row-thick");
        if (this._given[row][col]) cell.classList.add("given");
        if (this._hinted.has(key)) cell.classList.add("hint");
        if (this._wrong.has(key)) cell.classList.add("wrong");

        const input = document.createElement("input");
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.ariaLabel = `Row ${row + 1}, column ${col + 1}`;
        if (this._values[row][col]) input.value = String(this._values[row][col]);
        if (this._given[row][col] || this._hinted.has(key)) input.disabled = true;
        else {
          input.addEventListener("input", () => {
            const digit = input.value.replace(/[^1-9]/g, "").slice(-1);
            input.value = digit;
            this._values[row][col] = digit ? Number(digit) : 0;
            this._wrong.delete(key);
            cell.classList.remove("wrong");
          });
        }
        cell.appendChild(input);
        board.appendChild(cell);
      }
    }

    panel.append(difficulty, controls, status, board);
    this._root.replaceChildren(panel);
  }
};

})();
const chess = (() => {
// A complete, dependency-free two-player chess implementation: legal move
// generation (including castling and en passant), check, checkmate and
// stalemate detection. Pawns promote automatically to a queen.

const PIECE_UNICODE = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

function initialBoard() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: back[c], color: "w" };
  }
  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.type === "k" && cell.color === color) return { r, c };
    }
  }
  return null;
}

const SLIDING_DIRS = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
};
const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]
];
const KING_OFFSETS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]
];

function isSquareAttacked(board, row, col, byColor) {
  // Pawns
  const dir = byColor === "w" ? 1 : -1; // a white pawn on r attacks r-1; from target's view, attacker is at row+dir
  for (const dc of [-1, 1]) {
    const r = row + dir;
    const c = col + dc;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "p") return true;
    }
  }
  // Knights
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "n") return true;
    }
  }
  // King
  for (const [dr, dc] of KING_OFFSETS) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "k") return true;
    }
  }
  // Sliding: rook/queen
  for (const [dr, dc] of SLIDING_DIRS.r) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell) {
        if (cell.color === byColor && (cell.type === "r" || cell.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  // Sliding: bishop/queen
  for (const [dr, dc] of SLIDING_DIRS.b) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell) {
        if (cell.color === byColor && (cell.type === "b" || cell.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

// Generates pseudo-legal moves for the piece at (r,c) — legal piece movement
// and capture rules, plus castling/en passant, but WITHOUT verifying the
// move leaves the mover's own king safe (that filter happens one level up).
function pseudoMovesForSquare(state, r, c) {
  const { board } = state;
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const color = piece.color;

  const addIfLegalTarget = (tr, tc, opts = {}) => {
    if (!inBounds(tr, tc)) return;
    const target = board[tr][tc];
    if (target && target.color === color) return;
    moves.push({ from: { r, c }, to: { r: tr, c: tc }, ...opts });
  };

  if (piece.type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;

    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push({ from: { r, c }, to: { r: r + dir, c }, promotion: r + dir === promoRow });
      if (r === startRow && !board[r + 2 * dir][c]) {
        moves.push({ from: { r, c }, to: { r: r + 2 * dir, c }, doubleStep: true });
      }
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir;
      const tc = c + dc;
      if (!inBounds(tr, tc)) continue;
      const target = board[tr][tc];
      if (target && target.color !== color) {
        moves.push({ from: { r, c }, to: { r: tr, c: tc }, capture: true, promotion: tr === promoRow });
      } else if (
        state.epTarget &&
        state.epTarget.r === tr &&
        state.epTarget.c === tc
      ) {
        moves.push({ from: { r, c }, to: { r: tr, c: tc }, enPassant: true });
      }
    }
    return moves;
  }

  if (piece.type === "n") {
    for (const [dr, dc] of KNIGHT_OFFSETS) addIfLegalTarget(r + dr, c + dc);
    return moves;
  }

  if (piece.type === "k") {
    for (const [dr, dc] of KING_OFFSETS) addIfLegalTarget(r + dr, c + dc);

    // Castling
    const rights = state.castling;
    const homeRow = color === "w" ? 7 : 0;
    if (r === homeRow && c === 4 && !isSquareAttacked(board, r, c, opposite(color))) {
      const kingSide = color === "w" ? rights.wK : rights.bK;
      const queenSide = color === "w" ? rights.wQ : rights.bQ;

      if (
        kingSide &&
        !board[homeRow][5] &&
        !board[homeRow][6] &&
        !isSquareAttacked(board, homeRow, 5, opposite(color)) &&
        !isSquareAttacked(board, homeRow, 6, opposite(color))
      ) {
        moves.push({ from: { r, c }, to: { r: homeRow, c: 6 }, castle: "king" });
      }
      if (
        queenSide &&
        !board[homeRow][1] &&
        !board[homeRow][2] &&
        !board[homeRow][3] &&
        !isSquareAttacked(board, homeRow, 3, opposite(color)) &&
        !isSquareAttacked(board, homeRow, 2, opposite(color))
      ) {
        moves.push({ from: { r, c }, to: { r: homeRow, c: 2 }, castle: "queen" });
      }
    }
    return moves;
  }

  // Sliding pieces
  const dirs = SLIDING_DIRS[piece.type];
  for (const [dr, dc] of dirs) {
    let tr = r + dr;
    let tc = c + dc;
    while (inBounds(tr, tc)) {
      const target = board[tr][tc];
      if (target && target.color === color) break;
      moves.push({ from: { r, c }, to: { r: tr, c: tc }, capture: !!target });
      if (target) break;
      tr += dr;
      tc += dc;
    }
  }
  return moves;
}

function applyMove(state, move) {
  const board = cloneBoard(state.board);
  const piece = board[move.from.r][move.from.c];
  const nextCastling = { ...state.castling };
  let nextEp = null;

  board[move.from.r][move.from.c] = null;

  if (move.enPassant) {
    board[move.from.r][move.to.c] = null; // captured pawn is beside, not on target square
  }

  if (move.castle) {
    const homeRow = move.from.r;
    if (move.castle === "king") {
      board[homeRow][5] = board[homeRow][7];
      board[homeRow][7] = null;
    } else {
      board[homeRow][3] = board[homeRow][0];
      board[homeRow][0] = null;
    }
  }

  board[move.to.r][move.to.c] = move.promotion ? { type: "q", color: piece.color } : piece;

  if (piece.type === "k") {
    if (piece.color === "w") {
      nextCastling.wK = false;
      nextCastling.wQ = false;
    } else {
      nextCastling.bK = false;
      nextCastling.bQ = false;
    }
  }
  if (piece.type === "r") {
    if (move.from.r === 7 && move.from.c === 0) nextCastling.wQ = false;
    if (move.from.r === 7 && move.from.c === 7) nextCastling.wK = false;
    if (move.from.r === 0 && move.from.c === 0) nextCastling.bQ = false;
    if (move.from.r === 0 && move.from.c === 7) nextCastling.bK = false;
  }
  // A captured rook also loses castling rights on that side.
  if (move.to.r === 7 && move.to.c === 0) nextCastling.wQ = false;
  if (move.to.r === 7 && move.to.c === 7) nextCastling.wK = false;
  if (move.to.r === 0 && move.to.c === 0) nextCastling.bQ = false;
  if (move.to.r === 0 && move.to.c === 7) nextCastling.bK = false;

  if (move.doubleStep) {
    nextEp = { r: (move.from.r + move.to.r) / 2, c: move.from.c };
  }

  return {
    board,
    turn: opposite(state.turn),
    castling: nextCastling,
    epTarget: nextEp,
    lastMove: move
  };
}

function legalMovesForSquare(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = pseudoMovesForSquare(state, r, c);
  return pseudo.filter((move) => {
    const next = applyMove(state, move);
    const king = findKing(next.board, piece.color);
    if (!king) return false;
    return !isSquareAttacked(next.board, king.r, king.c, opposite(piece.color));
  });
}

function allLegalMoves(state, color) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && piece.color === color) {
        moves.push(...legalMovesForSquare({ ...state, turn: color }, r, c));
      }
    }
  }
  return moves;
}

function initialState() {
  return {
    board: initialBoard(),
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
    lastMove: null
  };
}

return {
  _root: null,
  _state: null,
  _selected: null,
  _legalTargets: [],
  _mode: "bot",
  _flipped: false,
  _botTimer: null,

  mount(root) {
    this._root = root;
    this._state = initialState();
    this._selected = null;
    this._legalTargets = [];
    this._mode = "bot";
    this._flipped = false;
    this._render("White to move — you are White.");
  },

  unmount() {
    window.clearTimeout(this._botTimer);
    this._botTimer = null;
    this._root = null;
    this._state = null;
  },

  _statusMessage() {
    const state = this._state;
    const color = state.turn;
    const king = findKing(state.board, color);
    const inCheck = king && isSquareAttacked(state.board, king.r, king.c, opposite(color));
    const moves = allLegalMoves(state, color);
    const colorName = color === "w" ? "White" : "Black";
    if (moves.length === 0) {
      return inCheck ? `Checkmate — ${colorName === "White" ? "Black" : "White"} wins!` : "Stalemate — draw.";
    }
    if (inCheck) return `${colorName} is in check.`;
    if (this._mode === "bot" && color === "b") return "Benny Bot is thinking…";
    return `${colorName} to move`;
  },

  _handleSquareClick(r, c) {
    const state = this._state;
    if (this._mode === "bot" && state.turn === "b") return;
    const piece = state.board[r][c];

    if (this._selected) {
      const target = this._legalTargets.find((m) => m.to.r === r && m.to.c === c);
      if (target) {
        this._state = applyMove(state, target);
        this._selected = null;
        this._legalTargets = [];
        this._render(this._statusMessage());
        this._maybeBotMove();
        return;
      }
    }

    if (piece && piece.color === state.turn) {
      this._selected = { r, c };
      this._legalTargets = legalMovesForSquare(state, r, c);
    } else {
      this._selected = null;
      this._legalTargets = [];
    }
    this._render(this._statusMessage());
  },

  _maybeBotMove() {
    window.clearTimeout(this._botTimer);
    if (!this._state || this._mode !== "bot" || this._state.turn !== "b") return;
    const moves = allLegalMoves(this._state, "b");
    if (!moves.length) return;
    this._botTimer = window.setTimeout(() => {
      if (!this._state || this._state.turn !== "b" || this._mode !== "bot") return;
      const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 50 };
      const ranked = moves.map((move) => {
        const target = this._state.board[move.to.r][move.to.c];
        const capture = target ? values[target.type] * 10 : 0;
        const center = 4 - (Math.abs(3.5 - move.to.r) + Math.abs(3.5 - move.to.c));
        return { move, score: capture + center + Math.random() * 3 };
      }).sort((a, b) => b.score - a.score);
      const choice = ranked[Math.floor(Math.random() * Math.min(3, ranked.length))].move;
      this._state = applyMove(this._state, choice);
      this._render(this._statusMessage());
    }, 620);
  },

  _reset() {
    window.clearTimeout(this._botTimer);
    this._state = initialState();
    this._selected = null;
    this._legalTargets = [];
    this._render(this._mode === "bot" ? "White to move — you are White." : "White to move");
  },

  _render(status) {
    const root = this._root;
    const state = this._state;
    if (!root || !state) return;

    const panel = document.createElement("div");
    panel.className = "game-panel";
    const app = document.createElement("div");
    app.className = "chess-app";

    const controls = document.createElement("div");
    controls.className = "game-controls";
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn secondary";
    resetBtn.textContent = "New game";
    resetBtn.addEventListener("click", () => this._reset());
    const modeBtn = document.createElement("button");
    modeBtn.className = "btn";
    modeBtn.textContent = this._mode === "bot" ? "Mode: vs Benny Bot" : "Mode: two players";
    modeBtn.addEventListener("click", () => {
      this._mode = this._mode === "bot" ? "local" : "bot";
      this._reset();
    });
    const flipBtn = document.createElement("button");
    flipBtn.className = "btn secondary";
    flipBtn.textContent = "Flip board";
    flipBtn.addEventListener("click", () => {
      this._flipped = !this._flipped;
      this._render(this._statusMessage());
    });
    controls.append(resetBtn, modeBtn, flipBtn);

    const toolbar = document.createElement("div");
    toolbar.className = "chess-toolbar";
    const player = document.createElement("div");
    player.className = "chess-player";
    player.innerHTML = `<span class="chess-avatar">${state.turn === "w" ? "♔" : "♚"}</span><span>${status}</span>`;
    toolbar.appendChild(player);

    const statusEl = document.createElement("p");
    statusEl.className = "game-status";
    statusEl.textContent = this._mode === "bot" ? "Legal moves, check, checkmate, castling, en passant, and promotion are supported." : "Two-player pass-and-play mode.";

    const boardWrap = document.createElement("div");
    boardWrap.className = "chess-board-wrap";
    const board = document.createElement("div");
    board.className = "chess-board";

    const king = findKing(state.board, state.turn);
    const inCheckSquare = king && isSquareAttacked(state.board, king.r, king.c, opposite(state.turn)) ? king : null;
    const order = this._flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

    for (const displayR of order) {
      for (const displayC of order) {
        const r = displayR;
        const c = displayC;
        const square = document.createElement("div");
        square.className = `chess-square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
        if (this._selected && this._selected.r === r && this._selected.c === c) square.classList.add("selected");
        if (inCheckSquare && inCheckSquare.r === r && inCheckSquare.c === c) square.classList.add("check");
        const targetMove = this._legalTargets.find((m) => m.to.r === r && m.to.c === c);
        if (targetMove) {
          square.classList.add("legal");
          if (state.board[r][c]) square.classList.add("has-piece");
        }
        const piece = state.board[r][c];
        if (piece) {
          const pieceEl = document.createElement("span");
          pieceEl.className = `chess-piece ${piece.color === "w" ? "white" : "black"}`;
          pieceEl.textContent = PIECE_UNICODE[piece.color][piece.type];
          square.appendChild(pieceEl);
        }
        square.addEventListener("click", () => this._handleSquareClick(r, c));
        board.appendChild(square);
      }
    }
    boardWrap.appendChild(board);
    app.append(controls, toolbar, boardWrap, statusEl);
    panel.appendChild(app);
    root.replaceChildren(panel);
  }
};

})();
const blockblast = (() => {
const GRID = 8;
const COLORS = ["#ff607c", "#8f6cff", "#4ba7ff", "#52c985", "#f6a33c", "#e65bd2"];
const SHAPES = [
  [[0,0]], [[0,0],[0,1]], [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[1,1],[1,2]], [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]], [[0,1],[1,0],[1,1],[2,0]],
  [[0,0],[0,1],[0,2],[1,0]], [[0,0],[0,1],[0,2],[1,2]],
  [[0,0],[1,0],[1,1],[1,2]], [[0,2],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[1,0],[2,0]], [[0,0],[1,0],[2,0],[2,1]],
  [[0,1],[1,1],[2,0],[2,1]], [[0,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]]
];

function randomPiece() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    used: false
  };
}
function newTray() { return [randomPiece(), randomPiece(), randomPiece()]; }
function emptyGrid() { return Array.from({ length: GRID }, () => Array(GRID).fill(null)); }
function fits(grid, shape, row, col) {
  return shape.every(([dr,dc]) => {
    const r = row + dr, c = col + dc;
    return r >= 0 && r < GRID && c >= 0 && c < GRID && !grid[r][c];
  });
}
function anyPlacementExists(grid, tray) {
  return tray.some((piece) => !piece.used && grid.some((row, r) => row.some((_, c) => fits(grid, piece.shape, r, c))));
}

return {
  _root: null,
  _grid: null,
  _tray: null,
  _selectedPieceId: null,
  _score: 0,
  _combo: 0,
  _best: 0,
  _hoverCell: null,

  mount(root) {
    this._root = root;
    this._best = Number(safeStorage.getItem("sixMonthsBlockBlastBest") || 0);
    this._restart();
  },
  unmount() { this._root = null; },

  _restart() {
    this._grid = emptyGrid();
    this._tray = newTray();
    this._selectedPieceId = null;
    this._score = 0;
    this._combo = 0;
    this._hoverCell = null;
    this._render("Tap a piece below, then tap where you want it on the board.");
  },

  _selectPiece(id) {
    this._selectedPieceId = this._selectedPieceId === id ? null : id;
    this._hoverCell = null;
    this._render(this._selectedPieceId ? "Now tap a square on the board." : "Choose a piece to continue.");
  },

  _previewPlacement(row, col) {
    if (!this._root) return;

    const piece = this._tray.find((item) => item.id === this._selectedPieceId && !item.used);
    const cells = this._root.querySelectorAll(".bb-cell");

    cells.forEach((cell) => {
      cell.classList.remove("preview-ok", "preview-bad");
    });

    this._hoverCell = piece ? { row, col } : null;
    if (!piece) return;

    const valid = fits(this._grid, piece.shape, row, col);
    piece.shape.forEach(([dr, dc]) => {
      const targetRow = row + dr;
      const targetCol = col + dc;
      if (targetRow < 0 || targetRow >= GRID || targetCol < 0 || targetCol >= GRID) return;

      const target = this._root.querySelector(
        `.bb-cell[data-row="${targetRow}"][data-col="${targetCol}"]`
      );
      target?.classList.add(valid ? "preview-ok" : "preview-bad");
    });
  },

  _clearPreview() {
    this._hoverCell = null;
    this._root?.querySelectorAll(".bb-cell").forEach((cell) => {
      cell.classList.remove("preview-ok", "preview-bad");
    });
  },

  _placeAt(row, col) {
    const piece = this._tray.find((p) => p.id === this._selectedPieceId && !p.used);
    if (!piece) return this._render("Choose one of the three pieces first.");
    if (!fits(this._grid, piece.shape, row, col)) return this._render("That piece does not fit there.");

    piece.shape.forEach(([dr,dc]) => { this._grid[row + dr][col + dc] = piece.color; });
    piece.used = true;
    this._selectedPieceId = null;
    this._score += piece.shape.length;

    const rows = [];
    const cols = [];
    for (let r = 0; r < GRID; r++) if (this._grid[r].every(Boolean)) rows.push(r);
    for (let c = 0; c < GRID; c++) if (this._grid.every((line) => line[c])) cols.push(c);
    rows.forEach((r) => { this._grid[r] = Array(GRID).fill(null); });
    cols.forEach((c) => this._grid.forEach((line) => { line[c] = null; }));

    const cleared = rows.length + cols.length;
    if (cleared) {
      this._combo += 1;
      this._score += cleared * 20 * this._combo;
    } else {
      this._combo = 0;
    }

    if (this._score > this._best) {
      this._best = this._score;
      safeStorage.setItem("sixMonthsBlockBlastBest", String(this._best));
    }
    if (this._tray.every((p) => p.used)) this._tray = newTray();
    if (!anyPlacementExists(this._grid, this._tray)) return this._render(`No more moves. Final score: ${this._score}.`);
    this._render(cleared ? `${cleared} line${cleared === 1 ? "" : "s"} cleared · Combo ×${this._combo}!` : "Nice placement.");
  },

  _render(message = "") {
    if (!this._root) return;
    const panel = document.createElement("div");
    panel.className = "game-panel";

    const controls = document.createElement("div");
    controls.className = "game-controls";
    const restart = document.createElement("button");
    restart.className = "btn secondary";
    restart.textContent = "New game";
    restart.addEventListener("click", () => this._restart());
    controls.appendChild(restart);

    const meta = document.createElement("div");
    meta.className = "bb-meta";
    meta.innerHTML = `<span class="bb-chip">Score ${this._score}</span><span class="bb-chip">Best ${this._best}</span><span class="bb-chip">Combo ×${this._combo}</span>`;

    const status = document.createElement("p");
    status.className = "game-status";
    status.textContent = message;

    const layout = document.createElement("div");
    layout.className = "blockblast-layout";
    const board = document.createElement("div");
    board.className = "blockblast-board";
    const selected = this._tray.find((p) => p.id === this._selectedPieceId && !p.used);

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "bb-cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute("aria-label", `Board row ${r + 1}, column ${c + 1}`);

        if (this._grid[r][c]) {
          cell.classList.add("filled");
          cell.style.setProperty("--bb-color", this._grid[r][c]);
        }

        cell.addEventListener("pointerenter", () => {
          this._previewPlacement(r, c);
        });

        cell.addEventListener("focus", () => {
          this._previewPlacement(r, c);
        });

        // Place on pointer-down instead of waiting for click. This works
        // reliably on Safari, phones, tablets, mice, and trackpads.
        cell.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this._placeAt(r, c);
        });

        cell.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          this._placeAt(r, c);
        });

        board.appendChild(cell);
      }
    }

    board.addEventListener("pointerleave", () => this._clearPreview());

    const tray = document.createElement("div");
    tray.className = "blockblast-tray";
    this._tray.forEach((piece) => {
      const pieceEl = document.createElement("button");
      pieceEl.type = "button";
      pieceEl.className = "bb-piece";
      pieceEl.ariaLabel = "Select block piece";
      if (piece.used) pieceEl.classList.add("used");
      if (piece.id === this._selectedPieceId) pieceEl.classList.add("selected");
      const maxR = Math.max(...piece.shape.map(([r]) => r)) + 1;
      const maxC = Math.max(...piece.shape.map(([,c]) => c)) + 1;
      for (let r = 0; r < maxR; r++) {
        const row = document.createElement("div");
        row.className = "bb-piece-row";
        for (let c = 0; c < maxC; c++) {
          const bit = document.createElement("div");
          bit.className = "bb-piece-cell";
          if (piece.shape.some(([sr,sc]) => sr === r && sc === c)) {
            bit.classList.add("on");
            bit.style.setProperty("--piece-color", piece.color);
          }
          row.appendChild(bit);
        }
        pieceEl.appendChild(row);
      }
      pieceEl.addEventListener("click", () => !piece.used && this._selectPiece(piece.id));
      tray.appendChild(pieceEl);
    });

    layout.append(board, tray);
    panel.append(controls, meta, status, layout);
    this._root.replaceChildren(panel);
  }
};

})();
const minecraft = (() => {
const WORLD_RADIUS = 30;
const RENDER_DISTANCE = 27;
const SAVE_KEY = "happySixMonthsBennyWorldV4";
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.28;
const MAX_REACH = 8;

const BLOCKS = {
  grass:   { label: "Grass",   icon: "🌿", top: "#70b84d", side: "#568d3b", dark: "#3f6f2d" },
  dirt:    { label: "Dirt",    icon: "🟫", top: "#a8754e", side: "#8a5e3e", dark: "#68452e" },
  stone:   { label: "Stone",   icon: "🪨", top: "#aaa9a5", side: "#85847f", dark: "#666561" },
  sand:    { label: "Sand",    icon: "🟨", top: "#e6d08a", side: "#cbb36b", dark: "#a58e4f" },
  wood:    { label: "Wood",    icon: "🪵", top: "#c39055", side: "#9e6e3d", dark: "#744d2b" },
  planks:  { label: "Planks",  icon: "🏠", top: "#d0a363", side: "#b17e43", dark: "#865d31" },
  brick:   { label: "Brick",   icon: "🧱", top: "#b95e55", side: "#97453f", dark: "#73332f" },
  glass:   { label: "Glass",   icon: "◇",  top: "rgba(196,232,244,.58)", side: "rgba(142,202,225,.48)", dark: "rgba(95,166,197,.5)" },
  lantern: { label: "Lantern", icon: "🏮", top: "#ffe58a", side: "#e9a93b", dark: "#a96a20" },
  leaves:  { label: "Leaves",  icon: "🍃", top: "#4d9950", side: "#3c7d40", dark: "#2e6534" },
  water:   { label: "Water",   icon: "💧", top: "rgba(73,157,218,.72)", side: "rgba(44,118,178,.66)", dark: "rgba(31,87,143,.7)" },
  flower:  { label: "Flower",  icon: "🌹", top: "#d84662", side: "#a52e45", dark: "#772234" },
  crop:    { label: "Crops",   icon: "🌾", top: "#d9c95a", side: "#9a9a3d", dark: "#6c6e2d" },
  crystal: { label: "Crystal", icon: "💎", top: "#83e4ff", side: "#4eb8dc", dark: "#2e7194" },
  coal:    { label: "Coal",    icon: "⚫", top: "#53515a", side: "#37353c", dark: "#222126" },
  bedrock: { label: "Bedrock", icon: "⬛", top: "#4a4849", side: "#343233", dark: "#242223" }
};

const HOTBAR = ["grass", "dirt", "stone", "wood", "planks", "glass", "brick", "lantern"];
const LANDMARKS = [
  { id: "pond", name: "Moon Pond", x: -14, z: 10, icon: "💧" },
  { id: "meadow", name: "Rose Meadow", x: 15, z: -12, icon: "🌹" },
  { id: "village", name: "Tiny Village", x: 18, z: 15, icon: "🏘️" },
  { id: "tower", name: "Old Lookout", x: -20, z: -17, icon: "🗼" },
  { id: "cave", name: "Crystal Cave", x: 0, z: 24, icon: "💎" }
];
const HOUSE_SITE = { x: -7, z: -10, size: 7, foundationY: 4 };
const HOUSE_REQUIREMENTS = { wood: 12, stone: 8, sand: 4, walls: 20, windows: 4, roof: 12 };
const FACE_DEFS = [
  { n: [0, 1, 0], shade: "top", verts: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]] },
  { n: [0,-1, 0], shade: "dark", verts: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]] },
  { n: [0, 0,-1], shade: "dark", verts: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]] },
  { n: [0, 0, 1], shade: "side", verts: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]] },
  { n: [-1,0, 0], shade: "dark", verts: [[0,0,0],[0,1,0],[0,1,1],[0,0,1]] },
  { n: [1, 0, 0], shade: "side", verts: [[1,0,1],[1,1,1],[1,1,0],[1,0,0]] }
];

function key(x, y, z) { return `${x},${y},${z}`; }
function parseKey(value) { return value.split(",").map(Number); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function hash2(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function seededHeight(x, z) {
  const broad = Math.sin(x * .19) * 1.05 + Math.cos(z * .17) * .9;
  const detail = Math.sin((x + z) * .31) * .5 + Math.cos((x - z) * .27) * .35;
  const mountain = Math.max(0, 1 - Math.hypot(x - 1, z - 23) / 11) * 4.2;
  return clamp(2 + Math.round(broad + detail + mountain), 1, 8);
}

function riverCenter(x) {
  return Math.round(Math.sin((x + 7) * .18) * 4 + 4);
}

function nearPoint(x, z, px, pz, radius) {
  return Math.hypot(x - px, z - pz) <= radius;
}

function createWorld() {
  const world = new Map();
  for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
    for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
      const pond = ((x + 14) ** 2) / 34 + ((z - 10) ** 2) / 24 <= 1;
      const river = x < 7 && Math.abs(z - riverCenter(x)) <= 1;
      const water = pond || river;
      let height = water ? 1 : seededHeight(x, z);

      world.set(key(x, 0, z), "bedrock");
      for (let y = 1; y <= height; y++) {
        let type = "stone";
        if (water && y === height) type = "sand";
        else if (y === height) type = "grass";
        else if (y >= height - 1) type = "dirt";
        world.set(key(x, y, z), type);
      }
      if (water) world.set(key(x, 2, z), "water");
    }
  }

  // A broad forest, with denser tree clusters away from the landmarks.
  for (let x = -27; x <= 27; x += 3) {
    for (let z = -27; z <= 27; z += 3) {
      const reserved = LANDMARKS.some((spot) => nearPoint(x, z, spot.x, spot.z, 5.5)) || nearPoint(x, z, HOUSE_SITE.x + 3, HOUSE_SITE.z + 3, 6);
      const top = topBlockType(world, x, z);
      if (!reserved && top === "grass" && hash2(x, z) > .82) addTree(world, x, z, 4 + Math.floor(hash2(z, x) * 3));
    }
  }

  // A flower meadow and crop field make the map feel more alive.
  for (let x = 10; x <= 21; x++) {
    for (let z = -18; z <= -7; z++) {
      if (hash2(x * 2, z * 3) > .57 && topBlockType(world, x, z) === "grass") {
        world.set(key(x, highestSolid(world, x, z), z), "flower");
      }
    }
  }

  addVillage(world, 16, 13);
  addTower(world, -20, -17);
  addBridge(world, -8);
  addCampfire(world, -2, -5);
  addCrystalCave(world, 0, 24);
  addStarterCabin(world, 5, 3);
  return world;
}

function topBlockType(world, x, z) {
  for (let y = 24; y >= 0; y--) {
    const type = world.get(key(x, y, z));
    if (type && type !== "water" && type !== "flower" && type !== "crop") return type;
  }
  return null;
}

function addTree(world, x, z, trunkHeight = 5) {
  const ground = highestSolid(world, x, z);
  if (ground < 1 || topBlockType(world, x, z) !== "grass") return;
  for (let y = ground; y < ground + trunkHeight; y++) world.set(key(x, y, z), "wood");
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = trunkHeight - 2; dy <= trunkHeight + 1; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - trunkHeight) <= 4) {
          world.set(key(x + dx, ground + dy, z + dz), "leaves");
        }
      }
    }
  }
}

function addHut(world, baseX, baseZ, width = 5, depth = 5) {
  const floorY = Math.max(...Array.from({length: width * depth}, (_, i) => {
    const dx = i % width, dz = Math.floor(i / width);
    return highestSolid(world, baseX + dx, baseZ + dz);
  }));
  for (let dx = 0; dx < width; dx++) for (let dz = 0; dz < depth; dz++) world.set(key(baseX + dx, floorY, baseZ + dz), "planks");
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (!(dx === 2 && dy <= 2)) world.set(key(baseX + dx, floorY + dy, baseZ), "planks");
      world.set(key(baseX + dx, floorY + dy, baseZ + depth - 1), dx === 2 && dy === 2 ? "glass" : "planks");
    }
    for (let dz = 1; dz < depth - 1; dz++) {
      world.set(key(baseX, floorY + dy, baseZ + dz), dy === 2 ? "glass" : "planks");
      world.set(key(baseX + width - 1, floorY + dy, baseZ + dz), dy === 2 ? "glass" : "planks");
    }
  }
  for (let dx = -1; dx <= width; dx++) for (let dz = -1; dz <= depth; dz++) world.set(key(baseX + dx, floorY + 4, baseZ + dz), "brick");
  world.set(key(baseX + 1, floorY + 2, baseZ + 1), "lantern");
}

function addVillage(world, x, z) {
  addHut(world, x, z, 5, 5);
  addHut(world, x + 7, z + 2, 5, 5);
  const wellY = highestSolid(world, x + 5, z + 7);
  for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) world.set(key(x + 4 + dx, wellY, z + 6 + dz), "stone");
  world.set(key(x + 5, wellY + 1, z + 7), "water");
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const gx = x - 2 + col, gz = z + 7 + row;
      if (topBlockType(world, gx, gz) === "grass") world.set(key(gx, highestSolid(world, gx, gz), gz), "crop");
    }
  }
}

function addTower(world, x, z) {
  const y = highestSolid(world, x, z);
  for (let dy = 0; dy < 9; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const doorway = dz === -2 && dx === 0 && dy < 3;
        if (edge && !doorway) world.set(key(x + dx, y + dy, z + dz), dy > 6 ? "brick" : "stone");
      }
    }
  }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (Math.abs(dx) === 3 || Math.abs(dz) === 3) world.set(key(x + dx, y + 9, z + dz), "brick");
  world.set(key(x, y + 10, z), "lantern");
}

function addBridge(world, x) {
  const centerZ = riverCenter(x);
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -2; dx <= 2; dx++) world.set(key(x + dx, 3, centerZ + dz), "planks");
    world.set(key(x - 3, 4, centerZ + dz), "wood");
    world.set(key(x + 3, 4, centerZ + dz), "wood");
  }
  world.set(key(x - 3, 5, centerZ), "lantern");
  world.set(key(x + 3, 5, centerZ), "lantern");
}

function addCampfire(world, x, z) {
  const y = highestSolid(world, x, z);
  for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) world.set(key(x + dx, y, z + dz), "stone");
  world.set(key(x, y, z), "lantern");
  for (let i = -2; i <= 2; i++) {
    world.set(key(x + i, y, z + 3), "planks");
    world.set(key(x + i, y, z - 3), "planks");
  }
}

function addCrystalCave(world, x, z) {
  const base = highestSolid(world, x, z);
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const height = Math.max(0, Math.round(6 - Math.hypot(dx * .8, dz)));
      for (let dy = 0; dy <= height; dy++) world.set(key(x + dx, base + dy, z + dz), hash2(dx, dz) > .88 ? "coal" : "stone");
    }
  }
  // Carve a walkable tunnel from the south side into the hill.
  for (let dz = -7; dz <= 2; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 1; dy <= 3; dy++) world.delete(key(x + dx, base + dy, z + dz));
    }
  }
  const crystals = [[-1,1,1],[1,1,0],[-1,2,-1],[1,2,-2],[0,1,-4],[0,3,-3],[2,1,-3],[-2,1,-2]];
  crystals.forEach(([dx,dy,dz]) => world.set(key(x + dx, base + dy, z + dz), "crystal"));
  world.set(key(x, base + 1, z - 5), "lantern");
}

function addStarterCabin(world, baseX, baseZ) {
  addHut(world, baseX, baseZ, 5, 5);
}

function highestSolid(world, x, z) {
  let highest = 1;
  for (const [id, type] of world) {
    const [bx, by, bz] = parseKey(id);
    if (bx === x && bz === z && type !== "water" && type !== "flower" && type !== "leaves" && type !== "crop") highest = Math.max(highest, by + 1);
  }
  return highest;
}

function shadeColor(hex, amount) {
  if (!hex.startsWith("#")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

return {
  _root: null,
  _canvas: null,
  _ctx: null,
  _world: null,
  _player: null,
  _benny: null,
  _selected: 0,
  _keys: new Set(),
  _raf: null,
  _lastTime: 0,
  _listeners: [],
  _resizeObserver: null,
  _messageTimer: null,
  _target: null,
  _mobileLook: null,
  _lookTargetYaw: 0,
  _lookTargetPitch: 0,
  _bennyRewards: null,
  _adventure: null,
  _animals: [],
  _zoom: .92,
  _zoomTarget: .92,
  _povMode: "first",
  _skyMode: "day",
  _celebration: 0,
  _minimapCanvas: null,
  _minimapCtx: null,
  _minimapBase: null,

  mount(root) {
    this._root = root;
    this._world = this._loadWorld() || createWorld();
    this._player = { x: 0.5, y: highestSolid(this._world, 0, -2), z: -2.5, yaw: 0, pitch: -0.08, vy: 0, grounded: true };
    this._benny = { x: 1.5, z: 1.5, y: highestSolid(this._world, 1, 1), yaw: Math.PI, tamed: this._loadTamed(), phase: 0, petBoost: 0 };
    this._bennyRewards = this._loadRewards();
    this._adventure = this._loadAdventure();
    this._skyMode = this._adventure.skyMode || "day";
    this._povMode = this._adventure.povMode || "first";
    this._animals = this._createAnimals();
    this._zoom = this._povMode === "builder" ? .5 : this._povMode === "third" ? .72 : .92;
    this._zoomTarget = this._zoom;
    this._lookTargetYaw = this._player.yaw;
    this._lookTargetPitch = this._player.pitch;
    this._selected = 0;
    this._keys = new Set();
    this._buildUI();
    this._rebuildMinimap();
    this._bindEvents();
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  },

  unmount() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._messageTimer);
    this._listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    this._listeners = [];
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (document.pointerLockElement === this._canvas) document.exitPointerLock();
    this._saveWorld();
    this._root = null;
    this._canvas = null;
    this._ctx = null;
    this._minimapCanvas = null;
    this._minimapCtx = null;
    this._minimapBase = null;
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.className = "game-panel minecraft-panel";
    panel.innerHTML = `
      <div class="minecraft-shell">
        <div class="minecraft-stage">
          <canvas class="minecraft-canvas" aria-label="Benny's 3D block world"></canvas>
          <div class="minecraft-overlay">
            <div class="mc-topbar">
              <div>
                <div class="mc-stat" data-mc-stat>Creative mode · Benny is nearby</div>
                <div class="mc-quest" data-mc-quest>
                  <span>🍃 Leaves <strong>0/10</strong></span>
                  <span>🪵 Wood <strong>0/5</strong></span>
                  <span>🏠 House <strong>0%</strong></span>
                  <span>💎 Tag <strong>0/6</strong></span>
                </div>
              </div>
              <div class="mc-help">WASD move · mouse look · Space jump · Shift sprint · wheel/Z/X zoom · C changes POV · M tasks · left-click mine · right-click place · E Benny · 1–8 blocks</div>
            </div>
            <aside class="mc-task-drawer" data-mc-task-drawer aria-label="Benny mission drawer">
              <section class="mc-task-drawer-panel">
                <header class="mc-task-drawer-heading">
                  <div>
                    <span>Benny’s Adventure Book</span>
                    <strong data-mc-peek-heading>Mission 1 of 7</strong>
                  </div>
                  <kbd>M</kbd>
                </header>

                <div class="mc-task-now">
                  <small>Current mission</small>
                  <strong data-mc-peek-title>1. Find and tame Benny</strong>
                  <p data-mc-peek-detail>Walk close to Benny and press E.</p>
                  <div class="mc-task-house-progress">
                    <span><i data-mc-peek-progress-bar></i></span>
                    <small data-mc-peek-progress-label>House progress · 0%</small>
                  </div>
                </div>

                <div class="mc-task-drawer-supplies" data-mc-peek-supplies>
                  <span>🪵 <strong>0/12</strong></span>
                  <span>🪨 <strong>0/8</strong></span>
                  <span>🟨 <strong>0/4</strong></span>
                </div>

                <div class="mc-task-drawer-list" aria-label="All ordered missions">
                  <div data-mc-peek-step="1"><b>1</b><span>Tame Benny</span></div>
                  <div data-mc-peek-step="2"><b>2</b><span>Gather supplies</span></div>
                  <div data-mc-peek-step="3"><b>3</b><span>Lay foundation</span></div>
                  <div data-mc-peek-step="4"><b>4</b><span>Raise walls</span></div>
                  <div data-mc-peek-step="5"><b>5</b><span>Add windows</span></div>
                  <div data-mc-peek-step="6"><b>6</b><span>Finish roof</span></div>
                  <div data-mc-peek-step="7"><b>7</b><span>Housewarming</span></div>
                </div>

                <div class="mc-task-drawer-bonus" data-mc-peek-bonus>
                  <span>🍃 Feed <strong>0/10</strong></span>
                  <span>🧸 Toy <strong>0/5</strong></span>
                  <span>💎 Tag <strong>0/6</strong></span>
                </div>
              </section>

              <div class="mc-task-drawer-tab" aria-hidden="true">
                <span>📜</span>
                <strong>Tasks</strong>
                <small>Hover</small>
              </div>
            </aside>
            <canvas class="mc-minimap" data-mc-minimap width="160" height="160" aria-label="Block World minimap"></canvas>
            <div class="mc-zoom-controls" aria-label="Zoom controls">
              <button type="button" data-zoom-out aria-label="Zoom out">−</button>
              <span data-zoom-label>100%</span>
              <button type="button" data-zoom-in aria-label="Zoom in">+</button>
            </div>
            <div class="mc-view-controls" aria-label="Camera view controls">
              <button type="button" data-mc-pov>POV: First person</button>
              <button type="button" data-mc-wide>Wide view</button>
            </div>
            <div class="mc-crosshair"></div>
            <div class="mc-message" data-mc-message></div>
            <div class="mc-interact" data-mc-interact>Press E to tame Benny ♥</div>
            <div class="mc-hotbar" data-mc-hotbar></div>
            <div class="mc-lock-screen" data-mc-lock>
              <div class="mc-lock-card">
                <h3>Enter Benny’s Block World</h3>
                <p>Explore a much larger voxel world with forests, a river, village, tower, meadow, crystal cave, animals, quests, building, mining, day/night, and Benny.</p>
                <button class="mc-start" type="button">Start exploring</button>
              </div>
            </div>
            <div class="mc-mobile-controls" aria-label="Touch controls">
              <div class="mc-pad" aria-label="Movement controls">
                <button class="mc-mobile-btn mc-up" data-move="KeyW" aria-label="Move forward"><strong>W</strong><small>▲</small></button>
                <button class="mc-mobile-btn mc-left" data-move="KeyA" aria-label="Move left"><strong>A</strong><small>◀</small></button>
                <button class="mc-mobile-btn mc-right" data-move="KeyD" aria-label="Move right"><strong>D</strong><small>▶</small></button>
                <button class="mc-mobile-btn mc-down" data-move="KeyS" aria-label="Move backward"><strong>S</strong><small>▼</small></button>
              </div>
              <div class="mc-action-stack" aria-label="Action controls">
                <button data-action="mine"><span>⛏</span><small>Mine</small></button>
                <button data-action="build"><span>▣</span><small>Place</small></button>
                <button data-action="jump"><span>↑</span><small>Jump</small></button>
                <button data-action="tame"><span>🐾</span><small>Benny</small></button>
                <button data-action="pov"><span>◉</span><small>POV</small></button>
                <button data-action="wide"><span>↔</span><small>Wide</small></button>
              </div>
            </div>
          </div>
        </div>
        <div class="mc-benny-panel">
          <img class="mc-benny-photo" src="benny-standing.jpeg" alt="Benny standing happily on his back legs" />
          <div class="mc-benny-copy">
            <h3>Benny’s Adventure Book 🐕</h3>
            <p>Follow the missions in order. The mission board tells you exactly what to collect and what to build next.</p>
            <div class="mc-current-mission" data-current-mission>
              <span>Current mission</span>
              <strong>1. Find and tame Benny</strong>
              <small>Walk close to Benny and press E.</small>
            </div>
            <div class="mc-supply-card">
              <div class="mc-supply-heading"><strong>House supply checklist</strong><small>Mine these before starting the house.</small></div>
              <div class="mc-supply-list" data-house-materials>
                <span>🪵 Wood <strong>0/12</strong></span>
                <span>🪨 Stone <strong>0/8</strong></span>
                <span>🟨 Sand <strong>0/4</strong></span>
              </div>
            </div>
            <div class="mc-mission-board" aria-label="Ordered mission list">
              <div class="mc-mission" data-mission-step="1"><b>1</b><span>🐕</span><div><strong>Tame Benny</strong><small>Find Benny and press E.</small></div></div>
              <div class="mc-mission" data-mission-step="2"><b>2</b><span>⛏️</span><div><strong>Gather supplies</strong><small>12 wood · 8 stone · 4 sand</small></div></div>
              <div class="mc-mission" data-mission-step="3"><b>3</b><span>▦</span><div><strong>Lay the foundation</strong><small>Use the Start House button.</small></div></div>
              <div class="mc-mission" data-mission-step="4"><b>4</b><span>🧱</span><div><strong>Raise the walls</strong><small>Place 20 planks inside the guide.</small></div></div>
              <div class="mc-mission" data-mission-step="5"><b>5</b><span>◇</span><div><strong>Add the windows</strong><small>Place 4 glass blocks.</small></div></div>
              <div class="mc-mission" data-mission-step="6"><b>6</b><span>⌂</span><div><strong>Finish the roof</strong><small>Place 12 planks, stone, or bricks on top.</small></div></div>
              <div class="mc-mission" data-mission-step="7"><b>7</b><span>♥</span><div><strong>Housewarming</strong><small>Celebrate the finished house with Benny.</small></div></div>
            </div>
            <h4 class="mc-bonus-title">Bonus adventures</h4>
            <div class="mc-adventure-grid mc-bonus-grid">
              <div class="mc-activity" data-feed-activity><span>🍃</span><div><strong>Feed Benny</strong><small>Mine 0/10 leaves</small></div></div>
              <div class="mc-activity" data-toy-activity><span>🧸</span><div><strong>Make a toy</strong><small>Mine 0/5 wood</small></div></div>
              <div class="mc-activity" data-explore-activity><span>🧭</span><div><strong>Explore the map</strong><small>0/5 landmarks found</small></div></div>
              <div class="mc-activity" data-crystal-activity><span>💎</span><div><strong>Benny’s shiny tag</strong><small>Mine 0/6 crystals</small></div></div>
            </div>
            <div class="mc-adventure-actions">
              <button class="btn" data-house-start type="button" disabled>Collect supplies first</button>
              <button class="btn secondary" data-mc-time type="button">Switch to sunset</button>
              <button class="btn secondary" data-mc-benny type="button">Go to Benny</button>
              <button class="btn secondary" data-mc-home type="button">Go home</button>
              <button class="btn secondary" data-mc-save type="button">Save world</button>
              <button class="btn secondary" data-mc-reset type="button">New world</button>
            </div>
            <p class="mc-disclaimer">This is a much larger original Minecraft-inspired browser sandbox, not Minecraft, TLauncher, Mojang, or an official clone.</p>
          </div>
        </div>
      </div>`;
    this._root.replaceChildren(panel);
    this._canvas = panel.querySelector(".minecraft-canvas");
    this._ctx = this._canvas.getContext("2d");
    this._minimapCanvas = panel.querySelector("[data-mc-minimap]");
    this._minimapCtx = this._minimapCanvas?.getContext("2d") || null;
    this._renderHotbar();
    this._updateAdventureUI();

    const resize = () => {
      const rect = this._canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      this._canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      this._canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    this._resizeObserver = new ResizeObserver(resize);
    this._resizeObserver.observe(this._canvas);
  },

  _on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push([target, type, handler, options]);
  },

  _bindEvents() {
    const lock = this._root.querySelector("[data-mc-lock]");
    const start = this._root.querySelector(".mc-start");
    const begin = () => {
      lock.style.display = "none";
      if (matchMedia("(pointer:fine)").matches) this._canvas.requestPointerLock?.();
      this._showMessage("Find Benny, then press E to tame him.");
    };
    this._on(start, "click", begin);
    this._on(this._canvas, "click", () => {
      if (matchMedia("(pointer:fine)").matches && !document.pointerLockElement) this._canvas.requestPointerLock?.();
    });
    this._on(document, "pointerlockchange", () => {
      const playing = document.pointerLockElement === this._canvas;
      const drawer = this._root?.querySelector("[data-mc-task-drawer]");
      drawer?.classList.toggle("playing", playing);

      if (!playing && matchMedia("(pointer:fine)").matches) {
        lock.style.display = "grid";
      }
    });

    this._on(document, "keydown", (event) => {
      if (!this._root) return;
      if (["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft"].includes(event.code)) {
        this._keys.add(event.code);
        event.preventDefault();
      }
      if (/^Digit[1-8]$/.test(event.code)) {
        this._selected = Number(event.code.slice(-1)) - 1;
        this._renderHotbar();
      }
      if (event.code === "KeyE") this._interactWithBenny();
      if (event.code === "KeyR") this._saveWorld();
      if (event.code === "KeyZ") this._setZoom(this._zoomTarget - .12);
      if (event.code === "KeyX") this._setZoom(this._zoomTarget + .12);
      if (event.code === "KeyC") this._cyclePov();
      if (event.code === "KeyM") {
        const drawer = this._root.querySelector("[data-mc-task-drawer]");
        drawer?.classList.toggle("manual-collapsed");
        event.preventDefault();
      }
    });
    this._on(document, "keyup", (event) => this._keys.delete(event.code));
    this._on(document, "mousemove", (event) => {
      if (document.pointerLockElement !== this._canvas) return;
      this._lookTargetYaw -= event.movementX * .00215;
      this._lookTargetPitch = clamp(this._lookTargetPitch - event.movementY * .002, -1.25, 1.25);
    });
    this._on(this._canvas, "contextmenu", (event) => event.preventDefault());
    this._on(this._canvas, "mousedown", (event) => {
      if (document.pointerLockElement !== this._canvas) return;
      if (event.button === 0) this._mine();
      if (event.button === 2) this._build();
    });
    this._on(this._canvas, "wheel", (event) => {
      event.preventDefault();
      this._setZoom(this._zoomTarget + (event.deltaY < 0 ? .1 : -.1));
    }, { passive: false });
    this._on(this._root.querySelector("[data-zoom-in]"), "click", () => this._setZoom(this._zoomTarget + .12));
    this._on(this._root.querySelector("[data-zoom-out]"), "click", () => this._setZoom(this._zoomTarget - .12));
    this._on(this._root.querySelector("[data-mc-pov]"), "click", () => this._cyclePov());
    this._on(this._root.querySelector("[data-mc-wide]"), "click", () => this._setZoom(.36));

    // Touch drag controls camera direction. Dragging left now turns left.
    // Camera targets are eased in the animation loop to prevent jerky movement.
    this._on(this._canvas, "pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      event.preventDefault();
      this._canvas.setPointerCapture?.(event.pointerId);
      this._mobileLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }, { passive: false });
    this._on(this._canvas, "pointermove", (event) => {
      if (event.pointerType !== "touch" || !this._mobileLook || event.pointerId !== this._mobileLook.id) return;
      event.preventDefault();
      const dx = clamp(event.clientX - this._mobileLook.x, -36, 36);
      const dy = clamp(event.clientY - this._mobileLook.y, -30, 30);
      this._lookTargetYaw += dx * .0046;
      this._lookTargetPitch = clamp(this._lookTargetPitch - dy * .0039, -1.2, 1.2);
      this._mobileLook.x = event.clientX;
      this._mobileLook.y = event.clientY;
    }, { passive: false });
    const finishTouchLook = (event) => {
      if (!this._mobileLook || (event.pointerId != null && event.pointerId !== this._mobileLook.id)) return;
      this._mobileLook = null;
    };
    this._on(this._canvas, "pointerup", finishTouchLook);
    this._on(this._canvas, "pointercancel", finishTouchLook);

    this._root.querySelectorAll("[data-move]").forEach((button) => {
      const code = button.dataset.move;
      this._on(button, "pointerdown", (event) => { event.preventDefault(); this._keys.add(code); });
      this._on(button, "pointerup", () => this._keys.delete(code));
      this._on(button, "pointercancel", () => this._keys.delete(code));
      this._on(button, "pointerleave", (event) => {
        if (event.pointerType === "touch") this._keys.delete(code);
      });
    });
    this._root.querySelectorAll("[data-action]").forEach((button) => {
      this._on(button, "click", () => {
        const action = button.dataset.action;
        if (action === "jump") this._keys.add("Space"), setTimeout(() => this._keys.delete("Space"), 120);
        if (action === "mine") this._mine();
        if (action === "build") this._build();
        if (action === "tame") this._interactWithBenny();
        if (action === "pov") this._cyclePov();
        if (action === "wide") this._setZoom(.36);
      });
    });
    this._on(this._root.querySelector("[data-house-start]"), "click", () => this._startHouseChallenge());
    this._on(this._root.querySelector("[data-mc-time]"), "click", () => this._cycleSky());
    this._on(this._root.querySelector("[data-mc-benny]"), "click", () => this._teleportNear(this._benny.x, this._benny.z, "Teleported near Benny."));
    this._on(this._root.querySelector("[data-mc-home]"), "click", () => this._teleportNear(6, 1, "Teleported home."));
    this._on(this._root.querySelector("[data-mc-save]"), "click", () => this._saveWorld(true));
    this._on(this._root.querySelector("[data-mc-reset]"), "click", () => {
      if (!confirm("Reset the block world and Benny's tame status?")) return;
      safeStorage.removeItem(SAVE_KEY);
      safeStorage.removeItem(`${SAVE_KEY}:tamed`);
      safeStorage.removeItem(`${SAVE_KEY}:rewards`);
      safeStorage.removeItem(`${SAVE_KEY}:adventure`);
      this._world = createWorld();
      this._benny = { x: 1.5, z: 1.5, y: highestSolid(this._world, 1, 1), yaw: Math.PI, tamed: false, phase: 0, petBoost: 0 };
      this._bennyRewards = { leaves: 0, wood: 0, fed: false, toy: false };
      this._adventure = this._defaultAdventure();
      this._skyMode = "day";
      this._povMode = "first";
      this._animals = this._createAnimals();
      this._player.x = .5; this._player.z = -2.5; this._player.y = highestSolid(this._world, 0, -2);
      this._lookTargetYaw = this._player.yaw;
      this._lookTargetPitch = this._player.pitch;
      this._rebuildMinimap();
      this._updateAdventureUI();
      this._showMessage("A new expanded world has been generated.");
    });
  },

  _renderHotbar() {
    const hotbar = this._root?.querySelector("[data-mc-hotbar]");
    if (!hotbar) return;
    hotbar.replaceChildren(...HOTBAR.map((type, index) => {
      const block = BLOCKS[type];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `mc-slot${index === this._selected ? " active" : ""}`;
      slot.innerHTML = `<span>${index + 1}</span>${block.icon}<small>∞</small>`;
      slot.title = block.label;
      slot.style.pointerEvents = "auto";
      slot.addEventListener("click", () => { this._selected = index; this._renderHotbar(); });
      return slot;
    }));
  },

  _loop(time) {
    if (!this._root) return;
    const dt = Math.min(.045, (time - this._lastTime) / 1000 || 0);
    this._lastTime = time;
    this._update(dt);
    this._draw(time / 1000);
    this._raf = requestAnimationFrame((t) => this._loop(t));
  },

  _update(dt) {
    const p = this._player;
    const lookEase = 1 - Math.exp(-15 * dt);
    p.yaw += (this._lookTargetYaw - p.yaw) * lookEase;
    p.pitch += (this._lookTargetPitch - p.pitch) * lookEase;
    this._zoom += (this._zoomTarget - this._zoom) * (1 - Math.exp(-10 * dt));
    this._celebration = Math.max(0, this._celebration - dt);

    let forward = 0, strafe = 0;
    if (this._keys.has("KeyW")) forward += 1;
    if (this._keys.has("KeyS")) forward -= 1;
    if (this._keys.has("KeyD")) strafe += 1;
    if (this._keys.has("KeyA")) strafe -= 1;
    const len = Math.hypot(forward, strafe) || 1;
    forward /= len; strafe /= len;
    const speed = this._keys.has("ShiftLeft") ? 6.2 : 4.2;
    const dx = (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed * dt;
    const dz = (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed * dt;
    this._moveHorizontal(dx, dz);

    if (this._keys.has("Space") && p.grounded) {
      p.vy = 6.1;
      p.grounded = false;
    }
    p.vy -= 16 * dt;
    p.y += p.vy * dt;
    const ground = this._groundAt(p.x, p.z);
    if (p.y <= ground) {
      p.y = ground;
      p.vy = 0;
      p.grounded = true;
    }
    p.x = clamp(p.x, -WORLD_RADIUS + .4, WORLD_RADIUS + .6);
    p.z = clamp(p.z, -WORLD_RADIUS + .4, WORLD_RADIUS + .6);
    this._updateBenny(dt);
    this._updateAnimals(dt);
    this._checkDiscoveries();
    this._target = this._raycast();

    const near = distance2D(p, this._benny) < 2.7;
    const prompt = this._root.querySelector("[data-mc-interact]");
    prompt.textContent = this._benny.tamed ? "Press E to pet Benny ♥" : "Press E to tame Benny ♥";
    prompt.classList.toggle("show", near);
    const stat = this._root.querySelector("[data-mc-stat]");
    const povLabel = this._povMode === "first" ? "1st person" : this._povMode === "third" ? "3rd person" : "builder view";
    stat.textContent = `${this._benny.tamed ? "Benny tamed ♥" : "Find and tame Benny"} · ${BLOCKS[HOTBAR[this._selected]].label} · ${povLabel}`;

    const quest = this._root.querySelector("[data-mc-quest]");
    if (quest && this._bennyRewards && this._adventure) {
      const houseProgress = this._houseProgress();
      const step = this._missionStep();
      const crystals = Math.min(6, this._adventure.crystals);
      quest.innerHTML = `
        <span class="${this._benny.tamed ? "complete" : ""}">🐕 Benny <strong>${this._benny.tamed ? "Tamed" : "Find him"}</strong></span>
        <span class="${this._suppliesReady() ? "complete" : ""}">⛏ Supplies <strong>${this._suppliesReady() ? "Ready" : "Collect"}</strong></span>
        <span class="${this._adventure.houseComplete ? "complete" : ""}">🏠 House <strong>${houseProgress}%</strong></span>
        <span>📜 Mission <strong>${step}/7</strong></span>
        <span class="${this._adventure.shinyTag ? "complete" : ""}">💎 Tag <strong>${crystals}/6</strong></span>
      `;
    }
    this._updateAdventureUI();
  },

  _moveHorizontal(dx, dz) {
    const p = this._player;
    const currentGround = this._groundAt(p.x, p.z);
    const tryAxis = (nx, nz) => {
      const nextGround = this._groundAt(nx, nz);
      if (nextGround - currentGround > 1.05) return false;
      if (this._bodyBlocked(nx, p.y, nz)) return false;
      p.x = nx; p.z = nz;
      if (p.grounded && nextGround < p.y) p.y = nextGround;
      return true;
    };
    tryAxis(p.x + dx, p.z);
    tryAxis(p.x, p.z + dz);
  },

  _bodyBlocked(x, y, z) {
    const samples = [[-PLAYER_RADIUS,-PLAYER_RADIUS],[PLAYER_RADIUS,-PLAYER_RADIUS],[-PLAYER_RADIUS,PLAYER_RADIUS],[PLAYER_RADIUS,PLAYER_RADIUS]];
    for (const [ox,oz] of samples) {
      const bx = Math.floor(x + ox), bz = Math.floor(z + oz);
      const feet = Math.floor(y + .1), head = Math.floor(y + 1.7);
      for (let by = feet; by <= head; by++) {
        const type = this._world.get(key(bx,by,bz));
        if (type && type !== "water" && type !== "flower" && type !== "leaves" && type !== "crop") return true;
      }
    }
    return false;
  },

  _groundAt(x, z) {
    const bx = Math.floor(x), bz = Math.floor(z);
    let top = 1;
    for (let y = 0; y < 28; y++) {
      const type = this._world.get(key(bx,y,bz));
      if (type && type !== "water" && type !== "flower" && type !== "leaves" && type !== "crop") top = y + 1;
    }
    return top;
  },

  _updateBenny(dt) {
    const b = this._benny;
    b.phase += dt * (b.tamed ? 7 : 3);
    b.petBoost = Math.max(0, b.petBoost - dt);
    let targetX, targetZ, speed;
    if (b.tamed) {
      const side = Math.sin(this._player.yaw) * 1.3;
      targetX = this._player.x - Math.sin(this._player.yaw) * 2.0 + Math.cos(this._player.yaw) * .7;
      targetZ = this._player.z - Math.cos(this._player.yaw) * 2.0 - Math.sin(this._player.yaw) * .7;
      speed = 2.7;
    } else {
      targetX = 1.5 + Math.sin(b.phase * .19) * 2.3;
      targetZ = 1.5 + Math.cos(b.phase * .17) * 2.1;
      speed = .7;
    }
    const vx = targetX - b.x, vz = targetZ - b.z;
    const dist = Math.hypot(vx,vz);
    if (dist > (b.tamed ? 1.5 : .2)) {
      const step = Math.min(dist, speed * dt);
      b.x += vx / dist * step;
      b.z += vz / dist * step;
      b.yaw = Math.atan2(vx, vz);
    }
    b.y = this._groundAt(b.x, b.z);
    if (b.tamed && distance2D(b, this._player) > 16) {
      b.x = this._player.x - Math.sin(this._player.yaw) * 2;
      b.z = this._player.z - Math.cos(this._player.yaw) * 2;
      b.y = this._groundAt(b.x,b.z);
    }
  },

  _createAnimals() {
    return [
      { type: "sheep", x: -5.5, z: -4.5, homeX: -5.5, homeZ: -4.5, yaw: 0, phase: .2 },
      { type: "sheep", x: 10.5, z: -10.5, homeX: 10.5, homeZ: -10.5, yaw: 1, phase: 1.4 },
      { type: "sheep", x: 19.5, z: 11.5, homeX: 19.5, homeZ: 11.5, yaw: 2, phase: 2.3 },
      { type: "duck", x: -14.5, z: 9.5, homeX: -14.5, homeZ: 9.5, yaw: 0, phase: .7 },
      { type: "duck", x: -11.5, z: 11.5, homeX: -11.5, homeZ: 11.5, yaw: 2.2, phase: 1.8 }
    ];
  },

  _updateAnimals(dt) {
    for (const animal of this._animals) {
      animal.phase += dt * (animal.type === "duck" ? 1.1 : .7);
      const targetX = animal.homeX + Math.sin(animal.phase * .57) * 2.4;
      const targetZ = animal.homeZ + Math.cos(animal.phase * .49) * 2.1;
      const dx = targetX - animal.x, dz = targetZ - animal.z;
      const dist = Math.hypot(dx, dz);
      if (dist > .1) {
        const speed = animal.type === "duck" ? .45 : .62;
        animal.x += dx / dist * Math.min(dist, speed * dt);
        animal.z += dz / dist * Math.min(dist, speed * dt);
        animal.yaw = Math.atan2(dx, dz);
      }
      animal.y = this._groundAt(animal.x, animal.z);
    }
  },

  _defaultAdventure() {
    return {
      houseActive: false,
      houseMaterials: { wood: 0, stone: 0, sand: 0 },
      planksPlaced: 0,
      glassPlaced: 0,
      roofPlaced: 0,
      houseComplete: false,
      crystals: 0,
      shinyTag: false,
      discoveries: Object.fromEntries(LANDMARKS.map((spot) => [spot.id, false])),
      skyMode: "day",
      povMode: "first"
    };
  },

  _loadAdventure() {
    const defaults = this._defaultAdventure();
    try {
      const saved = JSON.parse(safeStorage.getItem(`${SAVE_KEY}:adventure`));
      if (!saved || typeof saved !== "object") return defaults;
      const merged = {
        ...defaults,
        ...saved,
        houseMaterials: { ...defaults.houseMaterials, ...(saved.houseMaterials || {}) },
        discoveries: { ...defaults.discoveries, ...(saved.discoveries || {}) }
      };
      if ((merged.houseActive || merged.houseComplete) && !saved.houseMaterials) {
        merged.houseMaterials = {
          wood: HOUSE_REQUIREMENTS.wood,
          stone: HOUSE_REQUIREMENTS.stone,
          sand: HOUSE_REQUIREMENTS.sand
        };
      }
      if (merged.houseComplete) {
        merged.planksPlaced = Math.max(HOUSE_REQUIREMENTS.walls, merged.planksPlaced || 0);
        merged.glassPlaced = Math.max(HOUSE_REQUIREMENTS.windows, merged.glassPlaced || 0);
        merged.roofPlaced = Math.max(HOUSE_REQUIREMENTS.roof, merged.roofPlaced || 0);
      }
      return merged;
    } catch {
      return defaults;
    }
  },

  _saveAdventure() {
    if (!this._adventure) return;
    this._adventure.skyMode = this._skyMode;
    this._adventure.povMode = this._povMode;
    try { safeStorage.setItem(`${SAVE_KEY}:adventure`, JSON.stringify(this._adventure)); } catch (_error) {}
  },

  _suppliesReady() {
    const materials = this._adventure?.houseMaterials || {};
    return (materials.wood || 0) >= HOUSE_REQUIREMENTS.wood &&
      (materials.stone || 0) >= HOUSE_REQUIREMENTS.stone &&
      (materials.sand || 0) >= HOUSE_REQUIREMENTS.sand;
  },

  _missionStep() {
    if (this._adventure?.houseComplete) return 7;
    if (!this._benny?.tamed) return 1;
    if (!this._suppliesReady()) return 2;
    if (!this._adventure?.houseActive) return 3;
    if ((this._adventure.planksPlaced || 0) < HOUSE_REQUIREMENTS.walls) return 4;
    if ((this._adventure.glassPlaced || 0) < HOUSE_REQUIREMENTS.windows) return 5;
    if ((this._adventure.roofPlaced || 0) < HOUSE_REQUIREMENTS.roof) return 6;
    return 7;
  },

  _houseProgress() {
    if (!this._adventure) return 0;
    const materials = this._adventure.houseMaterials || {};
    const supplyPart = (
      Math.min(1, (materials.wood || 0) / HOUSE_REQUIREMENTS.wood) +
      Math.min(1, (materials.stone || 0) / HOUSE_REQUIREMENTS.stone) +
      Math.min(1, (materials.sand || 0) / HOUSE_REQUIREMENTS.sand)
    ) / 3;
    if (!this._adventure.houseActive) return Math.round(supplyPart * 25);
    const wallPart = Math.min(1, (this._adventure.planksPlaced || 0) / HOUSE_REQUIREMENTS.walls);
    const glassPart = Math.min(1, (this._adventure.glassPlaced || 0) / HOUSE_REQUIREMENTS.windows);
    const roofPart = Math.min(1, (this._adventure.roofPlaced || 0) / HOUSE_REQUIREMENTS.roof);
    return Math.round(25 + wallPart * 40 + glassPart * 15 + roofPart * 20);
  },

  _updateAdventureUI() {
    if (!this._root || !this._adventure) return;
    const step = this._missionStep();
    const materials = this._adventure.houseMaterials || { wood: 0, stone: 0, sand: 0 };
    const missionCopy = {
      1: ["1. Find and tame Benny", "Walk close to Benny and press E."],
      2: ["2. Gather the house supplies", `Mine ${HOUSE_REQUIREMENTS.wood} wood, ${HOUSE_REQUIREMENTS.stone} stone, and ${HOUSE_REQUIREMENTS.sand} sand.`],
      3: ["3. Lay the foundation", "Press Start House Challenge. The foundation and guide will appear."],
      4: ["4. Raise the walls", `Place ${HOUSE_REQUIREMENTS.walls} planks inside the glowing guide.`],
      5: ["5. Add the windows", `Place ${HOUSE_REQUIREMENTS.windows} glass blocks in the walls.`],
      6: ["6. Finish the roof", `Place ${HOUSE_REQUIREMENTS.roof} planks, stone, or bricks across the top.`],
      7: ["7. Housewarming complete!", "Benny has a finished home. Explore and finish the bonus adventures."]
    };
    const current = this._root.querySelector("[data-current-mission]");
    if (current) {
      current.querySelector("strong").textContent = missionCopy[step][0];
      current.querySelector("small").textContent = missionCopy[step][1];
      current.classList.toggle("complete", step === 7);
    }

    const peekHeading = this._root.querySelector("[data-mc-peek-heading]");
    const peekTitle = this._root.querySelector("[data-mc-peek-title]");
    const peekDetail = this._root.querySelector("[data-mc-peek-detail]");
    const peekProgressBar = this._root.querySelector("[data-mc-peek-progress-bar]");
    const peekProgressLabel = this._root.querySelector("[data-mc-peek-progress-label]");
    const housePercent = this._houseProgress();

    if (peekHeading) peekHeading.textContent = `Mission ${step} of 7`;
    if (peekTitle) peekTitle.textContent = missionCopy[step][0];
    if (peekDetail) peekDetail.textContent = missionCopy[step][1];
    if (peekProgressBar) peekProgressBar.style.width = `${housePercent}%`;
    if (peekProgressLabel) peekProgressLabel.textContent = `House progress · ${housePercent}%`;

    this._root.querySelectorAll("[data-mc-peek-step]").forEach((row) => {
      const rowStep = Number(row.dataset.mcPeekStep);
      row.classList.toggle("active", rowStep === step);
      row.classList.toggle("complete", rowStep < step || (rowStep === 7 && this._adventure.houseComplete));
      row.classList.toggle("locked", rowStep > step);
    });

    this._root.querySelectorAll("[data-mission-step]").forEach((row) => {
      const rowStep = Number(row.dataset.missionStep);
      row.classList.toggle("active", rowStep === step);
      row.classList.toggle("complete", rowStep < step || (rowStep === 7 && this._adventure.houseComplete));
      row.classList.toggle("locked", rowStep > step);
    });

    const supplyList = this._root.querySelector("[data-house-materials]");
    if (supplyList) {
      const values = [
        ["🪵", "Wood", materials.wood || 0, HOUSE_REQUIREMENTS.wood],
        ["🪨", "Stone", materials.stone || 0, HOUSE_REQUIREMENTS.stone],
        ["🟨", "Sand", materials.sand || 0, HOUSE_REQUIREMENTS.sand]
      ];
      supplyList.innerHTML = values.map(([icon, label, value, target]) =>
        `<span class="${value >= target ? "complete" : ""}">${icon} ${label} <strong>${Math.min(value, target)}/${target}</strong></span>`
      ).join("");
    }

    const peekSupplies = this._root.querySelector("[data-mc-peek-supplies]");
    if (peekSupplies) {
      const supplyValues = [
        ["🪵", materials.wood || 0, HOUSE_REQUIREMENTS.wood],
        ["🪨", materials.stone || 0, HOUSE_REQUIREMENTS.stone],
        ["🟨", materials.sand || 0, HOUSE_REQUIREMENTS.sand]
      ];

      peekSupplies.innerHTML = supplyValues.map(([icon, value, target]) =>
        `<span class="${value >= target ? "complete" : ""}">${icon} <strong>${Math.min(value, target)}/${target}</strong></span>`
      ).join("");
    }

    const startButton = this._root.querySelector("[data-house-start]");
    if (startButton) {
      if (this._adventure.houseComplete) {
        startButton.disabled = true;
        startButton.textContent = "House complete ♥";
      } else if (this._adventure.houseActive) {
        startButton.disabled = true;
        startButton.textContent = "House challenge active";
      } else if (!this._benny.tamed) {
        startButton.disabled = true;
        startButton.textContent = "Tame Benny first";
      } else if (!this._suppliesReady()) {
        startButton.disabled = true;
        startButton.textContent = "Collect house supplies";
      } else {
        startButton.disabled = false;
        startButton.textContent = "Start house challenge";
      }
    }

    const feed = this._root.querySelector("[data-feed-activity]");
    const toy = this._root.querySelector("[data-toy-activity]");
    const explore = this._root.querySelector("[data-explore-activity]");
    const crystal = this._root.querySelector("[data-crystal-activity]");
    const found = Object.values(this._adventure.discoveries).filter(Boolean).length;
    if (feed) {
      feed.classList.toggle("complete", this._bennyRewards?.fed);
      feed.querySelector("small").textContent = this._bennyRewards?.fed ? "Benny has been fed!" : `Mine ${Math.min(10, this._bennyRewards?.leaves || 0)}/10 leaves`;
    }
    if (toy) {
      toy.classList.toggle("complete", this._bennyRewards?.toy);
      toy.querySelector("small").textContent = this._bennyRewards?.toy ? "Benny has his toy!" : `Mine ${Math.min(5, this._bennyRewards?.wood || 0)}/5 wood`;
    }
    if (explore) {
      explore.classList.toggle("complete", found === LANDMARKS.length);
      explore.querySelector("small").textContent = `${found}/${LANDMARKS.length} landmarks found`;
    }
    if (crystal) {
      crystal.classList.toggle("complete", this._adventure.shinyTag);
      crystal.querySelector("small").textContent = this._adventure.shinyTag
        ? "Benny is wearing his shiny tag!"
        : `Mine ${Math.min(6, this._adventure.crystals)}/6 crystals in the cave`;
    }
    const peekBonus = this._root.querySelector("[data-mc-peek-bonus]");
    if (peekBonus) {
      const leafCount = Math.min(10, this._bennyRewards?.leaves || 0);
      const toyCount = Math.min(5, this._bennyRewards?.wood || 0);
      const crystalCount = Math.min(6, this._adventure.crystals || 0);

      peekBonus.innerHTML = `
        <span class="${this._bennyRewards?.fed ? "complete" : ""}">🍃 Feed <strong>${leafCount}/10</strong></span>
        <span class="${this._bennyRewards?.toy ? "complete" : ""}">🧸 Toy <strong>${toyCount}/5</strong></span>
        <span class="${this._adventure.shinyTag ? "complete" : ""}">💎 Tag <strong>${crystalCount}/6</strong></span>
      `;
    }

    const timeButton = this._root.querySelector("[data-mc-time]");
    if (timeButton) {
      const next = this._skyMode === "day" ? "sunset" : this._skyMode === "sunset" ? "night" : "day";
      timeButton.textContent = `Switch to ${next}`;
    }
    this._updateViewUI();
  },

  _startHouseChallenge() {
    if (!this._benny.tamed) return this._showMessage("Tame Benny before building his house.");
    if (!this._suppliesReady()) return this._showMessage(`Collect ${HOUSE_REQUIREMENTS.wood} wood, ${HOUSE_REQUIREMENTS.stone} stone, and ${HOUSE_REQUIREMENTS.sand} sand first.`);
    const { x, z, size, foundationY } = HOUSE_SITE;
    for (let dx = -1; dx <= size; dx++) {
      for (let dz = -1; dz <= size; dz++) {
        for (let y = 1; y <= 18; y++) this._world.delete(key(x + dx, y, z + dz));
        this._world.set(key(x + dx, 1, z + dz), "dirt");
        this._world.set(key(x + dx, 2, z + dz), "dirt");
        this._world.set(key(x + dx, 3, z + dz), "grass");
      }
    }
    for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) this._world.set(key(x + dx, foundationY, z + dz), "planks");
    this._adventure.houseActive = true;
    this._adventure.planksPlaced = 0;
    this._adventure.glassPlaced = 0;
    this._adventure.roofPlaced = 0;
    this._adventure.houseComplete = false;
    this._selected = HOTBAR.indexOf("planks");
    this._renderHotbar();
    this._teleportNear(x + 3, z - 3, `Foundation ready. Mission 4: place ${HOUSE_REQUIREMENTS.walls} planks inside the glowing guide.`);
    this._rebuildMinimap();
    this._saveAdventure();
    this._updateAdventureUI();
  },

  _isInsideHouseSite(x, y, z) {
    return this._adventure?.houseActive &&
      x >= HOUSE_SITE.x && x < HOUSE_SITE.x + HOUSE_SITE.size &&
      z >= HOUSE_SITE.z && z < HOUSE_SITE.z + HOUSE_SITE.size &&
      y >= HOUSE_SITE.foundationY + 1 && y <= HOUSE_SITE.foundationY + 5;
  },

  _checkHouseCompletion() {
    if (!this._adventure.houseActive || this._adventure.houseComplete) return;
    if (this._adventure.planksPlaced >= HOUSE_REQUIREMENTS.walls &&
        this._adventure.glassPlaced >= HOUSE_REQUIREMENTS.windows &&
        this._adventure.roofPlaced >= HOUSE_REQUIREMENTS.roof) {
      this._adventure.houseComplete = true;
      this._celebration = 8;
      this._benny.petBoost = 6;
      this._showMessage("House complete! Benny is celebrating the housewarming with you! 🏠♥");
      this._saveAdventure();
      this._updateAdventureUI();
    }
  },

  _checkDiscoveries() {
    if (!this._adventure) return;
    for (const spot of LANDMARKS) {
      if (this._adventure.discoveries[spot.id]) continue;
      if (Math.hypot(this._player.x - spot.x, this._player.z - spot.z) < 5) {
        this._adventure.discoveries[spot.id] = true;
        this._celebration = 2.4;
        this._showMessage(`${spot.icon} Landmark discovered: ${spot.name}`);
        this._saveAdventure();
        this._updateAdventureUI();
      }
    }
  },

  _cycleSky() {
    this._skyMode = this._skyMode === "day" ? "sunset" : this._skyMode === "sunset" ? "night" : "day";
    this._saveAdventure();
    this._updateAdventureUI();
    this._showMessage(`${this._skyMode[0].toUpperCase() + this._skyMode.slice(1)} mode enabled.`);
  },

  _cyclePov() {
    const modes = ["first", "third", "builder"];
    this._povMode = modes[(modes.indexOf(this._povMode) + 1) % modes.length];
    if (this._povMode === "first") {
      this._lookTargetPitch = clamp(this._lookTargetPitch, -.85, .85);
      this._setZoom(.92);
      this._showMessage("First-person view enabled.");
    } else if (this._povMode === "third") {
      this._lookTargetPitch = -.2;
      this._setZoom(.68);
      this._showMessage("Third-person view enabled. You can see your character.");
    } else {
      this._lookTargetPitch = -.72;
      this._setZoom(.46);
      this._showMessage("Builder view enabled. Zoomed out for house construction.");
    }
    this._saveAdventure();
    this._updateViewUI();
  },

  _updateViewUI() {
    const labels = { first: "First person", third: "Third person", builder: "Builder view" };
    const button = this._root?.querySelector("[data-mc-pov]");
    if (button) button.textContent = `POV: ${labels[this._povMode] || labels.first}`;
    const label = this._root?.querySelector("[data-zoom-label]");
    if (label) label.textContent = `${Math.round(this._zoomTarget / .92 * 100)}%`;
  },

  _setZoom(value) {
    this._zoomTarget = clamp(value, .32, 1.7);
    this._updateViewUI();
  },

  _teleportNear(x, z, message) {
    const px = clamp(x, -WORLD_RADIUS + 1, WORLD_RADIUS - 1);
    const pz = clamp(z, -WORLD_RADIUS + 1, WORLD_RADIUS - 1);
    this._player.x = px;
    this._player.z = pz;
    this._player.y = this._groundAt(px, pz);
    this._player.vy = 0;
    this._player.grounded = true;
    this._showMessage(message);
  },

  _interactWithBenny() {
    if (distance2D(this._player, this._benny) >= 3) return this._showMessage("Benny is too far away. Walk closer.");
    if (!this._benny.tamed) {
      this._benny.tamed = true;
      safeStorage.setItem(`${SAVE_KEY}:tamed`, "true");
      this._benny.petBoost = 2;
      this._showMessage("Benny is tamed! He will follow you everywhere. ♥");
      this._saveAdventure();
      this._updateAdventureUI();
    } else {
      this._benny.petBoost = 2;
      this._showMessage("You pet Benny. His tail is going wild! 🐕");
    }
  },

  _viewDirection() {
    const cp = Math.cos(this._player.pitch);
    return {
      x: Math.sin(this._player.yaw) * cp,
      y: Math.sin(this._player.pitch),
      z: Math.cos(this._player.yaw) * cp
    };
  },

  _raycast() {
    const dir = this._viewDirection();
    const origin = { x: this._player.x, y: this._player.y + EYE_HEIGHT, z: this._player.z };
    let previous = { x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z) };
    for (let t = .1; t <= MAX_REACH; t += .055) {
      const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
      const cell = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
      if (cell.x === previous.x && cell.y === previous.y && cell.z === previous.z) continue;
      const type = this._world.get(key(cell.x,cell.y,cell.z));
      if (type && type !== "water" && type !== "flower") return { hit: cell, place: previous, type };
      previous = cell;
    }
    return null;
  },

  _mine() {
    const target = this._raycast();
    if (!target) return this._showMessage("No block within reach.");
    if (target.hit.y === 0 || target.type === "bedrock") return this._showMessage("Bedrock cannot be mined.");
    this._world.delete(key(target.hit.x,target.hit.y,target.hit.z));
    this._rebuildMinimap();

    if (target.type === "crystal") {
      this._adventure.crystals = Math.min(6, this._adventure.crystals + 1);
      if (this._adventure.crystals >= 6 && !this._adventure.shinyTag) {
        this._adventure.shinyTag = true;
        this._benny.petBoost = 6;
        this._celebration = 6;
        this._showMessage("You crafted Benny a shiny crystal tag! 💎🐕");
      } else {
        this._showMessage(`Crystal collected · ${this._adventure.crystals}/6`);
      }
      this._saveAdventure();
      this._updateAdventureUI();
      return;
    }

    const houseMessage = this._collectHouseMaterial(target.type);
    let bennyMessage = "";
    if (target.type === "leaves" || target.type === "wood") {
      bennyMessage = this._collectForBenny(target.type, true);
    }
    this._showMessage([houseMessage, bennyMessage].filter(Boolean).join(" · ") || `${BLOCKS[target.type]?.label || target.type} mined.`);
    this._updateAdventureUI();
  },

  _collectHouseMaterial(type) {
    if (!this._adventure || this._adventure.houseActive || this._adventure.houseComplete) return "";
    if (!this._benny?.tamed) return "";
    if (!["wood", "stone", "sand"].includes(type)) return "";
    const target = HOUSE_REQUIREMENTS[type];
    const current = this._adventure.houseMaterials[type] || 0;
    if (current >= target) return `${BLOCKS[type].label} mined`;
    this._adventure.houseMaterials[type] = Math.min(target, current + 1);
    this._saveAdventure();
    const value = this._adventure.houseMaterials[type];
    if (this._suppliesReady()) {
      this._celebration = 3;
      return `All house supplies collected! Press Start House Challenge`;
    }
    return `${BLOCKS[type].label} for the house ${value}/${target}`;
  },

  _collectForBenny(type, returnOnly = false) {
    const rewards = this._bennyRewards;
    if (!rewards) return "";
    let message = "";

    if (type === "leaves" && !rewards.fed) {
      rewards.leaves += 1;
      if (rewards.leaves >= 10) {
        rewards.leaves = 10;
        rewards.fed = true;
        this._benny.petBoost = 4;
        message = "You mined 10 leaves and fed Benny! 🍃🐕";
      } else {
        message = `Leaf for Benny ${rewards.leaves}/10`;
      }
    } else if (type === "wood" && !rewards.toy) {
      rewards.wood += 1;
      if (rewards.wood >= 5) {
        rewards.wood = 5;
        rewards.toy = true;
        this._benny.petBoost = 4;
        message = "You mined 5 wood blocks and made Benny a toy! 🪵🧸";
      } else {
        message = `Wood for Benny’s toy ${rewards.wood}/5`;
      }
    }

    this._saveRewards();
    if (!returnOnly && message) this._showMessage(message);
    return message;
  },

  _build() {
    const target = this._raycast();
    if (!target) return this._showMessage("Look at a block before building.");
    const { x,y,z } = target.place;
    if (y < 0 || y > 14) return;
    const nearPlayer = Math.abs(this._player.x - (x + .5)) < .75 && Math.abs(this._player.z - (z + .5)) < .75 && y >= Math.floor(this._player.y) && y <= Math.floor(this._player.y + 1.8);
    const nearBenny = Math.abs(this._benny.x - (x + .5)) < .7 && Math.abs(this._benny.z - (z + .5)) < .7 && y <= this._benny.y + 1;
    if (nearPlayer || nearBenny) return this._showMessage("That space is occupied.");
    const type = HOTBAR[this._selected];
    this._world.set(key(x,y,z), type);
    this._rebuildMinimap();
    if (this._isInsideHouseSite(x, y, z)) {
      const roofLevel = HOUSE_SITE.foundationY + 4;
      const missionBefore = this._missionStep();
      let counted = false;

      if (missionBefore === 4 && y < roofLevel && ["planks", "wood", "brick"].includes(type)) {
        this._adventure.planksPlaced += 1;
        counted = true;
      } else if (missionBefore === 5 && y < roofLevel && type === "glass") {
        this._adventure.glassPlaced += 1;
        counted = true;
      } else if (missionBefore === 6 && y >= roofLevel && ["planks", "stone", "brick"].includes(type)) {
        this._adventure.roofPlaced += 1;
        counted = true;
      }

      if (!counted) {
        const guidance = missionBefore === 4
          ? "Mission 4: use planks, wood, or brick below the roof line."
          : missionBefore === 5
            ? "Mission 5: select glass and place four windows in the walls."
            : missionBefore === 6
              ? "Mission 6: place planks, stone, or brick across the glowing roof guide."
              : "Follow the active mission shown in Benny’s Adventure Book.";
        this._showMessage(guidance);
        return;
      }

      this._checkHouseCompletion();
      this._saveAdventure();
      this._updateAdventureUI();
      const step = this._missionStep();
      if (missionBefore === 4 && step === 5) {
        this._selected = HOTBAR.indexOf("glass");
        this._renderHotbar();
        this._showMessage("Walls complete! Glass selected — now add 4 windows.");
      } else if (missionBefore === 5 && step === 6) {
        this._selected = HOTBAR.indexOf("planks");
        this._renderHotbar();
        this._showMessage("Windows complete! Planks selected — now build the roof.");
      } else {
        const nextText = step === 4
          ? `Walls ${Math.min(HOUSE_REQUIREMENTS.walls, this._adventure.planksPlaced)}/${HOUSE_REQUIREMENTS.walls}`
          : step === 5
            ? `Windows ${Math.min(HOUSE_REQUIREMENTS.windows, this._adventure.glassPlaced)}/${HOUSE_REQUIREMENTS.windows}`
            : step === 6
              ? `Roof ${Math.min(HOUSE_REQUIREMENTS.roof, this._adventure.roofPlaced)}/${HOUSE_REQUIREMENTS.roof}`
              : "House complete";
        this._showMessage(nextText);
      }
    } else {
      this._showMessage(`${BLOCKS[type].label} placed.`);
    }
  },

  _cameraPose() {
    const p = this._player;
    if (this._povMode === "third") {
      const distance = 6.2;
      return {
        x: p.x - Math.sin(p.yaw) * distance,
        y: p.y + 3.1,
        z: p.z - Math.cos(p.yaw) * distance,
        yaw: p.yaw,
        pitch: clamp(p.pitch * .45 - .12, -.7, .45)
      };
    }
    if (this._povMode === "builder") {
      const distance = 9.5;
      return {
        x: p.x - Math.sin(p.yaw) * distance,
        y: p.y + 11.5,
        z: p.z - Math.cos(p.yaw) * distance,
        yaw: p.yaw,
        pitch: -.72
      };
    }
    return { x: p.x, y: p.y + EYE_HEIGHT, z: p.z, yaw: p.yaw, pitch: p.pitch };
  },

  _cameraTransform(point) {
    const camera = this._cameraPose();
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const x1 = cy * dx - sy * dz;
    const z1 = sy * dx + cy * dz;
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const y2 = cp * dy - sp * z1;
    const z2 = sp * dy + cp * z1;
    return { x: x1, y: y2, z: z2 };
  },

  _project(point, width, height) {
    const v = this._cameraTransform(point);
    if (v.z <= .08) return null;
    const focal = Math.min(width, height) * this._zoom;
    return { x: width / 2 + v.x * focal / v.z, y: height / 2 - v.y * focal / v.z, z: v.z };
  },

  _draw(time) {
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    ctx.clearRect(0,0,width,height);

    const sky = ctx.createLinearGradient(0,0,0,height);
    if (this._skyMode === "night") {
      sky.addColorStop(0,"#071426");
      sky.addColorStop(.58,"#17395a");
      sky.addColorStop(.59,"#273f43");
      sky.addColorStop(1,"#334d35");
    } else if (this._skyMode === "sunset") {
      sky.addColorStop(0,"#4d315f");
      sky.addColorStop(.45,"#da6e67");
      sky.addColorStop(.59,"#f6bb79");
      sky.addColorStop(1,"#667548");
    } else {
      sky.addColorStop(0,"#79bce9");
      sky.addColorStop(.58,"#c4e6f6");
      sky.addColorStop(.59,"#d8e8ce");
      sky.addColorStop(1,"#688f54");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,width,height);
    this._drawSky(ctx,width,height,time);

    const faces = [];
    const px = this._player.x, pz = this._player.z;
    for (const [id,type] of this._world) {
      const [x,y,z] = parseKey(id);
      if ((x - px) ** 2 + (z - pz) ** 2 > RENDER_DISTANCE ** 2) continue;
      for (const face of FACE_DEFS) {
        const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
        const neighbor = this._world.get(key(nx,ny,nz));
        if (neighbor && !(type === "water" && neighbor !== "water") && !(type === "glass" && neighbor !== "glass")) continue;
        const points3 = face.verts.map(([vx,vy,vz]) => ({ x:x+vx, y:y+vy, z:z+vz }));
        const projected = points3.map((point) => this._project(point,width,height));
        if (projected.some((point) => !point)) continue;
        const depth = projected.reduce((sum,p) => sum+p.z,0) / projected.length;
        const block = BLOCKS[type] || BLOCKS.dirt;
        faces.push({ projected, depth, fill: block[face.shade] || block.side, type, x,y,z });
      }
    }
    this._addPlayerFaces(faces,width,height,time);
    this._addBennyFaces(faces,width,height,time);
    this._addAnimalFaces(faces,width,height,time);
    this._addHouseGuideFaces(faces,width,height,time);
    faces.sort((a,b) => b.depth - a.depth);

    for (const face of faces) {
      ctx.beginPath();
      ctx.moveTo(face.projected[0].x, face.projected[0].y);
      for (let i=1;i<face.projected.length;i++) ctx.lineTo(face.projected[i].x,face.projected[i].y);
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      ctx.strokeStyle = face.model ? "rgba(35,18,20,.32)" : "rgba(30,20,20,.16)";
      ctx.lineWidth = face.model ? 1.2 : .6;
      ctx.stroke();
      if (face.type === "glass") {
        ctx.strokeStyle = "rgba(255,255,255,.5)";
        ctx.stroke();
      }
      if (face.type === "lantern") {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,201,77,.18)";
        ctx.fill();
        ctx.restore();
      }
    }

    this._drawBennyName(ctx,width,height);
    this._drawTargetOutline(ctx,width,height);
    this._drawCelebration(ctx,width,height,time);
    this._renderMinimap();
  },

  _drawSky(ctx,width,height,time) {
    ctx.save();
    if (this._skyMode === "night") {
      ctx.fillStyle = "rgba(245,248,224,.92)";
      ctx.beginPath();
      ctx.arc(width * .82, height * .18, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.82)";
      for (let i = 0; i < 48; i++) {
        const x = (i * 97) % Math.max(1, width);
        const y = 18 + ((i * 53) % Math.max(40, Math.floor(height * .48)));
        const r = i % 7 === 0 ? 1.7 : .8;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = this._skyMode === "sunset" ? "rgba(255,202,117,.94)" : "rgba(255,245,190,.94)";
      ctx.beginPath();
      ctx.arc(width * .82, height * (this._skyMode === "sunset" ? .38 : .18), 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = this._skyMode === "night" ? "rgba(190,207,226,.35)" : "rgba(255,255,255,.7)";
    const drift = (time * 6) % (width + 240) - 120;
    for (let i=0;i<3;i++) {
      const x = (drift + i * width * .48) % (width + 180) - 90;
      const y = 60 + i * 48;
      ctx.beginPath();
      ctx.ellipse(x,y,55,18,0,0,Math.PI*2);
      ctx.ellipse(x+38,y+3,42,14,0,0,Math.PI*2);
      ctx.ellipse(x-38,y+4,34,12,0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  },

  _modelBox(faces, center, size, color, yaw, width, height) {
    const [sx,sy,sz] = size;
    const corners = [];
    for (const [x,y,z] of [[-.5,0,-.5],[.5,0,-.5],[.5,1,-.5],[-.5,1,-.5],[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]]) {
      const lx=x*sx, ly=y*sy, lz=z*sz;
      corners.push({
        x:center.x + Math.cos(yaw)*lx + Math.sin(yaw)*lz,
        y:center.y + ly,
        z:center.z - Math.sin(yaw)*lx + Math.cos(yaw)*lz
      });
    }
    const faceIndices = [
      [3,2,6,7,"top"],[0,4,5,1,"dark"],[0,1,2,3,"dark"],[4,7,6,5,"side"],[0,3,7,4,"dark"],[1,5,6,2,"side"]
    ];
    for (const [a,b,c,d,shade] of faceIndices) {
      const projected=[corners[a],corners[b],corners[c],corners[d]].map((p)=>this._project(p,width,height));
      if (projected.some((p)=>!p)) continue;
      const depth=projected.reduce((s,p)=>s+p.z,0)/4;
      const fill=shade==="top"?shadeColor(color,20):shade==="dark"?shadeColor(color,-28):color;
      faces.push({ projected, depth, fill, model:true });
    }
  },

  _addPlayerFaces(faces,width,height,time) {
    if (this._povMode === "first") return;
    const p = this._player;
    const walking = this._keys.has("KeyW") || this._keys.has("KeyA") || this._keys.has("KeyS") || this._keys.has("KeyD");
    const swing = walking ? Math.sin(time * 9) * .1 : 0;
    const base = { x: p.x, y: p.y, z: p.z };
    const local = (side, up, front) => ({
      x: base.x + Math.cos(p.yaw) * side + Math.sin(p.yaw) * front,
      y: base.y + up,
      z: base.z - Math.sin(p.yaw) * side + Math.cos(p.yaw) * front
    });
    this._modelBox(faces, local(0,.76,0), [.56,.72,.34], "#8f1730", p.yaw, width, height);
    this._modelBox(faces, local(0,1.48,.02), [.48,.48,.48], "#d7ae91", p.yaw, width, height);
    this._modelBox(faces, local(-.17,.05,swing), [.2,.72,.24], "#34303d", p.yaw, width, height);
    this._modelBox(faces, local(.17,.05,-swing), [.2,.72,.24], "#34303d", p.yaw, width, height);
    this._modelBox(faces, local(-.39,.72,-swing), [.18,.68,.2], "#d7ae91", p.yaw, width, height);
    this._modelBox(faces, local(.39,.72,swing), [.18,.68,.2], "#d7ae91", p.yaw, width, height);
  },

  _addBennyFaces(faces,width,height,time) {
    const b=this._benny;
    const moving = b.tamed ? distance2D(b,this._player)>1.7 : true;
    const walk = moving ? Math.sin(b.phase*1.7)*.07 : 0;
    const bounce = moving ? Math.abs(Math.sin(b.phase*1.7))*.05 : 0;
    const base={x:b.x,y:b.y+bounce,z:b.z};
    const tan="#d5b58c", cream="#ead7bb", dark="#5c3d36", collar=this._adventure?.shinyTag?"#f1d36c":"#8f1730";
    const local=(side,up,front)=>({
      x:base.x+Math.cos(b.yaw)*side+Math.sin(b.yaw)*front,
      y:base.y+up,
      z:base.z-Math.sin(b.yaw)*side+Math.cos(b.yaw)*front
    });
    this._modelBox(faces,local(0,.34,0),[.58,.46,1.02],tan,b.yaw,width,height);
    this._modelBox(faces,local(0,.58,.63),[.55,.52,.5],cream,b.yaw,width,height);
    this._modelBox(faces,local(0,.63,.93),[.3,.23,.28],dark,b.yaw,width,height);
    this._modelBox(faces,local(0,.53,.48),[.61,.12,.15],collar,b.yaw,width,height);
    const legZ=[-.31,.31];
    const legX=[-.2,.2];
    let index=0;
    for(const lx of legX) for(const lz of legZ){
      const offset=(index++%2===0?walk:-walk);
      this._modelBox(faces,local(lx,.05,lz+offset),[.16,.38,.18],cream,b.yaw,width,height);
    }
    this._modelBox(faces,local(-.2,.91,.67),[.17,.3,.16],tan,b.yaw-.12,width,height);
    this._modelBox(faces,local(.2,.91,.67),[.17,.3,.16],tan,b.yaw+.12,width,height);
    const wag=Math.sin(time*(b.petBoost>0?15:7))*.22;
    this._modelBox(faces,local(wag,.66,-.68),[.14,.16,.52],tan,b.yaw+wag,width,height);

    if (this._bennyRewards?.toy) {
      const toyBounce = Math.abs(Math.sin(time * 4)) * .04;
      this._modelBox(faces,local(.46,.08 + toyBounce,.72),[.24,.22,.24],"#d7a52e",b.yaw + time * .7,width,height);
      this._modelBox(faces,local(.46,.27 + toyBounce,.72),[.1,.12,.1],"#8f1730",b.yaw,width,height);
    }
  },

  _addAnimalFaces(faces,width,height,time) {
    for (const animal of this._animals) {
      const ground = animal.y || this._groundAt(animal.x, animal.z);
      const bob = Math.abs(Math.sin(animal.phase * 2)) * .025;
      const base = { x: animal.x, y: ground + bob, z: animal.z };
      const local = (side, up, front) => ({
        x: base.x + Math.cos(animal.yaw) * side + Math.sin(animal.yaw) * front,
        y: base.y + up,
        z: base.z - Math.sin(animal.yaw) * side + Math.cos(animal.yaw) * front
      });
      if (animal.type === "sheep") {
        this._modelBox(faces, local(0,.34,0), [.72,.62,1.08], "#e7e1d3", animal.yaw, width, height);
        this._modelBox(faces, local(0,.58,.67), [.48,.5,.48], "#4b423d", animal.yaw, width, height);
        for (const sx of [-.24,.24]) for (const fz of [-.32,.32]) this._modelBox(faces, local(sx,.04,fz), [.14,.38,.14], "#3b3430", animal.yaw, width, height);
      } else {
        this._modelBox(faces, local(0,.18,0), [.44,.32,.65], "#f2d45f", animal.yaw, width, height);
        this._modelBox(faces, local(0,.37,.38), [.34,.36,.34], "#f4df75", animal.yaw, width, height);
        this._modelBox(faces, local(0,.39,.62), [.25,.12,.28], "#e58f37", animal.yaw, width, height);
      }
    }
  },

  _addHouseGuideFaces(faces,width,height,time) {
    if (!this._adventure?.houseActive || this._adventure.houseComplete) return;
    const { x, z, size, foundationY } = HOUSE_SITE;
    const pulse = .17 + Math.sin(time * 3) * .04;
    const guide = `rgba(255,255,255,${pulse})`;
    for (let dy = 1; dy <= 3; dy++) {
      for (let i = 0; i < size; i += 2) {
        this._modelBox(faces, {x:x+i+.5,y:foundationY+dy,z:z+.5}, [.94,.08,.94], guide, 0, width, height);
        this._modelBox(faces, {x:x+i+.5,y:foundationY+dy,z:z+size-.5}, [.94,.08,.94], guide, 0, width, height);
        this._modelBox(faces, {x:x+.5,y:foundationY+dy,z:z+i+.5}, [.94,.08,.94], guide, 0, width, height);
        this._modelBox(faces, {x:x+size-.5,y:foundationY+dy,z:z+i+.5}, [.94,.08,.94], guide, 0, width, height);
      }
    }
    if (this._missionStep() >= 6) {
      for (let dx = 0; dx < size; dx += 2) {
        for (let dz = 0; dz < size; dz += 2) {
          this._modelBox(faces, {x:x+dx+.5,y:foundationY+4.05,z:z+dz+.5}, [.92,.08,.92], guide, 0, width, height);
        }
      }
    }
  },

  _drawCelebration(ctx,width,height,time) {
    if (this._celebration <= 0) return;
    ctx.save();
    ctx.textAlign = "center";
    for (let i = 0; i < 18; i++) {
      const x = ((i * 83 + time * (28 + i)) % (width + 80)) - 40;
      const y = height - ((time * (42 + i * 1.3) + i * 47) % (height + 90));
      ctx.globalAlpha = .45 + (i % 4) * .12;
      ctx.font = `${18 + (i % 5) * 4}px sans-serif`;
      ctx.fillText(i % 3 === 0 ? "♥" : i % 3 === 1 ? "✦" : "🐾", x, y);
    }
    ctx.restore();
  },

  _rebuildMinimap() {
    if (!this._minimapCanvas || !this._minimapCtx || !this._world) return;
    const size = this._minimapCanvas.width;
    const base = document.createElement("canvas");
    base.width = size; base.height = size;
    const ctx = base.getContext("2d");
    const cell = size / (WORLD_RADIUS * 2 + 1);
    const colors = {
      grass: "#5f9d47", dirt: "#8a5e3e", stone: "#7e7d79", sand: "#ddc77d",
      water: "#397fbd", wood: "#865a35", leaves: "#376f3c", planks: "#ba874d",
      brick: "#93433e", crystal: "#5ed4f5", crop: "#c8b94e", flower: "#c23a59"
    };
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
      for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
        let top = "bedrock";
        for (let y = 24; y >= 0; y--) {
          const type = this._world.get(key(x,y,z));
          if (type) { top = type; break; }
        }
        ctx.fillStyle = colors[top] || "#4b4a4a";
        ctx.fillRect((x + WORLD_RADIUS) * cell, (z + WORLD_RADIUS) * cell, Math.ceil(cell)+.2, Math.ceil(cell)+.2);
      }
    }
    this._minimapBase = base;
  },

  _renderMinimap() {
    const ctx = this._minimapCtx;
    const canvas = this._minimapCanvas;
    if (!ctx || !canvas || !this._minimapBase) return;
    const size = canvas.width;
    const toMap = (value) => (value + WORLD_RADIUS) / (WORLD_RADIUS * 2 + 1) * size;
    ctx.clearRect(0,0,size,size);
    ctx.drawImage(this._minimapBase,0,0);
    for (const spot of LANDMARKS) {
      ctx.fillStyle = this._adventure?.discoveries?.[spot.id] ? "#fff2a8" : "rgba(255,255,255,.4)";
      ctx.beginPath(); ctx.arc(toMap(spot.x),toMap(spot.z),3.2,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = "#8f1730";
    ctx.beginPath(); ctx.arc(toMap(this._benny.x),toMap(this._benny.z),4.2,0,Math.PI*2); ctx.fill();
    const px = toMap(this._player.x), pz = toMap(this._player.z);
    ctx.save(); ctx.translate(px,pz); ctx.rotate(-this._player.yaw);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(5,6); ctx.lineTo(0,3); ctx.lineTo(-5,6); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  _drawBennyName(ctx,width,height) {
    const point=this._project({x:this._benny.x,y:this._benny.y+1.45,z:this._benny.z},width,height);
    if(!point||point.z>24)return;
    const rewardWords = [
      this._bennyRewards?.fed ? "Fed" : "",
      this._bennyRewards?.toy ? "Toy" : ""
    ].filter(Boolean);
    const label = this._benny.tamed
      ? `Benny ♥ Tamed${rewardWords.length ? ` · ${rewardWords.join(" · ")}` : ""}`
      : `Benny${rewardWords.length ? ` · ${rewardWords.join(" · ")}` : ""}`;
    ctx.save();
    ctx.font="700 13px DM Sans, sans-serif";
    const w=ctx.measureText(label).width+20;
    roundedRect(ctx,point.x-w/2,point.y-15,w,26,8);
    ctx.fillStyle="rgba(40,12,19,.82)";ctx.fill();
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label,point.x,point.y-2);
    ctx.restore();
  },

  _drawTargetOutline(ctx,width,height) {
    const target=this._target;
    if(!target)return;
    const {x,y,z}=target.hit;
    const verts=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
      .map(([vx,vy,vz])=>this._project({x:x+vx,y:y+vy,z:z+vz},width,height));
    if(verts.some((p)=>!p))return;
    const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    ctx.save();ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=2;
    for(const[a,b]of edges){ctx.beginPath();ctx.moveTo(verts[a].x,verts[a].y);ctx.lineTo(verts[b].x,verts[b].y);ctx.stroke();}
    ctx.restore();
  },

  _showMessage(message) {
    const el=this._root?.querySelector("[data-mc-message]");
    if(!el)return;
    el.textContent=message;el.classList.add("show");
    clearTimeout(this._messageTimer);
    this._messageTimer=setTimeout(()=>el.classList.remove("show"),1900);
  },

  _saveWorld(showMessage=false) {
    try {
      const custom=[];
      for(const[id,type]of this._world) custom.push([id,type]);
      safeStorage.setItem(SAVE_KEY,JSON.stringify(custom));
      safeStorage.setItem(`${SAVE_KEY}:tamed`,String(this._benny?.tamed||false));
      this._saveRewards();
      this._saveAdventure();
      if(showMessage)this._showMessage("World, quests, and Benny's progress saved in this browser.");
    } catch(error) {
      if(showMessage)this._showMessage("The browser could not save this world.");
    }
  },

  _loadWorld() {
    try {
      const saved=JSON.parse(safeStorage.getItem(SAVE_KEY));
      if(!Array.isArray(saved)||!saved.length)return null;
      return new Map(saved);
    } catch { return null; }
  },

  _saveRewards() {
    try {
      safeStorage.setItem(`${SAVE_KEY}:rewards`, JSON.stringify(this._bennyRewards || {
        leaves: 0, wood: 0, fed: false, toy: false
      }));
    } catch (_error) {}
  },

  _loadRewards() {
    try {
      const saved = JSON.parse(safeStorage.getItem(`${SAVE_KEY}:rewards`));
      if (!saved || typeof saved !== "object") throw new Error("No reward state");
      return {
        leaves: clamp(Number(saved.leaves) || 0, 0, 10),
        wood: clamp(Number(saved.wood) || 0, 0, 5),
        fed: Boolean(saved.fed),
        toy: Boolean(saved.toy)
      };
    } catch {
      return { leaves: 0, wood: 0, fed: false, toy: false };
    }
  },

  _loadTamed() { return safeStorage.getItem(`${SAVE_KEY}:tamed`) === "true"; }
};

})();
const solitaire = (() => {
// Klondike solitaire. Click a card to select it (and any valid run beneath
// it), then click a destination pile to move it there.

const SUITS = ["S", "H", "D", "C"];
const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set(["H", "D"]);
const RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };

function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

function isRed(card) {
  return RED_SUITS.has(card.suit);
}

function shuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealNewGame() {
  const deck = shuffledDeck();
  const tableau = Array.from({ length: 7 }, () => []);

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  const foundations = { S: [], H: [], D: [], C: [] };
  const stock = deck; // remaining cards, all face down
  const waste = [];

  return { tableau, foundations, stock, waste, moves: 0 };
}

// Returns the index at which the longest valid descending, alternating-color
// run begins, counting back from the top of the pile.
function runStartIndex(pile) {
  let i = pile.length - 1;
  while (i > 0) {
    const upper = pile[i - 1];
    const lower = pile[i];
    if (!upper.faceUp) break;
    const validSequence = upper.rank === lower.rank + 1 && isRed(upper) !== isRed(lower);
    if (!validSequence) break;
    i -= 1;
  }
  return i;
}

return {
  _root: null,
  _state: null,
  _selection: null, // { source: 'tableau'|'waste', col?: number }

  mount(root) {
    this._root = root;
    this._state = dealNewGame();
    this._selection = null;
    this._render("");
  },

  unmount() {
    this._root = null;
    this._state = null;
  },

  _clearSelection() {
    this._selection = null;
  },

  _drawStock() {
    const state = this._state;
    if (state.stock.length === 0) {
      state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      state.waste = [];
    } else {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    }
    this._clearSelection();
    this._render("");
  },

  _selectTableau(col, index) {
    const state = this._state;
    const pile = state.tableau[col];
    const card = pile[index];
    if (!card || !card.faceUp) return;

    const start = runStartIndex(pile);
    const resolvedIndex = index >= start ? index : pile.length - 1;
    const sel = this._selection;

    if (sel && sel.source === "tableau" && sel.col === col && sel.index === resolvedIndex) {
      this._clearSelection();
    } else {
      this._selection = { source: "tableau", col, index: resolvedIndex };
    }
    this._render("");
  },

  _selectWaste() {
    const state = this._state;
    if (state.waste.length === 0) return;
    const sel = this._selection;
    if (sel && sel.source === "waste") {
      this._clearSelection();
    } else {
      this._selection = { source: "waste" };
    }
    this._render("");
  },

  _getSelectedCards() {
    const sel = this._selection;
    const state = this._state;
    if (!sel) return [];
    if (sel.source === "waste") {
      const top = state.waste[state.waste.length - 1];
      return top ? [top] : [];
    }
    if (sel.source === "tableau") {
      return state.tableau[sel.col].slice(sel.index);
    }
    return [];
  },

  _removeSelectedCards() {
    const sel = this._selection;
    const state = this._state;
    if (sel.source === "waste") {
      return [state.waste.pop()];
    }
    if (sel.source === "tableau") {
      const pile = state.tableau[sel.col];
      const removed = pile.splice(sel.index);
      if (pile.length > 0) pile[pile.length - 1].faceUp = true;
      return removed;
    }
    return [];
  },

  _moveToFoundation(suit) {
    const cards = this._getSelectedCards();
    if (cards.length !== 1) return this._render("Only one card can go to a foundation.");
    const card = cards[0];
    if (card.suit !== suit) return this._render("That card doesn't match this foundation's suit.");

    const foundation = this._state.foundations[suit];
    const nextRank = foundation.length === 0 ? 1 : foundation[foundation.length - 1].rank + 1;
    if (card.rank !== nextRank) return this._render("That card can't go there yet.");

    this._removeSelectedCards();
    foundation.push(card);
    this._clearSelection();
    this._state.moves += 1;
    this._checkWin();
  },

  _moveToTableau(destCol) {
    const cards = this._getSelectedCards();
    if (cards.length === 0) return;
    const destPile = this._state.tableau[destCol];
    const moving = cards[0];

    if (destPile.length === 0) {
      if (moving.rank !== 13) return this._render("Only a king can start an empty pile.");
    } else {
      const top = destPile[destPile.length - 1];
      const validSequence = top.rank === moving.rank + 1 && isRed(top) !== isRed(moving);
      if (!validSequence) return this._render("That card doesn't fit there.");
    }

    if (this._selection.source === "tableau" && this._selection.col === destCol) {
      this._clearSelection();
      return this._render("");
    }

    const removed = this._removeSelectedCards();
    destPile.push(...removed);
    this._clearSelection();
    this._state.moves += 1;
    this._render("");
  },

  _checkWin() {
    const state = this._state;
    const done = SUITS.every((s) => state.foundations[s].length === 13);
    this._render(done ? "All four suits home. You win! 🎉" : "");
  },

  _render(status) {
    const root = this._root;
    const state = this._state;
    if (!root || !state) return;

    const panel = document.createElement("div");
    panel.className = "game-panel wide solitaire-panel";

    const controls = document.createElement("div");
    controls.className = "game-controls";
    const newBtn = document.createElement("button");
    newBtn.className = "btn secondary";
    newBtn.textContent = "New deal";
    newBtn.addEventListener("click", () => {
      this._state = dealNewGame();
      this._clearSelection();
      this._render("");
    });
    controls.appendChild(newBtn);

    const statusEl = document.createElement("p");
    statusEl.className = "game-status";
    statusEl.textContent = `Moves: ${state.moves}${status ? " — " + status : ""}`;

    const board = document.createElement("div");
    board.className = "solitaire-board";

    // --- Top row: stock, waste, foundations ---
    const topRow = document.createElement("div");
    topRow.className = "solitaire-row";

    const stockPile = document.createElement("div");
    stockPile.className = "sol-pile";
    stockPile.title = "Draw a card";
    if (state.stock.length > 0) {
      const back = this._makeCardEl({ faceUp: false }, 0);
      stockPile.appendChild(back);
    } else {
      stockPile.textContent = "↺";
      stockPile.style.display = "grid";
      stockPile.style.placeItems = "center";
      stockPile.style.color = "rgba(255,255,255,.72)";
    }
    stockPile.addEventListener("click", () => this._drawStock());
    topRow.appendChild(stockPile);

    const wastePile = document.createElement("div");
    wastePile.className = "sol-pile";
    const wasteTop = state.waste[state.waste.length - 1];
    if (wasteTop) {
      const el = this._makeCardEl(wasteTop, 0);
      if (this._selection?.source === "waste") el.classList.add("selected");
      wastePile.appendChild(el);
    }
    wastePile.addEventListener("click", () => this._selectWaste());
    topRow.appendChild(wastePile);

    const spacer = document.createElement("div");
    spacer.style.flex = "1 1 30px";
    spacer.style.minWidth = "12px";
    topRow.appendChild(spacer);

    SUITS.forEach((suit) => {
      const pile = document.createElement("div");
      pile.className = "sol-pile";
      const top = state.foundations[suit][state.foundations[suit].length - 1];
      if (top) {
        pile.appendChild(this._makeCardEl(top, 0));
      } else {
        pile.textContent = SUIT_SYMBOL[suit];
        pile.style.display = "grid";
        pile.style.placeItems = "center";
        pile.style.color = RED_SUITS.has(suit) ? "#f5c3cc" : "rgba(255,255,255,.58)";
        pile.style.fontSize = "1.6rem";
      }
      pile.addEventListener("click", () => this._moveToFoundation(suit));
      topRow.appendChild(pile);
    });

    // --- Tableau ---
    const tableauRow = document.createElement("div");
    tableauRow.className = "solitaire-tableau";

    state.tableau.forEach((pile, col) => {
      const pileEl = document.createElement("div");
      pileEl.className = "sol-pile sol-tableau-pile";

      pile.forEach((card, index) => {
        const el = this._makeCardEl(card, index);
        const sel = this._selection;
        if (
          sel &&
          sel.source === "tableau" &&
          sel.col === col &&
          index >= sel.index
        ) {
          el.classList.add("selected");
        }
        if (card.faceUp) {
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            this._selectTableau(col, index);
          });
        }
        pileEl.appendChild(el);
      });

      pileEl.addEventListener("click", () => this._moveToTableau(col));
      tableauRow.appendChild(pileEl);
    });

    board.appendChild(topRow);
    board.appendChild(tableauRow);

    panel.appendChild(controls);
    panel.appendChild(statusEl);
    panel.appendChild(board);

    root.innerHTML = "";
    root.appendChild(panel);
  },

  _makeCardEl(card, stackIndex) {
    const el = document.createElement("div");
    el.className = "sol-card";
    el.style.top = `${stackIndex * 20}px`;
    el.style.zIndex = String(stackIndex + 1);

    if (!card.faceUp) {
      el.classList.add("face-down");
      return el;
    }

    el.classList.add(isRed(card) ? "red" : "black");
    el.textContent = `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
    return el;
  }
};

})();

const screenDiary = (() => {
  const STORAGE_KEY = "happy6:cozy-screen-diary:v7";

  const WATCHED_STARTER = [
    {
      id: "anand",
      title: "Anand",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://play-lh.googleusercontent.com/proxy/VujXcineAs2bBiwz7OeBbGn3bbkuT7aSQGotjV0KCIx2faddcYOR8iYmwoWx_9DkzudFRiB8YdnVc7lPwxR1eaGv10O8mMuSnzUIo5mA-MH8ql5bmxqdYOxUCwNSvAnx261ZAonQ5h_BHMSn-vgj7I5f3jgx5sFjFSAvKw=w480-h960"
    },
    {
      id: "ye-maaya-chesave",
      title: "Ye Maaya Chesave",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://play-lh.googleusercontent.com/dRqoM-6maw4enTL-g1RU2iek4erAPukRdg5k7U4bdUz1CT5cZEQtrUC-P9tCcvXWJ5w=w480-h960"
    },
    {
      id: "with-love",
      title: "With Love",
      type: "Series",
      language: "English",
      status: "watched",
      note: "Watched together",
      poster: "https://images.fandango.com/ImageRenderer/400/0/redesign/static/img/default_poster--dark-mode.png/0/images/masterrepository/Fandango/244298/withlove.jpg"
    },
    {
      id: "anaganaga-oka-raju",
      title: "Anaganaga Oka Raju",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://images.fandango.com/ImageRenderer/400/0/redesign/static/img/default_poster--dark-mode.png/0/images/masterrepository/Fandango/243701/1290220-anaganaga-oka-raju-0-230-0-345-crop.jpg"
    },
    {
      id: "mike-and-molly",
      title: "Mike & Molly",
      type: "Series",
      language: "English",
      status: "watched",
      note: "Watched together",
      poster: "https://upload.wikimedia.org/wikipedia/commons/9/95/Mike-and-molly-13.jpg"
    },
    {
      id: "tamizh-padam-2",
      title: "Tamizh Padam 2",
      type: "Movie",
      language: "Tamil",
      status: "halfway",
      note: "Halfway… lmao",
      poster: "https://play-lh.googleusercontent.com/vnGWrt5NYKGGLYUJ5kEJFugzOXhRjr_1E5LFiuzaOINF9K_iBiFZMcxH31xfIuYSyWLHrmRmcEzBt7d2sV8=w480-h960"
    },
    {
      id: "little-things",
      title: "Little Things",
      type: "Series",
      language: "English",
      status: "watched",
      note: "Watched together",
      poster: "https://images.justwatch.com/poster/255483793/s592/little-things.jpg",
      posterFallback: "https://resizing.flixster.com/8edPB5rPK5_2cyFuICY5bNT6LJc%3D/342x513/v2/https%3A//resizing.flixster.com/uKRM5V-4Sdx-eXjCYhkC7ecmzew%3D/ems.cHJkLWVtcy1hc3NldHMvdHZzZXJpZXMvNDQ0ZDk4MGMtN2FmNy00MDJjLTgwNTAtZTExMmFiMGMzODJiLmpwZw%3D%3D"
    },
    {
      id: "attarintiki-daredi",
      title: "Attarintiki Daredi",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://play-lh.googleusercontent.com/RTPgLMluBxCFjmM-crWQS_38zUuboxajlLWRvFx3KSvBpOocVzWRAfA16u-8vgWd_Nez=w480-h960"
    },
    {
      id: "seethamma-vakitlo-sirimalle-chettu",
      title: "Seethamma Vakitlo Sirimalle Chettu",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://play-lh.googleusercontent.com/ztyP5jIJ9pRuz-gxXAlGC7DTfFEQNNt78RdYZRh-Ufr1YRZdvWW8yoilmvxvjevjmr5O=w480-h960"
    },
    {
      id: "hi-nanna-watched",
      title: "Hi Nanna",
      type: "Movie",
      language: "Telugu",
      status: "watched",
      note: "Watched together",
      poster: "https://images.justwatch.com/poster/311292828/s592/nani30.jpg",
      posterFallback: "https://image.tmdb.org/t/p/original/hhMLtq9m1aK0dpY9Wcq26XeDH2z.jpg"
    }
  ];

  const AI_CATALOG = [
    {
      id: "hi-nanna",
      title: "Hi Nanna",
      type: "Movie",
      language: "Telugu",
      releaseDate: "7 December 2023",
      duration: "2h 35m",
      actors: ["Nani", "Mrunal Thakur", "Kiara Khanna"],
      synopsis: "A devoted single father and his daughter meet a mysterious woman whose connection to their past slowly changes all of their lives.",
      poster: "https://images.justwatch.com/poster/311292828/s592/nani30.jpg",
      posterFallback: "https://image.tmdb.org/t/p/original/hhMLtq9m1aK0dpY9Wcq26XeDH2z.jpg"
    },
    {
      id: "premalu",
      title: "Premalu",
      type: "Movie",
      language: "Malayalam",
      releaseDate: "9 February 2024",
      duration: "2h 36m",
      actors: ["Naslen Gafoor", "Mamitha Baiju", "Sangeeth Prathap"],
      synopsis: "Sachin’s search for love becomes a funny modern triangle filled with awkward timing, friendship, and growing up.",
      poster: "https://images.justwatch.com/poster/311710055/s592/premalu.jpg",
      posterFallback: "https://images.justwatch.com/poster/311710055/s166/premalu.jpg"
    },
    {
      id: "pelli-choopulu",
      title: "Pelli Choopulu",
      type: "Movie",
      language: "Telugu",
      releaseDate: "29 July 2016",
      duration: "2h 4m",
      actors: ["Ritu Varma", "Vijay Deverakonda", "Priyadarshi Pullikonda"],
      synopsis: "A carefree aspiring chef meets an ambitious entrepreneur during a matchmaking visit, and working together changes both of their lives.",
      poster: "https://images.justwatch.com/poster/332397071/s592/pellichoopulu.jpg",
      posterFallback: "https://images.justwatch.com/poster/332397071/s166/pellichoopulu.jpg"
    },
    {
      id: "about-time",
      title: "About Time",
      type: "Movie",
      language: "English",
      releaseDate: "4 September 2013",
      duration: "2h 3m",
      actors: ["Domhnall Gleeson", "Rachel McAdams", "Bill Nighy"],
      synopsis: "A young man who can travel through time learns that love and happiness come from appreciating ordinary days.",
      poster: "https://images.justwatch.com/poster/9568757/s592/about-time.jpg",
      posterFallback: "https://images.justwatch.com/poster/9568757/s166/about-time.jpg"
    },
    {
      id: "96",
      title: "’96",
      type: "Movie",
      language: "Tamil",
      releaseDate: "4 October 2018",
      duration: "2h 39m",
      actors: ["Vijay Sethupathi", "Trisha Krishnan", "Gouri G. Kishan"],
      synopsis: "Former school sweethearts reunite years later and spend an evening revisiting the love and memories that never really left them.",
      poster: "https://images.justwatch.com/poster/85695504/s592/96.jpg",
      posterFallback: "https://images.justwatch.com/poster/85695504/s166/96.jpg"
    },
    {
      id: "queen-of-tears",
      title: "Queen of Tears",
      type: "Series",
      language: "Korean",
      releaseDate: "9 March 2024",
      duration: "16 episodes · about 1h 28m each",
      actors: ["Kim Soo-hyun", "Kim Ji-won", "Park Sung-hoon"],
      synopsis: "A married couple facing separation begins to rediscover love while navigating illness, family power struggles, and emotional upheaval.",
      poster: "https://images.justwatch.com/poster/316813600/s592/queen-of-tears.jpg",
      posterFallback: "https://images.justwatch.com/poster/316813600/s166/queen-of-tears.jpg"
    },
    {
      id: "business-proposal",
      title: "Business Proposal",
      type: "Series",
      language: "Korean",
      releaseDate: "28 February 2022",
      duration: "12 episodes · about 1h 1m each",
      actors: ["Ahn Hyo-seop", "Kim Se-jeong", "Kim Min-gue"],
      synopsis: "Ha-ri attends a blind date while disguised as her friend, only to discover that the man across the table is her company’s CEO.",
      poster: "https://images.justwatch.com/poster/269914828/s592/a-business-proposal.jpg",
      posterFallback: "https://images.justwatch.com/poster/269914828/s166/a-business-proposal.jpg"
    },
    {
      id: "heartstopper",
      title: "Heartstopper",
      type: "Series",
      language: "English",
      releaseDate: "22 April 2022",
      duration: "3 seasons · about 33m each",
      actors: ["Joe Locke", "Kit Connor", "Yasmin Finney"],
      synopsis: "Classmates Charlie and Nick form a close friendship that gradually becomes something more as they navigate school and young love.",
      poster: "https://images.justwatch.com/poster/321076012/s592/heartstopper.jpg",
      posterFallback: "https://images.justwatch.com/poster/321076012/s166/heartstopper.jpg"
    },
    {
      id: "new-girl",
      title: "New Girl",
      type: "Series",
      language: "English",
      releaseDate: "20 September 2011",
      duration: "7 seasons · about 21m each",
      actors: ["Zooey Deschanel", "Jake Johnson", "Max Greenfield"],
      synopsis: "After a breakup, Jess moves into a loft with three men and becomes part of their chaotic, funny, and unexpectedly close found family.",
      poster: "https://images.justwatch.com/poster/60368190/s592/new-girl.jpg",
      posterFallback: "https://images.justwatch.com/poster/60368190/s166/new-girl.jpg"
    },
    {
      id: "the-good-place",
      title: "The Good Place",
      type: "Series",
      language: "English",
      releaseDate: "19 September 2016",
      duration: "4 seasons · about 23m each",
      actors: ["Kristen Bell", "Ted Danson", "William Jackson Harper"],
      synopsis: "Eleanor arrives in an unusually cheerful afterlife and decides she must become a better person before anyone discovers the mistake.",
      poster: "https://images.justwatch.com/poster/150630553/s592/the-good-place.jpg",
      posterFallback: "https://images.justwatch.com/poster/150630553/s166/the-good-place.jpg"
    }
  ];

  const DEFAULT_QUEUE = [
    {
      ...AI_CATALOG.find((item) => item.id === "queen-of-tears"),
      queueId: "queue-queen-of-tears"
    }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeCustomPoster(title, type = "Movie") {
    const safeTitle = escapeHtml(title);
    const label = type === "Series" ? "OUR NEXT SHOW" : "OUR MOVIE NIGHT";
    const top = type === "Series" ? "#d9c4ef" : "#f1bdca";
    const bottom = type === "Series" ? "#55326a" : "#771a35";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 1050">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${top}"/>
            <stop offset="100%" stop-color="${bottom}"/>
          </linearGradient>
        </defs>
        <rect width="700" height="1050" fill="url(#bg)"/>
        <circle cx="560" cy="170" r="92" fill="rgba(255,255,255,.14)"/>
        <text x="560" y="195" text-anchor="middle" fill="#fffaf7" font-family="Georgia,serif" font-size="76">♥</text>
        <rect x="34" y="34" width="632" height="982" rx="28" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>
        <text x="58" y="105" fill="#fffaf7" font-family="Arial,sans-serif" font-size="26" font-weight="800" letter-spacing="4">${label}</text>
        <foreignObject x="58" y="650" width="584" height="245">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fffaf7;font-family:Georgia,serif;font-size:64px;font-weight:700;line-height:1.06;overflow-wrap:anywhere;">
            ${safeTitle}
          </div>
        </foreignObject>
        <text x="58" y="970" fill="#fffaf7" opacity=".78" font-family="Arial,sans-serif" font-size="24">saved for us ♥</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function uniqueByTitle(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = String(item.title || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function loadState() {
    const fallback = {
      favorites: [],
      extraWatched: [],
      removedTitles: ["chandramukhi"],
      queue: DEFAULT_QUEUE,
      watchedFilter: "all",
      aiType: "Movie",
      aiLanguage: "all",
      aiPickId: "premalu",
      message: "Queen of Tears is saved under Need to Watch ♥"
    };

    try {
      const saved = JSON.parse(safeStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return fallback;

      const isChandramukhi = (item) =>
        String(item?.title || "").trim().toLowerCase() === "chandramukhi";

      return {
        favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
        extraWatched: Array.isArray(saved.extraWatched)
          ? saved.extraWatched.filter((item) => !isChandramukhi(item))
          : [],
        removedTitles: Array.from(new Set([
          "chandramukhi",
          ...(Array.isArray(saved.removedTitles) ? saved.removedTitles : [])
        ].map((title) => String(title || "").trim().toLowerCase()).filter(Boolean))),
        queue: Array.isArray(saved.queue)
          ? saved.queue.filter((item) => !isChandramukhi(item))
          : DEFAULT_QUEUE,
        watchedFilter: typeof saved.watchedFilter === "string" ? saved.watchedFilter : "all",
        aiType: saved.aiType === "Series" ? "Series" : "Movie",
        aiLanguage: typeof saved.aiLanguage === "string" ? saved.aiLanguage : "all",
        aiPickId: typeof saved.aiPickId === "string" ? saved.aiPickId : "premalu",
        message: ""
      };
    } catch (_error) {
      return fallback;
    }
  }

  function attachPosterFallback(image, item, fallbackElement) {
    image.addEventListener("error", () => {
      if (item.posterFallback && image.dataset.fallbackTried !== "true") {
        image.dataset.fallbackTried = "true";
        image.src = item.posterFallback;
        return;
      }

      image.remove();
      fallbackElement.classList.add("visible");
    });
  }

  return {
    _root: null,
    _state: null,

    mount(root) {
      this._root = root;
      this._state = loadState();
      document.body.classList.add("screen-diary-open");
      this._save();
      this._render();
    },

    unmount() {
      document.body.classList.remove("screen-diary-open");
      this._root = null;
      this._state = null;
    },

    _save() {
      if (!this._state) return true;

      try {
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
        return true;
      } catch (error) {
        console.error("Could not save the Screen Diary:", error);

        // Large pasted/uploaded posters can exceed Safari's localStorage.
        // Keep every title and detail, but replace only oversized data-URL
        // posters with a lightweight generated card, then save again.
        const compactState = JSON.parse(JSON.stringify(this._state));

        const compactItem = (item) => {
          if (typeof item?.poster === "string" && item.poster.startsWith("data:image/")) {
            return {
              ...item,
              poster: makeCustomPoster(item.title || "Our movie", item.type || "Movie")
            };
          }
          return item;
        };

        compactState.extraWatched = (compactState.extraWatched || []).map(compactItem);
        compactState.queue = (compactState.queue || []).map(compactItem);
        compactState.message =
          "The title was added, but Safari could not store the large poster. Upload a smaller JPG for the real poster.";

        try {
          safeStorage.setItem(STORAGE_KEY, JSON.stringify(compactState));
          this._state = compactState;
          return true;
        } catch (secondError) {
          console.error("Compact Screen Diary save also failed:", secondError);
          this._state.message =
            "The browser storage is full. Remove an older custom title, then add this one again.";
          return false;
        }
      }
    },

    _watched() {
      const removedTitles = new Set(
        (this._state.removedTitles || [])
          .map((title) => String(title || "").trim().toLowerCase())
          .filter(Boolean)
      );

      return uniqueByTitle([
        ...WATCHED_STARTER,
        ...(this._state.extraWatched || [])
      ]).filter((item) => !removedTitles.has(String(item.title || "").trim().toLowerCase()));
    },

    _filteredWatched() {
      const filter = this._state.watchedFilter;
      if (filter === "needtowatch") return [];
      return this._watched().filter((item) => {
        if (filter === "movies") return item.type === "Movie";
        if (filter === "shows") return item.type === "Series";
        if (filter === "halfway") return item.status === "halfway";
        return true;
      });
    },

    _toggleFavorite(id) {
      const favorites = new Set(this._state.favorites);
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      this._state.favorites = [...favorites];
      this._save();
      this._render();
    },

    _searchCatalog(query, type = "all") {
      const cleanQuery = String(query || "").trim().toLowerCase();
      if (!cleanQuery) return [];

      return AI_CATALOG
        .filter((item) => {
          const typeMatches = type === "all" || item.type === type;
          const searchText = [
            item.title,
            item.language,
            item.type,
            ...(Array.isArray(item.actors) ? item.actors : [])
          ].join(" ").toLowerCase();

          return typeMatches && searchText.includes(cleanQuery);
        })
        .slice(0, 8);
    },

    _posterFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !String(file.type || "").startsWith("image/")) {
          reject(new Error("Choose a JPG, PNG, or WebP poster image."));
          return;
        }

        const reader = new FileReader();

        reader.onerror = () => reject(new Error("Could not read that poster image."));
        reader.onload = () => {
          const image = new Image();

          image.onerror = () => reject(new Error("That poster format could not be opened. Try JPG or PNG."));
          image.onload = () => {
            // Compress posters before storing them. This keeps several custom
            // posters safely below Safari/localStorage limits.
            const maxWidth = 420;
            const maxHeight = 630;
            const scale = Math.min(
              1,
              maxWidth / image.naturalWidth,
              maxHeight / image.naturalHeight
            );

            const width = Math.max(1, Math.round(image.naturalWidth * scale));
            const height = Math.max(1, Math.round(image.naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) {
              reject(new Error("Could not prepare that poster."));
              return;
            }

            context.fillStyle = "#fff";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);

            resolve(canvas.toDataURL("image/jpeg", 0.72));
          };

          image.src = String(reader.result || "");
        };

        reader.readAsDataURL(file);
      });
    },

    _checkPosterUrl(url) {
      return new Promise((resolve, reject) => {
        const cleanUrl = String(url || "").trim();
        if (!cleanUrl) {
          reject(new Error("Paste a direct image address or upload the poster."));
          return;
        }

        const image = new Image();
        const timer = window.setTimeout(() => {
          image.src = "";
          reject(new Error("That poster link did not load. Upload the image instead."));
        }, 8000);

        image.onload = () => {
          window.clearTimeout(timer);
          resolve(cleanUrl);
        };

        image.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("Google blocked that image link. Save the poster and upload it instead."));
        };

        image.referrerPolicy = "no-referrer";
        image.src = cleanUrl;
      });
    },

    async _searchOnline(query, type = "all") {
      const cleanQuery = String(query || "").trim();
      if (!cleanQuery) return [];

      const typeHint =
        type === "Series"
          ? "television series"
          : type === "Movie"
            ? "film"
            : "film OR television series";

      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: `${cleanQuery} ${typeHint}`,
        gsrnamespace: "0",
        gsrlimit: "10",
        prop: "pageimages|extracts|pageprops",
        piprop: "thumbnail|original",
        pithumbsize: "700",
        exintro: "1",
        explaintext: "1",
        exsentences: "4",
        format: "json",
        origin: "*"
      });

      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
      if (!response.ok) throw new Error("Online search failed.");

      const payload = await response.json();
      const pages = Object.values(payload?.query?.pages || {})
        .sort((a, b) => (a.index || 999) - (b.index || 999));

      const mediaPages = pages.filter((page) => {
        const text = `${page.title || ""} ${page.extract || ""}`.toLowerCase();
        const looksLikeMedia =
          text.includes("film") ||
          text.includes("movie") ||
          text.includes("television series") ||
          text.includes("tv series") ||
          text.includes("web series") ||
          text.includes("drama series") ||
          text.includes("sitcom");

        if (!looksLikeMedia) return false;
        if (type === "Movie") return text.includes("film") || text.includes("movie");
        if (type === "Series") {
          return (
            text.includes("television series") ||
            text.includes("tv series") ||
            text.includes("web series") ||
            text.includes("drama series") ||
            text.includes("sitcom")
          );
        }
        return true;
      });

      const qids = mediaPages
        .map((page) => page?.pageprops?.wikibase_item)
        .filter(Boolean);

      let entityMap = {};
      if (qids.length) {
        const entityParams = new URLSearchParams({
          action: "wbgetentities",
          ids: qids.join("|"),
          props: "claims|labels",
          languages: "en",
          format: "json",
          origin: "*"
        });

        const entityResponse = await fetch(
          `https://www.wikidata.org/w/api.php?${entityParams.toString()}`
        );

        if (entityResponse.ok) {
          const entityPayload = await entityResponse.json();
          entityMap = entityPayload.entities || {};
        }
      }

      const actorIds = new Set();
      Object.values(entityMap).forEach((entity) => {
        (entity?.claims?.P161 || []).slice(0, 6).forEach((claim) => {
          const actorId = claim?.mainsnak?.datavalue?.value?.id;
          if (actorId) actorIds.add(actorId);
        });
      });

      let actorLabels = {};
      if (actorIds.size) {
        const actorParams = new URLSearchParams({
          action: "wbgetentities",
          ids: [...actorIds].join("|"),
          props: "labels",
          languages: "en",
          format: "json",
          origin: "*"
        });

        const actorResponse = await fetch(
          `https://www.wikidata.org/w/api.php?${actorParams.toString()}`
        );

        if (actorResponse.ok) {
          const actorPayload = await actorResponse.json();
          Object.entries(actorPayload.entities || {}).forEach(([id, entity]) => {
            actorLabels[id] = entity?.labels?.en?.value || "";
          });
        }
      }

      const readClaim = (entity, property) =>
        entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;

      const readDate = (entity) => {
        const value = readClaim(entity, "P577");
        const raw = value?.time;
        if (!raw) return "Not listed";

        const match = raw.match(/[+-](\d{4})-(\d{2})-(\d{2})/);
        if (!match) return "Not listed";

        const [, year, month, day] = match;
        const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return year;

        return new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC"
        }).format(date);
      };

      const readDuration = (entity, inferredType) => {
        const value = readClaim(entity, "P2047");
        const amount = Number(value?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return inferredType === "Series" ? "Episode duration not listed" : "Not listed";
        }

        const minutes = Math.round(amount);
        if (minutes < 60) return `${minutes}m`;
        return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
      };

      return mediaPages.slice(0, 8).map((page) => {
        const qid = page?.pageprops?.wikibase_item || "";
        const entity = entityMap[qid];
        const combinedText = `${page.title || ""} ${page.extract || ""}`.toLowerCase();
        const inferredType =
          type === "Movie" || type === "Series"
            ? type
            : (
              combinedText.includes("television series") ||
              combinedText.includes("tv series") ||
              combinedText.includes("web series") ||
              combinedText.includes("sitcom")
                ? "Series"
                : "Movie"
            );

        const cast = (entity?.claims?.P161 || [])
          .slice(0, 6)
          .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
          .map((id) => actorLabels[id])
          .filter(Boolean);

        const commonsFilename = readClaim(entity, "P18");
        const commonsPoster = commonsFilename
          ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(commonsFilename)}?width=700`
          : "";

        const poster =
          commonsPoster ||
          page?.thumbnail?.source ||
          page?.original?.source ||
          makeCustomPoster(page.title, inferredType);

        return {
          id: `online-${qid || page.pageid}`,
          title: String(page.title || cleanQuery).replace(/\s+\((film|TV series|television series)\)$/i, ""),
          type: inferredType,
          language: "Not listed",
          releaseDate: readDate(entity),
          duration: readDuration(entity, inferredType),
          actors: cast,
          synopsis: page.extract || "No synopsis was returned for this title.",
          poster,
          sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
          googleUrl: `https://www.google.com/search?q=${encodeURIComponent(
            `${page.title} ${inferredType === "Series" ? "TV series" : "movie"}`
          )}`
        };
      });
    },

    _addSearchResult(item, destination) {
      const watchedTitles = new Set(this._watched().map((entry) => entry.title.toLowerCase()));
      const queueTitles = new Set(this._state.queue.map((entry) => entry.title.toLowerCase()));
      const key = item.title.toLowerCase();

      if (destination === "watched") {
        this._state.removedTitles = (this._state.removedTitles || []).filter(
          (title) => String(title || "").trim().toLowerCase() !== key
        );

        if (watchedTitles.has(key)) {
          this._state.message = `${item.title} is already in Watched With You ♥`;
          this._render();
          return false;
        }

        this._state.queue = this._state.queue.filter((entry) => entry.title.toLowerCase() !== key);
        this._state.extraWatched.unshift({
          ...item,
          id: `watched-${item.id || Date.now().toString(36)}-${Date.now().toString(36)}`,
          status: "watched",
          note: "Watched together"
        });
        this._state.watchedFilter = "all";
        this._state.message = `${item.title} was added to Watched With You ♥`;
      } else {
        if (queueTitles.has(key)) {
          this._state.message = `${item.title} is already under Need to Watch.`;
          this._render();
          return false;
        }

        if (watchedTitles.has(key)) {
          this._state.message = `${item.title} is already marked as watched.`;
          this._render();
          return false;
        }

        this._state.queue.unshift({
          ...item,
          queueId: `queue-${item.id || Date.now().toString(36)}-${Date.now().toString(36)}`
        });
        this._state.watchedFilter = "needtowatch";
        this._state.message = `${item.title} was added to Need to Watch.`;
      }

      const saved = this._save();
      this._render();

      window.requestAnimationFrame(() => {
        const cards = [...document.querySelectorAll(".clean-watched-card")];
        const addedCard = cards.find((card) =>
          card.querySelector("h5")?.textContent?.trim().toLowerCase() === key
        );

        if (addedCard) {
          addedCard.classList.add("clean-newly-added");
          addedCard.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => addedCard.classList.remove("clean-newly-added"), 2400);
        }
      });

      return saved !== false;
    },

    _addCustomSearchTitle(title, type, destination) {
      const cleanTitle = String(title || "").trim();
      if (!cleanTitle) return;

      const customItem = {
        id: `custom-${Date.now().toString(36)}`,
        title: cleanTitle,
        type: type === "Series" ? "Series" : "Movie",
        language: "Not listed",
        releaseDate: "Not listed",
        duration: "Not listed",
        actors: [],
        synopsis: "Add the details later—or keep it as a simple memory in our diary.",
        poster: makeCustomPoster(cleanTitle, type)
      };

      this._addSearchResult(customItem, destination);
    },

    _aiCandidates() {
      return AI_CATALOG.filter((item) => {
        const typeMatches = item.type === this._state.aiType;
        const languageMatches =
          this._state.aiLanguage === "all" ||
          item.language === this._state.aiLanguage;
        return typeMatches && languageMatches;
      });
    },

    _pickSuggestion(id = "") {
      const candidates = this._aiCandidates();
      if (!candidates.length) {
        this._state.message = "No match in that exact category yet—try another language.";
        this._render();
        return;
      }

      let choice = id ? candidates.find((item) => item.id === id) : null;
      if (!choice) {
        const different = candidates.filter((item) => item.id !== this._state.aiPickId);
        const pool = different.length ? different : candidates;
        choice = pool[Math.floor(Math.random() * pool.length)];
      }

      this._state.aiPickId = choice.id;
      this._state.message = `${choice.title} is the ${choice.type.toLowerCase()} pick for tonight ✨`;
      this._save();
      this._render();
    },

    _saveSuggestion(item) {
      const alreadyQueued = this._state.queue.some(
        (entry) => entry.title.toLowerCase() === item.title.toLowerCase()
      );
      const alreadyWatched = this._watched().some(
        (entry) => entry.title.toLowerCase() === item.title.toLowerCase()
      );

      if (alreadyQueued || alreadyWatched) {
        this._state.message = "That title is already in the diary ♥";
        this._render();
        return;
      }

      this._state.queue.unshift({
        ...item,
        queueId: `queue-${item.id}-${Date.now().toString(36)}`
      });
      this._state.message = `${item.title} was saved under Need to Watch.`;
      this._save();
      this._render();
    },

    _removeWatched(item) {
      if (!item) return;

      const confirmed = window.confirm(`Remove "${item.title}" from Watched With You?`);
      if (!confirmed) return;

      const titleKey = String(item.title || "").trim().toLowerCase();

      this._state.extraWatched = (this._state.extraWatched || []).filter((entry) => {
        const sameId = item.id && entry.id === item.id;
        const sameTitle = String(entry.title || "").trim().toLowerCase() === titleKey;
        return !sameId && !sameTitle;
      });

      this._state.removedTitles = Array.from(new Set([
        ...(this._state.removedTitles || []),
        titleKey
      ]));

      this._state.favorites = (this._state.favorites || []).filter((id) => id !== item.id);
      this._state.message = `${item.title} was removed from Watched With You.`;
      this._save();
      this._render();
    },

    _removeQueue(queueId) {
      this._state.queue = this._state.queue.filter((item) => item.queueId !== queueId);
      this._state.message = "Removed from Need to Watch.";
      this._save();
      this._render();
    },

    _moveQueueToWatched(queueId) {
      const item = this._state.queue.find((entry) => entry.queueId === queueId);
      if (!item) return;

      this._state.queue = this._state.queue.filter((entry) => entry.queueId !== queueId);
      const titleKey = String(item.title || "").trim().toLowerCase();
      this._state.removedTitles = (this._state.removedTitles || []).filter(
        (title) => String(title || "").trim().toLowerCase() !== titleKey
      );
      this._state.extraWatched.push({
        ...item,
        id: `watched-${item.id}-${Date.now().toString(36)}`,
        status: "watched",
        note: "Watched together"
      });
      this._state.message = `${item.title} moved into Watched With You ♥`;
      this._save();
      this._render();
    },

    _renderWatchedCard(item, index) {
      const card = document.createElement("article");
      card.className = "clean-watched-card";

      const poster = document.createElement("div");
      poster.className = "clean-watched-poster";
      poster.innerHTML = `
        <div class="clean-poster-fallback">
          <span>Poster unavailable</span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)} poster" loading="lazy" referrerpolicy="no-referrer" />
        <span class="clean-card-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="clean-status ${item.status === "halfway" ? "halfway" : "watched"}">
          ${item.status === "halfway" ? "Still watching" : "Watched"}
        </span>
      `;

      const image = poster.querySelector("img");
      attachPosterFallback(image, item, poster.querySelector(".clean-poster-fallback"));

      const copy = document.createElement("div");
      copy.className = "clean-watched-copy";
      copy.innerHTML = `
        <div>
          <h5>${escapeHtml(item.title)}</h5>
          <p>${escapeHtml(item.note)}</p>
        </div>
        <div class="clean-meta">
          <span>${escapeHtml(item.type === "Series" ? "Show" : "Movie")}</span>
          <span>${escapeHtml(item.language)}</span>
        </div>
      `;

      const favorite = document.createElement("button");
      const active = this._state.favorites.includes(item.id);
      favorite.type = "button";
      favorite.className = `clean-heart ${active ? "active" : ""}`;
      favorite.textContent = active ? "♥" : "♡";
      favorite.setAttribute("aria-label", `${active ? "Remove" : "Add"} ${item.title} ${active ? "from" : "to"} favorites`);
      favorite.addEventListener("click", () => this._toggleFavorite(item.id));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "clean-watched-remove";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${item.title} from Watched With You`);
      removeButton.addEventListener("click", () => this._removeWatched(item));

      const cardActions = document.createElement("div");
      cardActions.className = "clean-watched-card-actions";
      cardActions.append(removeButton);

      copy.append(favorite, cardActions);
      card.append(poster, copy);
      return card;
    },

    _renderNeedCard(item, index) {
      const card = document.createElement("article");
      card.className = `clean-watched-card clean-need-card ${item.type === "Series" ? "show" : "movie"}`;

      const detailsId = `need-details-${String(item.queueId || item.id || index).replace(/[^a-z0-9_-]/gi, "-")}`;

      const poster = document.createElement("button");
      poster.type = "button";
      poster.className = "clean-watched-poster clean-need-poster-button";
      poster.setAttribute("aria-expanded", "false");
      poster.setAttribute("aria-controls", detailsId);
      poster.setAttribute("aria-label", `View details for ${item.title}`);
      poster.innerHTML = `
        <div class="clean-poster-fallback">
          <span>Poster unavailable</span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)} poster" loading="lazy" referrerpolicy="no-referrer" />
        <span class="clean-card-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="clean-status need ${item.type === "Series" ? "show" : "movie"}">
          ${item.type === "Series" ? "Show to watch" : "Movie to watch"}
        </span>
        <span class="clean-poster-details-hint">Tap for details</span>
      `;

      const image = poster.querySelector("img");
      attachPosterFallback(image, item, poster.querySelector(".clean-poster-fallback"));

      const copy = document.createElement("div");
      copy.className = "clean-watched-copy clean-need-copy";
      copy.innerHTML = `
        <div>
          <h5>${escapeHtml(item.title)}</h5>
          <p>Saved for one of our next couch nights.</p>
        </div>
        <div class="clean-meta">
          <span>${escapeHtml(item.type === "Series" ? "Show" : "Movie")}</span>
          ${item.language ? `<span>${escapeHtml(item.language)}</span>` : ""}
        </div>
      `;

      const details = document.createElement("div");
      details.className = "clean-need-details";
      details.id = detailsId;
      details.hidden = true;
      details.innerHTML = `
        <div><strong>Release date</strong><span>${escapeHtml(item.releaseDate || item.year || "Not listed")}</span></div>
        <div><strong>Duration</strong><span>${escapeHtml(item.duration || "Not listed")}</span></div>
        <div class="wide"><strong>Actors</strong><span>${escapeHtml(Array.isArray(item.actors) && item.actors.length ? item.actors.join(", ") : "Not listed")}</span></div>
        <div class="wide"><strong>Synopsis</strong><span>${escapeHtml(item.synopsis || "Details have not been added for this title yet.")}</span></div>
      `;

      const actions = document.createElement("div");
      actions.className = "clean-need-card-actions";

      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "clean-details-action";
      detailsButton.textContent = "View details";
      detailsButton.setAttribute("aria-expanded", "false");
      detailsButton.setAttribute("aria-controls", detailsId);

      const toggleDetails = () => {
        const opening = details.hidden;
        details.hidden = !opening;
        detailsButton.textContent = opening ? "Hide details" : "View details";
        detailsButton.setAttribute("aria-expanded", String(opening));
        poster.setAttribute("aria-expanded", String(opening));
        card.classList.toggle("details-open", opening);
      };

      detailsButton.addEventListener("click", toggleDetails);
      poster.addEventListener("click", toggleDetails);

      const watchedButton = document.createElement("button");
      watchedButton.type = "button";
      watchedButton.className = "clean-neutral-action";
      watchedButton.textContent = "Move to watched";
      watchedButton.addEventListener("click", () => this._moveQueueToWatched(item.queueId));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "clean-remove-action";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => this._removeQueue(item.queueId));

      actions.append(detailsButton, watchedButton, removeButton);
      copy.append(details, actions);
      card.append(poster, copy);
      return card;
    },

    _renderAiCard(item) {
      const card = document.createElement("article");
      card.className = "clean-ai-result";

      const poster = document.createElement("div");
      poster.className = "clean-ai-poster";
      poster.innerHTML = `
        <div class="clean-poster-fallback">
          <span>Poster unavailable</span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)} poster" referrerpolicy="no-referrer" />
        <span class="clean-ai-category ${item.type === "Series" ? "show" : "movie"}">
          ${item.type === "Series" ? "Show suggestion" : "Movie suggestion"}
        </span>
      `;

      attachPosterFallback(
        poster.querySelector("img"),
        item,
        poster.querySelector(".clean-poster-fallback")
      );

      const copy = document.createElement("div");
      copy.className = "clean-ai-copy";
      copy.innerHTML = `
        <header>
          <div>
            <p>${escapeHtml(item.language)} ${escapeHtml(item.type === "Series" ? "show" : "movie")}</p>
            <h5>${escapeHtml(item.title)}</h5>
          </div>
        </header>

        <div class="clean-ai-facts">
          <span><b>Release date</b>${escapeHtml(item.releaseDate)}</span>
          <span><b>Duration</b>${escapeHtml(item.duration)}</span>
        </div>

        <section>
          <strong>Actors</strong>
          <p>${escapeHtml(item.actors.join(", "))}</p>
        </section>

        <section>
          <strong>Synopsis</strong>
          <p>${escapeHtml(item.synopsis)}</p>
        </section>
      `;

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = `btn clean-save-pick ${item.type === "Series" ? "show" : "movie"}`;
      saveButton.textContent = `Save ${item.type === "Series" ? "show" : "movie"} to Need to Watch`;
      saveButton.addEventListener("click", () => this._saveSuggestion(item));
      copy.appendChild(saveButton);

      card.append(poster, copy);
      return card;
    },

    _renderQueueItem(item) {
      const row = document.createElement("article");
      row.className = "clean-queue-item";

      const tinyPoster = document.createElement("div");
      tinyPoster.className = "clean-queue-poster";
      tinyPoster.innerHTML = `
        <div class="clean-poster-fallback">
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <img src="${escapeHtml(item.poster)}" alt="" aria-hidden="true" loading="lazy" referrerpolicy="no-referrer" />
      `;
      attachPosterFallback(
        tinyPoster.querySelector("img"),
        item,
        tinyPoster.querySelector(".clean-poster-fallback")
      );

      const body = document.createElement("div");
      body.className = "clean-queue-copy";
      body.innerHTML = `
        <span class="clean-queue-tag ${item.type === "Series" ? "show" : "movie"}">
          ${item.type === "Series" ? "Show to watch" : "Movie to watch"}
        </span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.language)} · ${escapeHtml(item.releaseDate)}</small>
      `;

      const actions = document.createElement("div");
      actions.className = "clean-queue-actions";

      const watchedButton = document.createElement("button");
      watchedButton.type = "button";
      watchedButton.className = "clean-neutral-action";
      watchedButton.textContent = "Move to watched";
      watchedButton.addEventListener("click", () => this._moveQueueToWatched(item.queueId));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "clean-remove-action";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => this._removeQueue(item.queueId));

      actions.append(watchedButton, removeButton);
      body.appendChild(actions);
      row.append(tinyPoster, body);
      return row;
    },

    _render() {
      if (!this._root || !this._state) return;

      const watched = this._watched();
      const filteredWatched = this._filteredWatched();
      const candidates = this._aiCandidates();
      let aiPick = candidates.find((item) => item.id === this._state.aiPickId);
      if (!aiPick) aiPick = candidates[0] || AI_CATALOG.find((item) => item.type === this._state.aiType);

      const panel = document.createElement("section");
      panel.className = "game-panel wide clean-screen-diary";

      const hero = document.createElement("header");
      hero.className = "clean-screen-hero";
      hero.innerHTML = `
        <div>
          <p class="screen-diary-kicker">Six months, one couch, many stories</p>
          <h3>Our Cozy Screen Diary</h3>
          <p>Everything we have already watched stays in the main gallery. The AI sidekick suggests one complete movie or show at a time.</p>
        </div>
        <div class="clean-screen-stats">
          <span><strong>${watched.filter((item) => item.status === "watched").length}</strong> watched</span>
          <span><strong>${watched.filter((item) => item.status === "halfway").length}</strong> halfway</span>
          <span><strong>${this._state.queue.length}</strong> saved next</span>
        </div>
      `;

      const layout = document.createElement("div");
      layout.className = "clean-screen-layout";

      const main = document.createElement("main");
      main.className = "clean-watched-main";

      const libraryNotice = document.createElement("div");
      libraryNotice.className = `clean-library-notice ${this._state.message ? "visible" : ""}`;
      libraryNotice.setAttribute("aria-live", "polite");
      libraryNotice.textContent = this._state.message || "";

      const searchBox = document.createElement("section");
      searchBox.className = "clean-library-search";
      searchBox.innerHTML = `
        <div class="clean-search-heading">
          <div>
            <p class="screen-section-kicker">Add anything to our diary</p>
            <h4>Search or add any movie/show</h4>
          </div>
          <span>Use online search—or Google it and paste the details yourself</span>
        </div>

        <div class="clean-search-controls clean-online-search-controls">
          <label class="clean-search-field">
            <span class="sr-only">Search movies and shows</span>
            <input type="search" placeholder="Type any movie or show title…" data-library-search autocomplete="off" />
          </label>

          <select data-library-type aria-label="Filter search by movie or show">
            <option value="all">Movies + shows</option>
            <option value="Movie">Movies only</option>
            <option value="Series">Shows only</option>
          </select>

          <button type="button" class="btn clean-online-search-button" data-search-online>
            Search online
          </button>

          <button type="button" class="clean-google-search-button" data-search-google>
            Search Google
          </button>
        </div>

        <div class="clean-search-results" data-library-results aria-live="polite">
          <p class="clean-search-empty">Type a title, then search online or open it in Google.</p>
        </div>

        <details class="clean-manual-import">
          <summary>Add a title manually from Google</summary>

          <div class="clean-manual-intro">
            Google the title, then paste the poster and details here. This works for any random movie or show.
          </div>

          <div class="clean-manual-grid">
            <label>
              <span>Title *</span>
              <input type="text" data-manual-title placeholder="Movie or show title" />
            </label>

            <label>
              <span>Type</span>
              <select data-manual-type>
                <option value="Movie">Movie</option>
                <option value="Series">Show</option>
              </select>
            </label>

            <label>
              <span>Add it to</span>
              <select data-manual-destination>
                <option value="need">Need to Watch</option>
                <option value="watched">Watched With You</option>
              </select>
            </label>

            <label>
              <span>Language</span>
              <input type="text" data-manual-language placeholder="English, Telugu, Tamil…" />
            </label>

            <label>
              <span>Release date/year</span>
              <input type="text" data-manual-date placeholder="2024 or 9 February 2024" />
            </label>

            <label>
              <span>Duration</span>
              <input type="text" data-manual-duration placeholder="2h 15m or 12 episodes" />
            </label>

            <label class="clean-manual-wide">
              <span>Actors</span>
              <input type="text" data-manual-actors placeholder="Actor 1, Actor 2, Actor 3" />
            </label>

            <label class="clean-manual-wide">
              <span>Synopsis</span>
              <textarea data-manual-synopsis rows="3" placeholder="Paste a short synopsis…"></textarea>
            </label>

            <label class="clean-manual-wide">
              <span>Direct poster image address</span>
              <input type="url" data-manual-poster-url placeholder="Must end in or directly load a JPG, PNG, or WebP image" />
              <small>Google result-page links usually do not work. Use “Copy image address,” not “Copy link.”</small>
            </label>

            <div class="clean-manual-wide clean-poster-import">
              <div class="clean-poster-preview" data-manual-poster-preview>
                <div>
                  <strong>Add the real poster</strong>
                  <span>Choose, drag, or paste a poster image here</span>
                </div>
                <img alt="Selected poster preview" data-manual-poster-preview-image hidden />
              </div>

              <div class="clean-poster-import-actions">
                <label class="clean-poster-file-button">
                  <span>Choose poster image</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" data-manual-poster-file />
                </label>
                <button type="button" data-clear-manual-poster>Clear poster</button>
              </div>

              <small class="clean-poster-help">
                Most reliable method: save the poster from Google, then upload it here. You can also copy the image itself and paste it into the box.
              </small>
            </div>
          </div>

          <div class="clean-manual-actions">
            <button type="button" class="btn" data-add-manual>Add to our diary</button>
            <p data-manual-status aria-live="polite"></p>
          </div>
        </details>
      `;

      const searchInput = searchBox.querySelector("[data-library-search]");
      const searchType = searchBox.querySelector("[data-library-type]");
      const searchOnlineButton = searchBox.querySelector("[data-search-online]");
      const searchGoogleButton = searchBox.querySelector("[data-search-google]");
      const searchResults = searchBox.querySelector("[data-library-results]");

      const manualTitle = searchBox.querySelector("[data-manual-title]");
      const manualType = searchBox.querySelector("[data-manual-type]");
      const manualDestination = searchBox.querySelector("[data-manual-destination]");
      const manualLanguage = searchBox.querySelector("[data-manual-language]");
      const manualDate = searchBox.querySelector("[data-manual-date]");
      const manualDuration = searchBox.querySelector("[data-manual-duration]");
      const manualActors = searchBox.querySelector("[data-manual-actors]");
      const manualSynopsis = searchBox.querySelector("[data-manual-synopsis]");
      const manualPosterUrl = searchBox.querySelector("[data-manual-poster-url]");
      const manualPosterFile = searchBox.querySelector("[data-manual-poster-file]");
      const manualPosterPreview = searchBox.querySelector("[data-manual-poster-preview]");
      const manualPosterPreviewImage = searchBox.querySelector("[data-manual-poster-preview-image]");
      const clearManualPoster = searchBox.querySelector("[data-clear-manual-poster]");
      const manualStatus = searchBox.querySelector("[data-manual-status]");
      const manualAddButton = searchBox.querySelector("[data-add-manual]");

      let preparedPosterData = "";

      const createSearchResult = (item, online = false) => {
        const result = document.createElement("article");
        result.className = "clean-search-result";
        result.innerHTML = `
          <div class="clean-search-poster">
            <div class="clean-poster-fallback"><strong>${escapeHtml(item.title)}</strong></div>
            <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)} poster" loading="lazy" referrerpolicy="no-referrer" />
          </div>

          <div class="clean-search-copy">
            <span>${escapeHtml(item.type === "Series" ? "Show" : "Movie")}${item.language ? ` · ${escapeHtml(item.language)}` : ""}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.releaseDate || "")}${item.duration ? ` · ${escapeHtml(item.duration)}` : ""}</small>
            ${online ? `<em>Online result</em>` : ""}
          </div>

          <div class="clean-search-actions">
            ${online && item.googleUrl ? `<a href="${escapeHtml(item.googleUrl)}" target="_blank" rel="noopener noreferrer">Open Google</a>` : ""}
            <button type="button" data-add-watched>Add to watched</button>
            <button type="button" data-add-need>Add to need to watch</button>
          </div>
        `;

        attachPosterFallback(
          result.querySelector("img"),
          item,
          result.querySelector(".clean-poster-fallback")
        );

        result.querySelector("[data-add-watched]")?.addEventListener("click", () => {
          this._addSearchResult(item, "watched");
        });
        result.querySelector("[data-add-need]")?.addEventListener("click", () => {
          this._addSearchResult(item, "need");
        });

        return result;
      };

      const renderLocalResults = () => {
        const query = searchInput.value.trim();
        const matches = this._searchCatalog(query, searchType.value);

        if (!query) {
          searchResults.innerHTML = `<p class="clean-search-empty">Type a title, then search online or open it in Google.</p>`;
          return;
        }

        if (!matches.length) {
          searchResults.innerHTML = `
            <article class="clean-search-custom">
              <div>
                <strong>No built-in match for “${escapeHtml(query)}”</strong>
                <small>Press Search online, open Google, or add it manually below.</small>
              </div>
            </article>
          `;
          return;
        }

        searchResults.innerHTML = "";
        matches.forEach((item) => {
          searchResults.appendChild(createSearchResult(item, false));
        });
      };

      const renderOnlineResults = async () => {
        const query = searchInput.value.trim();
        if (!query) {
          searchResults.innerHTML = `<p class="clean-search-empty">Type a movie or show title first.</p>`;
          searchInput.focus();
          return;
        }

        searchOnlineButton.disabled = true;
        searchOnlineButton.textContent = "Searching…";
        searchResults.innerHTML = `<p class="clean-search-empty">Searching online for “${escapeHtml(query)}”…</p>`;

        try {
          const matches = await this._searchOnline(query, searchType.value);

          if (!matches.length) {
            searchResults.innerHTML = `
              <article class="clean-search-custom">
                <div>
                  <strong>No automatic result was found.</strong>
                  <small>Use Search Google, then add the title manually below.</small>
                </div>
              </article>
            `;
            return;
          }

          searchResults.innerHTML = "";
          matches.forEach((item) => {
            searchResults.appendChild(createSearchResult(item, true));
          });
        } catch (error) {
          console.error("Online movie search failed:", error);
          searchResults.innerHTML = `
            <article class="clean-search-custom">
              <div>
                <strong>The automatic search could not load.</strong>
                <small>Use Search Google and the manual form below instead.</small>
              </div>
            </article>
          `;
        } finally {
          searchOnlineButton.disabled = false;
          searchOnlineButton.textContent = "Search online";
        }
      };

      searchGoogleButton.addEventListener("click", () => {
        const query = searchInput.value.trim();
        if (!query) {
          searchResults.innerHTML = `<p class="clean-search-empty">Type a title before opening Google.</p>`;
          searchInput.focus();
          return;
        }

        manualTitle.value = query;
        if (searchType.value === "Series" || searchType.value === "Movie") {
          manualType.value = searchType.value;
        }

        const googleQuery = `${query} ${manualType.value === "Series" ? "TV show" : "movie"} poster cast duration release date synopsis`;
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`,
          "_blank",
          "noopener,noreferrer"
        );
      });

      const showPreparedPoster = (posterData) => {
        preparedPosterData = posterData || "";
        manualPosterPreview.classList.toggle("has-poster", Boolean(preparedPosterData));
        manualPosterPreviewImage.hidden = !preparedPosterData;
        manualPosterPreviewImage.src = preparedPosterData || "";
        manualStatus.textContent = preparedPosterData ? "Poster ready ✓" : "";
      };

      const preparePosterFile = async (file) => {
        if (!file) return;

        manualStatus.textContent = "Preparing poster…";
        try {
          const posterData = await this._posterFromFile(file);
          showPreparedPoster(posterData);
          manualPosterUrl.value = "";
        } catch (error) {
          showPreparedPoster("");
          manualStatus.textContent = error?.message || "Could not prepare that poster.";
        }
      };

      manualPosterFile.addEventListener("change", () => {
        preparePosterFile(manualPosterFile.files?.[0]);
      });

      manualPosterPreview.addEventListener("dragover", (event) => {
        event.preventDefault();
        manualPosterPreview.classList.add("dragging");
      });

      manualPosterPreview.addEventListener("dragleave", () => {
        manualPosterPreview.classList.remove("dragging");
      });

      manualPosterPreview.addEventListener("drop", (event) => {
        event.preventDefault();
        manualPosterPreview.classList.remove("dragging");
        const imageFile = [...(event.dataTransfer?.files || [])].find((file) =>
          String(file.type || "").startsWith("image/")
        );
        preparePosterFile(imageFile);
      });

      manualPosterPreview.tabIndex = 0;
      manualPosterPreview.addEventListener("paste", (event) => {
        const imageFile = [...(event.clipboardData?.items || [])]
          .find((item) => String(item.type || "").startsWith("image/"))
          ?.getAsFile();

        if (!imageFile) {
          manualStatus.textContent = "Copy the poster image itself, then paste it here.";
          return;
        }

        event.preventDefault();
        preparePosterFile(imageFile);
      });

      manualPosterPreview.addEventListener("click", () => {
        manualPosterFile.click();
      });

      clearManualPoster.addEventListener("click", () => {
        manualPosterFile.value = "";
        manualPosterUrl.value = "";
        showPreparedPoster("");
      });

      manualPosterUrl.addEventListener("change", async () => {
        const url = manualPosterUrl.value.trim();
        if (!url) return;

        manualStatus.textContent = "Checking poster link…";
        try {
          const validUrl = await this._checkPosterUrl(url);
          preparedPosterData = "";
          manualPosterPreviewImage.hidden = false;
          manualPosterPreviewImage.src = validUrl;
          manualPosterPreview.classList.add("has-poster");
          manualStatus.textContent = "Poster link works ✓";
        } catch (error) {
          manualPosterPreview.classList.remove("has-poster");
          manualPosterPreviewImage.hidden = true;
          manualStatus.textContent = error?.message || "That poster link did not work.";
        }
      });

      manualAddButton.addEventListener("click", async () => {
        const title = manualTitle.value.trim();
        if (!title) {
          manualStatus.textContent = "Add the title first.";
          manualTitle.focus();
          return;
        }

        manualAddButton.disabled = true;
        manualAddButton.textContent = "Adding…";
        manualStatus.textContent = "";

        try {
          let poster = preparedPosterData;
          let posterWarning = "";

          if (!poster && manualPosterFile.files?.[0]) {
            try {
              poster = await this._posterFromFile(manualPosterFile.files[0]);
            } catch (error) {
              posterWarning = error?.message || "The uploaded poster could not be used.";
            }
          }

          if (!poster && manualPosterUrl.value.trim()) {
            try {
              poster = await this._checkPosterUrl(manualPosterUrl.value.trim());
            } catch (error) {
              // A blocked Google image URL must not block the movie/show.
              posterWarning = error?.message || "The poster link was blocked.";
            }
          }

          if (!poster) {
            poster = makeCustomPoster(title, manualType.value);
          }

          const item = {
            id: `manual-${Date.now().toString(36)}`,
            title,
            type: manualType.value === "Series" ? "Series" : "Movie",
            language: manualLanguage.value.trim() || "Not listed",
            releaseDate: manualDate.value.trim() || "Not listed",
            duration: manualDuration.value.trim() || "Not listed",
            actors: manualActors.value
              .split(",")
              .map((actor) => actor.trim())
              .filter(Boolean),
            synopsis: manualSynopsis.value.trim() || "No synopsis added yet.",
            poster
          };

          const destination = manualDestination.value;
          const added = this._addSearchResult(item, destination);

          if (!added) return;

          // _addSearchResult re-renders the Screen Diary, so show the final
          // confirmation through the state notice rather than this old form.
          if (posterWarning) {
            this._state.message =
              `${title} was added, but Google blocked the poster link. ` +
              `The title card is showing instead—upload the image file for the real poster.`;
            this._save();
            this._render();
          }
        } catch (error) {
          console.error("Could not add manual title:", error);
          manualStatus.textContent = error?.message || "Could not add that title.";
          manualAddButton.disabled = false;
          manualAddButton.textContent = "Add to our diary";
        }
      });

      searchInput.addEventListener("input", renderLocalResults);
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        renderOnlineResults();
      });
      searchType.addEventListener("change", renderLocalResults);
      searchOnlineButton.addEventListener("click", renderOnlineResults);

      const heading = document.createElement("div");
      heading.className = "clean-section-heading";
      const showingNeedToWatch = this._state.watchedFilter === "needtowatch";

      heading.innerHTML = showingNeedToWatch
        ? `
        <div>
          <p class="screen-section-kicker">Saved for our next couch night</p>
          <h4>Need to Watch ♥</h4>
        </div>
      `
        : `
        <div>
          <p class="screen-section-kicker">Already part of our story</p>
          <h4>Watched With You ♥</h4>
        </div>
      `;

      const filters = document.createElement("div");
      filters.className = "clean-filter-tags";
      [
        ["all", "All"],
        ["movies", "Movies"],
        ["shows", "Shows"],
        ["halfway", "Halfway"],
        ["needtowatch", "Need to watch"]
      ].forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = this._state.watchedFilter === value ? "active" : "";
        button.textContent = label;
        button.addEventListener("click", () => {
          this._state.watchedFilter = value;
          this._save();
          this._render();
        });
        filters.appendChild(button);
      });

      heading.appendChild(filters);

      const watchedGrid = document.createElement("div");

      if (showingNeedToWatch) {
        watchedGrid.className = "clean-watched-grid clean-need-grid";

        if (!this._state.queue.length) {
          watchedGrid.innerHTML = `<p class="clean-empty-queue clean-empty-main">Nothing saved yet. Use the AI picker on the right and save a movie or show for later ♥</p>`;
        } else {
          this._state.queue.forEach((item, index) => {
            watchedGrid.appendChild(this._renderNeedCard(item, index));
          });
        }
      } else {
        watchedGrid.className = "clean-watched-grid";
        filteredWatched.forEach((item, index) => {
          watchedGrid.appendChild(this._renderWatchedCard(item, index));
        });
      }

      main.append(libraryNotice, searchBox, heading, watchedGrid);

      const sidebar = document.createElement("aside");
      sidebar.className = "clean-ai-sidebar";

      const sidebarHeading = document.createElement("div");
      sidebarHeading.className = "clean-ai-heading";
      sidebarHeading.innerHTML = `
        <p class="screen-section-kicker">Pick our next couch night</p>
        <h4>AI Movie & Show Picker ✨</h4>
        <p>Choose a category. You will get one complete suggestion with its real poster and details.</p>
      `;

      const typeTabs = document.createElement("div");
      typeTabs.className = "clean-ai-type-tabs";
      [["Movie", "Movie"], ["Series", "Show"]].forEach(([value, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = this._state.aiType === value ? "active" : "";
        button.textContent = label;
        button.addEventListener("click", () => {
          this._state.aiType = value;
          this._state.aiLanguage = "all";
          this._state.aiPickId = "";
          this._save();
          this._render();
        });
        typeTabs.appendChild(button);
      });

      const controls = document.createElement("div");
      controls.className = "clean-ai-controls";

      const languageLabel = document.createElement("label");
      languageLabel.innerHTML = `
        <span>Language</span>
        <select data-clean-language>
          <option value="all">Any language</option>
          <option value="Telugu">Telugu</option>
          <option value="Tamil">Tamil</option>
          <option value="Malayalam">Malayalam</option>
          <option value="English">English</option>
          <option value="Korean">Korean</option>
        </select>
      `;
      const languageSelect = languageLabel.querySelector("select");
      languageSelect.value = this._state.aiLanguage;
      languageSelect.addEventListener("change", () => {
        this._state.aiLanguage = languageSelect.value;
        this._state.aiPickId = "";
        this._save();
        this._render();
      });

      const pickButton = document.createElement("button");
      pickButton.type = "button";
      pickButton.className = "btn clean-pick-button";
      pickButton.textContent = `Suggest another ${this._state.aiType === "Series" ? "show" : "movie"}`;
      pickButton.addEventListener("click", () => this._pickSuggestion());

      controls.append(languageLabel, pickButton);

      const message = document.createElement("p");
      message.className = "clean-screen-message";
      message.setAttribute("aria-live", "polite");
      message.textContent = this._state.message || "Choose Movie or Show, then let the picker decide.";

      const resultHolder = document.createElement("div");
      resultHolder.className = "clean-ai-result-holder";
      if (aiPick) resultHolder.appendChild(this._renderAiCard(aiPick));

      const queueHeading = document.createElement("div");
      queueHeading.className = "clean-queue-heading";
      queueHeading.innerHTML = `
        <div>
          <strong>Need to Watch</strong>
          <small>Saved from the AI picker</small>
        </div>
        <span>${this._state.queue.length}</span>
      `;

      const queue = document.createElement("div");
      queue.className = "clean-queue-list";
      if (!this._state.queue.length) {
        queue.innerHTML = `<p class="clean-empty-queue">Nothing saved yet. Let the AI picker choose something for us.</p>`;
      } else {
        this._state.queue.forEach((item) => {
          queue.appendChild(this._renderQueueItem(item));
        });
      }

      sidebar.append(
        sidebarHeading,
        typeTabs,
        controls,
        message,
        resultHolder,
        queueHeading,
        queue
      );

      layout.append(main, sidebar);
      panel.append(hero, layout);

      this._root.innerHTML = "";
      this._root.appendChild(panel);
    }
  };
})();

const games = {
  wordle: {
    title: "Cute Memory Wordle",
    emoji: "💌",
    tagline: "Five letters, six guesses, and one sweet memory waiting for us.",
    module: wordle
  },
  sudoku: {
    title: "Easy Sudoku",
    emoji: "🔢",
    tagline: "A soft little number puzzle for a slow, cozy moment together.",
    module: sudoku
  },
  chess: {
    title: "Chess",
    emoji: "♟️",
    tagline: "A tiny battle of hearts and brains—play me or challenge Benny Bot.",
    module: chess
  },
  blockblast: {
    title: "Block Blast",
    emoji: "🧩",
    tagline: "Make the pieces fit, clear the board, and build our cutest streak.",
    module: blockblast
  },
  minecraft: {
    title: "Benny’s Block World",
    emoji: "🐕",
    tagline: "Our little blocky universe where we explore, build Benny a home, and adventure together.",
    module: minecraft
  },
  solitaire: {
    title: "Solitaire",
    emoji: "🃏",
    tagline: "The only game I’ll let you kick my ass.",
    module: solitaire
  },
  screendiary: {
    title: "Our Cozy Screen Diary",
    emoji: "🎬",
    tagline: "Every show, movie, laugh, and dramatic couch-night memory in one place.",
    module: screenDiary
  }
};

const homeView = document.querySelector("#home-view");
const gameView = document.querySelector("#game-view");
const gameRoot = document.querySelector("#game-root");
const gameViewEmoji = document.querySelector("#game-view-emoji");
const gameViewHeading = document.querySelector("#game-view-heading");
const gameViewTagline = document.querySelector("#game-view-tagline");
const backButton = document.querySelector("#back-button");
const gameButtons = document.querySelectorAll(".game-card");

let activeGame = null;
let lastFocusedButton = null;

function openGame(key) {
  const game = games[key];
  if (!game) return;

  gameViewEmoji.textContent = game.emoji;
  gameViewHeading.textContent = game.title;
  gameViewTagline.textContent = game.tagline;

  gameRoot.innerHTML = "";
  homeView.classList.add("hidden");
  gameView.classList.add("open");
  gameView.setAttribute("aria-hidden", "false");
  document.body.classList.toggle("minecraft-open", key === "minecraft");
  window.scrollTo({ top: 0, behavior: "auto" });

  activeGame = game.module;

  try {
    activeGame.mount(gameRoot);
    backButton.focus({ preventScroll: true });
  } catch (error) {
    console.error(`${game.title} could not open:`, error);
    activeGame = null;
    gameRoot.innerHTML = `
      <section class="game-panel game-load-error">
        <div class="game-load-error-icon" aria-hidden="true">${game.emoji}</div>
        <h3>${game.title} needs one quick reload</h3>
        <p>The game hit a browser error while opening. Refresh the page, then try it again.</p>
        <button class="btn" type="button" data-retry-game>Try opening again</button>
      </section>
    `;
    gameRoot.querySelector("[data-retry-game]")?.addEventListener("click", () => {
      closeGame();
      window.setTimeout(() => openGame(key), 60);
    });
  }
}

function closeGame() {
  if (activeGame && typeof activeGame.unmount === "function") {
    activeGame.unmount();
  }
  activeGame = null;
  gameRoot.innerHTML = "";

  gameView.classList.remove("open");
  gameView.setAttribute("aria-hidden", "true");
  homeView.classList.remove("hidden");
  document.body.classList.remove("minecraft-open");

  lastFocusedButton?.focus({ preventScroll: true });
}

gameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lastFocusedButton = button;
    openGame(button.dataset.game);
  });
});

backButton.addEventListener("click", closeGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && gameView.classList.contains("open") && !document.pointerLockElement) {
    closeGame();
  }
});


/* ---------- Floating local full-song soundtrack ---------- */
(() => {
  const shell = document.querySelector("#floating-soundtrack");
  const launcher = document.querySelector("#soundtrack-launcher");
  const panel = document.querySelector("#soundtrack-panel");
  const closeButton = document.querySelector("#soundtrack-close");
  const audio = document.querySelector("#site-audio");
  const songButtons = [...document.querySelectorAll(".soundtrack-song")];

  const heroNote = document.querySelector("#hero-audio-note");
  const heroAutoplayState = document.querySelector("#hero-autoplay-state");
  const playButton = document.querySelector("#local-play");
  const previousButton = document.querySelector("#local-previous");
  const nextButton = document.querySelector("#local-next");
  const shuffleButton = document.querySelector("#local-shuffle");
  const repeatButton = document.querySelector("#local-repeat");
  const restartButton = document.querySelector("#soundtrack-restart");
  const progress = document.querySelector("#local-progress");
  const volume = document.querySelector("#local-volume");
  const currentTimeLabel = document.querySelector("#local-current-time");
  const durationLabel = document.querySelector("#local-duration");
  const titleLabel = document.querySelector("#local-title");
  const artistLabel = document.querySelector("#local-artist");
  const miniTitle = document.querySelector("#soundtrack-mini-title");
  const cover = document.querySelector("#local-cover");
  const equalizer = document.querySelector("#soundtrack-equalizer");
  const status = document.querySelector("#soundtrack-status");

  if (!shell || !launcher || !panel || !audio || !songButtons.length) return;

  const STATE_KEY = "happy6:local-soundtrack:v3";
  const VALENTINE_INDEX = 0;
  const VALENTINE_MOMENT_SECONDS = 40;

  let currentIndex = VALENTINE_INDEX;
  let shuffleOn = false;
  let repeatOn = true;
  let seeking = false;
  let hasStarted = false;
  let pendingSeek = VALENTINE_MOMENT_SECONDS;

  const tracks = songButtons.map((button, index) => ({
    index,
    button,
    src: button.dataset.src,
    title: button.dataset.title,
    artist: button.dataset.artist,
    durationText: button.dataset.duration,
    startAt: Number(button.dataset.startAt || 0),
    art: button.dataset.art || "♫",
    artClass: button.dataset.artClass || "art-valentine"
  }));

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  function setOpen(open) {
    shell.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
  }

  function updatePlayVisuals() {
    const playing = !audio.paused && !audio.ended;
    shell.classList.toggle("playing", playing);
    equalizer?.classList.toggle("paused", !playing);
    playButton.textContent = playing ? "❚❚" : "▶";
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");

    if (heroAutoplayState) {
      heroAutoplayState.classList.toggle("playing", playing);
      heroAutoplayState.classList.toggle("blocked", !playing && hasStarted);
      heroAutoplayState.innerHTML = playing
        ? '<i aria-hidden="true"></i> Playing'
        : '<i aria-hidden="true"></i> Ready';
    }
  }

  function savePreferences() {
    try {
      safeStorage.setItem(STATE_KEY, JSON.stringify({
        volume: audio.volume,
        shuffleOn,
        repeatOn
      }));
    } catch (_error) {}
  }

  function seekWhenReady(seconds) {
    pendingSeek = Math.max(0, Number(seconds) || 0);

    const applySeek = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = Math.min(pendingSeek, Math.max(0, audio.duration - 0.2));
      pendingSeek = 0;
    };

    if (audio.readyState >= 1) {
      try { applySeek(); } catch (_error) {}
    } else {
      audio.addEventListener("loadedmetadata", applySeek, { once: true });
    }
  }

  function selectTrack(index, {
    autoplay = false,
    startAt = 0,
    announce = true
  } = {}) {
    const normalized = (index + tracks.length) % tracks.length;
    const track = tracks[normalized];
    currentIndex = normalized;

    songButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === normalized;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });

    titleLabel.textContent = track.title;
    artistLabel.textContent = track.artist;
    miniTitle.textContent = `${track.title} · ${track.artist}`;
    durationLabel.textContent = track.durationText;
    cover.textContent = track.art;
    cover.className = `local-cover ${track.artClass}`;

    const currentSource = audio.getAttribute("src") || "";
    if (currentSource !== track.src) {
      audio.src = track.src;
      audio.load();
    }

    seekWhenReady(startAt);

    if (announce) status.textContent = `Selected ${track.title}`;

    if (autoplay) {
      playAudio();
    }

    savePreferences();
  }

  function playAudio({ autoplayAttempt = false } = {}) {
    hasStarted = true;

    const result = audio.play();
    if (!result || typeof result.then !== "function") {
      return Promise.resolve(true);
    }

    return result
      .then(() => {
        audio.muted = false;
        if (heroNote) heroNote.textContent = "Valentine is playing from our lyric moment ♥";
        if (heroAutoplayState) {
          heroAutoplayState.classList.remove("blocked");
          heroAutoplayState.classList.add("playing");
          heroAutoplayState.innerHTML = '<i aria-hidden="true"></i> Playing';
        }
        return true;
      })
      .catch(async () => {
        if (!autoplayAttempt) {
          status.textContent = "Tap anywhere once to let the browser play the song.";
          if (heroNote) heroNote.textContent = "The browser paused the song. Any tap on the page will resume it.";
          updatePlayVisuals();
          return false;
        }

        // Audible autoplay is commonly blocked. Keep the song loaded at the
        // correct timestamp, then resume on the first ordinary interaction.
        audio.muted = true;
        try {
          await audio.play();
          window.setTimeout(() => {
            audio.muted = false;
          }, 650);
        } catch (_error) {}

        status.textContent = "Autoplay is waiting for browser permission.";
        if (heroNote) {
          heroNote.textContent = "Safari blocked audible autoplay. Enable Allow All Auto-Play for this site to hear it immediately.";
        }
        if (heroAutoplayState) {
          heroAutoplayState.classList.remove("playing");
          heroAutoplayState.classList.add("blocked");
          heroAutoplayState.innerHTML = '<i aria-hidden="true"></i> Browser blocked audio';
        }
        updatePlayVisuals();
        return false;
      });
  }

  function startValentine() {
    if (currentIndex !== VALENTINE_INDEX || audio.getAttribute("src") !== tracks[0].src) {
      selectTrack(VALENTINE_INDEX, {
        autoplay: false,
        startAt: VALENTINE_MOMENT_SECONDS,
        announce: false
      });
    } else if (!hasStarted && audio.currentTime < 2) {
      seekWhenReady(VALENTINE_MOMENT_SECONDS);
    }

    if (audio.paused) playAudio();
    else audio.pause();

    if (heroNote) {
      heroNote.textContent = audio.paused
        ? "Valentine is ready in the floating playlist."
        : "Valentine is playing in the background ♥";
    }
  }

  function nextTrack({ fromEnded = false } = {}) {
    if (fromEnded && !repeatOn && !shuffleOn && currentIndex === tracks.length - 1) {
      audio.pause();
      audio.currentTime = 0;
      status.textContent = "Playlist finished ♥";
      return;
    }

    let nextIndex = currentIndex + 1;
    if (shuffleOn && tracks.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } while (nextIndex === currentIndex);
    }

    selectTrack(nextIndex, { autoplay: true });
  }

  function previousTrack() {
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    selectTrack(currentIndex - 1, { autoplay: true });
  }

  launcher.addEventListener("click", () => {
    setOpen(!shell.classList.contains("open"));
  });

  closeButton?.addEventListener("click", () => setOpen(false));

  restartButton?.addEventListener("click", () => {
    audio.currentTime = 0;
    playAudio();
  });

  songButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      selectTrack(index, { autoplay: true, startAt: 0 });
      setOpen(true);
    });
  });

  playButton.addEventListener("click", () => {
    if (audio.paused) playAudio();
    else audio.pause();
  });

  previousButton.addEventListener("click", previousTrack);
  nextButton.addEventListener("click", () => nextTrack());

  shuffleButton.addEventListener("click", () => {
    shuffleOn = !shuffleOn;
    shuffleButton.classList.toggle("active", shuffleOn);
    shuffleButton.setAttribute("aria-pressed", String(shuffleOn));
    status.textContent = shuffleOn ? "Shuffle is on" : "Shuffle is off";
    savePreferences();
  });

  repeatButton.addEventListener("click", () => {
    repeatOn = !repeatOn;
    repeatButton.classList.toggle("active", repeatOn);
    repeatButton.setAttribute("aria-pressed", String(repeatOn));
    status.textContent = repeatOn ? "Playlist repeat is on" : "Playlist repeat is off";
    savePreferences();
  });

  progress.addEventListener("input", () => {
    seeking = true;
    if (!Number.isFinite(audio.duration)) return;
    currentTimeLabel.textContent = formatTime((Number(progress.value) / 100) * audio.duration);
  });

  progress.addEventListener("change", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    }
    seeking = false;
  });

  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    savePreferences();
  });

  audio.addEventListener("loadedmetadata", () => {
    durationLabel.textContent = formatTime(audio.duration);
    if (pendingSeek > 0) seekWhenReady(pendingSeek);
  });

  audio.addEventListener("timeupdate", () => {
    if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0) {
      progress.value = String((audio.currentTime / audio.duration) * 100);
      currentTimeLabel.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener("play", () => {
    updatePlayVisuals();
    status.textContent = `Playing ${tracks[currentIndex].title}`;
    if (heroNote) heroNote.textContent = `${tracks[currentIndex].title} is playing in the background ♥`;
  });

  audio.addEventListener("pause", () => {
    updatePlayVisuals();
    if (!audio.ended) status.textContent = `Paused ${tracks[currentIndex].title}`;
  });

  audio.addEventListener("ended", () => nextTrack({ fromEnded: true }));

  audio.addEventListener("error", () => {
    status.textContent = `Could not load ${tracks[currentIndex].title}. Upload every MP3 file to GitHub.`;
    if (heroNote) heroNote.textContent = "A song file is missing. Make sure every MP3 was uploaded.";
    updatePlayVisuals();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("open") && !document.pointerLockElement) {
      setOpen(false);
    }
  });

  // Fallback only: browsers may block audible autoplay. Any ordinary click,
  // tap, or key press then resumes Valentine without requiring a special button.
  function resumeAfterBrowserBlock() {
    if (audio.paused || audio.muted) {
      audio.muted = false;
      seekWhenReady(
        audio.currentTime > 2 ? audio.currentTime : VALENTINE_MOMENT_SECONDS
      );
      playAudio();
    }

    document.removeEventListener("pointerdown", resumeAfterBrowserBlock, true);
    document.removeEventListener("click", resumeAfterBrowserBlock, true);
    document.removeEventListener("keydown", resumeAfterBrowserBlock, true);
    document.removeEventListener("touchstart", resumeAfterBrowserBlock, true);
  }

  document.addEventListener("pointerdown", resumeAfterBrowserBlock, true);
  document.addEventListener("click", resumeAfterBrowserBlock, true);
  document.addEventListener("keydown", resumeAfterBrowserBlock, true);
  document.addEventListener("touchstart", resumeAfterBrowserBlock, { capture: true, passive: true });

  try {
    const saved = JSON.parse(safeStorage.getItem(STATE_KEY));
    if (saved && typeof saved === "object") {
      audio.volume = Math.max(0, Math.min(1, Number(saved.volume ?? 0.72)));
      shuffleOn = Boolean(saved.shuffleOn);
      repeatOn = saved.repeatOn !== false;
    } else {
      audio.volume = 0.72;
    }
  } catch (_error) {
    audio.volume = 0.72;
  }

  volume.value = String(audio.volume);
  shuffleButton.classList.toggle("active", shuffleOn);
  shuffleButton.setAttribute("aria-pressed", String(shuffleOn));
  repeatButton.classList.toggle("active", repeatOn);
  repeatButton.setAttribute("aria-pressed", String(repeatOn));

  selectTrack(VALENTINE_INDEX, {
    autoplay: false,
    startAt: VALENTINE_MOMENT_SECONDS,
    announce: false
  });

  audio.autoplay = true;
  audio.muted = false;

  const attemptAutoplay = () => {
    seekWhenReady(VALENTINE_MOMENT_SECONDS);
    playAudio({ autoplayAttempt: true });
  };

  if (audio.readyState >= 2) {
    attemptAutoplay();
  } else {
    audio.addEventListener("canplay", attemptAutoplay, { once: true });
    window.setTimeout(attemptAutoplay, 900);
  }

  updatePlayVisuals();
})();

