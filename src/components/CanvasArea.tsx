import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { BrushEngine } from '../utils/BrushEngine';

export interface CanvasAreaHandles {
  clear: () => void;
  getDataURL: () => string;
}

interface CanvasAreaProps {
  onDraw: () => void;
  color: string;
  brushSize: number;
  activeBrush?: string;
}

export const CanvasArea = forwardRef<CanvasAreaHandles, CanvasAreaProps>(({ onDraw, color, brushSize, activeBrush }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const brushEngineRef = useRef<BrushEngine | null>(null);
  const lastTime = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    getDataURL: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      // Composite white background
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const ctx = tmp.getContext('2d');
      if (!ctx) return '';
      
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(canvas, 0, 0);
      return tmp.toDataURL('image/jpeg', 0.8);
    }
  }));

  // Initialize Brush Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    brushEngineRef.current = new BrushEngine(canvas);
  }, []);

  // Update Brush
  useEffect(() => {
    if (brushEngineRef.current && activeBrush) {
      brushEngineRef.current.setBrush(activeBrush);
    }
  }, [activeBrush]);

  // Update Color
  useEffect(() => {
    if (brushEngineRef.current && color) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      brushEngineRef.current.setColor(r, g, b);
    }
  }, [color]);

  useEffect(() => {
    if (brushEngineRef.current && brushSize) {
        brushEngineRef.current.setBrushSize(brushSize);
    }
  }, [brushSize]);

  // Resize Observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Save current content
        const data = canvas.toDataURL();
        const ctx = canvas.getContext('2d');
        
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        
        // Restore content
        const img = new Image();
        img.src = data;
        img.onload = () => {
           if (ctx) ctx.drawImage(img, 0, 0);
        }
      }
    };
    
    // Initial resize
    resize();

    const parent = canvas.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
        resize();
    });
    
    observer.observe(parent);

    return () => observer.disconnect();
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDraw = (e: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    lastTime.current = performance.now() / 1000;
    
    const pos = getPos(e);
    // Use pressure if available and > 0, otherwise default. 
    // Some devices report 0 on start? 
    // PointerEvent spec says pressure is 0.5 for devices without pressure.
    let pressure = e.pressure;
    if (e.pointerType === 'mouse' && e.buttons !== 1) return; // Only left click logic
    if (pressure === 0 && e.pointerType === 'mouse') pressure = 0.5;

    brushEngineRef.current?.startStroke(pos.x, pos.y);
    // Also do a strokeTo immediately to draw a dot?
    brushEngineRef.current?.strokeTo(pos.x, pos.y, pressure, 0.1); 
    
    // onDraw(); 
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    
    const pos = getPos(e);
    let pressure = e.pressure;
    if (pressure === 0 && e.pointerType === 'mouse') pressure = 0.5;

    const now = performance.now() / 1000;
    let dt = now - lastTime.current;
    if (dt <= 0) dt = 0.001; // Avoid zero div if called too fast

    brushEngineRef.current?.strokeTo(pos.x, pos.y, pressure, dt);
    
    lastTime.current = now;
  };

  const endDraw = (e: React.PointerEvent) => {
    if (isDrawing.current) {
        canvasRef.current?.releasePointerCapture(e.pointerId);
        isDrawing.current = false;
        onDraw(); // Trigger generation only when stroke finishes
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full touch-none cursor-crosshair"
      onPointerDown={startDraw}
      onPointerMove={draw}
      onPointerUp={endDraw}
      onPointerLeave={endDraw}
    />
  );
});
