import React from 'react';

interface HUDProps {
  name: string;
  time: number;
  isActive: boolean;
  status?: string;
  captured?: string[];
  capturedColor?: string;
}

const formatTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const PIECE_MAP: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

const HUD: React.FC<HUDProps> = ({ name, time, isActive, status, captured = [], capturedColor = 'white' }) => {
  return (
    <div className="flex items-center w-full max-w-[min(95vw,65vh)] py-2 text-sm sm:text-base font-medium gap-3">
      <div className={`
        flex items-center gap-2 px-3 py-1 rounded-md transition-colors border-2 shrink-0
        ${isActive ? 'bg-gray-200 text-black border-white' : 'bg-[#151515] text-gray-500 border-transparent'}
      `}>
        <span className="font-mono text-xl">{formatTime(time)}</span>
      </div>
      
      <div className="flex items-center h-8 overflow-hidden">
        {captured.map((p, i) => (
          <span key={i} className="text-[#bababa] text-2xl -ml-2 first:ml-0 font-chess leading-none">
            {PIECE_MAP[(capturedColor[0] || 'w') + p]}
          </span>
        ))}
      </div>

      <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
        {status && (
          <div className={`font-bold truncate ${status.includes('Win') ? 'text-green-500' : 'text-[#eb5757]'}`}>
            {status}
          </div>
        )}

        <div className="font-bold text-gray-400 uppercase tracking-wider truncate">{name}</div>
      </div>
    </div>
  );
};

export default HUD;