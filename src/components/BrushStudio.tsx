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
  { id: "rendering",     label: "Rendering",       icon: "⟋",  enabled: false },
  { id: "wetmix",        label: "Wet Mix",         icon: "💧",  enabled: false },
  { id: "colordynamics", label: "Color dynamics",  icon: "✧",  enabled: false },
  { id: "dynamics",      label: "Dynamics",        icon: "⌇",  enabled: false },
  { id: "applepencil",   label: "Apple Pencil",    icon: "✎",  enabled: false },
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
            background: `linear-gradient(to right, #4a9eff ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
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

// ── Taper Curve Preview ────────────────────────────────────
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
      padEngineRef.current?.startStroke(pos.x, pos.y);
      padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, 0.001);
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
        
        padEngineRef.current?.strokeTo(pos.x, pos.y, pressure, dtPerEvent);
      }
      
      lastTimeRef.current = now;
    },
    [getPos]
  );

  const handlePadUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDrawingRef.current) {
        padCanvasRef.current?.releasePointerCapture(e.pointerId);
        isDrawingRef.current = false;
      }
    },
    []
  );

  const clearPad = useCallback(() => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  const renderSection = () => {
    switch (activeSection) {
      case "stroke":
        return renderStroke();
      case "stabilization":
        return renderStabilization();
      case "taper":
        return renderTaper();
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
