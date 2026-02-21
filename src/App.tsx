import { useState, useRef, useEffect, useCallback } from 'react';
import { ControlBar } from '@/components/ControlBar';
import { BrushLibrary } from '@/components/BrushLibrary';
import { SettingsDialog } from '@/components/SettingsDialog';
import { RenderModeOverlay } from '@/components/RenderModeOverlay';
import { CanvasArea, type CanvasAreaHandles } from '@/components/CanvasArea';
import { CustomStyleWidget } from '@/components/CustomStyleWidget';
import { BrushControlWidget } from '@/components/BrushControlWidget';
import { useComfy } from '@/hooks/useComfy';
import { useFal } from '@/hooks/useFal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { defaultWorkflow } from './defaultWorkflow';

const PRESETS: Record<string, string> = {
  studio: "product design sketch material, industrial design material, clean lighting, realistic material, white soft illumination background",
  toy: "plastic toy material render, smooth shiny plastic material, white soft illumination background",
  ceramic: "handcrafted ceramic material render, matte glaze, subtle imperfections, white soft illumination background",
  plush: "soft plush fabric material render, stitched seams, cozy toy aesthetic, white soft illumination background",
  wood: "carved wooden material render, natural wood grain texture, warm studio lighting, realistic product shot, white soft illumination background",
  metal: "brushed metal material render, high-end industrial material, clean reflections, white soft illumination background",
  stone: "carved stone material render, smooth sculpture, soft shadows, museum lighting, white soft illumination background",
  anime: "anime-inspired stylized material render, clean cel shading, bold shape language, playful cartoon look, white soft illumination background",
  neon: "neon glow, dark background, vibrant cyan and magenta lines, cyberpunk, white soft illumination background",
  glass: "translucent borosilicate glass material render, caustics, elegant minimal form, white soft illumination background",
  ink: "Japanese ink wash painting, sumi-e, expressive brush strokes, minimal, white soft illumination background",
};

function App() {
  const [activePreset, setActivePreset] = useState("studio");
  const [viewMode, setViewMode] = useState<"split" | "merge">("split");
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("klein-theme", "light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<"top" | "bottom">("bottom");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeBrush, setActiveBrush] = useState("pencil");
  const [activeCustomStyle, setActiveCustomStyle] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(3);
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [isDynamicRendering, setIsDynamicRendering] = useState(true);

  const canvasRef = useRef<CanvasAreaHandles>(null);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const comfy = useComfy();
  const fal = useFal();

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  const handleClear = () => {
    canvasRef.current?.clear();
  };

  const handleHistoryChange = useCallback((undoable: boolean, redoable: boolean) => {
    setCanUndo(undoable);
    setCanRedo(redoable);
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  const activeProvider = comfy.status === 'CONNECTED' ? 'comfy' : 'fal';
  const statusDisplay = activeProvider === 'comfy' ? comfy.status : fal.status;

  const generate = useCallback(async () => {
    if (!canvasRef.current) return;
    
    // Capture
    const dataUrl = canvasRef.current.getDataURL();
    const prompt = PRESETS[activePreset];

    if (activeProvider === 'comfy') {
      try {
        const storedWorkflow = localStorage.getItem("comfy-workflow");
        const baseWorkflow = storedWorkflow ? JSON.parse(storedWorkflow) : defaultWorkflow; 
        
        if (baseWorkflow) {
             const blob = await (await fetch(dataUrl)).blob();
             let styleBlob: Blob | undefined = undefined;
             if (activeCustomStyle) {
                 styleBlob = await (await fetch(activeCustomStyle)).blob();
             }
             await comfy.runWorkflow(baseWorkflow, blob, prompt, styleBlob);
        }
      } catch (e) {
        console.error("Comfy Gen Error", e);
      }
    } else {
      // Logic for Fal
      if (fal.send) {
          fal.send(dataUrl, prompt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, activeProvider, comfy.runWorkflow, fal.send, activeCustomStyle]);

  const onDraw = useCallback(() => {
    if (!isDynamicRendering) return; // Block auto-generation if not dynamic
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
       generate();
    }, 128); // Debounce
  }, [generate, isDynamicRendering]);
  
  // Track previous preset to only trigger generation when it ACTUALLY changes
  const prevPresetRef = useRef(activePreset);
  useEffect(() => {
    if (prevPresetRef.current !== activePreset) {
      prevPresetRef.current = activePreset;
      // When changing style, we probably ALWAYS want to generate to see it,
      // even if manual rendering is on. Or maybe standard behavior is strictly manual?
      // For now, let's auto-generate on style switch to provide immediate visual feedback.
      generate();
    }
  }, [activePreset, generate]);
  
  // Initial connect check for comfy
  useEffect(() => {
      if (comfy.host && comfy.status === 'DISCONNECTED' && comfy.connect) {
          comfy.connect(comfy.host);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasColor = theme === 'light' ? '#000000' : '#ffffff';

  return (
    <div className={`relative w-full h-screen overflow-hidden bg-background text-foreground ${theme} flex flex-col`}>
      <ControlBar
        onClear={handleClear}
        onSettings={() => setSettingsOpen(true)}
        presets={PRESETS}
        activePreset={activePreset}
        setActivePreset={setActivePreset}
        viewMode={viewMode}
        setViewMode={setViewMode}
        theme={theme}
        toggleTheme={toggleTheme}
        status={statusDisplay}
        comfyStatus={comfy.status}
        position={toolbarPosition}
        setPosition={setToolbarPosition}
        isLibraryOpen={isLibraryOpen}
        setIsLibraryOpen={setIsLibraryOpen}
        activeBrush={activeBrush}
        setActiveBrush={setActiveBrush}
      />
      
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onConnect={comfy.connect}
        status={comfy.status}
      />

      <BrushLibrary // New component
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)}
        activeBrush={activeBrush}
        onSelectBrush={(brush) => {
          setActiveBrush(brush);
          // Optional: Close library on select?
          // setIsLibraryOpen(false);
        }}
      />
      
      <BrushControlWidget
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        brushOpacity={brushOpacity}
        onBrushOpacityChange={setBrushOpacity}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      
      {activeProvider === 'comfy' && (
        <CustomStyleWidget
            activeStyleUrl={activeCustomStyle}
            onSelectStyle={(url) => {
                 setActiveCustomStyle(url);
                 if (isDynamicRendering) generate();
            }}
        />
      )}

      <div className={`flex-1 flex ${viewMode === 'split' ? 'flex-row' : 'flex-col'} relative min-h-0`}>
        {/* Input Area */}
        <div className={`${viewMode === 'split' ? 'relative w-1/2 h-full' : 'absolute w-1/2 h-full top-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none'}`}>
             
             {/* Render Mode Overlay */}
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
                 <div className="pointer-events-auto">
                    <RenderModeOverlay 
                        activePreset={activePreset} 
                        isDynamic={isDynamicRendering} 
                        setIsDynamic={setIsDynamicRendering} 
                        onGenerate={generate}
                        viewMode={viewMode}
                    />
                 </div>
             </div>

             <div className="w-full h-full pointer-events-auto bg-white/5 relative z-10">
                <CanvasArea 
                    ref={canvasRef} 
                    onDraw={onDraw} 
                    color={canvasColor} 
                    brushSize={brushSize}
                    activeBrush={activeBrush}
                    opacity={brushOpacity}
                    onHistoryChange={handleHistoryChange}
                />
             </div>
        </div>

        {/* Output Area */}
        <div className={`${viewMode === 'split' ? 'relative w-1/2 h-full border-l border-white/10 p-8' : 'absolute w-full h-full top-0 left-0 z-0 bg-muted/20'} flex items-center justify-center`}>
            <div className={`relative flex items-center justify-center overflow-hidden ${viewMode === 'merge' ? 'w-1/2 h-full' : 'w-full h-full rounded-md shadow-md border border-white/10 bg-background/50'}`}>
               {activeProvider === 'comfy' && comfy.lastImage && (
                   <img src={comfy.lastImage} className={`w-full h-full object-contain ${viewMode === 'merge' ? '' : 'rounded-md'}`} alt="ComfyUI Output" />
               )}
               {activeProvider === 'fal' && fal.lastImage && (
                   <img src={fal.lastImage} className={`w-full h-full object-contain ${viewMode === 'merge' ? '' : 'rounded-md'}`} alt="Fal Output" />
               )}
               {(!comfy.lastImage && !fal.lastImage) && (
                   <div className="text-muted-foreground opacity-50">Draw to generate</div>
               )}
            </div>
        </div>
      </div>
    </div>
  )
}

export default App;
