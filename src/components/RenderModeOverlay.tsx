import { Button } from "./ui/button";

interface RenderModeOverlayProps {
  activePreset: string;
  isDynamic: boolean;
  setIsDynamic: (val: boolean) => void;
  onGenerate: () => void;
  viewMode: "split" | "merge";
}

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

const PRESET_LABELS: Record<string, string> = {
  studio: "Studio Material",
  toy: "Toy Material",
  ceramic: "Ceramic Material",
  plush: "Plush Material",
  wood: "Wood Material",
  metal: "Metal Material",
  stone: "Stone Material",
  anime: "Anime Material",
  neon: "Neon Material",
  glass: "Glass Material",
  ink: "Ink Material",
};

export function RenderModeOverlay({ activePreset, isDynamic, setIsDynamic, onGenerate, viewMode }: RenderModeOverlayProps) {
  const imgSrc = STYLE_IMAGES[activePreset] || STYLE_IMAGES['studio'];
  const label = PRESET_LABELS[activePreset] || "Studio Material";

  return (
    <div className={`absolute top-6 z-40 flex items-center gap-4 bg-background/40 backdrop-blur-sm p-4 rounded-2xl border shadow-sm transition-all duration-300 ${
        viewMode === "split" ? "left-6" : "left-1/2 -translate-x-1/2"
    }`}>
      
      {/* Thumbnail */}
      <div className="w-24 h-24 rounded-xl overflow-hidden border shadow-sm bg-muted flex-shrink-0">
        <img src={imgSrc} alt={label} className="w-full h-full object-cover" />
      </div>

      {/* Controls */}
      <div className="flex flex-col justify-center gap-3">
        
        {/* Label */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>

        {/* Dynamic Mode Toggle */}
        <div className="flex items-center gap-2">
            <button
            onClick={() => setIsDynamic(!isDynamic)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                isDynamic 
                ? "bg-muted/50 border-input hover:bg-muted" 
                : "bg-background border-input hover:bg-muted"
            }`}
            >
            <div className={`w-2.5 h-2.5 rounded-full ${isDynamic ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-muted-foreground/40'}`} />
            <span className={`text-sm font-medium ${isDynamic ? 'text-foreground' : 'text-muted-foreground'}`}>
                {isDynamic ? 'Dynamic Rendering' : 'Manual Rendering'}
            </span>
            </button>

            {/* Manual Render Button (Only shows when dynamic is off) */}
            {!isDynamic && (
                <Button 
                    onClick={onGenerate}
                    size="sm"
                    className="h-8 bg-blue-500 hover:bg-blue-600 text-white shadow-md animate-in fade-in zoom-in duration-200"
                >
                    Render
                </Button>
            )}
        </div>

      </div>
    </div>
  );
}
