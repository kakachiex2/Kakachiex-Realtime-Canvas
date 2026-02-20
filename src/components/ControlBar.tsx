import { Button } from "./ui/button"
import { Settings, Eraser, Sun, Moon } from "lucide-react"
import { StyleSelector } from "./StyleSelector"
import { SplitIcon, SketchIcon } from "./Icons"

export interface ControlBarProps {
  onClear: () => void
  onSettings: () => void
  presets: Record<string, string>
  activePreset: string
  setActivePreset: (p: string) => void
  viewMode: "split" | "merge"
  setViewMode: (m: "split" | "merge") => void
  theme: "light" | "dark"
  toggleTheme: () => void
  status: string
  comfyStatus: string
  position: "top" | "bottom"
  setPosition: (p: "top" | "bottom") => void
  isLibraryOpen: boolean
  setIsLibraryOpen: (open: boolean) => void
  activeBrush: string
  setActiveBrush: (brush: string) => void
}

export function ControlBar({
  onClear,
  onSettings,
  presets,
  activePreset,
  setActivePreset,
  viewMode,
  setViewMode,
  theme,
  toggleTheme,
  status,
  comfyStatus,
  position,
  setPosition,
  isLibraryOpen,
  setIsLibraryOpen,
  activeBrush,
  setActiveBrush
}: ControlBarProps) {
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition(position === "top" ? "bottom" : "top");
  };

  const toggleSplit = () => {
    setViewMode(viewMode === "split" ? "merge" : "split");
  };

  return (
    <div 
        className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-background/80 backdrop-blur-md border rounded-full shadow-lg transition-all duration-300 ${position === "top" ? "top-4" : "bottom-4"}`}
        onContextMenu={handleContextMenu}
    >
      
      {/* Style Selector */}
      <StyleSelector 
        activePreset={activePreset} 
        onSelect={setActivePreset} 
        presets={presets}
        side={position === "top" ? "bottom" : "top"} 
      />

      <div className="h-6 w-px bg-border" />

      {/* Split Toggle */}
      <Button
        variant="ghost" 
        size="icon"
        className={`h-8 w-8 rounded-full ${viewMode === "split" ? "text-blue-500 bg-blue-100/20" : "text-muted-foreground"}`}
        onClick={toggleSplit}
      >
        <SplitIcon className="h-4 w-4" />
      </Button>

      {/* Brush Library Toggle / Pencil Select */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 rounded-full ${activeBrush === 'pencil' ? (isLibraryOpen ? "text-orange-500 bg-orange-100/20" : "text-blue-500") : "text-muted-foreground"}`}
        onClick={() => {
            if (activeBrush !== 'pencil') {
                setActiveBrush('pencil');
                // Ensure library is closed when switching back to pencil? 
                // Or leave as is. User asked: "pencil sketch button behaviour click activate sketch second click show brush library."
                // So 1st click: set pencil. 2nd click: toggle library.
                setIsLibraryOpen(false); 
            } else {
                setIsLibraryOpen(!isLibraryOpen);
            }
        }}
      >
        <SketchIcon className="h-4 w-4" />
      </Button>

       <div className="h-6 w-px bg-border" />

      {/* Actions */}
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClear}>
        <Eraser className="h-4 w-4" />
      </Button>

      <Button 
        variant="ghost" 
        size="icon" 
        className={`h-8 w-8 rounded-full ${comfyStatus === 'CONNECTED' ? 'text-green-500' : ''}`} 
        onClick={onSettings}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={toggleTheme}>
        {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      
      <div className="pl-2 pr-4 text-xs font-mono text-muted-foreground min-w-[100px] text-right select-none">
        {status}
      </div>

    </div>
  )
}
