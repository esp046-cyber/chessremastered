
export type Color = 'white' | 'black';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type GameMode = 'AI' | 'Human';

export interface Piece {
  type: PieceType;
  color: Color;
  hasMoved?: boolean;
}

export type Board = (Piece | null)[][];

export interface Position {
  r: number;
  c: number;
}

export interface Move {
  from: Position;
  to: Position;
}

export interface MoveRecord {
  from: Position;
  to: Position;
  color: Color;
  piece: PieceType;
  promotion?: PieceType;
  san: string;
}

export interface GameState {
  board: Board;
  turn: Color;
  selected: Position | null;
  validMoves: Position[];
  lastMove: Move | null;
  lastCapture: Position | null;
  lastCapturedPiece: Piece | null; // Added for animations
  history: MoveRecord[];
  timers: { white: number; black: number };
  gameOver: boolean;
  winner: Color | 'draw' | null;
  statusMessage: string;
  isAiThinking: boolean;
  promotionPending: Move | null;
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  gameMode: GameMode;
}
