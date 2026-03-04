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
  { id: "shape",         label: "Shape",           icon: "✦",  enabled: true },
  { id: "grain",         label: "Grain",           icon: "▦",  enabled: true },
  { id: "rendering",     label: "Rendering",       icon: "⟋",  enabled: true },
  { id: "wetmix",        label: "Wet Mix",         icon: "💧",  enabled: true },
  { id: "colordynamics", label: "Color dynamics",  icon: "✧",  enabled: true },
  { id: "dynamics",      label: "Dynamics",        icon: "⌇",  enabled: true },
  { id: "applepencil",   label: "Pencil",          icon: "✎",  enabled: true },
  { id: "properties",    label: "Properties",      icon: "☰",  enabled: true },
  { id: "preview",       label: "Preview",         icon: "▢",  enabled: true },
  { id: "about",         label: "About this brush",icon: "ⓘ",  enabled: true },
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
      <div className="bs-slider-controls">
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
              background: `linear-gradient(to right, var(--bs-slider-fill, #4df0ff) ${pct}%, transparent ${pct}%)`,
            }}
          />
        </div>
        <span className="bs-value-badge">{displayVal}</span>
      </div>
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
function TaperWidget({ start, end, onChangeStart, onChangeEnd }: { start: number; end: number; onChangeStart: (v: number) => void; onChangeEnd: (v: number) => void; }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<'start' | 'end' | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    // Nearest dot
    const distStart = Math.abs(x - start);
    const distEnd = Math.abs(x - (1 - end));
    
    if (distStart < distEnd && distStart < 0.2) setDragTarget('start');
    else if (distEnd < 0.2) setDragTarget('end');
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragTarget || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    if (dragTarget === 'start') {
      onChangeStart(Math.min(x, 1 - end - 0.05)); // prevent crossing
    } else {
      onChangeEnd(Math.min(1 - x, 1 - start - 0.05));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragTarget(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const s = start;
  const eVal = 1 - end;

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ position: 'relative', height: 70, background: 'var(--bs-slider-track)', borderRadius: 12, margin: '16px 0', cursor: 'ew-resize', touchAction: 'none' }}
    >
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
           {/* Dynamic vertical lines at dot positions */}
           <line x1={s * 100} y1="0" x2={s * 100} y2="100" stroke={document.documentElement.classList.contains("dark") ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
           <line x1={eVal * 100} y1="0" x2={eVal * 100} y2="100" stroke={document.documentElement.classList.contains("dark") ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
           
           {/* Center horizontal line */}
           <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
           
           {/* Taper representation */}
           <polygon 
              points={`0,50 ${s * 100},25 ${eVal * 100},25 100,50 ${eVal * 100},75 ${s * 100},75`}
              fill="rgba(0,0,0,0.3)"
           />
        </svg>

        <div style={{ position: 'absolute', left: `${s * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, background: '#4df0ff', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', left: `${eVal * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, background: '#4df0ff', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '50%' }} />
    </div>
  );
}

// ── Utility: Smooth Catmull-Rom Spline SVG Path ────────────
function getSplinePath(curve: {x:number, y:number}[]): string {
  const n = curve.length;
  if (n === 0) return "";
  if (n === 1) return `M ${curve[0].x * 100} ${(1 - curve[0].y) * 100}`;
  
  let path = `M ${curve[0].x * 100} ${(1 - curve[0].y) * 100}`;
  
  if (n === 2) {
    path += ` L ${curve[1].x * 100} ${(1 - curve[1].y) * 100}`;
    return path;
  }

  const p = [...curve];
  // duplicate endpoints for Catmull-Rom
  p.unshift(curve[0]);
  p.push(curve[n - 1]);

  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x * 100} ${(1 - cp1y) * 100}, ${cp2x * 100} ${(1 - cp2y) * 100}, ${p2.x * 100} ${(1 - p2.y) * 100}`;
  }
  
  return path;
}

// ── Utility: Pressure Curve Widget ─────────────────────────
function PressureCurveWidget({ value, onChange }: { value: { x: number; y: number }[]; onChange: (v: { x: number; y: number }[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const lastClickTime = useRef(0);
  const lastClickIdx = useRef(-1);

  const getPt = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pt = getPt(e.clientX, e.clientY);
    
    // Check if clicking near an existing point
    const threshold = 10; // 10px hit area
    let closestIdx = -1;
    let minD = Infinity;
    value.forEach((p, i) => {
      const dx = p.x * rect.width - pt.x * rect.width;
      const dy = p.y * rect.height - pt.y * rect.height;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < threshold && d < minD) {
        minD = d;
        closestIdx = i;
      }
    });

    // Double-click detection: delete intermediate dots
    const now = Date.now();
    if (closestIdx !== -1 && closestIdx === lastClickIdx.current && now - lastClickTime.current < 300) {
      // Double-click on same dot — remove it if not first or last
      if (closestIdx > 0 && closestIdx < value.length - 1) {
        const newPts = value.filter((_, i) => i !== closestIdx);
        onChange(newPts);
        lastClickTime.current = 0;
        lastClickIdx.current = -1;
        return;
      }
    }
    lastClickTime.current = now;
    lastClickIdx.current = closestIdx;

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

  const handleReset = () => {
    onChange([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  };
  
  const pathData = getSplinePath(value);

  return (
    <div>
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: 'relative', width: 270, height: 270, background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', margin: '8px 0 8px 0', cursor: 'crosshair', touchAction: 'none' }}
      >
         {/* Grid Lines */}
         <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
              {/* Vertical */}
              <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              {/* Horizontal */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              
              {/* Curve Path */}
              <path d={pathData} stroke="#444" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
              
              {/* Points - intermediate dots are slightly larger to hint they're removable */}
              {value.map((p, i) => (
                 <circle key={i} cx={p.x * 100} cy={(1 - p.y) * 100} r={i === 0 || i === value.length - 1 ? 2.5 : 3.5} fill={i === 0 || i === value.length - 1 ? "#444" : "#2979ff"} stroke="transparent" />
              ))}
           </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: 'var(--bs-text-muted)', fontStyle: 'italic' }}>
          {value.length > 2 ? 'Double-click dot to remove' : ''}
        </span>
        <button
          className="bs-grain-edit-btn"
          onClick={handleReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Utility: Tilt Widget ───────────────────────────────────
function TiltWidget({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Value represents 0-90 degrees.
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Angle in radians (0 is right, 90 is up)
  const angleRad = value * (Math.PI / 180);
  
  const dotX = Math.cos(angleRad) * 100;
  const dotY = 100 - Math.sin(angleRad) * 100;

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
    const dx = x - 0;
    const dy = rect.height - y; // inverted y since screen y goes down
    
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
      style={{ position: 'relative', width: 270, height: 270, background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', margin: '8px 0 24px 0', cursor: 'pointer', touchAction: 'none' }}
    >
       <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {/* Filled Quarter Circle Arc */}
            <path d={`M 0 100 L 100 100 A 100 100 0 0 0 0 0 Z`} fill="rgba(0,0,0,0.08)" />
            
            {/* Connecting line to the dot */}
            <line x1={0} y1={100} x2={dotX} y2={dotY} stroke="#444" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            
            {/* The draggable dot at the edge of the circle */}
            <circle cx={dotX} cy={dotY} r={2.5} fill="#444" stroke="transparent" style={{ pointerEvents: 'auto' }} />
         </svg>
         <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', color: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
            {Math.round(value)}°
         </div>
    </div>
  );
}

// ── Utility: Circular Angle Widget ─────────────────────────────
function CircularAngleWidget({
  rotation,
  roundness,
  onRotationChange,
  onRoundnessChange,
}: {
  rotation: number;
  roundness: number;
  onRotationChange: (v: number) => void;
  onRoundnessChange: (v: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<"rotation" | "roundness" | null>(null);

  const handlePointerDown = (e: React.PointerEvent, type: "rotation" | "roundness") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag(type);
    updateValues(e, type);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeDrag) {
      updateValues(e, activeDrag);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveDrag(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateValues = (e: React.PointerEvent, type: "rotation" | "roundness") => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    if (type === "rotation") {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      onRotationChange(angle);
    } else if (type === "roundness") {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = rect.width / 2;
      let r = (dist / maxDist) * 100;
      r = Math.max(0, Math.min(100, r));
      onRoundnessChange(r);
    }
  };

  const angleRad = (rotation * Math.PI) / 180;
  const rotX = 50 + Math.cos(angleRad) * 40;
  const rotY = 50 + Math.sin(angleRad) * 40;
  const rotOppX = 50 + Math.cos(angleRad + Math.PI) * 40;
  const rotOppY = 50 + Math.sin(angleRad + Math.PI) * 40;

  const roundRadius = Math.max(0, Math.min(40, (roundness / 100) * 40));
  const perpRad1 = angleRad + Math.PI / 2;
  const perpRad2 = angleRad - Math.PI / 2;
  const r1X = 50 + Math.cos(perpRad1) * roundRadius;
  const r1Y = 50 + Math.sin(perpRad1) * roundRadius;
  const r2X = 50 + Math.cos(perpRad2) * roundRadius;
  const r2Y = 50 + Math.sin(perpRad2) * roundRadius;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'relative', width: 270, height: 270, background: 'rgba(0,0,0,0.01)',
        border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', margin: '8px 0 24px 0',
        touchAction: 'none'
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ pointerEvents: 'none' }}>
        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" strokeDasharray="2,2" fill="none" />
        
        <ellipse
          cx="50" cy="50" rx="40" ry={roundRadius} fill="none"
          stroke="rgba(255,255,255,0.6)" strokeWidth="1"
          transform={`rotate(${rotation} 50 50)`}
        />

        {/* Rotation Dots (Green) */}
        <circle cx={rotX} cy={rotY} r="3" fill="#34c759" stroke="#fff" strokeWidth="1" style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handlePointerDown(e, "rotation")} />
        <circle cx={rotOppX} cy={rotOppY} r="3" fill="#34c759" stroke="#fff" strokeWidth="1" style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handlePointerDown(e, "rotation")} />

        {/* Roundness Dots (Blue) */}
        <circle cx={r1X} cy={r1Y} r="3" fill="#007aff" stroke="#fff" strokeWidth="1" style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handlePointerDown(e, "roundness")} />
        <circle cx={r2X} cy={r2Y} r="3" fill="#007aff" stroke="#fff" strokeWidth="1" style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handlePointerDown(e, "roundness")} />
      </svg>
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
        {Math.round(rotation)}°
      </div>
    </div>
  );
}

// ── Utility: Grain Preview Canvas ──────────────────────────
function GrainPreview({ zoom, brightness, contrast }: { zoom: number; brightness: number; contrast: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 120;

    const scale = Math.max(1, zoom / 50);
    const imgData = ctx.createImageData(120, 120);
    const data = imgData.data;
    const brightnessOffset = (brightness / 100) * 128;
    const contrastFactor = 1 + (contrast / 100);

    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < 120; x++) {
        const sx = Math.floor(x / scale) * 1337;
        const sy = Math.floor(y / scale) * 7919;
        // Simple hash noise
        let noise = ((sx ^ sy) * 2654435761 >>> 0) % 256;
        // Apply brightness and contrast
        noise = Math.max(0, Math.min(255, (noise - 128) * contrastFactor + 128 + brightnessOffset));
        const i = (y * 120 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = noise;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [zoom, brightness, contrast]);

  return <canvas ref={canvasRef} width={120} height={120} />;
}


// ── Main Component ─────────────────────────────────────────
export interface BrushStudioProps {
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

  // Editor Drawer State
  const [isEditorOpen, setIsEditorOpen] = useState<"shape" | "grain" | null>(null);

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
      const twist = (e.nativeEvent as PointerEvent & { twist?: number }).twist || 0;
      
      padEngineRef.current?.startStroke(pos.x, pos.y);
      padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, tiltX, tiltY, 0.001, twist);
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
        const twist = (ev as PointerEvent & { twist?: number }).twist || 0;
        
        padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, tiltX, tiltY, dtPerEvent, twist);
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

  // If the editor is open, render over the top
  if (isEditorOpen) {
    const isShape = isEditorOpen === 'shape';
    return (
      <div className="brush-studio-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="brush-studio-container" style={{ display: 'flex', flexDirection: 'column', background: '#1c1c1e' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h2 style={{ color: '#fff', fontSize: 28, margin: 0, fontWeight: 600 }}>
                 {isShape ? 'Shape Editor' : 'Grain Editor'}
               </h2>
               <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                 <button style={{ background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer' }} onClick={() => {}}>Import</button>
                 <button style={{ background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer' }} onClick={() => setIsEditorOpen(null)}>Cancel</button>
                 <button className="bs-top-btn done" onClick={() => setIsEditorOpen(null)}>Done</button>
               </div>
            </div>
            
            {/* Editor Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 500, height: 500, background: '#151515', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #333' }}>
                    {isShape ? (
                        <>
                           <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, transparent 70%)', opacity: 0.8, marginBottom: 40 }} />
                           <span style={{ color: '#aaa', fontSize: 16, fontWeight: 500, letterSpacing: 1.5 }}>ALGORITHMIC DAB</span>
                           <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 12, maxWidth: 300, lineHeight: 1.5 }}>MyPaint engine generates shapes mathematically instead of stamping images.</p>
                        </>
                    ) : (
                        <>
                           <div style={{ width: 200, height: 200, background: 'repeating-linear-gradient(45deg, #333 0, #333 2px, transparent 2px, transparent 8px), repeating-linear-gradient(-45deg, #333 0, #333 2px, transparent 2px, transparent 8px)', opacity: 0.5, marginBottom: 40, borderRadius: 16 }} />
                           <span style={{ color: '#aaa', fontSize: 16, fontWeight: 500, letterSpacing: 1.5 }}>PROCEDURAL GRAIN</span>
                           <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 12, maxWidth: 300, lineHeight: 1.5 }}>Texture is generated procedurally using noise and scattering.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // ── Render Section Content ─────────────────────────────
  const renderStroke = () => (
    <>
      <div className="bs-section-title">Stroke properties</div>
      <SliderRow label="Spacing" value={localSettings.spacing} min={1} max={100} onChange={(v) => updateSetting("spacing", v)} />
      <SliderRow label="Spacing Jitter" value={localSettings.spacingJitter} onChange={(v) => updateSetting("spacingJitter", v)} />
      <SliderRow label="Jitter Lateral" value={localSettings.jitterLateral} onChange={(v) => updateSetting("jitterLateral", v)} />
      <SliderRow label="Jitter Linear" value={localSettings.jitterLinear} onChange={(v) => updateSetting("jitterLinear", v)} />
      <SliderRow label="Fall off" value={localSettings.fallOff} onChange={(v) => updateSetting("fallOff", v)} />

      <div className="bs-group-title">Native Behavior</div>
      <div className="bs-slider-mypaint"><SliderRow label="Dabs per second" value={localSettings.dabsPerSecond} onChange={(v) => updateSetting("dabsPerSecond", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Stroke threshold" value={localSettings.strokeThreshold} onChange={(v) => updateSetting("strokeThreshold", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Stroke holdtime" value={localSettings.strokeHoldtime} onChange={(v) => updateSetting("strokeHoldtime", v)} /></div>
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
      
      <div className="bs-group-title">Native Engine Tracking</div>
      <div className="bs-slider-mypaint"><SliderRow label="Slow tracking" value={localSettings.slowTracking} onChange={(v) => updateSetting("slowTracking", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Slow tracking per dab" value={localSettings.slowTrackingPerDab} onChange={(v) => updateSetting("slowTrackingPerDab", v)} /></div>
    </>
  );

  const renderTaper = () => (
    <>
      <div className="bs-section-title">Pressure taper</div>
      <TaperWidget 
         start={localSettings.taperStart / 100} 
         end={localSettings.taperEnd / 100} 
         onChangeStart={(v) => updateSetting("taperStart", v * 100)} 
         onChangeEnd={(v) => updateSetting("taperEnd", v * 100)} 
      />
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

  const renderGrain = () => {
    const isMoving = localSettings.grainBehavior === "Moving";
    return (
      <>
        {/* Grain Source */}
        <div className="bs-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Grain Source
          <button className="bs-grain-edit-btn" onClick={() => setIsEditorOpen('grain')}>Edit</button>
        </div>
        <div className="bs-grain-preview" style={{ marginBottom: 20, width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GrainPreview
            zoom={isMoving ? localSettings.grainMovingZoom : localSettings.grainTexZoom}
            brightness={localSettings.grainBrightness}
            contrast={localSettings.grainContrast}
          />
        </div>

        {/* Grain behavior toggle */}
        <div className="bs-subsection-title">Grain behavior</div>
        <div className="bs-segment-control">
          <button
            className={`bs-segment-btn ${isMoving ? "active" : ""}`}
            onClick={() => updateSetting("grainBehavior", "Moving")}
            type="button"
          >
            <span className="bs-segment-icon">☁</span> Moving
          </button>
          <button
            className={`bs-segment-btn ${!isMoving ? "active" : ""}`}
            onClick={() => updateSetting("grainBehavior", "Texturized")}
            type="button"
          >
            <span className="bs-segment-icon">▦</span> Texturized
          </button>
        </div>

        {/* Moving grain settings */}
        {isMoving && (
          <>
            <SelectRow
              label="Movement"
              value={localSettings.grainMovement}
              options={["Rolling", "Flowing", "Glazed", "Luminescent"]}
              onChange={(v) => updateSetting("grainMovement", v)}
            />
            <SliderRow label="Scale" value={localSettings.grainMovingScale} onChange={(v) => updateSetting("grainMovingScale", v)} />
            <SliderRow label="Zoom" value={localSettings.grainMovingZoom} min={1} max={200} suffix="%" onChange={(v) => updateSetting("grainMovingZoom", v)} />
            <SliderRow label="Rotation" value={localSettings.grainMovingRotation} max={360} suffix="°" onChange={(v) => updateSetting("grainMovingRotation", v)} />
            <SliderRow label="Depth" value={localSettings.grainMovingDepth} suffix="%" onChange={(v) => updateSetting("grainMovingDepth", v)} />
            <SliderRow label="Depth minimum" value={localSettings.grainMovingDepthMin} onChange={(v) => updateSetting("grainMovingDepthMin", v)} />
            <SliderRow label="Depth jitter" value={localSettings.grainMovingDepthJitter} onChange={(v) => updateSetting("grainMovingDepthJitter", v)} />
          </>
        )}

        {/* Texturized grain settings */}
        {!isMoving && (
          <>
            <SliderRow label="Scale" value={localSettings.grainTexScale} onChange={(v) => updateSetting("grainTexScale", v)} />
            <SliderRow label="Zoom" value={localSettings.grainTexZoom} min={1} max={200} suffix="%" onChange={(v) => updateSetting("grainTexZoom", v)} />
            <SliderRow label="Rotation" value={localSettings.grainTexRotation} max={360} suffix="°" onChange={(v) => updateSetting("grainTexRotation", v)} />
            <SliderRow label="Depth" value={localSettings.grainTexDepth} suffix="%" onChange={(v) => updateSetting("grainTexDepth", v)} />
            <SliderRow label="Depth minimum" value={localSettings.grainTexDepthMin} onChange={(v) => updateSetting("grainTexDepthMin", v)} />
            <SliderRow label="Depth jitter" value={localSettings.grainTexDepthJitter} onChange={(v) => updateSetting("grainTexDepthJitter", v)} />
          </>
        )}

        {/* Common settings */}
        <div style={{ marginTop: 8 }}>
          <ToggleRow label="Offset jitter" value={localSettings.grainOffsetJitter} onChange={(v) => updateSetting("grainOffsetJitter", v)} />
          <SelectRow
            label="Blend mode"
            value={localSettings.grainBlendMode}
            options={["Multiply", "Screen", "Overlay", "Darken", "Lighten", "Color Dodge", "Color Burn"]}
            onChange={(v) => updateSetting("grainBlendMode", v)}
          />
          <SliderRow label="Brightness" value={localSettings.grainBrightness} min={-100} max={100} suffix="%" onChange={(v) => updateSetting("grainBrightness", v)} />
          <SliderRow label="Contrast" value={localSettings.grainContrast} min={-100} max={100} suffix="%" onChange={(v) => updateSetting("grainContrast", v)} />
        </div>

        {/* Grain filtering */}
        <div className="bs-subsection-title">Grain filtering</div>
        <div className="bs-radio-group">
          {["None", "Classic", "Improved"].map((mode) => (
            <button
              key={mode}
              className={`bs-radio-item ${localSettings.grainFiltering === mode ? "active" : ""}`}
              onClick={() => updateSetting("grainFiltering", mode)}
              type="button"
            >
              {mode === "None" ? "No filtering" : `${mode} filtering`}
              {localSettings.grainFiltering === mode && <span className="bs-radio-check">✓</span>}
            </button>
          ))}
        </div>

        {/* 3D grain behaviour */}
        <div className="bs-subsection-title">3D grain behaviour</div>
        <ToggleRow label="Grain follows camera" value={localSettings.grainFollowsCamera} onChange={(v) => updateSetting("grainFollowsCamera", v)} />
      </>
    );
  };

  const renderShape = () => {
    return (
    <>
      {/* Shape Source */}
      <div className="bs-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Shape Source
        <button className="bs-grain-edit-btn" onClick={() => setIsEditorOpen('shape')}>Edit</button>
      </div>
      <div style={{ background: '#111', width: '100%', height: 200, borderRadius: 12, margin: '8px 0 24px 0', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
         <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, transparent 70%)', opacity: 0.8, marginBottom: 12 }} />
         <span style={{ color: '#888', fontSize: 13, fontWeight: 500, letterSpacing: 0.5 }}>ALGORITHMIC DAB</span>
      </div>

      <div className="bs-subsection-title">Input style</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
         {["Touch only", "Azimuth", "Azimuth and barrel roll"].map(mode => (
             <button
                key={mode}
                onClick={() => updateSetting("shapeInputStyle", mode)}
                className={`bs-rendering-btn ${localSettings.shapeInputStyle === mode ? 'active' : ''}`}
             >
                {mode}
                {localSettings.shapeInputStyle === mode && <span>✓</span>}
             </button>
         ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <ToggleRow label="Relative to stroke" value={localSettings.shapeRelativeToStroke} onChange={(v) => updateSetting("shapeRelativeToStroke", v)} />
      </div>

      <div className="bs-subsection-title">Touch properties</div>
      <div style={{ opacity: 0.5, pointerEvents: 'none', marginBottom: 24 }}>
        <SliderRow label="Rotation" value={localSettings.shapeTouchRotation} suffix="%" onChange={(v) => updateSetting("shapeTouchRotation", v)} />
      </div>

      <div className="bs-subsection-title">Shape behavior</div>
      <div className="bs-slider-mypaint"><SliderRow label="Hardness" value={localSettings.shapeHardness} onChange={(v) => updateSetting("shapeHardness", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Direction filter" value={localSettings.directionFilter} onChange={(v) => updateSetting("directionFilter", v)} /></div>
      <SliderRow label="Scatter" value={localSettings.shapeScatter} onChange={(v) => updateSetting("shapeScatter", v)} />
      <SliderRow label="Count" value={localSettings.shapeCount} min={1} max={16} suffix="" onChange={(v) => updateSetting("shapeCount", v)} />
      <SliderRow label="Count jitter" value={localSettings.shapeCountJitter} onChange={(v) => updateSetting("shapeCountJitter", v)} />
      
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <ToggleRow label="Randomized" value={localSettings.shapeRandomized} onChange={(v) => updateSetting("shapeRandomized", v)} />
        <ToggleRow label="Flip X" value={localSettings.shapeFlipX} onChange={(v) => updateSetting("shapeFlipX", v)} />
        <ToggleRow label="Flip Y" value={localSettings.shapeFlipY} onChange={(v) => updateSetting("shapeFlipY", v)} />
      </div>

      <CircularAngleWidget
        rotation={localSettings.shapeRotation}
        roundness={localSettings.shapeRoundness}
        onRotationChange={(v) => updateSetting("shapeRotation", v)}
        onRoundnessChange={(v) => updateSetting("shapeRoundness", v)}
      />

      <SliderRow label="Pressure Roundness" value={localSettings.shapePressureRoundness} onChange={(v) => updateSetting("shapePressureRoundness", v)} />
      <SliderRow label="Tilt roundness" value={localSettings.shapeTiltRoundness} onChange={(v) => updateSetting("shapeTiltRoundness", v)} />
      <SliderRow label="Roundness Vertical Jitter" value={localSettings.shapeRoundnessVerticalJitter} onChange={(v) => updateSetting("shapeRoundnessVerticalJitter", v)} />
      <SliderRow label="Roundness Horizontal Jitter" value={localSettings.shapeRoundnessHorizontalJitter} onChange={(v) => updateSetting("shapeRoundnessHorizontalJitter", v)} />

      {/* Shape filtering */}
      <div className="bs-subsection-title">Shape filtering</div>
      <div className="bs-radio-group">
        {["None", "Classic", "Improved"].map((mode) => (
          <button
            key={mode}
            className={`bs-radio-item ${localSettings.shapeFiltering === mode ? "active" : ""}`}
            onClick={() => updateSetting("shapeFiltering", mode)}
            type="button"
          >
            {mode === "None" ? "No filtering" : `${mode} filtering`}
            {localSettings.shapeFiltering === mode && <span className="bs-radio-check">✓</span>}
          </button>
        ))}
      </div>
    </>
    );
  };

  const renderProperties = () => (
    <>
      <div className="bs-section-title">Brush properties</div>
      <ToggleRow label="Orient to screen" value={localSettings.orientToScreen} onChange={(v) => updateSetting("orientToScreen", v)} />
      <SliderRow label="Smudge Pull" value={localSettings.smudgePull} onChange={(v) => updateSetting("smudgePull", v)} />

      <div className="bs-group-title">Brush behavior</div>
      <SliderRow label="Maximum size" value={localSettings.maxSize} suffix={localSettings.maxSize >= 100 ? " Max" : "%"} onChange={(v) => updateSetting("maxSize", v)} />
      <SliderRow label="Minimum size" value={localSettings.minSize} onChange={(v) => updateSetting("minSize", v)} />
      <SliderRow label="Maximum opacity" value={localSettings.maxOpacity} suffix="%" onChange={(v) => updateSetting("maxOpacity", v)} />
      <SliderRow label="Minimum opacity" value={localSettings.minOpacity} onChange={(v) => updateSetting("minOpacity", v)} />
      <div className="bs-slider-mypaint"><SliderRow label="Opacity multiply" value={localSettings.opacityMultiply} onChange={(v) => updateSetting("opacityMultiply", v)} /></div>
    </>
  );

  const renderWetMix = () => (
    <>
      <div className="bs-section-title">Wet mix</div>
      <SliderRow label="Dilution" value={localSettings.wetMixDilution} onChange={(v) => updateSetting("wetMixDilution", v)} />
      <SliderRow label="Charge" value={localSettings.wetMixCharge} onChange={(v) => updateSetting("wetMixCharge", v)} />
      <SliderRow label="Attack" value={localSettings.wetMixAttack} onChange={(v) => updateSetting("wetMixAttack", v)} />
      <SliderRow label="Pull" value={localSettings.wetMixPull} onChange={(v) => updateSetting("wetMixPull", v)} />
      <SliderRow label="Grade" value={localSettings.wetMixGrade} onChange={(v) => updateSetting("wetMixGrade", v)} />
      <SliderRow label="Blur" value={localSettings.wetMixBlur} onChange={(v) => updateSetting("wetMixBlur", v)} />
      <SliderRow label="Blur jitter" value={localSettings.wetMixBlurJitter} onChange={(v) => updateSetting("wetMixBlurJitter", v)} />
      <SliderRow label="Wetness jitter" value={localSettings.wetMixWetnessJitter} onChange={(v) => updateSetting("wetMixWetnessJitter", v)} />
    </>
  );

  const renderColorDynamics = () => (
    <>
      <div className="bs-section-title">Stamp color jitter</div>
      <SliderRow label="Hue" value={localSettings.colorStampHue} onChange={(v) => updateSetting("colorStampHue", v)} />
      <SliderRow label="Saturation" value={localSettings.colorStampSaturation} onChange={(v) => updateSetting("colorStampSaturation", v)} />
      <SliderRow label="Lightness" value={localSettings.colorStampLightness} onChange={(v) => updateSetting("colorStampLightness", v)} />
      <SliderRow label="Darkness" value={localSettings.colorStampDarkness} onChange={(v) => updateSetting("colorStampDarkness", v)} />
      <SliderRow label="Secondary color" value={localSettings.colorStampSecondary} onChange={(v) => updateSetting("colorStampSecondary", v)} />

      <div className="bs-group-title">Stroke color jitter</div>
      <SliderRow label="Hue" value={localSettings.colorStrokeHue} onChange={(v) => updateSetting("colorStrokeHue", v)} />
      <SliderRow label="Saturation" value={localSettings.colorStrokeSaturation} onChange={(v) => updateSetting("colorStrokeSaturation", v)} />
      <SliderRow label="Lightness" value={localSettings.colorStrokeLightness} onChange={(v) => updateSetting("colorStrokeLightness", v)} />
      <SliderRow label="Darkness" value={localSettings.colorStrokeDarkness} onChange={(v) => updateSetting("colorStrokeDarkness", v)} />
      <SliderRow label="Secondary color" value={localSettings.colorStrokeSecondary} onChange={(v) => updateSetting("colorStrokeSecondary", v)} />

      <div className="bs-group-title">Color pressure</div>
      <SliderRow label="Hue" value={localSettings.colorPressureHue} onChange={(v) => updateSetting("colorPressureHue", v)} />
      <SliderRow label="Saturation" value={localSettings.colorPressureSaturation} onChange={(v) => updateSetting("colorPressureSaturation", v)} />
      <SliderRow label="Brightness" value={localSettings.colorPressureBrightness} onChange={(v) => updateSetting("colorPressureBrightness", v)} />
      <SliderRow label="Secondary Color" value={localSettings.colorPressureSecondary} onChange={(v) => updateSetting("colorPressureSecondary", v)} />

      <div className="bs-group-title">Color tilt</div>
      <SliderRow label="Hue" value={localSettings.colorTiltHue} onChange={(v) => updateSetting("colorTiltHue", v)} />
      <SliderRow label="Saturation" value={localSettings.colorTiltSaturation} onChange={(v) => updateSetting("colorTiltSaturation", v)} />
      <SliderRow label="Brightness" value={localSettings.colorTiltBrightness} onChange={(v) => updateSetting("colorTiltBrightness", v)} />
      <SliderRow label="Secondary Color" value={localSettings.colorTiltSecondary} onChange={(v) => updateSetting("colorTiltSecondary", v)} />

      <div className="bs-group-title">Color barrel roll</div>
      <SliderRow label="Hue" value={localSettings.colorBarrelHue} onChange={(v) => updateSetting("colorBarrelHue", v)} />
      <SliderRow label="Saturation" value={localSettings.colorBarrelSaturation} onChange={(v) => updateSetting("colorBarrelSaturation", v)} />
      <SliderRow label="Brightness" value={localSettings.colorBarrelBrightness} onChange={(v) => updateSetting("colorBarrelBrightness", v)} />
      <SliderRow label="Secondary Color" value={localSettings.colorBarrelSecondary} onChange={(v) => updateSetting("colorBarrelSecondary", v)} />
    </>
  );

  const renderDynamics = () => (
    <>
      <div className="bs-section-title">Speed</div>
      <SliderRow label="Size" value={localSettings.dynamicsSpeedSize} onChange={(v) => updateSetting("dynamicsSpeedSize", v)} />
      <SliderRow label="Opacity" value={localSettings.dynamicsSpeedOpacity} onChange={(v) => updateSetting("dynamicsSpeedOpacity", v)} />
      <SliderRow label="Spacing" value={localSettings.dynamicsSpeedSpacing} onChange={(v) => updateSetting("dynamicsSpeedSpacing", v)} />
      
      <div className="bs-group-title">Smoothing</div>
      <div className="bs-slider-mypaint"><SliderRow label="Speed1 slowness" value={localSettings.speed1Slowness} onChange={(v) => updateSetting("speed1Slowness", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Speed2 slowness" value={localSettings.speed2Slowness} onChange={(v) => updateSetting("speed2Slowness", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Speed1 gamma" value={localSettings.speed1Gamma} onChange={(v) => updateSetting("speed1Gamma", v)} /></div>
      <div className="bs-slider-mypaint"><SliderRow label="Speed2 gamma" value={localSettings.speed2Gamma} onChange={(v) => updateSetting("speed2Gamma", v)} /></div>

      <div className="bs-group-title">Jitter</div>
      <div className="bs-slider-mypaint"><SliderRow label="Offset by speed slowness" value={localSettings.offsetBySpeedSlowness} onChange={(v) => updateSetting("offsetBySpeedSlowness", v)} /></div>
      <SliderRow label="Size" value={localSettings.dynamicsJitterSize} onChange={(v) => updateSetting("dynamicsJitterSize", v)} />
      <SliderRow label="Opacity" value={localSettings.dynamicsJitterOpacity} onChange={(v) => updateSetting("dynamicsJitterOpacity", v)} />
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

  const renderPreview = () => {
    const currentPreset = BrushEngine.presets.find((p) => p.name === brushName);
    return (
    <>
      <div className="bs-section-title">Preview render</div>
      <div style={{ background: '#222', borderRadius: 12, padding: 16, border: '1px solid #333', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, overflow: 'hidden' }}>
         <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{brushName}</span>
         {currentPreset?.preview && (
            <img src={currentPreset.preview} alt="Brush Stroke Preview" style={{ width: '100%', height: 80, objectFit: 'contain', filter: 'invert(1) grayscale(1)' }} />
         )}
      </div>

      <div className="bs-section-title">Preview properties</div>
      <ToggleRow label="Use stamp preview" value={localSettings.previewUseStamp} onChange={(v) => updateSetting("previewUseStamp", v)} />
      <SliderRow label="Size" value={localSettings.previewSize} onChange={(v) => updateSetting("previewSize", v)} />
      <SliderRow label="Pressure Minimum" value={localSettings.previewPressureMin} onChange={(v) => updateSetting("previewPressureMin", v)} />
      <SliderRow label="Pressure Scale" value={localSettings.previewPressureScale} onChange={(v) => updateSetting("previewPressureScale", v)} />
      <ToggleRow label="Wet Mix" value={localSettings.previewWetMix} onChange={(v) => updateSetting("previewWetMix", v)} />
      <SliderRow label="Tilt angle" value={localSettings.previewTiltAngle} onChange={(v) => updateSetting("previewTiltAngle", v)} />
    </>
    );
  };

  const renderAbout = () => (
    <>
      <div style={{ background: '#222', borderRadius: 12, padding: 32, border: '1px solid #333', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
         <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 24, alignSelf: 'flex-start' }}>{brushName}</span>
         
         <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 32 }}>👤</span>
         </div>
         
         <span style={{ color: '#ccc', fontSize: 16, marginBottom: 4 }}>Made by <span style={{ color: '#fff', fontWeight: 600 }}>Name</span></span>
         <span style={{ color: '#666', fontSize: 12, marginBottom: 40 }}>Created on {new Date().toLocaleDateString()}</span>
         
         <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px dashed #444', paddingBottom: 8 }}>
            <span style={{ color: '#555', fontSize: 12 }}>Sign here</span>
            <span style={{ color: '#555', fontSize: 16 }}>⊗</span>
         </div>
      </div>

      <button style={{ width: '100%', background: '#222', color: '#ccc', border: '1px solid #333', borderRadius: 8, padding: '12px 16px', textAlign: 'left', fontSize: 14, marginBottom: 16, cursor: 'pointer' }}>
        Create new reset point
      </button>

      <div className="bs-section-title">Reset brush</div>
      <div style={{ background: '#222', borderRadius: 8, padding: '12px 16px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
         <input type="checkbox" checked={true} readOnly style={{ accentColor: '#2979ff', width: 16, height: 16 }} />
         <span style={{ color: '#ccc', fontSize: 14 }}>Last reset point: {new Date().toLocaleDateString()}</span>
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
      case "wetmix":
        return renderWetMix();
      case "grain":
        return renderGrain();
      case "shape":
        return renderShape();
      case "colordynamics":
        return renderColorDynamics();
      case "dynamics":
        return renderDynamics();
      case "applepencil":
        return renderApplePencil();
      case "properties":
        return renderProperties();
      case "preview":
        return renderPreview();
      case "about":
        return renderAbout();
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
