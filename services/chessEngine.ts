import { Board, Color, Move, Piece, Position, PieceType } from '../types';

const VALS = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

export const getInitialBoard = (): Board => {
  const mk = (type: any, color: Color): Piece => ({ type, color, hasMoved: false });
  const backRow = (c: Color) => [
    mk('r', c), mk('n', c), mk('b', c), mk('q', c), mk('k', c), mk('b', c), mk('n', c), mk('r', c)
  ];

  return [
    backRow('black'),
    Array.from({ length: 8 }, () => mk('p', 'black')),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array.from({ length: 8 }, () => mk('p', 'white')),
    backRow('white')
  ];
};

const cloneBoard = (board: Board): Board => board.map(row => [...row]);

const isPathClear = (board: Board, from: Position, to: Position): boolean => {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  let r = from.r + dr;
  let c = from.c + dc;

  while (r !== to.r || c !== to.c) {
    if (board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
};

// Robust Check Detection using Ray-Casting from the target square
export const isSquareUnderAttack = (board: Board, pos: Position, attackerColor: Color): boolean => {
  // 1. Pawn Attacks
  // If attacker is White, they attack from row+1 (upwards relative to board indices? No, board 0 is top)
  // White pawns move from row 6 to 0. So they are "below" visually, high index.
  // A White pawn at [r+1] attacks [r].
  // Black pawns move from row 1 to 7. They are "above", low index.
  // A Black pawn at [r-1] attacks [r].
  
  const pawnRow = pos.r + (attackerColor === 'white' ? 1 : -1);
  if (pawnRow >= 0 && pawnRow < 8) {
    // Check Left Diagonal
    if (pos.c - 1 >= 0) {
      const p = board[pawnRow][pos.c - 1];
      if (p && p.color === attackerColor && p.type === 'p') return true;
    }
    // Check Right Diagonal
    if (pos.c + 1 < 8) {
      const p = board[pawnRow][pos.c + 1];
      if (p && p.color === attackerColor && p.type === 'p') return true;
    }
  }

  // 2. Knight Attacks
  const knightMoves = [
    { r: pos.r - 2, c: pos.c - 1 }, { r: pos.r - 2, c: pos.c + 1 },
    { r: pos.r - 1, c: pos.c - 2 }, { r: pos.r - 1, c: pos.c + 2 },
    { r: pos.r + 1, c: pos.c - 2 }, { r: pos.r + 1, c: pos.c + 2 },
    { r: pos.r + 2, c: pos.c - 1 }, { r: pos.r + 2, c: pos.c + 1 }
  ];
  for (const m of knightMoves) {
    if (m.r >= 0 && m.r < 8 && m.c >= 0 && m.c < 8) {
      const p = board[m.r][m.c];
      if (p && p.color === attackerColor && p.type === 'n') return true;
    }
  }

  // 3. King Attacks (Adjacent)
  for (let r = Math.max(0, pos.r - 1); r <= Math.min(7, pos.r + 1); r++) {
    for (let c = Math.max(0, pos.c - 1); c <= Math.min(7, pos.c + 1); c++) {
      if (r === pos.r && c === pos.c) continue;
      const p = board[r][c];
      if (p && p.color === attackerColor && p.type === 'k') return true;
    }
  }

  // 4. Sliding Attacks (Rook/Queen + Bishop/Queen)
  const directions = [
    { dr: -1, dc: 0, types: ['r', 'q'] }, // Up
    { dr: 1, dc: 0, types: ['r', 'q'] },  // Down
    { dr: 0, dc: -1, types: ['r', 'q'] }, // Left
    { dr: 0, dc: 1, types: ['r', 'q'] },  // Right
    { dr: -1, dc: -1, types: ['b', 'q'] }, // Up-Left
    { dr: -1, dc: 1, types: ['b', 'q'] },  // Up-Right
    { dr: 1, dc: -1, types: ['b', 'q'] },  // Down-Left
    { dr: 1, dc: 1, types: ['b', 'q'] }    // Down-Right
  ];

  for (const d of directions) {
    let r = pos.r + d.dr;
    let c = pos.c + d.dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r][c];
      if (p) {
        // If we hit a piece, check if it's an enemy slider of correct type
        if (p.color === attackerColor && d.types.includes(p.type)) {
          return true;
        }
        // If we hit ANY piece (friend or foe), the line is blocked
        break; 
      }
      r += d.dr;
      c += d.dc;
    }
  }

  return false;
};

export const isValidMove = (board: Board, from: Position, to: Position, turn: Color, checkSafety: boolean = true): boolean => {
  const p = board[from.r][from.c];
  const target = board[to.r][to.c];

  if (!p || p.color !== turn) return false;
  if (target && target.color === p.color) return false; // Friendly fire

  const dx = Math.abs(to.c - from.c);
  const dy = Math.abs(to.r - from.r);
  let valid = false;

  switch (p.type) {
    case 'p': {
      const dir = p.color === 'white' ? -1 : 1;
      const startRow = p.color === 'white' ? 6 : 1;
      // Move forward 1
      if (from.c === to.c && to.r === from.r + dir && !target) valid = true;
      // Move forward 2
      if (from.c === to.c && to.r === from.r + 2 * dir && from.r === startRow && !target && !board[from.r + dir][from.c]) valid = true;
      // Capture
      if (dx === 1 && to.r === from.r + dir && target) valid = true;
      break;
    }
    case 'r':
      valid = (dx === 0 || dy === 0) && isPathClear(board, from, to);
      break;
    case 'n':
      valid = (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
      break;
    case 'b':
      valid = (dx === dy) && isPathClear(board, from, to);
      break;
    case 'q':
      valid = (dx === 0 || dy === 0 || dx === dy) && isPathClear(board, from, to);
      break;
    case 'k':
      // Standard move
      if (dx <= 1 && dy <= 1) {
        valid = true;
      } 
      // Castling
      else if (dy === 0 && dx === 2 && !p.hasMoved) {
        // Cannot castle out of check
        if (checkSafety && isInCheck(board, turn)) return false;

        const row = from.r;
        const isKingSide = to.c > from.c;
        const rookCol = isKingSide ? 7 : 0;
        const rook = board[row][rookCol];

        // Check if rook exists and hasn't moved
        if (rook && rook.type === 'r' && rook.color === turn && !rook.hasMoved) {
          // Check if path is clear
          if (isPathClear(board, from, { r: row, c: rookCol })) {
            // Check if passing through check
            // The middle square is (row, from.c + 1) or (row, from.c - 1)
            const midCol = from.c + (isKingSide ? 1 : -1);
            const opponent = turn === 'white' ? 'black' : 'white';
            
            // Only check safety if required (prevents infinite recursion if used in attack detection)
            if (checkSafety && isSquareUnderAttack(board, { r: row, c: midCol }, opponent)) {
              return false;
            }
            valid = true;
          }
        }
      }
      break;
  }

  // KING SAFETY CHECK
  // If the move is geometrically valid, we must ensure it doesn't leave the King in check.
  if (valid && checkSafety) {
    // Simulate move to see if King is in check
    const newBoard = applyMove(board, { from, to });
    if (isInCheck(newBoard, turn)) return false;
  }

  return valid;
};

// Helper to get all valid moves for a specific piece (for UI highlighting)
export const getValidMoves = (board: Board, from: Position): Position[] => {
  const moves: Position[] = [];
  const p = board[from.r][from.c];
  if (!p) return [];

  // Iterate all squares (simple approach)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isValidMove(board, from, { r, c }, p.color, true)) {
        moves.push({ r, c });
      }
    }
  }
  return moves;
};

export const applyMove = (board: Board, move: Move, promoteTo?: PieceType): Board => {
  const newBoard = cloneBoard(board);
  // CRITICAL: Create a copy of the piece to avoid mutating the previous state in history/AI
  const p = { ...newBoard[move.from.r][move.from.c]! };

  if (!p) return newBoard;

  // Mark piece as moved
  p.hasMoved = true;

  // Handle Castling (King moves 2 squares)
  if (p.type === 'k' && Math.abs(move.to.c - move.from.c) === 2) {
    const row = move.from.r;
    const isKingSide = move.to.c > move.from.c;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? 5 : 3;

    const rook = { ...newBoard[row][rookFromCol]! };
    rook.hasMoved = true;
    
    newBoard[row][rookToCol] = rook;
    newBoard[row][rookFromCol] = null;
  }

  newBoard[move.to.r][move.to.c] = p;
  newBoard[move.from.r][move.from.c] = null;

  // Handle promotion (default to Queen if not specified)
  if (p.type === 'p' && (move.to.r === 0 || move.to.r === 7)) {
    p.type = promoteTo || 'q';
  }

  return newBoard;
};

export const isInCheck = (board: Board, color: Color): boolean => {
  // Find King
  let kPos: Position | null = null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        kPos = { r, c };
        break;
      }
    }
  }
  if (!kPos) return true; // King missing

  // Check if any enemy piece attacks King
  const opponent = color === 'white' ? 'black' : 'white';
  return isSquareUnderAttack(board, kPos, opponent);
};

const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        score += (p.color === 'black' ? 1 : -1) * VALS[p.type];
      }
    }
  }
  return score;
};

export const getAllMoves = (board: Board, color: Color): Move[] => {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.color === color) {
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (isValidMove(board, { r, c }, { r: tr, c: tc }, color, true)) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc } });
            }
          }
        }
      }
    }
  }
  return moves;
};

// Minimax with Alpha-Beta Pruning
export const getBestMove = (board: Board, depth: number): Move | null => {
  const moves = getAllMoves(board, 'black');
  if (moves.length === 0) return null;

  // Simple shuffle to add variety
  moves.sort(() => Math.random() - 0.5);

  let bestMove: Move | null = null;
  let maxVal = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const val = minimax(nextBoard, depth - 1, alpha, beta, false);
    if (val > maxVal) {
      maxVal = val;
      bestMove = move;
    }
    alpha = Math.max(alpha, val);
    if (beta <= alpha) break;
  }

  return bestMove;
};

const minimax = (board: Board, depth: number, alpha: number, beta: number, isMaximizing: boolean): number => {
  if (depth === 0) return evaluateBoard(board);

  const color = isMaximizing ? 'black' : 'white';
  const moves = getAllMoves(board, color);

  if (moves.length === 0) {
    // Check if checkmate or stalemate
    if (isInCheck(board, color)) {
      return isMaximizing ? -9999 : 9999;
    }
    return 0; // Stalemate
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nextBoard = applyMove(board, move);
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nextBoard = applyMove(board, move);
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getSan = (prevBoard: Board, nextBoard: Board, move: Move, promoteTo?: PieceType): string => {
  const piece = prevBoard[move.from.r][move.from.c]!;
  if (!piece) return '';

  const fromFile = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][move.from.c];
  const toFile = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][move.to.c];
  const toRank = 8 - move.to.r;
  const dest = `${toFile}${toRank}`;

  // Castling
  if (piece.type === 'k' && Math.abs(move.to.c - move.from.c) === 2) {
    let san = move.to.c > move.from.c ? 'O-O' : 'O-O-O';
    // Check suffixes
    const opponent = piece.color === 'white' ? 'black' : 'white';
    if (isInCheck(nextBoard, opponent)) {
      san += getAllMoves(nextBoard, opponent).length === 0 ? '#' : '+';
    }
    return san;
  }

  let san = '';
  const isCapture = prevBoard[move.to.r][move.to.c] !== null;

  if (piece.type === 'p') {
    if (isCapture) {
      san = `${fromFile}x${dest}`;
    } else {
      san = dest;
    }
    if (promoteTo) {
      san += `=${promoteTo.toUpperCase()}`;
    }
  } else {
    san = piece.type.toUpperCase();
    
    // Disambiguation
    // Find other pieces of same type and color that can also move to the destination
    const others: Position[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === move.from.r && c === move.from.c) continue; // Skip self
        const p = prevBoard[r][c];
        if (p && p.type === piece.type && p.color === piece.color) {
          if (isValidMove(prevBoard, { r, c }, move.to, piece.color, true)) {
            others.push({ r, c });
          }
        }
      }
    }

    if (others.length > 0) {
      let fileMatch = false;
      let rankMatch = false;
      
      for (const o of others) {
        if (o.c === move.from.c) fileMatch = true;
        if (o.r === move.from.r) rankMatch = true;
      }

      if (!fileMatch) {
        san += fromFile;
      } else if (!rankMatch) {
        san += (8 - move.from.r).toString();
      } else {
        san += fromFile + (8 - move.from.r).toString();
      }
    }

    if (isCapture) san += 'x';
    san += dest;
  }

  // Check / Mate detection
  const opponent = piece.color === 'white' ? 'black' : 'white';
  if (isInCheck(nextBoard, opponent)) {
    // Check for checkmate
    const moves = getAllMoves(nextBoard, opponent);
    if (moves.length === 0) {
      san += '#';
    } else {
      san += '+';
    }
  }

  return san;
};