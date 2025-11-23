import React, { useState, useEffect } from 'react';
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
      const saved = localStorage.getItem('chess.gameMode');
      return (saved as GameMode) || 'AI';
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
    lastCapturedPiece: null,
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
      isAiThinking: false,
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
    <div className="h-[100dvh] w-full flex flex-col items-center justify-start bg-[#262522] text-[#bababa] font-sans overflow-hidden select-none">
      {notification && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center animate-in slide-in-from-top duration-300 pointer-events-none">
           <div className="bg-[#baca44] text-[#262522] px-6 py-2 rounded-full font-bold shadow-lg shadow-black/50">
             {notification}
           </div>
        </div>
      )}

      {/* Main content wrapper - limited width, flex column */}
      <div className="flex flex-col w-full max-w-[min(95vw,65vh)] h-full p-2 gap-1">
        
        {/* Top HUD */}
        <HUD 
          name={gameState.gameMode === 'AI' ? `AI (Level ${difficulty})` : 'Player 2 (Black)'}
          time={gameState.timers.black} 
          isActive={gameState.turn === 'black'} 
          status={gameState.gameMode === 'Human' && gameState.turn === 'black' ? gameState.statusMessage : undefined}
          captured={gameState.capturedByBlack}
          capturedColor="white"
        />

        {/* Board - Shrinkable but preferred size */}
        <div className="relative shrink-0 shadow-2xl border-[6px] border-[#333] rounded-sm mx-auto">
          <div 
            // Dynamic sizing: prefers 50vh, but respects width constraints
            className="grid grid-cols-8 grid-rows-8 w-[min(95vw,50vh)] h-[min(95vw,50vh)] transition-transform duration-500"
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-sm backdrop-blur-sm animate-pop">
              <div className="bg-[#262522] p-4 rounded-lg shadow-xl border border-[#444]">
                <h3 className="text-white text-center mb-2 font-bold text-sm uppercase">Promote</h3>
                <div className="flex gap-2">
                  {['q', 'r', 'b', 'n'].map((type) => (
                    <button
                      key={type}
                      onClick={() => confirmPromotion(type as PieceType)}
                      className="w-12 h-12 bg-[#3a3a3a] hover:bg-[#baca44] hover:text-[#262522] text-4xl flex items-center justify-center rounded shadow-lg font-chess transition-transform hover:scale-110 active:scale-95 text-[#bababa]"
                    >
                      {PIECE_MAP[gameState.turn[0] + type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState.gameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
              <div className={`
                flex flex-col items-center p-6 rounded-xl shadow-2xl border-2 max-w-[90%] text-center
                ${gameState.winner === 'white' ? 'bg-gradient-to-b from-[#769656] to-[#5a7642] border-[#baca44]' : 
                  gameState.winner === 'black' ? 'bg-gradient-to-b from-[#333] to-[#111] border-[#c0392b]' : 
                  'bg-gray-800 border-gray-600'}
              `}>
                <div className="text-5xl mb-2 drop-shadow-lg">{gameState.winner === 'white' ? '🏆' : gameState.winner === 'black' ? '🏆' : '🤝'}</div>
                <h2 className="text-3xl font-black text-white mb-1 uppercase drop-shadow-md">{gameState.winner === 'draw' ? 'Draw' : 'Victory!'}</h2>
                <p className="text-base text-white/90 font-medium mb-6">{gameState.statusMessage}</p>
                <button onClick={() => resetGame()} className="px-6 py-3 rounded-lg font-bold text-lg shadow-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors text-white">New Game</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom HUD */}
        <HUD 
          name={gameState.gameMode === 'AI' ? "You" : "Player 1 (White)"}
          time={gameState.timers.white} 
          isActive={gameState.turn === 'white'} 
          status={(gameState.gameMode === 'AI' || gameState.turn === 'white' || gameState.gameOver) ? gameState.statusMessage : undefined}
          captured={gameState.capturedByWhite}
          capturedColor="black"
        />

        {/* Controls - Fixed Height */}
        <div className="flex flex-col gap-2 w-full shrink-0">
          <div className="flex gap-2 h-12">
            <button 
              onClick={undoMove}
              disabled={gameState.history.length === 0 || gameState.isAiThinking}
              className="flex-1 rounded-lg bg-[#3a3a3a] text-[#ccc] font-bold hover:bg-[#444] active:bg-[#555] disabled:opacity-50 disabled:transform-none transition-all active:scale-95 shadow-sm"
            >
              Undo
            </button>
            <button 
              onClick={() => { unlockAudio(); setIsFlipped(!isFlipped); }}
              className="flex-1 rounded-lg bg-[#3a3a3a] text-[#ccc] font-bold hover:bg-[#444] active:bg-[#555] transition-all active:scale-95 shadow-sm disabled:opacity-50"
              disabled={gameState.gameOver}
            >
              Flip
            </button>
            <button 
              onClick={handleNewGameClick}
              className="flex-1 rounded-lg bg-[#c0392b] text-white font-bold hover:bg-[#e74c3c] active:bg-[#c0392b] transition-all active:scale-95 shadow-sm"
            >
              New
            </button>
          </div>

          <div className="flex gap-2 h-10">
            <div className="relative flex-1 flex items-center bg-[#3a3a3a] rounded-lg px-3 shadow-sm">
              <span className="text-gray-400 text-xs font-bold uppercase mr-auto">Mode</span>
              <span className="text-[#baca44] font-bold text-xs truncate mr-4">{gameState.gameMode === 'AI' ? 'vs AI' : '2 Player'}</span>
              <svg className="w-4 h-4 text-gray-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <select value={gameState.gameMode} onChange={handleModeSwitch} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer">
                <option value="AI">vs AI</option>
                <option value="Human">2 Player</option>
              </select>
            </div>

            <div className={`relative flex-1 flex items-center bg-[#3a3a3a] rounded-lg px-3 shadow-sm ${gameState.gameMode !== 'AI' ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-gray-400 text-xs font-bold uppercase mr-auto">Level</span>
              <span className="text-[#baca44] font-bold text-xs truncate mr-4">{difficulty === 1 ? 'Easy' : difficulty === 2 ? 'Med' : 'Hard'}</span>
              <svg className="w-4 h-4 text-gray-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <select value={difficulty} onChange={(e) => { unlockAudio(); handleDifficultyChange(Number(e.target.value)); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer">
                <option value="1">Easy</option>
                <option value="2">Medium</option>
                <option value="3">Hard</option>
              </select>
            </div>
            
            <button onClick={saveGame} className="flex-[0.5] rounded-lg bg-[#2a2a2a] text-[#bababa] text-xs font-medium border border-[#3a3a3a] hover:bg-[#3a3a3a] active:bg-[#444]">Save</button>
            <button onClick={loadGame} className="flex-[0.5] rounded-lg bg-[#2a2a2a] text-[#bababa] text-xs font-medium border border-[#3a3a3a] hover:bg-[#3a3a3a] active:bg-[#444]">Load</button>
          </div>
        </div>

        {/* Move History - Flexible Height */}
        <div className="flex-1 min-h-0 w-full p-2 bg-[#1a1a1a] rounded border border-[#333] shadow-inner flex flex-col mt-1">
          <h3 className="text-[#baca44] font-bold text-xs uppercase tracking-wider mb-2 border-b border-[#333] pb-1 shrink-0">History</h3>
          <div className="overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-gray-700 pr-1">
             <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-1 text-gray-500 font-bold text-[10px] uppercase sticky top-0 bg-[#1a1a1a] pb-1">
                <div>#</div><div>White</div><div>Black</div>
             </div>
             {gameState.history.length === 0 && <div className="text-gray-600 italic text-center py-4 text-xs">No moves</div>}
             {Array.from({ length: Math.ceil(gameState.history.length / 2) }).map((_, i) => {
                const whiteMove = gameState.history[i * 2];
                const blackMove = gameState.history[i * 2 + 1];
                return (
                  <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr] gap-1 py-0.5 border-b border-[#333/30] last:border-0 hover:bg-white/5 text-xs">
                    <div className="text-gray-600 font-mono">{i + 1}.</div>
                    <div className="text-[#bababa] font-mono">{whiteMove.san}</div>
                    <div className="text-[#bababa] font-mono">{blackMove ? blackMove.san : ''}</div>
                  </div>
                );
             })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;