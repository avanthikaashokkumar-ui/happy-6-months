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
    this._render("Choose a piece, then place it on the board.");
  },

  _selectPiece(id) {
    this._selectedPieceId = this._selectedPieceId === id ? null : id;
    this._hoverCell = null;
    this._render("");
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
        const cell = document.createElement("div");
        cell.className = "bb-cell";
        if (this._grid[r][c]) {
          cell.classList.add("filled");
          cell.style.setProperty("--bb-color", this._grid[r][c]);
        }
        if (selected && this._hoverCell) {
          const { row: hr, col: hc } = this._hoverCell;
          if (selected.shape.some(([dr,dc]) => hr + dr === r && hc + dc === c)) {
            cell.classList.add(fits(this._grid, selected.shape, hr, hc) ? "preview-ok" : "preview-bad");
          }
        }
        cell.addEventListener("pointerenter", () => {
          if (!selected) return;
          this._hoverCell = { row: r, col: c };
          this._render(message);
        });
        cell.addEventListener("click", () => this._placeAt(r,c));
        board.appendChild(cell);
      }
    }

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
const WORLD_RADIUS = 12;
const SAVE_KEY = "happySixMonthsBennyWorldV3";
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.28;
const MAX_REACH = 6;

const BLOCKS = {
  grass:  { label: "Grass",  icon: "🌿", top: "#70b84d", side: "#568d3b", dark: "#3f6f2d" },
  dirt:   { label: "Dirt",   icon: "🟫", top: "#a8754e", side: "#8a5e3e", dark: "#68452e" },
  stone:  { label: "Stone",  icon: "🪨", top: "#aaa9a5", side: "#85847f", dark: "#666561" },
  wood:   { label: "Wood",   icon: "🪵", top: "#c39055", side: "#9e6e3d", dark: "#744d2b" },
  planks: { label: "Planks", icon: "🏠", top: "#d0a363", side: "#b17e43", dark: "#865d31" },
  glass:  { label: "Glass",  icon: "◇",  top: "rgba(196,232,244,.58)", side: "rgba(142,202,225,.48)", dark: "rgba(95,166,197,.5)" },
  leaves: { label: "Leaves", icon: "🍃", top: "#4d9950", side: "#3c7d40", dark: "#2e6534" },
  water:  { label: "Water",  icon: "💧", top: "rgba(73,157,218,.72)", side: "rgba(44,118,178,.66)", dark: "rgba(31,87,143,.7)" },
  flower: { label: "Flower", icon: "🌹", top: "#d84662", side: "#a52e45", dark: "#772234" },
  bedrock:{ label: "Bedrock",icon: "⬛", top: "#4a4849", side: "#343233", dark: "#242223" }
};

const HOTBAR = ["grass", "dirt", "stone", "wood", "planks", "glass"];
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
function seededHeight(x, z) {
  const wave = Math.sin(x * .42) * .7 + Math.cos(z * .37) * .62 + Math.sin((x + z) * .22) * .38;
  return clamp(2 + Math.round(wave), 1, 4);
}

function createWorld() {
  const world = new Map();
  for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
    for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
      let height = seededHeight(x, z);
      const pond = x >= -7 && x <= -3 && z >= 4 && z <= 8;
      if (pond) height = 1;
      world.set(key(x, 0, z), "bedrock");
      for (let y = 1; y <= height; y++) {
        const type = y === height ? (pond ? "sand" : "grass") : y >= height - 1 ? "dirt" : "stone";
        world.set(key(x, y, z), type === "sand" ? "dirt" : type);
      }
      if (pond) world.set(key(x, 2, z), "water");
    }
  }

  const trees = [[-8,-6],[8,-7],[7,7],[-9,8],[4,-10]];
  for (const [x,z] of trees) addTree(world, x, z);
  const flowers = [[-2,-3],[0,-5],[3,-4],[-6,-1],[5,4],[8,2],[-1,8]];
  for (const [x,z] of flowers) {
    const y = highestSolid(world, x, z);
    if (y > 0) world.set(key(x, y, z), "flower");
  }

  // A tiny starting shelter so the world already feels alive.
  const baseX = 4, baseZ = 3;
  const ground = highestSolid(world, baseX, baseZ);
  for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) world.set(key(baseX + dx, ground, baseZ + dz), "planks");
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      if (!(dx === 1 && dy <= 2)) world.set(key(baseX + dx, ground + dy, baseZ), "planks");
      world.set(key(baseX + dx, ground + dy, baseZ + 3), dx === 1 && dy === 2 ? "glass" : "planks");
    }
    for (let dz = 1; dz < 3; dz++) {
      world.set(key(baseX, ground + dy, baseZ + dz), "planks");
      world.set(key(baseX + 3, ground + dy, baseZ + dz), dy === 2 ? "glass" : "planks");
    }
  }
  for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 4; dz++) world.set(key(baseX + dx, ground + 4, baseZ + dz), "wood");
  return world;
}

function addTree(world, x, z) {
  const ground = highestSolid(world, x, z);
  if (ground < 1) return;
  for (let y = ground; y < ground + 4; y++) world.set(key(x, y, z), "wood");
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 2; dy <= 4; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) <= 4) world.set(key(x + dx, ground + dy, z + dz), "leaves");
      }
    }
  }
}

function highestSolid(world, x, z) {
  let highest = 1;
  for (const [id, type] of world) {
    const [bx, by, bz] = parseKey(id);
    if (bx === x && bz === z && type !== "water" && type !== "flower" && type !== "leaves") highest = Math.max(highest, by + 1);
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

  mount(root) {
    this._root = root;
    this._world = this._loadWorld() || createWorld();
    this._player = { x: 0.5, y: highestSolid(this._world, 0, -2), z: -2.5, yaw: 0, pitch: -0.08, vy: 0, grounded: true };
    this._benny = { x: 1.5, z: 1.5, y: highestSolid(this._world, 1, 1), yaw: Math.PI, tamed: this._loadTamed(), phase: 0, petBoost: 0 };
    this._selected = 0;
    this._keys = new Set();
    this._buildUI();
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
              <div class="mc-stat" data-mc-stat>Creative mode · Benny is nearby</div>
              <div class="mc-help">WASD move · mouse look · Space jump · left-click mine · right-click build · E tame/pet · 1–6 blocks</div>
            </div>
            <div class="mc-crosshair"></div>
            <div class="mc-message" data-mc-message></div>
            <div class="mc-interact" data-mc-interact>Press E to tame Benny ♥</div>
            <div class="mc-hotbar" data-mc-hotbar></div>
            <div class="mc-lock-screen" data-mc-lock>
              <div class="mc-lock-card">
                <h3>Enter Benny’s Block World</h3>
                <p>This is a real-time, first-person browser voxel world. Explore, mine blocks, build a house, and find Benny.</p>
                <button class="mc-start" type="button">Start exploring</button>
              </div>
            </div>
            <div class="mc-mobile-controls">
              <div class="mc-pad">
                <button class="mc-mobile-btn mc-up" data-move="KeyW">▲</button>
                <button class="mc-mobile-btn mc-left" data-move="KeyA">◀</button>
                <button class="mc-mobile-btn mc-right" data-move="KeyD">▶</button>
                <button class="mc-mobile-btn mc-down" data-move="KeyS">▼</button>
              </div>
              <div class="mc-action-stack">
                <button data-action="jump">Jump</button>
                <button data-action="mine">Mine</button>
                <button data-action="build">Build</button>
                <button data-action="tame">Tame / Pet</button>
              </div>
            </div>
          </div>
        </div>
        <div class="mc-benny-panel">
          <img class="mc-benny-photo" src="benny-standing.jpeg" alt="Benny standing happily on his back legs" />
          <div class="mc-benny-copy">
            <h3>Meet Benny 🐕</h3>
            <p>The animated block dog inside the world is based on Benny. Walk close and press <strong>E</strong> to tame him. After that, he follows you while you mine and build your house.</p>
            <div class="game-controls" style="justify-content:flex-start;margin:12px 0 0">
              <button class="btn secondary" data-mc-save type="button">Save world</button>
              <button class="btn secondary" data-mc-reset type="button">Reset world</button>
            </div>
            <p class="mc-disclaimer">This is an original Minecraft-inspired browser sandbox, not Minecraft, TLauncher, Mojang, or an official clone.</p>
          </div>
        </div>
      </div>`;
    this._root.replaceChildren(panel);
    this._canvas = panel.querySelector("canvas");
    this._ctx = this._canvas.getContext("2d");
    this._renderHotbar();

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
      if (document.pointerLockElement !== this._canvas && matchMedia("(pointer:fine)").matches) lock.style.display = "grid";
    });

    this._on(document, "keydown", (event) => {
      if (!this._root) return;
      if (["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft"].includes(event.code)) {
        this._keys.add(event.code);
        event.preventDefault();
      }
      if (/^Digit[1-6]$/.test(event.code)) {
        this._selected = Number(event.code.slice(-1)) - 1;
        this._renderHotbar();
      }
      if (event.code === "KeyE") this._interactWithBenny();
      if (event.code === "KeyR") this._saveWorld();
    });
    this._on(document, "keyup", (event) => this._keys.delete(event.code));
    this._on(document, "mousemove", (event) => {
      if (document.pointerLockElement !== this._canvas) return;
      this._player.yaw -= event.movementX * .00235;
      this._player.pitch = clamp(this._player.pitch - event.movementY * .0022, -1.25, 1.25);
    });
    this._on(this._canvas, "contextmenu", (event) => event.preventDefault());
    this._on(this._canvas, "mousedown", (event) => {
      if (document.pointerLockElement !== this._canvas) return;
      if (event.button === 0) this._mine();
      if (event.button === 2) this._build();
    });

    // Touch drag controls camera direction.
    this._on(this._canvas, "pointerdown", (event) => {
      if (event.pointerType === "touch") this._mobileLook = { x: event.clientX, y: event.clientY };
    });
    this._on(this._canvas, "pointermove", (event) => {
      if (event.pointerType !== "touch" || !this._mobileLook) return;
      const dx = event.clientX - this._mobileLook.x;
      const dy = event.clientY - this._mobileLook.y;
      this._player.yaw -= dx * .008;
      this._player.pitch = clamp(this._player.pitch - dy * .006, -1.2, 1.2);
      this._mobileLook = { x: event.clientX, y: event.clientY };
    });
    this._on(this._canvas, "pointerup", () => { this._mobileLook = null; });

    this._root.querySelectorAll("[data-move]").forEach((button) => {
      const code = button.dataset.move;
      this._on(button, "pointerdown", (event) => { event.preventDefault(); this._keys.add(code); });
      this._on(button, "pointerup", () => this._keys.delete(code));
      this._on(button, "pointercancel", () => this._keys.delete(code));
    });
    this._root.querySelectorAll("[data-action]").forEach((button) => {
      this._on(button, "click", () => {
        const action = button.dataset.action;
        if (action === "jump") this._keys.add("Space"), setTimeout(() => this._keys.delete("Space"), 120);
        if (action === "mine") this._mine();
        if (action === "build") this._build();
        if (action === "tame") this._interactWithBenny();
      });
    });
    this._on(this._root.querySelector("[data-mc-save]"), "click", () => this._saveWorld(true));
    this._on(this._root.querySelector("[data-mc-reset]"), "click", () => {
      if (!confirm("Reset the block world and Benny's tame status?")) return;
      safeStorage.removeItem(SAVE_KEY);
      safeStorage.removeItem(`${SAVE_KEY}:tamed`);
      this._world = createWorld();
      this._benny = { x: 1.5, z: 1.5, y: highestSolid(this._world, 1, 1), yaw: Math.PI, tamed: false, phase: 0, petBoost: 0 };
      this._player.x = .5; this._player.z = -2.5; this._player.y = highestSolid(this._world, 0, -2);
      this._showMessage("The world has been reset.");
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
    this._target = this._raycast();

    const near = distance2D(p, this._benny) < 2.7;
    const prompt = this._root.querySelector("[data-mc-interact]");
    prompt.textContent = this._benny.tamed ? "Press E to pet Benny ♥" : "Press E to tame Benny ♥";
    prompt.classList.toggle("show", near);
    const stat = this._root.querySelector("[data-mc-stat]");
    stat.textContent = `${this._benny.tamed ? "Benny tamed ♥" : "Find and tame Benny"} · ${BLOCKS[HOTBAR[this._selected]].label} selected`;
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
        if (type && type !== "water" && type !== "flower" && type !== "leaves") return true;
      }
    }
    return false;
  },

  _groundAt(x, z) {
    const bx = Math.floor(x), bz = Math.floor(z);
    let top = 1;
    for (let y = 0; y < 16; y++) {
      const type = this._world.get(key(bx,y,bz));
      if (type && type !== "water" && type !== "flower" && type !== "leaves") top = y + 1;
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

  _interactWithBenny() {
    if (distance2D(this._player, this._benny) >= 3) return this._showMessage("Benny is too far away. Walk closer.");
    if (!this._benny.tamed) {
      this._benny.tamed = true;
      safeStorage.setItem(`${SAVE_KEY}:tamed`, "true");
      this._benny.petBoost = 2;
      this._showMessage("Benny is tamed! He will follow you everywhere. ♥");
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
    this._showMessage(`${BLOCKS[target.type]?.label || target.type} mined.`);
  },

  _build() {
    const target = this._raycast();
    if (!target) return this._showMessage("Look at a block before building.");
    const { x,y,z } = target.place;
    if (y < 0 || y > 14) return;
    const nearPlayer = Math.abs(this._player.x - (x + .5)) < .75 && Math.abs(this._player.z - (z + .5)) < .75 && y >= Math.floor(this._player.y) && y <= Math.floor(this._player.y + 1.8);
    const nearBenny = Math.abs(this._benny.x - (x + .5)) < .7 && Math.abs(this._benny.z - (z + .5)) < .7 && y <= this._benny.y + 1;
    if (nearPlayer || nearBenny) return this._showMessage("That space is occupied.");
    this._world.set(key(x,y,z), HOTBAR[this._selected]);
    this._showMessage(`${BLOCKS[HOTBAR[this._selected]].label} placed.`);
  },

  _cameraTransform(point) {
    const p = this._player;
    const dx = point.x - p.x;
    const dy = point.y - (p.y + EYE_HEIGHT);
    const dz = point.z - p.z;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const x1 = cy * dx - sy * dz;
    const z1 = sy * dx + cy * dz;
    const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const y2 = cp * dy - sp * z1;
    const z2 = sp * dy + cp * z1;
    return { x: x1, y: y2, z: z2 };
  },

  _project(point, width, height) {
    const v = this._cameraTransform(point);
    if (v.z <= .08) return null;
    const focal = Math.min(width, height) * .92;
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
    sky.addColorStop(0,"#79bce9");
    sky.addColorStop(.58,"#c4e6f6");
    sky.addColorStop(.59,"#d8e8ce");
    sky.addColorStop(1,"#688f54");
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,width,height);
    this._drawSky(ctx,width,height,time);

    const faces = [];
    const px = this._player.x, pz = this._player.z;
    for (const [id,type] of this._world) {
      const [x,y,z] = parseKey(id);
      if ((x - px) ** 2 + (z - pz) ** 2 > 24 ** 2) continue;
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
    this._addBennyFaces(faces,width,height,time);
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
    }

    this._drawBennyName(ctx,width,height);
    this._drawTargetOutline(ctx,width,height);
  },

  _drawSky(ctx,width,height,time) {
    ctx.save();
    ctx.fillStyle = "rgba(255,245,190,.94)";
    ctx.beginPath();
    ctx.arc(width * .82, height * .18, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
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

  _addBennyFaces(faces,width,height,time) {
    const b=this._benny;
    const moving = b.tamed ? distance2D(b,this._player)>1.7 : true;
    const walk = moving ? Math.sin(b.phase*1.7)*.07 : 0;
    const bounce = moving ? Math.abs(Math.sin(b.phase*1.7))*.05 : 0;
    const base={x:b.x,y:b.y+bounce,z:b.z};
    const tan="#d5b58c", cream="#ead7bb", dark="#5c3d36", collar="#8f1730";
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
  },

  _drawBennyName(ctx,width,height) {
    const point=this._project({x:this._benny.x,y:this._benny.y+1.45,z:this._benny.z},width,height);
    if(!point||point.z>24)return;
    const label=this._benny.tamed?"Benny ♥  Tamed":"Benny";
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
      if(showMessage)this._showMessage("World saved in this browser.");
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
const games = {
  wordle: {
    title: "Cute Memory Wordle",
    emoji: "💌",
    tagline: "Take real guesses and uncover a cute five-letter memory word.",
    module: wordle
  },
  sudoku: {
    title: "Easy Sudoku",
    emoji: "🔢",
    tagline: "A gentle puzzle with hints whenever you need one.",
    module: sudoku
  },
  chess: {
    title: "Chess",
    emoji: "♟️",
    tagline: "A polished chess board for two players or one player versus Benny Bot.",
    module: chess
  },
  blockblast: {
    title: "Block Blast",
    emoji: "🧩",
    tagline: "Place colorful pieces, clear lines, and build a combo streak.",
    module: blockblast
  },
  minecraft: {
    title: "Benny’s Block World",
    emoji: "🐕",
    tagline: "A browser-built 3D voxel world where you can mine, build, explore, and tame Benny.",
    module: minecraft
  },
  solitaire: {
    title: "Solitaire",
    emoji: "🃏",
    tagline: "Classic one-card Klondike inspired by the clean Google Solitaire layout.",
    module: solitaire
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
  activeGame.mount(gameRoot);
  backButton.focus({ preventScroll: true });
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
