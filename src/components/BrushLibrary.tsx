import { useState, useRef, useEffect } from "react";
import { BrushEngine, type BrushPreset } from "../utils/BrushEngine";
import { Button } from "./ui/button";
import { X } from "lucide-react";

function BrushPreview({ brushName }: { brushName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BrushEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!engineRef.current) {
        engineRef.current = new BrushEngine(canvas);
    }
    const engine = engineRef.current;
    
    // Provide a fixed resolution for crisp drawing that scales to the container
    canvas.width = 240;
    canvas.height = 40;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    engine.setBrush(brushName);
    engine.setColor(0, 0, 0); // Black, which will be inverted in dark mode
    engine.setOpacity(1.0);
    engine.setBrushSize(5);

    const w = canvas.width;
    const h = canvas.height;
    
    const startX = w * 0.1;
    const endX = w * 0.9;
    const midY = h / 2;
    
    engine.startStroke(startX, midY);
    
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        
        const p0 = { x: startX, y: midY };
        const p1 = { x: w * 0.3, y: h * -0.5 };
        const p2 = { x: w * 0.7, y: h * 1.5 };
        const p3 = { x: endX, y: midY };

        const xt = Math.pow(1-t, 3)*p0.x + 3*Math.pow(1-t, 2)*t*p1.x + 3*(1-t)*t*t*p2.x + Math.pow(t, 3)*p3.x;
        const yt = Math.pow(1-t, 3)*p0.y + 3*Math.pow(1-t, 2)*t*p1.y + 3*(1-t)*t*t*p2.y + Math.pow(t, 3)*p3.y;

        const pressure = Math.sin(t * Math.PI) * 0.8 + 0.2; 

        engine.strokeTo(xt, yt, pressure, 0.05);
    }

  }, [brushName]);

  return (
    <canvas 
        ref={canvasRef} 
        className="w-full h-full object-contain opacity-80 dark:invert"
    />
  );
}

interface BrushLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBrush: (brushName: string) => void;
  activeBrush: string;
}

export function BrushLibrary({ isOpen, onClose, onSelectBrush, activeBrush }: BrushLibraryProps) {
  const [presets] = useState<BrushPreset[]>(() => {
    if (BrushEngine.presets.length === 0) {
      BrushEngine.loadPresets();
    }
    return BrushEngine.presets;
  });
  const [activeCategory, setActiveCategory] = useState<string>("Sketching");

  if (!isOpen) return null;

  const categories = Array.from(new Set(presets.map(p => p.category)));
  const currentBrushes = presets.filter(p => p.category === activeCategory);

  return (
    <div className="fixed top-20 right-4 z-50 w-[320px] h-[500px] bg-popover border border-border rounded-xl shadow-2xl flex flex-col text-popover-foreground font-sans overflow-hidden animate-in fade-in slide-in-from-right-10 duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <span className="font-semibold text-sm">Brush Library</span>
        <div className="flex gap-1">
             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                <X className="h-4 w-4" />
             </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-[100px] border-r border-border bg-muted/20 flex flex-col overflow-y-auto">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`p-3 text-xs text-left hover:bg-muted transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                    {cat}
                </button>
            ))}
        </div>

        {/* Brushes Grid */}
        <div className="flex-1 overflow-y-auto p-2 bg-background">
            <div className="space-y-1">
                {currentBrushes.map(brush => (
                    <div 
                        key={brush.name}
                        onClick={() => onSelectBrush(brush.name)}
                        className={`group flex flex-col p-2 rounded-lg cursor-pointer transition-all ${activeBrush === brush.name ? "bg-accent text-accent-foreground border border-blue-500/50" : "hover:bg-muted border border-transparent"}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-medium ${activeBrush === brush.name ? "text-primary" : "text-foreground"}`}>{brush.name}</span>
                        </div>
                        {/* Preview Stroke */}
                        <div className="h-8 w-full bg-muted/50 rounded overflow-hidden border border-border/50">
                            <BrushPreview brushName={brush.name} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
