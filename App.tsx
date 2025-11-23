
import React, { useState, useEffect, useRef } from 'react';
import { GameState, MoveRecord, PieceType, Position, GameMode, Move, Piece } from './types';
import { getInitialBoard, applyMove, getBestMove, getValidMoves, getSan, getAllMoves, isInCheck } from './services/chessEngine';
import { playSound, startAudioEngine } from './services/audioService';
import Square from './components/Square';
import HUD from './components/HUD';

// Mapping for promotion modal symbols
const PIECE_MAP: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const App: React.FC = () => {
  // Initialize Game Mode from Local Storage or default to AI
  const getSavedMode = (): GameMode => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('chess.gameMode') as GameMode) || 'AI';
    }
    return 'AI';
  };

  const [gameState, setGameState] = useState<GameState>({
    board: getInitialBoard(),
    turn: 'white',
    selected: null,
    validMoves: [],
    lastMove: null,
    lastCapture: null,
    lastCapturedPiece: null, // Initialize
    history: [],
    timers: { white: 600, black: 600 },
    gameOver: false,
    winner: null,
    statusMessage: 'Your Turn',
    isAiThinking: false,
    promotionPending: null,
    capturedByWhite: [],
    capturedByBlack: [],
    gameMode: getSavedMode(),
  });

  // Initialize difficulty from localStorage or default to 2 (Medium)
  const [difficulty, setDifficulty] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chess.difficulty');
      return saved ? parseInt(saved) : 2;
    }
    return 2;
  });

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDifficultyChange = (newDiff: number) => {
    setDifficulty(newDiff);
    localStorage.setItem('chess.difficulty', newDiff.toString());
  };

  const unlockAudio = () => {
    if (!audioUnlocked) {
      startAudioEngine();
      setAudioUnlocked(true);
    }
  };

  // FAILSAFE: Ensure AI Thinking is NEVER true in Human Mode
  useEffect(() => {
    if (gameState.gameMode === 'Human' && gameState.isAiThinking) {
      setGameState(prev => ({ ...prev, isAiThinking: false, statusMessage: "Black's Turn" }));
    }
  }, [gameState.gameMode, gameState.isAiThinking]);

  const saveGame = () => {
    unlockAudio();
    if (gameState.isAiThinking) {
      showNotification("Wait for AI to finish.");
      return;
    }
    try {
      localStorage.setItem('chess.savedGame', JSON.stringify(gameState));
      showNotification("Game Saved Successfully!");
    } catch (e) {
      console.error("Save error:", e);
      showNotification("Failed to save game.");
    }
  };

  const loadGame = () => {
    unlockAudio();
    if (gameState.isAiThinking) {
      showNotification("Wait for AI to finish.");
      return;
    }
    try {
      const saved = localStorage.getItem('chess.savedGame');
      if (!saved) {
        showNotification("No saved game found.");
        return;
      }
      
      if (gameState.history.length > 0 && !window.confirm("Load saved game? Current progress will be lost.")) return;

      const loadedState: GameState = JSON.parse(saved);
      
      // Basic sanity check
      if (!loadedState.board || !loadedState.turn) {
        throw new Error("Invalid save data");
      }
      
      // Ensure gameMode exists for older saves
      if (!loadedState.gameMode) {
        loadedState.gameMode = 'AI';
      }

      setGameState(loadedState);
      showNotification("Game Loaded!");
    } catch (e) {
      console.error("Load error:", e);
      showNotification("Failed to load: Save corrupted.");
    }
  };

  // Undo Move Logic
  const undoMove = () => {
    unlockAudio();
    if (gameState.isAiThinking || gameState.history.length === 0) return;

    let steps = 1;
    if (gameState.gameMode === 'AI') {
      const lastMoveColor = gameState.history[gameState.history.length - 1].color;
      // If last move was Black (AI), undo 2 to get back to user. If White (Player), undo 1.
      if (lastMoveColor === 'black') steps = 2;
      else steps = 1;

      // Prevent negative history slice
      if (gameState.history.length < 2 && steps === 2) steps = 1;
    }

    const newHistory = gameState.history.slice(0, -steps);
    
    // Replay Logic
    let replayBoard = getInitialBoard();
    let replayTurn: 'white' | 'black' = 'white';
    let replayCapturedWhite: PieceType[] = [];
    let replayCapturedBlack: PieceType[] = [];
    let replayLastMove: Move | null = null;
    let replayLastCapture: Position | null = null;
    let replayLastCapturedPiece: Piece | null = null;

    for (const record of newHistory) {
      const from = record.from;
      const to = record.to;
      const target = replayBoard[to.r][to.c];
      
      if (target) {
        const list = replayTurn === 'white' ? replayCapturedWhite : replayCapturedBlack;
        list.push(target.type);
        list.sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
        replayLastCapture = to;
        replayLastCapturedPiece = target;
      } else {
        replayLastCapture = null;
        replayLastCapturedPiece = null;
      }

      replayBoard = applyMove(replayBoard, { from, to }, record.promotion);
      replayLastMove = { from, to };
      replayTurn = replayTurn === 'white' ? 'black' : 'white';
    }

    setGameState(prev => ({
      ...prev,
      board: replayBoard,
      turn: replayTurn,
      history: newHistory,
      lastMove: replayLastMove,
      lastCapture: replayLastCapture,
      lastCapturedPiece: replayLastCapturedPiece,
      capturedByWhite: replayCapturedWhite,
      capturedByBlack: replayCapturedBlack,
      gameOver: false,
      winner: null,
      selected: null,
      validMoves: [],
      promotionPending: null,
      statusMessage: prev.gameMode === 'AI' ? 'Your Turn' : (replayTurn === 'white' ? "White's Turn" : "Black's Turn")
    }));
    
    playSound('move');
  };

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (!gameState.gameOver && !gameState.winner && !gameState.promotionPending) {
      interval = setInterval(() => {
        setGameState(prev => {
          if (prev.timers[prev.turn] <= 0) {
            return {
              ...prev,
              gameOver: true,
              winner: prev.turn === 'white' ? 'black' : 'white',
              statusMessage: 'Time Up!',
            };
          }
          return {
            ...prev,
            timers: { ...prev.timers, [prev.turn]: prev.timers[prev.turn] - 1 }
          };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.gameOver, gameState.winner, gameState.turn, gameState.promotionPending]);

  // Audio & AI Effects
  useEffect(() => {
    const lastMove = gameState.history[gameState.history.length - 1];
    if (!lastMove) return;
    const san = lastMove.san;
    if (san.includes('#') || san.includes('+')) playSound('notify');
    else if (san.includes('=')) playSound('promote');
    else if (san.includes('x')) playSound('capture');
    else if (san.includes('O-O')) playSound('castle');
    else playSound('move');
  }, [gameState.history]);

  useEffect(() => {
    if (gameState.gameOver && gameState.statusMessage === 'Time Up!') {
      playSound('notify');
    }
  }, [gameState.gameOver, gameState.statusMessage]);

  // AI Trigger
  useEffect(() => {
    if (gameState.gameMode === 'AI' && !gameState.gameOver && gameState.turn === 'black' && !gameState.isAiThinking && !gameState.promotionPending) {
      setGameState(prev => ({ ...prev, isAiThinking: true, statusMessage: 'AI Thinking...' }));
      const timerId = setTimeout(() => {
        try {
          const bestMove = getBestMove(gameState.board, difficulty);
          if (bestMove) {
            handleMove(bestMove.from, bestMove.to, true);
          } else {
            const inCheck = isInCheck(gameState.board, 'black');
            setGameState(prev => ({
              ...prev,
              gameOver: true,
              winner: inCheck ? 'white' : 'draw',
              statusMessage: inCheck ? 'Checkmate! You Win!' : 'Stalemate! It\'s a Draw.',
              isAiThinking: false
            }));
          }
        } catch (error) {
          console.error("AI Error:", error);
          setGameState(prev => ({ ...prev, isAiThinking: false, statusMessage: 'AI Error - Please try moving again' }));
        }
      }, 100);
      return () => clearTimeout(timerId);
    }
  }, [gameState.turn, gameState.gameOver, gameState.promotionPending, difficulty, gameState.gameMode]);

  // Game Over Detection
  useEffect(() => {
    if (!gameState.gameOver) {
      const shouldCheck = gameState.gameMode === 'Human' || gameState.turn === 'white';
      if (shouldCheck) {
        const timer = setTimeout(() => {
          const moves = getAllMoves(gameState.board, gameState.turn);
          if (moves.length === 0) {
            const inCheck = isInCheck(gameState.board, gameState.turn);
            const winner = inCheck ? (gameState.turn === 'white' ? 'black' : 'white') : 'draw';
            let msg = '';
            if (!inCheck) msg = "Stalemate! It's a Draw.";
            else if (gameState.gameMode === 'AI') msg = "Checkmate! You Lost.";
            else msg = `Checkmate! ${winner === 'white' ? 'White' : 'Black'} Wins!`;
            setGameState(prev => ({ ...prev, gameOver: true, winner: winner, statusMessage: msg }));
            playSound('notify');
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.board, gameState.turn, gameState.gameOver, gameState.gameMode]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.history]);

  const handleSquareClick = (r: number, c: number) => {
    unlockAudio();

    if (gameState.gameOver || gameState.promotionPending) return;
    if (gameState.isAiThinking) return;
    if (gameState.gameMode === 'AI' && gameState.turn === 'black') return;

    const clickedPos = { r, c };
    const piece = gameState.board[r][c];

    if (!gameState.selected) {
      if (piece && piece.color === gameState.turn) {
        const moves = getValidMoves(gameState.board, clickedPos);
        setGameState(prev => ({ ...prev, selected: clickedPos, validMoves: moves }));
      }
      return;
    }

    if (gameState.selected.r === r && gameState.selected.c === c) {
      setGameState(prev => ({ ...prev, selected: null, validMoves: [] }));
    } else if (piece && piece.color === gameState.turn) {
      const moves = getValidMoves(gameState.board, clickedPos);
      setGameState(prev => ({ ...prev, selected: clickedPos, validMoves: moves }));
    } else {
      const isMoveValid = gameState.validMoves.some(m => m.r === r && m.c === c);
      if (isMoveValid) {
        const sourcePiece = gameState.board[gameState.selected.r][gameState.selected.c];
        const isPawn = sourcePiece?.type === 'p';
        const isPromotionRow = clickedPos.r === 0 || clickedPos.r === 7;

        if (isPawn && isPromotionRow) {
          setGameState(prev => ({ ...prev, promotionPending: { from: prev.selected!, to: clickedPos } }));
          return;
        }
        handleMove(gameState.selected, clickedPos);
      } else {
        setGameState(prev => ({ ...prev, selected: null, validMoves: [] }));
      }
    }
  };

  const handleMove = (from: Position, to: Position, isAi: boolean = false, promoteTo?: PieceType) => {
    setGameState(prev => {
      if (isAi && !prev.isAiThinking) return prev;

      const piece = prev.board[from.r][from.c];
      const targetPiece = prev.board[to.r][to.c];
      const isCapture = targetPiece !== null;
      
      const newBoard = applyMove(prev.board, { from, to }, promoteTo);
      const san = getSan(prev.board, newBoard, { from, to }, promoteTo);

      const newHistoryRecord: MoveRecord = {
        from, to, color: prev.turn, piece: piece ? piece.type : 'p', promotion: promoteTo, san: san
      };

      let nextCapturedWhite = [...prev.capturedByWhite];
      let nextCapturedBlack = [...prev.capturedByBlack];

      if (isCapture && targetPiece) {
        if (prev.turn === 'white') {
          nextCapturedWhite.push(targetPiece.type);
          nextCapturedWhite.sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
        } else {
          nextCapturedBlack.push(targetPiece.type);
          nextCapturedBlack.sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
        }
      }

      const nextTurn = prev.turn === 'white' ? 'black' : 'white';
      
      let nextStatus = '';
      if (prev.gameMode === 'AI') {
        nextStatus = isAi ? 'Your Turn' : 'Waiting for AI...';
      } else {
        nextStatus = nextTurn === 'white' ? "White's Turn" : "Black's Turn";
      }

      return {
        ...prev,
        board: newBoard,
        turn: nextTurn,
        selected: null,
        validMoves: [],
        lastMove: { from, to },
        lastCapture: isCapture ? to : null,
        lastCapturedPiece: isCapture ? targetPiece : null,
        history: [...prev.history, newHistoryRecord],
        isAiThinking: false,
        statusMessage: nextStatus,
        promotionPending: null,
        capturedByWhite: nextCapturedWhite,
        capturedByBlack: nextCapturedBlack,
      };
    });
  };

  const confirmPromotion = (type: PieceType) => {
    if (gameState.promotionPending) {
      handleMove(gameState.promotionPending.from, gameState.promotionPending.to, false, type);
    }
  };

  const resetGame = (mode?: GameMode) => {
    unlockAudio();
    const targetMode = mode || gameState.gameMode;
    // Fix: Persist Game Mode so it doesn't reset on reload
    if (typeof window !== 'undefined') {
      localStorage.setItem('chess.gameMode', targetMode);
    }
    
    setGameState({
      board: getInitialBoard(),
      turn: 'white',
      selected: null,
      validMoves: [],
      lastMove: null,
      lastCapture: null,
      lastCapturedPiece: null,
      history: [],
      timers: { white: 600, black: 600 },
      gameOver: false,
      winner: null,
      statusMessage: targetMode === 'AI' ? 'Your Turn' : "White's Turn",
      isAiThinking: false, // FORCE RESET to clear locks
      promotionPending: null,
      capturedByWhite: [],
      capturedByBlack: [],
      gameMode: targetMode,
    });
  };

  const handleModeSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    unlockAudio();
    const newMode = e.target.value as GameMode;
    if (gameState.history.length === 0) {
      resetGame(newMode);
    } else {
      if(window.confirm(`Start a new ${newMode === 'AI' ? 'vs AI' : '2 Player'} game?`)) {
        resetGame(newMode);
      } else {
        // Fix: Force re-render to reset select value if cancelled
        setGameState(prev => ({ ...prev }));
      }
    }
  };

  const handleNewGameClick = () => {
    unlockAudio();
    if (gameState.history.length === 0 || gameState.gameOver) {
      resetGame();
    } else {
      if (window.confirm("Resign and start new game?")) {
        resetGame();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start sm:justify-center bg-[#262522] text-[#bababa] font-sans py-4">
      {notification && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center animate-in slide-in-from-top duration-300 pointer-events-none">
           <div className="bg-[#baca44] text-[#262522] px-6 py-2 rounded-full font-bold shadow-lg shadow-black/50">
             {notification}
           </div>
        </div>
      )}

      {/* Top HUD (AI or Player 2) */}
      <HUD 
        name={gameState.gameMode === 'AI' ? `AI (Level ${difficulty})` : 'Player 2 (Black)'}
        time={gameState.timers.black} 
        isActive={gameState.turn === 'black'} 
        status={gameState.gameMode === 'Human' && gameState.turn === 'black' ? gameState.statusMessage : undefined}
        captured={gameState.capturedByBlack}
        capturedColor="white"
      />

      <div className="relative my-2 shadow-2xl border-[6px] border-[#333] rounded-sm shrink-0 select-none">
        <div 
          className="grid grid-cols-8 grid-rows-8 w-[min(95vw,65vh)] h-[min(95vw,65vh)] transition-transform duration-500"
          style={{ transform: isFlipped ? 'rotate(180deg)' : 'none' }}
        >
          {gameState.board.map((row, r) => 
            row.map((piece, c) => {
              const isDark = (r + c) % 2 === 1;
              const isSelected = gameState.selected?.r === r && gameState.selected?.c === c;
              const isLastMove = (gameState.lastMove?.from.r === r && gameState.lastMove?.from.c === c) ||
                                 (gameState.lastMove?.to.r === r && gameState.lastMove?.to.c === c);
              const isCaptureSquare = gameState.lastCapture?.r === r && gameState.lastCapture?.c === c;
              const isValidTarget = !!gameState.selected && gameState.validMoves.some(m => m.r === r && m.c === c);

              return (
                <div key={`${r}-${c}`} style={{ transform: isFlipped ? 'rotate(180deg)' : 'none' }}>
                  <Square
                    r={r} c={c}
                    piece={piece}
                    isDark={isDark}
                    isSelected={isSelected}
                    isLastMove={isLastMove}
                    isCaptureSquare={isCaptureSquare}
                    isValidTarget={isValidTarget}
                    capturedPiece={isCaptureSquare ? gameState.lastCapturedPiece : null}
                    onClick={() => handleSquareClick(r, c)}
                  />
                </div>
              );
            })
          )}
        </div>
        
        {/* Promotion Modal */}
        {gameState.promotionPending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-sm backdrop-blur-sm transition-all duration-300">
            <div className="bg-[#262522] p-6 rounded-lg shadow-2xl border border-[#444] animate-pop">
              <h3 className="text-white text-center mb-4 font-bold text-lg uppercase tracking-wider">Promote to</h3>
              <div className="flex gap-3">
                {['q', 'r', 'b', 'n'].map((type) => (
                  <button
                    key={type}
                    onClick={() => confirmPromotion(type as PieceType)}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-[#3a3a3a] hover:bg-[#baca44] hover:text-[#262522] text-5xl flex items-center justify-center rounded-lg shadow-lg transform transition-all duration-200 hover:scale-110 active:scale-95 text-[#bababa] font-chess"
                  >
                    {PIECE_MAP[gameState.turn[0] + type]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameState.gameOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
            <div className={`
              flex flex-col items-center p-8 rounded-xl shadow-2xl border-2 max-w-sm w-full mx-4 text-center
              ${gameState.winner === 'white' ? 'bg-gradient-to-b from-[#769656] to-[#5a7642] border-[#baca44]' : 
                gameState.winner === 'black' ? 'bg-gradient-to-b from-[#333] to-[#111] border-[#c0392b]' : 
                'bg-gray-800 border-gray-600'}
            `}>
              <div className="text-6xl mb-4 drop-shadow-lg">{gameState.winner === 'white' ? '🏆' : gameState.winner === 'black' ? '🏆' : '🤝'}</div>
              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-wide drop-shadow-md">{gameState.winner === 'draw' ? 'Draw' : 'Victory!'}</h2>
              <p className="text-lg text-white/90 font-medium mb-8">{gameState.statusMessage}</p>
              <button onClick={() => resetGame()} className={`
                  px-8 py-3 rounded-lg font-bold text-lg shadow-lg transform transition-all hover:scale-105 active:scale-95
                  ${gameState.winner === 'white' ? 'bg-white text-[#769656] hover:bg-gray-100' : 
                    gameState.winner === 'black' ? 'bg-[#c0392b] text-white hover:bg-[#a93226]' : 
                    'bg-gray-600 text-white hover:bg-gray-500'}
                `}>New Game</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD (Player 1) */}
      <HUD 
        name={gameState.gameMode === 'AI' ? "You" : "Player 1 (White)"}
        time={gameState.timers.white} 
        isActive={gameState.turn === 'white'} 
        status={(gameState.gameMode === 'AI' || gameState.turn === 'white' || gameState.gameOver) ? gameState.statusMessage : undefined}
        captured={gameState.capturedByWhite}
        capturedColor="black"
      />

      <div className="w-full max-w-[min(95vw,65vh)] mt-3 flex flex-col gap-2 px-2 sm:px-0 z-10 shrink-0">
        
        {/* Row 1: Main Actions */}
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={undoMove}
            disabled={gameState.history.length === 0 || gameState.isAiThinking}
            className="flex-1 py-4 rounded-lg bg-[#3a3a3a] text-[#ccc] font-medium hover:bg-[#444] active:bg-[#555] disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation shadow-md"
          >
            Undo
          </button>
          <button 
            type="button"
            onClick={() => { unlockAudio(); setIsFlipped(!isFlipped); }}
            className="flex-1 py-4 rounded-lg bg-[#3a3a3a] text-[#ccc] font-medium hover:bg-[#444] active:bg-[#555] active:scale-95 transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            disabled={gameState.gameOver}
          >
            Flip
          </button>
          <button 
            type="button"
            onClick={handleNewGameClick}
            className="flex-1 py-4 rounded-lg bg-[#c0392b] text-white font-bold hover:bg-[#e74c3c] active:bg-[#c0392b] active:scale-95 transition-all touch-manipulation shadow-md"
          >
            New Game
          </button>
        </div>

        {/* Row 2: Settings */}
        <div className="flex gap-2">
          {/* Game Mode Selector */}
          <div className="relative flex-1 flex items-center bg-[#3a3a3a] rounded-lg px-3 py-2 shadow-sm">
            <span className="text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider mr-auto">Mode</span>
            <span className="text-[#baca44] font-bold text-sm truncate mr-4">{gameState.gameMode === 'AI' ? 'vs AI' : '2 Player'}</span>
            <svg className="w-4 h-4 text-gray-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            <select value={gameState.gameMode} onChange={handleModeSwitch} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" aria-label="Game Mode">
              <option value="AI">vs AI</option>
              <option value="Human">2 Player</option>
            </select>
          </div>

          {/* AI Strength (Only visible/active in AI mode) */}
          {gameState.gameMode === 'AI' && (
            <div className="relative flex-1 flex items-center bg-[#3a3a3a] rounded-lg px-3 py-2 animate-in fade-in duration-300 shadow-sm">
              <span className="text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-wider mr-auto">Level</span>
              <span className="text-[#baca44] font-bold text-sm truncate mr-4">{difficulty === 1 ? 'Easy' : difficulty === 2 ? 'Med' : 'Hard'}</span>
              <svg className="w-4 h-4 text-gray-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <select value={difficulty} onChange={(e) => { unlockAudio(); handleDifficultyChange(Number(e.target.value)); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" aria-label="AI Difficulty">
                <option value="1">Easy</option>
                <option value="2">Medium</option>
                <option value="3">Hard</option>
              </select>
            </div>
          )}
        </div>

        {/* Row 3: Save / Load */}
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={saveGame}
            className="flex-1 py-2 rounded bg-[#2a2a2a] text-[#bababa] text-sm font-medium border border-[#3a3a3a] hover:bg-[#3a3a3a] active:bg-[#444] active:scale-95 hover:border-[#555] transition-all touch-manipulation shadow-sm"
          >
            Save Game
          </button>
          <button 
            type="button"
            onClick={loadGame}
            className="flex-1 py-2 rounded bg-[#2a2a2a] text-[#bababa] text-sm font-medium border border-[#3a3a3a] hover:bg-[#3a3a3a] active:bg-[#444] active:scale-95 hover:border-[#555] transition-all touch-manipulation shadow-sm"
          >
            Load Game
          </button>
        </div>
      </div>

      <div className="w-full max-w-[min(95vw,65vh)] mt-4 p-4 bg-[#1a1a1a] rounded border border-[#333] shadow-lg shrink-0">
        <h3 className="text-[#baca44] font-bold text-sm uppercase tracking-wider mb-2 border-b border-[#333] pb-2">Move History</h3>
        <div className="h-32 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-gray-700">
           <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 mb-2 text-gray-500 font-bold text-xs uppercase sticky top-0 bg-[#1a1a1a]">
              <div>#</div><div>White</div><div>Black</div>
           </div>
           {gameState.history.length === 0 && <div className="text-gray-600 italic text-center py-4">No moves yet</div>}
           {Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, i) => {
              const whiteMove = gameState.history[i * 2];
              const blackMove = gameState.history[i * 2 + 1];
              return (
                <div key={i} className="grid grid-cols-[3rem_1fr_1fr] gap-2 py-1 border-b border-[#333/30] last:border-0 hover:bg-white/5">
                  <div className="text-gray-600 font-mono">{i + 1}.</div>
                  <div className="text-[#bababa] font-mono">{whiteMove.san}</div>
                  <div className="text-[#bababa] font-mono">{blackMove ? blackMove.san : ''}</div>
                </div>
              );
           })}
           <div ref={historyEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
