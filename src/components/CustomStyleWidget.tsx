import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { ImagePlus, X, ChevronRight, Upload } from "lucide-react";

interface CustomStyleWidgetProps {
  onSelectStyle: (dataUrl: string | null) => void;
  activeStyleUrl: string | null;
}

export function CustomStyleWidget({ onSelectStyle, activeStyleUrl }: CustomStyleWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("custom-style-history");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to parse custom style history", e);
      return [];
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // We no longer need an effect to load history since it's done in the initial state

  const saveHistory = (newHistory: string[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("custom-style-history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save custom style history", e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Add to history (limit to 10)
        const newHistory = [dataUrl, ...history.filter(h => h !== dataUrl)].slice(0, 10);
        saveHistory(newHistory);
        onSelectStyle(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const clearStyle = () => {
    onSelectStyle(null);
  };

  const removeHistoryItem = (e: React.MouseEvent, urlToRemove: string) => {
    e.stopPropagation();
    const newHistory = history.filter(url => url !== urlToRemove);
    saveHistory(newHistory);
    if (activeStyleUrl === urlToRemove) {
        clearStyle();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-background/80 backdrop-blur-md border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:scale-105 transition-all outline-none"
        title="Custom Style Reference"
      >
        {activeStyleUrl ? (
             <div className="w-full h-full rounded-full overflow-hidden border-2 border-primary/50 relative">
                 <img src={activeStyleUrl} alt="Active Style" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <ImagePlus size={18} className="text-white drop-shadow-md" />
                 </div>
             </div>
        ) : (
             <ImagePlus size={20} />
        )}
      </button>
    );
  }

  return (
    <div className="absolute bottom-24 right-6 z-40 w-80 bg-background/80 backdrop-blur-md rounded-2xl border shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-200">
      
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
        <h3 className="font-medium text-sm flex items-center gap-2">
            <ImagePlus size={16} className="text-primary" />
            Custom Style Reference
        </h3>
        <button 
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
            <ChevronRight size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-4">
        
        {/* Active Style Preview */}
        <div className="relative w-full aspect-video rounded-xl border bg-muted/30 overflow-hidden flex items-center justify-center group">
          {activeStyleUrl ? (
            <>
                <img src={activeStyleUrl} alt="Active Reference" className="w-full h-full object-contain bg-black/5" />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                        size="icon" 
                        variant="destructive" 
                        className="w-8 h-8 rounded-full shadow-md"
                        onClick={clearStyle}
                        title="Remove active style"
                    >
                        <X size={14} />
                    </Button>
                </div>
            </>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-60">
                <ImagePlus size={24} className="mb-2" />
                <span className="text-xs">No active style</span>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <Button 
            className="w-full flex items-center gap-2" 
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
        >
            <Upload size={16} />
            Upload New Style Image
        </Button>
        <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
        />

        {/* History Grid */}
        {history.length > 0 && (
            <div className="mt-2">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Recent Styles</div>
                <div className="grid grid-cols-4 gap-2">
                    {history.map((url, i) => (
                        <div 
                            key={i} 
                            onClick={() => onSelectStyle(url)}
                            className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:border-primary/50 transition-colors group ${activeStyleUrl === url ? 'ring-2 ring-primary border-transparent' : ''}`}
                        >
                            <img src={url} alt="History" className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-full w-5 h-5 flex flex-col items-center justify-center shadow-sm" onClick={(e) => removeHistoryItem(e, url)}>
                                <X size={12} className="text-muted-foreground hover:text-destructive" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
