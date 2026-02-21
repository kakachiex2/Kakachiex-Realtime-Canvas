import { useState, useRef, useEffect } from "react";
import { Undo, Redo } from "lucide-react";

interface BrushControlWidgetProps {
  brushSize: number;
  onBrushSizeChange: (val: number) => void;
  brushOpacity: number;
  onBrushOpacityChange: (val: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function BrushControlWidget({
  brushSize,
  onBrushSizeChange,
  brushOpacity,
  onBrushOpacityChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: BrushControlWidgetProps) {
  // Load initial position from localStorage or default to left center
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('brushWidgetPosition');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return { x: 20, y: window.innerHeight / 2 - 200 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('brushWidgetPosition', JSON.stringify(position));
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from the handle
    if (!(e.target as HTMLElement).closest(".drag-handle")) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initX: position.x, initY: position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className="fixed z-50 flex flex-col items-center p-3 gap-6 rounded-3xl bg-white/90 dark:bg-[#1e2023]/90 backdrop-blur-xl border border-black/5 dark:border-white/5 shadow-2xl transition-shadow"
      style={{ left: position.x, top: position.y, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Drag Handle */}
      <div className="drag-handle w-6 h-1.5 rounded-full bg-black/20 hover:bg-black/40 dark:bg-white/20 dark:hover:bg-white/40 cursor-grab active:cursor-grabbing mb-2" />

      {/* Size Slider (Top) */}
      <div className="relative w-[28px] h-[160px] bg-black/5 dark:bg-white/5 rounded-full flex flex-col items-center overflow-hidden border border-black/5 dark:border-white/5 shadow-inner" title={`Size: ${brushSize}`}>
        <input
          type="range"
          min="1"
          max="100"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-ns-resize z-10 w-full h-full appearance-none"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
        />
        <div 
          className="absolute bottom-0 w-full bg-black/80 dark:bg-white/90 rounded-t-full transition-all duration-75 pointer-events-none shadow-[0_-4px_12px_rgba(0,0,0,0.2)] dark:shadow-[0_-4px_12px_rgba(255,255,255,0.2)]" 
          style={{ height: `${(brushSize / 100) * 100}%` }} 
        />
        {/* Thumb indicator mock */}
        <div 
           className="absolute w-full h-[12px] bg-black dark:bg-white rounded-full shadow-md z-0 pointer-events-none"
           style={{ bottom: `calc(${(brushSize / 100) * 100}% - 6px)` }}
        />
      </div>

      {/* Opacity Slider (Bottom, Blue) */}
      <div className="relative w-[28px] h-[160px] bg-black/5 dark:bg-white/5 rounded-full flex flex-col items-center overflow-hidden border border-black/5 dark:border-white/5 shadow-inner mt-2" title={`Opacity: ${Math.round(brushOpacity * 100)}%`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={brushOpacity}
          onChange={(e) => onBrushOpacityChange(Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-ns-resize z-10 w-full h-full appearance-none"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
        />
        <div 
          className="absolute bottom-0 w-full bg-blue-500 rounded-t-full transition-all duration-75 pointer-events-none shadow-[0_-4px_12px_rgba(59,130,246,0.4)]" 
          style={{ height: `${brushOpacity * 100}%` }} 
        />
        <div 
           className="absolute w-full h-[12px] bg-blue-400 rounded-full shadow-md z-0 pointer-events-none"
           style={{ bottom: `calc(${brushOpacity * 100}% - 6px)` }}
        />
      </div>

      {/* Undo/Redo */}
      <div className="flex flex-col gap-4 mt-2 mb-2">
        <button 
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-full transition-colors active:scale-95 ${canUndo ? 'text-black/80 dark:text-white/80 hover:text-black hover:bg-black/10 dark:hover:text-white dark:hover:bg-white/10' : 'text-black/20 dark:text-white/20 cursor-not-allowed'}`}
          title="Undo"
        >
          <Undo size={20} strokeWidth={2.5} />
        </button>
        <button 
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-full transition-colors active:scale-95 ${canRedo ? 'text-black/80 dark:text-white/80 hover:text-black hover:bg-black/10 dark:hover:text-white dark:hover:bg-white/10' : 'text-black/20 dark:text-white/20 cursor-not-allowed'}`}
          title="Redo"
        >
          <Redo size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
