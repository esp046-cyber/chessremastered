import React from 'react';
import { Piece, Position } from '../types';

interface SquareProps {
  r: number;
  c: number;
  piece: Piece | null;
  isDark: boolean;
  isSelected: boolean;
  isLastMove: boolean;
  isCaptureSquare: boolean;
  isValidTarget: boolean;
  capturedPiece: Piece | null;
  onClick: () => void;
}

const PIECE_MAP: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

const Square: React.FC<SquareProps> = ({ 
  r, c, piece, isDark, isSelected, isLastMove, isCaptureSquare, capturedPiece, isValidTarget, onClick 
}) => {
  
  // Default Board Colors
  let bgClass = isDark ? 'bg-[#769656]' : 'bg-[#eeeed2]';

  // Highlight Logic
  // Last Move: Subtle yellow-green
  if (isLastMove) {
    bgClass = 'bg-[#bbcb2b]';
  }
  
  // Selection: Distinct bright yellow (Overrides last move)
  if (isSelected) {
    bgClass = 'bg-[#f6f669]'; 
  }

  const symbol = piece ? PIECE_MAP[piece.color[0] + piece.type] : '';
  const capturedSymbol = capturedPiece ? PIECE_MAP[capturedPiece.color[0] + capturedPiece.type] : '';

  return (
    <div 
      onClick={onClick}
      className={`relative w-full h-full flex items-center justify-center text-4xl sm:text-5xl cursor-pointer select-none ${bgClass} transition-colors duration-150 group`}
    >
      {/* Click/Touch Feedback Overlay */}
      <div className="absolute inset-0 z-0 bg-white/0 group-active:bg-white/30 transition-colors duration-75 pointer-events-none" />

      {/* Selection Inner Border */}
      {isSelected && (
        <div className="absolute inset-0 border-4 border-black/10 pointer-events-none z-10"></div>
      )}

      {/* Capture Animation (Red Ping) */}
      {isCaptureSquare && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-red-600/50 animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_1_forwards]" />
        </div>
      )}
      
      {/* Capture Piece Vanishing Animation */}
      {capturedPiece && (
        <span 
          key={`cap-${capturedPiece.type}-${capturedPiece.color}-${r}-${c}`}
          className="absolute z-30 font-chess text-black animate-capture-disappear pointer-events-none select-none"
        >
          {capturedSymbol}
        </span>
      )}

      {/* Move Hint (Dot for empty squares) */}
      {isValidTarget && !piece && (
        <div className="absolute w-[30%] h-[30%] bg-black/30 rounded-full pointer-events-none z-10"></div>
      )}
      
      {/* Capture Hint (Ring for occupied squares) */}
      {isValidTarget && piece && (
        <div className="absolute w-full h-full border-[8px] border-black/30 rounded-full pointer-events-none z-10"></div>
      )}

      {/* Current Chess Piece */}
      {piece && (
        <span 
          key={`${piece.type}-${piece.color}-${r}-${c}`} 
          className="z-10 drop-shadow-sm font-chess text-black animate-pop transition-all duration-200 ease-out group-hover:scale-115 group-hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        >
          {symbol}
        </span>
      )}
    </div>
  );
};

export default Square;