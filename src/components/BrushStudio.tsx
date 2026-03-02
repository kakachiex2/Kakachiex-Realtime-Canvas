import { useState, useRef, useEffect, useCallback } from "react";
import { BrushEngine } from "../utils/BrushEngine";
import type { BrushStudioSettings } from "../utils/brushStudioSettings";
import "./BrushStudio.css";

export type { BrushStudioSettings };
export { DEFAULT_BRUSH_STUDIO_SETTINGS } from "../utils/brushStudioSettings";

// ── Sidebar section definitions ────────────────────────────
type SectionId =
  | "stroke"
  | "stabilization"
  | "taper"
  | "shape"
  | "grain"
  | "rendering"
  | "wetmix"
  | "colordynamics"
  | "dynamics"
  | "applepencil"
  | "properties"
  | "materials"
  | "preview"
  | "about";

interface SidebarEntry {
  id: SectionId;
  label: string;
  icon: string; // emoji as quick icons matching the reference look
  enabled: boolean;
}

const SIDEBAR_SECTIONS: SidebarEntry[] = [
  { id: "stroke",        label: "Stroke path",     icon: "〰",  enabled: true },
  { id: "stabilization", label: "Stabilization",   icon: "◎",  enabled: true },
  { id: "taper",         label: "Taper",           icon: "〜",  enabled: true },
  { id: "shape",         label: "Shape",           icon: "✦",  enabled: false },
  { id: "grain",         label: "Grain",           icon: "▦",  enabled: false },
  { id: "rendering",     label: "Rendering",       icon: "⟋",  enabled: true },
  { id: "wetmix",        label: "Wet Mix",         icon: "💧",  enabled: false },
  { id: "colordynamics", label: "Color dynamics",  icon: "✧",  enabled: false },
  { id: "dynamics",      label: "Dynamics",        icon: "⌇",  enabled: false },
  { id: "applepencil",   label: "Pencil",          icon: "✎",  enabled: true },
  { id: "properties",    label: "Properties",      icon: "☰",  enabled: false },
  { id: "materials",     label: "Materials",       icon: "⊕",  enabled: false },
  { id: "preview",       label: "Preview",         icon: "▢",  enabled: false },
  { id: "about",         label: "About this brush",icon: "ⓘ",  enabled: false },
];

// ── Utility: Slider Row ────────────────────────────────────
function SliderRow({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const displayVal = value === 0 && suffix === "%" ? "None" : `${Math.round(value)}${suffix}`;

  // Compute filled track gradient
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="bs-slider-row">
      <span className="bs-slider-label">{label}</span>
      <div className="bs-slider-track-wrap">
        <input
          type="range"
          className="bs-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, #4a9eff ${pct}%, var(--bs-slider-track) ${pct}%)`,
          }}
        />
      </div>
      <span className="bs-value-badge">{displayVal}</span>
    </div>
  );
}

// ── Utility: Toggle Row ────────────────────────────────────
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bs-toggle-row">
      <span className="bs-toggle-label">{label}</span>
      <button
        className={`bs-toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
        type="button"
      >
        <div className="bs-toggle-knob" />
      </button>
    </div>
  );
}

// ── Utility: Select Row ────────────────────────────────────
function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="bs-select-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0px 4px 0px' }}>
      <span className="bs-slider-label">{label}</span>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="bs-rendering-select"
      >
        {options.map(opt => <option key={opt} value={opt} className="bs-rendering-option">{opt}</option>)}
      </select>
    </div>
  );
}

// ── Utility: List Selection ────────────────────────────────
function TaperCurvePreview({ size, pressure }: { size: number; pressure: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.classList.contains("dark");
    // Draw center line
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Draw vertical guides
    const guideX1 = w * (size / 100);
    const guideX2 = w * (1 - pressure / 100);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(guideX1, 0);
    ctx.lineTo(guideX1, h);
    ctx.moveTo(guideX2, 0);
    ctx.lineTo(guideX2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw taper shape (filled)
    const midY = h / 2;
    const maxThickness = h * 0.35;

    ctx.fillStyle = isDark ? "rgba(180, 180, 180, 0.5)" : "rgba(100, 100, 100, 0.4)";
    ctx.beginPath();
    ctx.moveTo(0, midY);

    // Top edge
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * w;
      let thickness = maxThickness;

      // Start taper
      const startTaper = size / 100;
      if (t < startTaper) {
        thickness *= t / startTaper;
      }

      // End taper
      const endTaper = 1 - pressure / 100;
      if (t > endTaper && endTaper < 1) {
        thickness *= (1 - t) / (1 - endTaper);
      }

      ctx.lineTo(x, midY - thickness);
    }

    // Bottom edge (reverse)
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const x = t * w;
      let thickness = maxThickness;

      const startTaper = size / 100;
      if (t < startTaper) {
        thickness *= t / startTaper;
      }

      const endTaper = 1 - pressure / 100;
      if (t > endTaper && endTaper < 1) {
        thickness *= (1 - t) / (1 - endTaper);
      }

      ctx.lineTo(x, midY + thickness);
    }

    ctx.closePath();
    ctx.fill();

    // Draw handle dots
    ctx.fillStyle = "#4a9eff";
    ctx.beginPath();
    ctx.arc(guideX1, midY, 5, 0, Math.PI * 2);
    ctx.arc(guideX2, midY, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [size, pressure]);

  return <canvas ref={canvasRef} className="bs-taper-curve" />;
}

// ── Utility: Pressure Curve Widget ─────────────────────────
function PressureCurveWidget({ value, onChange }: { value: { x: number; y: number }[]; onChange: (v: { x: number; y: number }[]) => void }) {
  const size = 160;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const getPt = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getPt(e.clientX, e.clientY);
    
    // Check if clicking near an existing point
    const threshold = 15 / size; // ~15px hit area
    let closestIdx = -1;
    let minD = Infinity;
    value.forEach((p, i) => {
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < threshold && d < minD) {
        minD = d;
        closestIdx = i;
      }
    });

    if (closestIdx !== -1) {
      setDragIndex(closestIdx);
    } else {
      // Add new point and keep sorted
      const newPts = [...value, pt].sort((a, b) => a.x - b.x);
      const newIdx = newPts.findIndex((p) => p === pt);
      onChange(newPts);
      setDragIndex(newIdx);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIndex !== null) {
      const pt = getPt(e.clientX, e.clientY);
      const newPts = [...value];
      
      // Clamp x based on neighbors to prevent crossing
      if (dragIndex === 0) pt.x = 0;
      else if (dragIndex === newPts.length - 1) pt.x = 1;
      else {
        const minX = newPts[dragIndex - 1].x;
        const maxX = newPts[dragIndex + 1].x;
        pt.x = Math.max(minX + 0.01, Math.min(maxX - 0.01, pt.x));
      }
      
      newPts[dragIndex] = pt;
      onChange(newPts);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  
  const pathData = value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * size} ${(1 - p.y) * size}`).join(' ');

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ position: 'relative', width: size, height: size, background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', margin: '8px 0 24px 0', cursor: 'crosshair', touchAction: 'none' }}
    >
       {/* Grid Lines */}
       <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {/* Vertical */}
          <line x1={size*0.25} y1={0} x2={size*0.25} y2={size} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <line x1={size*0.5} y1={0} x2={size*0.5} y2={size} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <line x1={size*0.75} y1={0} x2={size*0.75} y2={size} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          {/* Horizontal */}
          <line x1={0} y1={size*0.25} x2={size} y2={size*0.25} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <line x1={0} y1={size*0.5} x2={size} y2={size*0.5} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <line x1={0} y1={size*0.75} x2={size} y2={size*0.75} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          
          {/* Curve Path */}
          <path d={pathData} stroke="#444" strokeWidth="1.5" fill="none" />
          
          {/* Points */}
          {value.map((p, i) => (
             <circle key={i} cx={p.x * size} cy={(1 - p.y) * size} r={3.5} fill="#444" stroke="transparent" />
          ))}
       </svg>
    </div>
  );
}

// ── Utility: Tilt Widget ───────────────────────────────────
function TiltWidget({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Value represents 0-90 degrees.
  const size = 160;
  const radius = size;
  const cx = 0; // Bottom left corner
  const cy = size; // Bottom left corner
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Angle in radians (0 is right, 90 is up)
  const angleRad = value * (Math.PI / 180);
  
  const dotX = cx + Math.cos(angleRad) * radius;
  const dotY = cy - Math.sin(angleRad) * radius;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateAngle(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateAngle = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // dx and dy relative to bottom-left origin
    const dx = x - cx;
    const dy = cy - y; // inverted y since screen y goes down
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // restrict to 0-90
    if (angle < 0) angle = 0;
    if (angle > 90) angle = 90;
    
    onChange(angle);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ position: 'relative', width: size, height: size, background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', margin: '8px 0 24px 0', cursor: 'pointer', touchAction: 'none' }}
    >
       <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {/* Filled Quarter Circle Arc */}
          {/* M 0 size (bottom left) -> L size size (bottom right) -> A size size 0 0 0 0 0 (arc to top left) -> Z (close) */}
          <path d={`M 0 ${size} L ${size} ${size} A ${size} ${size} 0 0 0 0 0 Z`} fill="rgba(0,0,0,0.08)" />
          
          {/* Connecting line to the dot */}
          <line x1={cx} y1={cy} x2={dotX} y2={dotY} stroke="#444" strokeWidth="1.5" />
          
          {/* The draggable dot at the edge of the circle */}
          <circle cx={dotX} cy={dotY} r={3.5} fill="#444" stroke="transparent" style={{ pointerEvents: 'auto' }} />
       </svg>
       <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', color: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
          {Math.round(value)}°
       </div>
    </div>
  );
}


// ── Main Component ─────────────────────────────────────────
interface BrushStudioProps {
  isOpen: boolean;
  brushName: string;
  settings: BrushStudioSettings;
  onDone: (settings: BrushStudioSettings) => void;
  onCancel: () => void;
}

export function BrushStudio({ isOpen, brushName, settings, onDone, onCancel }: BrushStudioProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("stroke");
  const [localSettings, setLocalSettings] = useState<BrushStudioSettings>(settings);
  const [wasOpen, setWasOpen] = useState(false);

  // Drawing pad refs
  const padCanvasRef = useRef<HTMLCanvasElement>(null);
  const padEngineRef = useRef<BrushEngine | null>(null);
  const isDrawingRef = useRef(false);
  const lastTimeRef = useRef(0);

  // Re-sync local settings when the overlay transitions from closed to open
  useEffect(() => {
    if (isOpen && !wasOpen) {
      setLocalSettings(settings);
    }
    setWasOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Initialize pad brush engine
  useEffect(() => {
    if (!isOpen) return;
    const canvas = padCanvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();

    padEngineRef.current = new BrushEngine(canvas);
    padEngineRef.current.setBrush(brushName);
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      padEngineRef.current.setColor(200, 200, 200); // Light gray on dark bg
    } else {
      padEngineRef.current.setColor(50, 50, 50); // Dark gray on light bg
    }
    padEngineRef.current.setBrushSize(10);
    padEngineRef.current.setOpacity(1.0);
    // Apply current studio settings to the drawing pad engine
    padEngineRef.current.applyStudioSettings(localSettings);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);

    return () => observer.disconnect();
  }, [isOpen, brushName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply settings to drawing pad engine whenever they change
  useEffect(() => {
    if (padEngineRef.current) {
      padEngineRef.current.applyStudioSettings(localSettings);
    }
  }, [localSettings]);

  // Keyboard escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  // Drawing pad pointer handlers
  const getPos = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const canvas = padCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const handlePadDown = useCallback(
    (e: React.PointerEvent) => {
      padCanvasRef.current?.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      lastTimeRef.current = performance.now() / 1000;
      const pos = getPos(e);
      let pressure = e.pressure;
      if (pressure === 0 && e.pointerType === "mouse") pressure = 0.5;
      const tiltX = e.tiltX || 0;
      const tiltY = e.tiltY || 0;
      
      padEngineRef.current?.startStroke(pos.x, pos.y);
      padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, tiltX, tiltY, 0.001);
    },
    [getPos]
  );

  const handlePadMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;

      const nativeEvent = e.nativeEvent as PointerEvent;
      const eventsToProcess = nativeEvent.getCoalescedEvents ? nativeEvent.getCoalescedEvents() : [nativeEvent];
      if (eventsToProcess.length === 0) {
        eventsToProcess.push(nativeEvent);
      }

      const now = performance.now() / 1000;
      let totalDt = now - lastTimeRef.current;
      if (totalDt <= 0) totalDt = 0.001;
      const dtPerEvent = totalDt / eventsToProcess.length;

      for (const ev of eventsToProcess) {
        const pos = getPos(ev);
        let pressure = ev.pressure;
        if (pressure === 0 && ev.pointerType === "mouse") pressure = 0.5;
        
        const tiltX = ev.tiltX || 0;
        const tiltY = ev.tiltY || 0;
        
        padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, tiltX, tiltY, dtPerEvent);
      }
      
      lastTimeRef.current = now;
    },
    [getPos]
  );

  const handlePadUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDrawingRef.current) {
        padEngineRef.current?.endStroke();
        padCanvasRef.current?.releasePointerCapture(e.pointerId);
        isDrawingRef.current = false;
      }
    },
    []
  );

  const clearPad = useCallback(() => {
    padEngineRef.current?.clear();
  }, []);

  // Settings updater helpers
  const updateSetting = <K extends keyof BrushStudioSettings>(key: K, value: BrushStudioSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  // ── Render Section Content ─────────────────────────────
  const renderStroke = () => (
    <>
      <div className="bs-section-title">Stroke properties</div>
      <SliderRow label="Spacing" value={localSettings.spacing} min={1} max={100} onChange={(v) => updateSetting("spacing", v)} />
      <SliderRow label="Spacing Jitter" value={localSettings.spacingJitter} onChange={(v) => updateSetting("spacingJitter", v)} />
      <SliderRow label="Jitter Lateral" value={localSettings.jitterLateral} onChange={(v) => updateSetting("jitterLateral", v)} />
      <SliderRow label="Jitter Linear" value={localSettings.jitterLinear} onChange={(v) => updateSetting("jitterLinear", v)} />
      <SliderRow label="Fall off" value={localSettings.fallOff} onChange={(v) => updateSetting("fallOff", v)} />
    </>
  );

  const renderStabilization = () => (
    <>
      <div className="bs-section-title">StreamLine</div>
      <SliderRow label="Amount" value={localSettings.streamlineAmount} onChange={(v) => updateSetting("streamlineAmount", v)} />
      <SliderRow label="Pressure" value={localSettings.streamlinePressure} onChange={(v) => updateSetting("streamlinePressure", v)} />

      <div className="bs-group-title">Stabilization</div>
      <SliderRow label="Amount" value={localSettings.stabilizationAmount} onChange={(v) => updateSetting("stabilizationAmount", v)} />

      <div className="bs-group-title">Motion filtering</div>
      <SliderRow label="Amount" value={localSettings.motionFilterAmount} onChange={(v) => updateSetting("motionFilterAmount", v)} />
      <SliderRow label="Expression" value={localSettings.motionFilterExpression} onChange={(v) => updateSetting("motionFilterExpression", v)} />
    </>
  );

  const renderTaper = () => (
    <>
      <div className="bs-section-title">Pressure taper</div>
      <TaperCurvePreview size={localSettings.taperSize} pressure={localSettings.taperPressure} />
      <ToggleRow label="Link tip sizes" value={localSettings.taperLinkTips} onChange={(v) => updateSetting("taperLinkTips", v)} />
      <SliderRow label="Size" value={localSettings.taperSize} onChange={(v) => updateSetting("taperSize", v)} />
      <SliderRow label="Opacity" value={localSettings.taperOpacity} onChange={(v) => updateSetting("taperOpacity", v)} />
      <SliderRow label="Pressure" value={localSettings.taperPressure} onChange={(v) => updateSetting("taperPressure", v)} />
      <SliderRow
        label="Tip"
        value={localSettings.taperTip}
        min={0}
        max={100}
        suffix=""
        onChange={(v) => updateSetting("taperTip", v)}
      />
      <ToggleRow label="Tip animation" value={localSettings.taperTipAnimation} onChange={(v) => updateSetting("taperTipAnimation", v)} />
    </>
  );

  const renderRendering = () => (
    <>
      <div className="bs-section-title">Rendering mode</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
         {["Light Glaze", "Uniformed Glaze", "Intense Glaze", "Heavy Glaze", "Uniform Blending", "Intense Blending"].map(mode => (
             <button
                key={mode}
                onClick={() => updateSetting("renderingMode", mode)}
                className={`bs-rendering-btn ${localSettings.renderingMode === mode ? 'active' : ''}`}
             >
                {mode}
                {localSettings.renderingMode === mode && <span>✓</span>}
             </button>
         ))}
      </div>

      <div className="bs-group-title">Blending</div>
      <SliderRow label="Flow" value={localSettings.flow} onChange={(v) => updateSetting("flow", v)} />
      <SliderRow label="Wet edges" value={localSettings.wetEdges} onChange={(v) => updateSetting("wetEdges", v)} />
      <SliderRow label="Burnt edges" value={localSettings.burnEdges} onChange={(v) => updateSetting("burnEdges", v)} />
      
      <SelectRow 
          label="Burnt edges mode" 
          value={localSettings.burnEdgesMode} 
          options={["Multiply", "Linear Burn", "Color Burn", "Overlay"]} 
          onChange={(v) => updateSetting("burnEdgesMode", v)} 
      />
      <SelectRow 
          label="Blend mode" 
          value={localSettings.blendMode} 
          options={["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Color Dodge", "Color Burn"]} 
          onChange={(v) => updateSetting("blendMode", v)} 
      />

      <div style={{ marginTop: '16px' }}>
          <ToggleRow label="Luminance blending" value={localSettings.luminanceBlending} onChange={(v) => updateSetting("luminanceBlending", v)} />
          <ToggleRow label="Alpha Threshold" value={localSettings.alphaThreshold} onChange={(v) => updateSetting("alphaThreshold", v)} />
          <SliderRow label="Threshold Amount" value={localSettings.thresholdAmount} onChange={(v) => updateSetting("thresholdAmount", v)} />
      </div>
    </>
  );

  const renderApplePencil = () => (
    <>
      <div className="bs-section-title">Pressure</div>
      <PressureCurveWidget value={localSettings.pressureCurve} onChange={(v) => updateSetting("pressureCurve", v)} />
      <SliderRow label="Size" value={localSettings.pressureSize} onChange={(v) => updateSetting("pressureSize", v)} />
      <SliderRow label="Opacity" value={localSettings.pressureOpacity} onChange={(v) => updateSetting("pressureOpacity", v)} />
      <SliderRow label="Flow" value={localSettings.pressureFlow} suffix="%" onChange={(v) => updateSetting("pressureFlow", v)} />
      <SliderRow label="Bleed" value={localSettings.pressureBleed} onChange={(v) => updateSetting("pressureBleed", v)} />

      <div className="bs-group-title">Tilt</div>
      <TiltWidget value={localSettings.tiltAngle} onChange={(v) => updateSetting("tiltAngle", v)} />
      <SliderRow label="Opacity" value={localSettings.tiltOpacity} onChange={(v) => updateSetting("tiltOpacity", v)} />
      <SliderRow label="Gradation" value={localSettings.tiltGradation} onChange={(v) => updateSetting("tiltGradation", v)} />
      <SliderRow label="Bleed" value={localSettings.tiltBleed} onChange={(v) => updateSetting("tiltBleed", v)} />
      <SliderRow label="Size" value={localSettings.tiltSize} onChange={(v) => updateSetting("tiltSize", v)} />
      <ToggleRow label="Size compression" value={localSettings.tiltSizeCompression} onChange={(v) => updateSetting("tiltSizeCompression", v)} />

      <div className="bs-group-title">Barrel roll</div>
      <SliderRow label="Size" value={localSettings.barrelRollSize} onChange={(v) => updateSetting("barrelRollSize", v)} />
      <SliderRow label="Opacity" value={localSettings.barrelRollOpacity} onChange={(v) => updateSetting("barrelRollOpacity", v)} />
      <SliderRow label="Bleed" value={localSettings.barrelRollBleed} onChange={(v) => updateSetting("barrelRollBleed", v)} />

      <div className="bs-group-title">Cursor outline</div>
      <SelectRow 
          label="" 
          value={localSettings.cursorOutline} 
          options={["None", "Contrast", "Active color"]} 
          onChange={(v) => updateSetting("cursorOutline", v)} 
      />

      <div className="bs-group-title">Hover</div>
      <SliderRow label="Estimated pressure" value={localSettings.hoverEstimatedPressure} onChange={(v) => updateSetting("hoverEstimatedPressure", v)} />

      <div className="bs-group-title">Hover fill</div>
      <SelectRow 
          label="" 
          value={localSettings.hoverFill} 
          options={["None", "Shape"]} 
          onChange={(v) => updateSetting("hoverFill", v)} 
      />
      <div style={{ marginTop: '8px', padding: '0 8px' }}>
         <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
            All
            <input 
              type="checkbox" 
              checked={localSettings.hoverFillAll} 
              onChange={(e) => updateSetting("hoverFillAll", e.target.checked)} 
              style={{ width: '16px', height: '16px', accentColor: '#4a9eff' }}
            />
         </label>
      </div>
    </>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "stroke":
        return renderStroke();
      case "stabilization":
        return renderStabilization();
      case "taper":
        return renderTaper();
      case "rendering":
        return renderRendering();
      case "applepencil":
        return renderApplePencil();
      default:
        return <div className="bs-coming-soon">Coming soon</div>;
    }
  };

  const tipLabels: Record<number, string> = {};
  for (let i = 0; i <= 100; i += 25) {
    tipLabels[i] = i <= 25 ? "Sharp" : i <= 50 ? "Round" : i <= 75 ? "Flat" : "Square";
  }

  return (
    <div className="brush-studio-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      {/* Decorative handle dots */}
      <div style={{ position: "relative" }}>
        <div className="bs-dots">
          <span /><span /><span />
        </div>

        <div className="brush-studio">
          {/* ── LEFT SIDEBAR ──────────────────────────── */}
          <div className="bs-sidebar">
            <div className="bs-sidebar-title">Brush Studio</div>
            {SIDEBAR_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                className={`bs-sidebar-item ${activeSection === sec.id ? "active" : ""} ${!sec.enabled ? "disabled" : ""}`}
                onClick={() => {
                  if (sec.enabled) setActiveSection(sec.id);
                }}
              >
                <span className="bs-sidebar-icon">{sec.icon}</span>
                {sec.label}
              </button>
            ))}
          </div>

          {/* ── CENTER PANEL ──────────────────────────── */}
          <div className="bs-center">{renderSection()}</div>

          {/* ── RIGHT PANEL (Drawing Pad) ─────────────── */}
          <div className="bs-right">
            <div className="bs-right-header">
              <div className="bs-drawing-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Drawing Pad
              </div>
              <div className="bs-header-actions">
                <button className="bs-btn-cancel" onClick={onCancel}>
                  Cancel
                </button>
                <button className="bs-btn-done" onClick={() => onDone(localSettings)}>
                  Done
                </button>
              </div>
            </div>
            <div className="bs-drawing-area">
              <canvas
                ref={padCanvasRef}
                onPointerDown={handlePadDown}
                onPointerMove={handlePadMove}
                onPointerUp={handlePadUp}
                onPointerLeave={handlePadUp}
              />
              <button className="bs-clear-btn" onClick={clearPad}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
