import { useState, useRef, useEffect } from "react";
import { StyleIcon } from "./Icons";
import { Button } from "./ui/button";

// Determine asset path - using Vite's import.meta.glob or just static paths
// Since we don't have dynamic import set up easily here, we'll map manually based on known files.
const STYLE_IMAGES: Record<string, string> = {
  studio: "/src/assets/style-preview/studio.png",
  toy: "/src/assets/style-preview/toy.png",
  ceramic: "/src/assets/style-preview/ceramic.png",
  plush: "/src/assets/style-preview/plush.png",
  wood: "/src/assets/style-preview/wood.png",
  metal: "/src/assets/style-preview/metal.png",
  stone: "/src/assets/style-preview/stone.png",
  anime: "/src/assets/style-preview/anime.png",
  neon: "/src/assets/style-preview/neon.png",
  glass: "/src/assets/style-preview/glass.png",
  ink: "/src/assets/style-preview/ink.png",
};

// Fallback for missing images
const GET_IMAGE = (key: string) => STYLE_IMAGES[key] || STYLE_IMAGES['studio'];

interface StyleSelectorProps {
  activePreset: string;
  onSelect: (preset: string) => void;
  presets: Record<string, string>;
  side?: "top" | "bottom";
}

export function StyleSelector({ activePreset, onSelect, presets, side = "bottom" }: StyleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant={isOpen ? "secondary" : "ghost"}
        className="h-10 px-3 rounded-full flex items-center gap-2 bg-muted/50 hover:bg-muted"
        onClick={() => setIsOpen(!isOpen)}
      >
        <StyleIcon className="w-5 h-5" />
        <span className="text-sm font-medium">Style</span>
      </Button>

      {isOpen && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 ${
            side === "top" ? "bottom-20" : "top-20"
          } z-50 p-2 bg-background/95 backdrop-blur-md border rounded-xl shadow-xl flex gap-2 overflow-x-auto max-w-[80vw] min-w-[300px] scrollbar-hide`}
        >
          {Object.keys(presets).map((key) => (
            <div
              key={key}
              className={`relative group cursor-pointer flex-shrink-0 transition-all ${
                activePreset === key ? "ring-2 ring-primary rounded-lg" : "hover:opacity-80"
              }`}
              onClick={() => {
                onSelect(key);
                setIsOpen(false);
              }}
            >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                    <img 
                        src={GET_IMAGE(key)} 
                        alt={key} 
                        className="w-full h-full object-cover"
                    />
                </div>
                {/* Tooltip-ish label */}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1 rounded-b-lg">
                    {key}
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
