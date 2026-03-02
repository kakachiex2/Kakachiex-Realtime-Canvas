/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MypaintBrush,
  MypaintSurface,
  BRUSH,
  ColorRGB,
} from "../vendor/brushlib/js/mybrush.js";
import {
  DEFAULT_BRUSH_STUDIO_SETTINGS,
  type BrushStudioSettings,
} from "./brushStudioSettings";
import { CustomCompositor } from "./CustomCompositor";

// We need to map the brush names to their JSON content.
// Since we are in Vite, we can use glob import to get all json files.
const brushModules = import.meta.glob("../vendor/brushlib/brushes/*.myb.json", {
  eager: true,
});
const brushImages = import.meta.glob("../vendor/brushlib/brushes/*_prev.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export interface BrushPreset {
  name: string;
  category: string;
  setting: any;
  preview?: string;
}

const CATEGORIES: Record<string, string[]> = {
  Sketching: ["pencil", "charcoal", "b000"],
  Inking: ["pen", "calligraphy", "maobi"],
  Painting: ["brush", "impressionism", "watercolor"],
  Texture: [
    "coarse_bulk_1",
    "fur",
    "glow",
    "leaves",
    "short_grass",
    "texture_03",
    "texture_06",
  ],
  Artistic: ["sewing", "eraser"],
};

export class BrushEngine {
  private surface: any;
  private brush: any = null;
  private compositor: CustomCompositor;
  private canvasCtx: CanvasRenderingContext2D;
  private activeSettings: BrushStudioSettings = DEFAULT_BRUSH_STUDIO_SETTINGS;
  public static presets: BrushPreset[] = [];

  // Store original preset base values to scale relative to them
  private defaultBaseRadius: number = 0;
  private defaultBaseOpacity: number = 1;
  // Store original preset base values for studio settings so we can apply deltas
  private presetDabsPerBasicRadius: number = 0;
  private presetDabsPerActualRadius: number = 4;
  private presetOffsetByRandom: number = 0;
  private presetOffsetBySpeed: number = 0;
  private presetHardness: number = 0.5;
  private presetSlowTracking: number = 0;
  private presetSlowTrackingPerDab: number = 0;
  private presetSpeed1Slowness: number = 0.04;
  private presetSpeed2Slowness: number = 0.8;
  private presetDirectionFilter: number = 2;

  private baseImageData: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasCtx = canvas.getContext("2d", { willReadFrequently: true })!;
    this.compositor = new CustomCompositor();

    // MypaintSurface draws specifically to the isolated stroke canvas for clean glaze/blend modes
    this.surface = new MypaintSurface(this.compositor.strokeCanvas);

    // Override get_color to read from the main canvas for smudging, since stroke canvas starts transparent
    (this.surface as any).get_color = (x: number, y: number) => {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

      if (
        this.baseImageData &&
        x >= 0 &&
        y >= 0 &&
        x < this.baseImageData.width &&
        y < this.baseImageData.height
      ) {
        const index = (y * this.baseImageData.width + x) * 4;
        const data = this.baseImageData.data;
        // If the pixel is fully transparent, report it as white with 0 alpha (MyPaint interprets bg as white)
        const alpha = data[index + 3] / 255;
        if (alpha === 0) {
          (this.surface as any)["r"] = 1.0;
          (this.surface as any)["g"] = 1.0;
          (this.surface as any)["b"] = 1.0;
          (this.surface as any)["a"] = 0.0;
        } else {
          // Un-premultiply alpha so smudging doesn't artificially darken edges
          (this.surface as any)["r"] = data[index] / 255 / alpha;
          (this.surface as any)["g"] = data[index + 1] / 255 / alpha;
          (this.surface as any)["b"] = data[index + 2] / 255 / alpha;
          (this.surface as any)["a"] = alpha;
        }
      } else {
        const imgd = this.canvasCtx.getImageData(x, y, 1, 1);
        const pix = imgd.data;
        const alpha = pix[3] / 255;
        if (alpha === 0) {
          (this.surface as any)["r"] = 1.0;
          (this.surface as any)["g"] = 1.0;
          (this.surface as any)["b"] = 1.0;
          (this.surface as any)["a"] = 0.0;
        } else {
          (this.surface as any)["r"] = pix[0] / 255 / alpha;
          (this.surface as any)["g"] = pix[1] / 255 / alpha;
          (this.surface as any)["b"] = pix[2] / 255 / alpha;
          (this.surface as any)["a"] = alpha;
        }
      }
    };

    if (BrushEngine.presets.length === 0) {
      BrushEngine.loadPresets();
    }
  }

  public static loadPresets() {
    // Load all brushes
    const loaded: BrushPreset[] = [];
    for (const path in brushModules) {
      const setting = (brushModules[path] as any).default || brushModules[path];
      const filename = path.split("/").pop() || "";
      const name = filename.replace(".myb.json", "");

      // Determine category
      let category = "Other";
      for (const [cat, brushes] of Object.entries(CATEGORIES)) {
        if (brushes.includes(name)) {
          category = cat;
          break;
        }
      }

      // Find preview image
      // path is like ../vendor/brushlib/brushes/brush.myb.json
      // image is like ../vendor/brushlib/brushes/brush_prev.png
      const imagePath = path.replace(".myb.json", "_prev.png");
      const preview = brushImages[imagePath] as string | undefined;

      loaded.push({
        name,
        category,
        setting,
        preview,
      });
    }
    BrushEngine.presets = loaded;
  }

  public setBrush(name: string) {
    const preset = BrushEngine.presets.find((p) => p.name === name);
    if (preset) {
      this.brush = new MypaintBrush(preset.setting, this.surface);

      // Save original base values from the brush instance's internal settings array.
      // We read AFTER construction because readmyb_json maps string keys to numeric indices.
      this.defaultBaseRadius =
        this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value;
      this.defaultBaseOpacity = this.brush.settings[BRUSH.OPAQUE].base_value;
      this.presetDabsPerBasicRadius =
        this.brush.settings[BRUSH.DABS_PER_BASIC_RADIUS].base_value;
      this.presetDabsPerActualRadius =
        this.brush.settings[BRUSH.DABS_PER_ACTUAL_RADIUS].base_value;
      this.presetOffsetByRandom =
        this.brush.settings[BRUSH.OFFSET_BY_RANDOM].base_value;
      this.presetOffsetBySpeed =
        this.brush.settings[BRUSH.OFFSET_BY_SPEED].base_value;
      this.presetHardness = this.brush.settings[BRUSH.HARDNESS].base_value;
      this.presetSlowTracking =
        this.brush.settings[BRUSH.SLOW_TRACKING].base_value;
      this.presetSlowTrackingPerDab =
        this.brush.settings[BRUSH.SLOW_TRACKING_PER_DAB].base_value;
      this.presetSpeed1Slowness =
        this.brush.settings[BRUSH.SPEED1_SLOWNESS].base_value;
      this.presetSpeed2Slowness =
        this.brush.settings[BRUSH.SPEED2_SLOWNESS].base_value;
      this.presetDirectionFilter =
        this.brush.settings[BRUSH.DIRECTION_FILTER].base_value;
    }
  }

  public setColor(r: number, g: number, b: number) {
    if (!this.brush) return;
    const color = new ColorRGB(r / 255, g / 255, b / 255);
    color.rgb_to_hsv_float();

    this.brush.settings[BRUSH.COLOR_HUE].base_value = color.h;
    this.brush.settings[BRUSH.COLOR_SATURATION].base_value = color.s;
    this.brush.settings[BRUSH.COLOR_VALUE].base_value = color.v;
  }

  public setBrushSize(size: number) {
    if (!this.brush) return;
    // The slider ranges 1-100. Let's make 10 = 1.0x native size.
    // MyPaint radius is logarithmic, so scale is expressed by addition.
    const scale = size / 10;
    this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value =
      this.defaultBaseRadius + Math.log(scale);
  }

  public setOpacity(opacity: number) {
    if (!this.brush) return;
    // Multiply the user opacity (0 to 1) by the preset's native desired opacity
    this.brush.settings[BRUSH.OPAQUE].base_value =
      this.defaultBaseOpacity * opacity;
  }

  /**
   * Apply Brush Studio settings to the active MyPaint brush.
   * Maps UI slider values (0-100%) to actual MyPaint BRUSH parameters.
   */
  public applyStudioSettings(s: BrushStudioSettings) {
    if (!this.brush) return;

    // ── STROKE PROPERTIES ──────────────────────────────────

    // Spacing: controls dab density. spacing=1% → dense (high dabs value ~6)
    // spacing=100% → sparse (low dabs value ~0.3)
    // We invert: higher spacing % = fewer dabs = sparser stroke
    const spacingFactor = Math.max(0.1, 1.0 / ((s.spacing / 100) * 3 + 0.1));
    this.brush.settings[BRUSH.DABS_PER_BASIC_RADIUS].base_value =
      this.presetDabsPerBasicRadius * spacingFactor;
    this.brush.settings[BRUSH.DABS_PER_ACTUAL_RADIUS].base_value =
      this.presetDabsPerActualRadius * spacingFactor;

    // Spacing Jitter: adds randomness to radius → visual "spacing jitter"
    // 0% = no random radius, 100% = lots of random radius variation
    this.brush.settings[BRUSH.RADIUS_BY_RANDOM].base_value =
      (s.spacingJitter / 100) * 1.5;

    // Jitter Lateral: random offset perpendicular to stroke direction
    // Maps 0-100% → 0.0-3.0 on OFFSET_BY_RANDOM
    this.brush.settings[BRUSH.OFFSET_BY_RANDOM].base_value =
      this.presetOffsetByRandom + (s.jitterLateral / 100) * 3.0;

    // Jitter Linear: offset along stroke direction (speed-based offset)
    // Maps 0-100% → 0.0-2.0 on OFFSET_BY_SPEED
    this.brush.settings[BRUSH.OFFSET_BY_SPEED].base_value =
      this.presetOffsetBySpeed + (s.jitterLinear / 100) * 2.0;

    // Fall off: controls hardness of the dab edge
    // 0% = soft falloff (low hardness), 100% = crisp hard edge (hardness=1.0)
    this.brush.settings[BRUSH.HARDNESS].base_value =
      this.presetHardness * (1 - s.fallOff / 100) + s.fallOff / 100;

    // ── STABILIZATION ──────────────────────────────────────

    // StreamLine Amount: smooth cursor tracking (lagging behind mouse)
    // 0% = instant tracking, 100% = heavy smoothing
    // Maps 0-100% → 0.0-15.0 on SLOW_TRACKING
    this.brush.settings[BRUSH.SLOW_TRACKING].base_value =
      this.presetSlowTracking + (s.streamlineAmount / 100) * 15.0;

    // StreamLine Pressure: per-dab tracking smoothing
    // Maps 0-100% → 0.0-8.0 on SLOW_TRACKING_PER_DAB
    this.brush.settings[BRUSH.SLOW_TRACKING_PER_DAB].base_value =
      this.presetSlowTrackingPerDab + (s.streamlinePressure / 100) * 8.0;

    // Stabilization Amount: speed smoothing (averages speed over time)
    // Higher values = slower response to speed changes
    // Maps 0-100% → base + 0.0-5.0 on SPEED1_SLOWNESS
    this.brush.settings[BRUSH.SPEED1_SLOWNESS].base_value =
      this.presetSpeed1Slowness + (s.stabilizationAmount / 100) * 5.0;

    // Motion filtering Amount: secondary speed averaging
    // Maps 0-100% → base + 0.0-6.0 on SPEED2_SLOWNESS
    this.brush.settings[BRUSH.SPEED2_SLOWNESS].base_value =
      this.presetSpeed2Slowness + (s.motionFilterAmount / 100) * 6.0;

    // Motion filtering Expression: direction smoothing
    // Maps 0-100% → base + 0.0-10.0 on DIRECTION_FILTER
    this.brush.settings[BRUSH.DIRECTION_FILTER].base_value =
      this.presetDirectionFilter + (s.motionFilterExpression / 100) * 10.0;

    // ── TAPER ──────────────────────────────────────────────
    // Taper settings modify how pressure affects size and opacity.
    // We modify the pressure response curves (pointsList) on the brush's
    // RADIUS_LOGARITHMIC and OPAQUE_MULTIPLY mappings.

    // Taper Size: how much the stroke tapers at start/end based on pressure
    // We modify the pressure→radius curve to control size taper
    const radiusMapping = this.brush.settings[BRUSH.RADIUS_LOGARITHMIC];
    const taperSizeFactor = s.taperSize / 100; // 0.0 = no taper, 1.0 = full taper
    if (radiusMapping.pointsList) {
      const pressurePts = radiusMapping.pointsList[0]; // INPUT.PRESSURE = 0
      if (pressurePts && pressurePts.n >= 2) {
        // Scale the pressure-to-radius curve: stronger taper = steeper ramp
        const range = taperSizeFactor * 1.5;
        pressurePts.yvalues[0] = -range;
        pressurePts.yvalues[pressurePts.n - 1] = range * 0.5;
      }
    }

    // Taper Opacity: how pressure affects opacity at stroke edges
    const opacityMapping = this.brush.settings[BRUSH.OPAQUE_MULTIPLY];
    const taperOpacityFactor = s.taperOpacity / 100;
    if (opacityMapping.pointsList) {
      const pressurePts = opacityMapping.pointsList[0]; // INPUT.PRESSURE = 0
      if (pressurePts && pressurePts.n >= 2) {
        // Scale the pressure-to-opacity curve
        pressurePts.yvalues[0] = -taperOpacityFactor;
        pressurePts.yvalues[pressurePts.n - 1] = taperOpacityFactor;
      }
    }

    // Taper Pressure: overall pressure sensitivity multiplier
    // Affects STROKE_THRESHOLD — at what pressure the stroke registers
    const pressureThreshold = (1 - s.taperPressure / 100) * 0.1;
    this.brush.settings[BRUSH.STROKE_THRESHOLD].base_value = pressureThreshold;

    // Taper Tip: controls elliptical dab ratio for tip shape
    // 0 = sharp (ratio ~1), 100 = square (ratio ~3)
    const tipRatio = 1.0 + (s.taperTip / 100) * 2.0;
    this.brush.settings[BRUSH.ELLIPTICAL_DAB_RATIO].base_value = tipRatio;

    // ── RENDERING ──────────────────────────────────────────
    // Flow: Overall multiplier on opacity accumulation per dab
    // 0% = invisible, 100% = max flow
    const flowFactor = s.flow / 100;

    // Note: Glaze multipliers (opacity ceiling) and Blend Modes are
    // now handled natively by CustomCompositor during stroke composition!
    this.brush.settings[BRUSH.OPAQUE].base_value =
      this.defaultBaseOpacity * flowFactor;

    // Store settings so compositor can use them during stroke
    this.activeSettings = s;

    // ── PENCIL & STYLUS ────────────────────────────────────────
    // Map the new stylus configuration constraints directly from the Brush Studio
    // to the underlying MyPaint engine settings.

    // Pressure constraints
    if (s.pressureSize !== 15) {
      // Offset radius base value if a strict size override is dictated by pressure
      this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value +=
        (s.pressureSize - 15) * 0.01;
    }

    if (s.pressureOpacity > 0) {
      // Decrease base opacity barrier based on the pressure opacity slider
      this.brush.settings[BRUSH.OPAQUE_MULTIPLY].base_value *=
        1 - s.pressureOpacity / 100;
    }

    if (s.pressureFlow < 100) {
      // Restrict maximum pigment flow dynamically based on the set percentage.
      const pressureFlowFactor = s.pressureFlow / 100;
      this.brush.settings[BRUSH.OPAQUE].base_value =
        this.defaultBaseOpacity * flowFactor * pressureFlowFactor;
    }

    // Tilt constraints
    if (s.tiltSize > 0) {
      // Force the brush size to widen as the pencil dictates flat shading.
      // In a full implementation, this modifies the INPUT.TILT curves directly,
      // here we adjust the base log scale as a proxy.
      this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value +=
        (s.tiltSize / 100) * 0.5;
    }

    // Hover, Barrel Roll, and Outline properties are typically managed by the UI overlay
    // or specific PointerEvent listener layers rather than the internal brush physics.

    // Call settings_base_values_have_changed to recalculate internal speed mappings
    this.brush.settings_base_values_have_changed();
  }

  public clear() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(
        0,
        0,
        this.canvasCtx.canvas.width,
        this.canvasCtx.canvas.height,
      );
    }
    if (this.compositor) {
      this.compositor.resize(
        this.canvasCtx.canvas.width,
        this.canvasCtx.canvas.height,
      );
      this.compositor.strokeCtx.clearRect(
        0,
        0,
        this.compositor.strokeCanvas.width,
        this.compositor.strokeCanvas.height,
      );
    }
    this.baseImageData = null;
  }

  public startStroke(x: number, y: number) {
    if (!this.brush) return;

    // Initialize compositor stroke layer
    if (this.activeSettings) {
      this.compositor.resize(
        this.canvasCtx.canvas.width,
        this.canvasCtx.canvas.height,
      );
      this.compositor.beginStroke(this.activeSettings);

      // Snapshot the canvas state to safely composite the overlay layer per-frame
      this.baseImageData = this.canvasCtx.getImageData(
        0,
        0,
        this.canvasCtx.canvas.width,
        this.canvasCtx.canvas.height,
      );
    }

    this.brush.new_stroke(x, y);
  }

  public endStroke() {
    if (!this.brush || !this.activeSettings) return;
    this.brush.reset();

    if (this.canvasCtx) {
      // Final pixel-level post effects (alpha thresholding, specialized wet edges proxy)
      this.compositor.applyPostProcessEffects(
        this.canvasCtx,
        this.activeSettings,
      );
    }
    this.baseImageData = null;
  }

  private evaluatePressureCurve(
    curve: { x: number; y: number }[],
    p: number,
  ): number {
    if (!curve || curve.length === 0) return p;
    if (p <= curve[0].x) return curve[0].y;
    if (p >= curve[curve.length - 1].x) return curve[curve.length - 1].y;
    for (let i = 0; i < curve.length - 1; i++) {
      const p1 = curve[i];
      const p2 = curve[i + 1];
      if (p >= p1.x && p <= p2.x) {
        const t = (p - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
    return p;
  }

  public strokeTo(
    x: number,
    y: number,
    pressure: number = 0.5,
    tiltX: number = 0,
    tiltY: number = 0,
    dt: number = 0.1,
  ) {
    if (!this.brush) return;

    let finalPressure = pressure;
    if (this.activeSettings?.pressureCurve) {
      finalPressure = this.evaluatePressureCurve(
        this.activeSettings.pressureCurve,
        pressure,
      );
    }

    // If hardware tilt is exactly 0 and 0 (e.g., mouse), fallback to 90
    // so that flat markers don't completely disappear.
    // Twist is captured but MyPaint core may not natively use it without custom mappings.
    const xtilt = tiltX === 0 && tiltY === 0 ? 90 : tiltX;
    const ytilt = tiltY;

    this.brush.stroke_to(x, y, finalPressure, xtilt, ytilt, dt);

    // Composite the dynamically expanding stroke layer physically over the base image
    if (this.baseImageData) {
      this.compositor.compositeStrokeToMain(this.canvasCtx, this.baseImageData);
    }
  }
}
