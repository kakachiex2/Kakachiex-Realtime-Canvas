/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MypaintBrush,
  MypaintSurface,
  BRUSH,
  INPUT,
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
  // User-facing opacity from the control widget (0-1)
  private userOpacity: number = 1;
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
  private presetSmudge: number = 0;
  private presetSmudgeLength: number = 0.5;
  private presetEllipticalDabAngle: number = 0;
  private presetOpaqueMultiply: number = 0;

  // Taper: stroke distance tracking
  private strokeDistance: number = 0;
  private lastStrokeX: number = 0;
  private lastStrokeY: number = 0;

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
      this.presetSmudge = this.brush.settings[BRUSH.SMUDGE].base_value;
      this.presetSmudgeLength =
        this.brush.settings[BRUSH.SMUDGE_LENGTH].base_value;
      this.presetEllipticalDabAngle =
        this.brush.settings[BRUSH.ELLIPTICAL_DAB_ANGLE].base_value;
      this.presetOpaqueMultiply =
        this.brush.settings[BRUSH.OPAQUE_MULTIPLY].base_value;
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
    // Store the user-facing opacity so we can combine it with flow
    this.userOpacity = opacity;
    // Multiply with current flow factor (will be recalculated on next applyStudioSettings)
    this.brush.settings[BRUSH.OPAQUE].base_value =
      this.defaultBaseOpacity * opacity;
  }

  /**
   * Inject a 2-point input mapping curve on a BRUSH setting's pointsList.
   * inputIdx corresponds to INPUT.PRESSURE (0), INPUT.TILT_DECLINATION (6), etc.
   * This maps input range [x0..x1] to output range [y0..y1].
   */
  private injectInputCurve(
    brushSettingIdx: number,
    inputIdx: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) {
    const mapping = this.brush.settings[brushSettingIdx];
    if (!mapping || !mapping.pointsList) return;
    const pts = mapping.pointsList[inputIdx];
    if (!pts) return;
    pts.n = 2;
    pts.xvalues[0] = x0;
    pts.yvalues[0] = y0;
    pts.xvalues[1] = x1;
    pts.yvalues[1] = y1;
    mapping.inputs_used = 1;
  }

  /**
   * Clear an input mapping curve (set n=0) so it has no effect.
   */
  private clearInputCurve(brushSettingIdx: number, inputIdx: number) {
    const mapping = this.brush.settings[brushSettingIdx];
    if (!mapping || !mapping.pointsList) return;
    const pts = mapping.pointsList[inputIdx];
    if (!pts) return;
    pts.n = 0;
  }

  /**
   * Apply Brush Studio settings to the active MyPaint brush.
   * Maps UI slider values (0-100%) to actual MyPaint BRUSH parameters.
   */
  public applyStudioSettings(s: BrushStudioSettings) {
    if (!this.brush) return;

    // ── STROKE PROPERTIES ──────────────────────────────────

    // Spacing: controls dab density. spacing=1% → dense, spacing=100% → sparse
    const spacingFactor = Math.max(0.1, 1.0 / ((s.spacing / 100) * 3 + 0.1));
    this.brush.settings[BRUSH.DABS_PER_BASIC_RADIUS].base_value =
      this.presetDabsPerBasicRadius * spacingFactor;
    this.brush.settings[BRUSH.DABS_PER_ACTUAL_RADIUS].base_value =
      this.presetDabsPerActualRadius * spacingFactor;

    // Spacing Jitter: randomness to radius → visual spacing variation
    this.brush.settings[BRUSH.RADIUS_BY_RANDOM].base_value =
      (s.spacingJitter / 100) * 1.5;

    // Jitter Lateral: random offset perpendicular to stroke direction
    this.brush.settings[BRUSH.OFFSET_BY_RANDOM].base_value =
      this.presetOffsetByRandom + (s.jitterLateral / 100) * 3.0;

    // Jitter Linear: offset along stroke direction (speed-based)
    this.brush.settings[BRUSH.OFFSET_BY_SPEED].base_value =
      this.presetOffsetBySpeed + (s.jitterLinear / 100) * 2.0;

    // Fall off: hardness of the dab edge. 0%=soft, 100%=crisp
    this.brush.settings[BRUSH.HARDNESS].base_value =
      this.presetHardness * (1 - s.fallOff / 100) + s.fallOff / 100;

    // ── STABILIZATION ──────────────────────────────────────

    this.brush.settings[BRUSH.SLOW_TRACKING].base_value =
      this.presetSlowTracking + (s.streamlineAmount / 100) * 15.0;

    this.brush.settings[BRUSH.SLOW_TRACKING_PER_DAB].base_value =
      this.presetSlowTrackingPerDab + (s.streamlinePressure / 100) * 8.0;

    this.brush.settings[BRUSH.SPEED1_SLOWNESS].base_value =
      this.presetSpeed1Slowness + (s.stabilizationAmount / 100) * 5.0;

    this.brush.settings[BRUSH.SPEED2_SLOWNESS].base_value =
      this.presetSpeed2Slowness + (s.motionFilterAmount / 100) * 6.0;

    this.brush.settings[BRUSH.DIRECTION_FILTER].base_value =
      this.presetDirectionFilter + (s.motionFilterExpression / 100) * 10.0;

    // ── TAPER ──────────────────────────────────────────────
    // taperStart / taperEnd are handled in strokeTo() via distance tracking.
    // taperSize and taperOpacity modify the pressure→radius and pressure→opacity curves.

    const radiusMapping = this.brush.settings[BRUSH.RADIUS_LOGARITHMIC];
    const taperSizeFactor = s.taperSize / 100;
    if (radiusMapping.pointsList) {
      const pressurePts = radiusMapping.pointsList[INPUT.PRESSURE];
      if (pressurePts && pressurePts.n >= 2) {
        const range = taperSizeFactor * 1.5;
        pressurePts.yvalues[0] = -range;
        pressurePts.yvalues[pressurePts.n - 1] = range * 0.5;
      }
    }

    const opacityMapping = this.brush.settings[BRUSH.OPAQUE_MULTIPLY];
    const taperOpacityFactor = s.taperOpacity / 100;
    if (opacityMapping.pointsList) {
      const pressurePts = opacityMapping.pointsList[INPUT.PRESSURE];
      if (pressurePts && pressurePts.n >= 2) {
        pressurePts.yvalues[0] = -taperOpacityFactor;
        pressurePts.yvalues[pressurePts.n - 1] = taperOpacityFactor;
      }
    }

    // Taper Pressure: stroke threshold
    const pressureThreshold = (1 - s.taperPressure / 100) * 0.1;
    this.brush.settings[BRUSH.STROKE_THRESHOLD].base_value = pressureThreshold;

    // Taper Tip: elliptical dab ratio. 0=sharp (1.0), 100=square (3.0)
    const tipRatio = 1.0 + (s.taperTip / 100) * 2.0;
    this.brush.settings[BRUSH.ELLIPTICAL_DAB_RATIO].base_value = tipRatio;

    // Taper Tip Animation: controls stroke duration behavior
    if (s.taperTipAnimation) {
      this.brush.settings[BRUSH.STROKE_DURATION_LOGARITHMIC].base_value = 4.0;
    } else {
      this.brush.settings[BRUSH.STROKE_DURATION_LOGARITHMIC].base_value = 0;
    }

    // ── RENDERING ──────────────────────────────────────────
    // Combine flow, user opacity, and pressureFlow into the OPAQUE base value
    const flowFactor = s.flow / 100;
    const pressureFlowFactor = s.pressureFlow / 100;
    this.brush.settings[BRUSH.OPAQUE].base_value =
      this.defaultBaseOpacity *
      this.userOpacity *
      flowFactor *
      pressureFlowFactor;

    // Store settings so compositor can use them during stroke
    this.activeSettings = s;

    // ── PENCIL & STYLUS — PRESSURE ─────────────────────────

    // Pressure → Size: inject an input curve on RADIUS_LOGARITHMIC via INPUT.PRESSURE
    // so that light pressure = smaller, heavy pressure = bigger
    if (s.pressureSize > 0) {
      const sizeRange = (s.pressureSize / 100) * 2.0; // up to 2.0 log-radius range
      this.injectInputCurve(
        BRUSH.RADIUS_LOGARITHMIC,
        INPUT.PRESSURE,
        0.0,
        -sizeRange, // at zero pressure: shrink
        1.0,
        sizeRange * 0.3, // at full pressure: slight grow
      );
    } else {
      this.clearInputCurve(BRUSH.RADIUS_LOGARITHMIC, INPUT.PRESSURE);
    }

    // Pressure → Opacity: inject an input curve on OPAQUE_MULTIPLY via INPUT.PRESSURE
    // so that light pressure = transparent, heavy pressure = opaque
    if (s.pressureOpacity > 0) {
      const opacRange = (s.pressureOpacity / 100) * 1.0;
      this.brush.settings[BRUSH.OPAQUE_MULTIPLY].base_value =
        this.presetOpaqueMultiply;
      this.injectInputCurve(
        BRUSH.OPAQUE_MULTIPLY,
        INPUT.PRESSURE,
        0.0,
        -opacRange, // at zero pressure: reduce opacity
        1.0,
        0.0, // at full pressure: normal opacity
      );
    }

    // Pressure → Bleed (smudge): connect to SMUDGE parameter
    if (s.pressureBleed > 0) {
      this.brush.settings[BRUSH.SMUDGE].base_value =
        this.presetSmudge + (s.pressureBleed / 100) * 0.8;
      this.brush.settings[BRUSH.SMUDGE_LENGTH].base_value =
        this.presetSmudgeLength + (s.pressureBleed / 100) * 0.3;
    } else {
      this.brush.settings[BRUSH.SMUDGE].base_value = this.presetSmudge;
      this.brush.settings[BRUSH.SMUDGE_LENGTH].base_value =
        this.presetSmudgeLength;
    }

    // ── PENCIL & STYLUS — TILT ─────────────────────────────

    // Tilt → Angle: map tilt ascension to elliptical dab angle rotation
    if (s.tiltAngle > 0) {
      const angleRange = (s.tiltAngle / 90) * 180; // scale the dab rotation
      this.brush.settings[BRUSH.ELLIPTICAL_DAB_ANGLE].base_value =
        this.presetEllipticalDabAngle;
      this.injectInputCurve(
        BRUSH.ELLIPTICAL_DAB_ANGLE,
        INPUT.TILT_ASCENSION,
        -180.0,
        -angleRange,
        180.0,
        angleRange,
      );
    } else {
      this.clearInputCurve(BRUSH.ELLIPTICAL_DAB_ANGLE, INPUT.TILT_ASCENSION);
    }

    // Tilt → Opacity: more tilt = lower opacity (flat shading)
    if (s.tiltOpacity > 0) {
      const tiltOpacRange = (s.tiltOpacity / 100) * 0.8;
      this.injectInputCurve(
        BRUSH.OPAQUE_MULTIPLY,
        INPUT.TILT_DECLINATION,
        0.0,
        0.0, // upright: normal opacity
        90.0,
        -tiltOpacRange, // flat: reduced opacity
      );
    } else {
      this.clearInputCurve(BRUSH.OPAQUE_MULTIPLY, INPUT.TILT_DECLINATION);
    }

    // Tilt → Gradation: tilt softens the dab edge (reduces hardness)
    if (s.tiltGradation > 0) {
      const gradRange = (s.tiltGradation / 100) * 0.6;
      this.injectInputCurve(
        BRUSH.HARDNESS,
        INPUT.TILT_DECLINATION,
        0.0,
        0.0, // upright: normal hardness
        90.0,
        -gradRange, // flat: softer edge
      );
    } else {
      this.clearInputCurve(BRUSH.HARDNESS, INPUT.TILT_DECLINATION);
    }

    // Tilt → Bleed: tilt increases smudge
    if (s.tiltBleed > 0) {
      const tiltSmudge = (s.tiltBleed / 100) * 0.6;
      this.injectInputCurve(
        BRUSH.SMUDGE,
        INPUT.TILT_DECLINATION,
        0.0,
        0.0, // upright: no smudge
        90.0,
        tiltSmudge, // flat: more smudge
      );
    } else {
      this.clearInputCurve(BRUSH.SMUDGE, INPUT.TILT_DECLINATION);
    }

    // Tilt → Size: dynamic size change based on actual tilt input
    if (s.tiltSize > 0) {
      const tiltSizeRange = (s.tiltSize / 100) * 1.5;
      if (s.tiltSizeCompression) {
        // Compression: more tilt = wider (flatter pencil tip covers more)
        this.injectInputCurve(
          BRUSH.RADIUS_LOGARITHMIC,
          INPUT.TILT_DECLINATION,
          0.0,
          0.0,
          90.0,
          tiltSizeRange,
        );
      } else {
        // Non-compression: more tilt = thinner
        this.injectInputCurve(
          BRUSH.RADIUS_LOGARITHMIC,
          INPUT.TILT_DECLINATION,
          0.0,
          0.0,
          90.0,
          -tiltSizeRange,
        );
      }
    } else {
      this.clearInputCurve(BRUSH.RADIUS_LOGARITHMIC, INPUT.TILT_DECLINATION);
    }

    // ── PENCIL & STYLUS — BARREL ROLL ──────────────────────
    // Barrel roll (twist) is threaded through as CUSTOM_INPUT

    if (s.barrelRollSize > 0) {
      const rollSizeRange = (s.barrelRollSize / 100) * 1.0;
      this.injectInputCurve(
        BRUSH.RADIUS_LOGARITHMIC,
        INPUT.CUSTOM,
        -1.0,
        -rollSizeRange,
        1.0,
        rollSizeRange,
      );
    } else {
      this.clearInputCurve(BRUSH.RADIUS_LOGARITHMIC, INPUT.CUSTOM);
    }

    if (s.barrelRollOpacity > 0) {
      const rollOpacRange = (s.barrelRollOpacity / 100) * 0.6;
      this.injectInputCurve(
        BRUSH.OPAQUE_MULTIPLY,
        INPUT.CUSTOM,
        -1.0,
        -rollOpacRange,
        1.0,
        0.0,
      );
    } else {
      this.clearInputCurve(BRUSH.OPAQUE_MULTIPLY, INPUT.CUSTOM);
    }

    if (s.barrelRollBleed > 0) {
      const rollSmudge = (s.barrelRollBleed / 100) * 0.5;
      this.injectInputCurve(
        BRUSH.SMUDGE,
        INPUT.CUSTOM,
        -1.0,
        0.0,
        1.0,
        rollSmudge,
      );
    } else {
      this.clearInputCurve(BRUSH.SMUDGE, INPUT.CUSTOM);
    }

    // Barrel roll custom input slowness — how quickly twist changes take effect
    this.brush.settings[BRUSH.CUSTOM_INPUT_SLOWNESS].base_value = 1.0;

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

    // Reset taper distance tracking
    this.strokeDistance = 0;
    this.lastStrokeX = x;
    this.lastStrokeY = y;

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
    const n = curve.length;
    if (n === 0) return p;
    if (p <= curve[0].x) return curve[0].y;
    if (p >= curve[n - 1].x) return curve[n - 1].y;

    if (n === 2) {
      const t = (p - curve[0].x) / (curve[1].x - curve[0].x);
      return curve[0].y + t * (curve[1].y - curve[0].y);
    }

    const pts = [curve[0], ...curve, curve[n - 1]];

    // Find enclosing segment based on X
    let segIdx = 0;
    while (segIdx < n - 1 && curve[segIdx + 1].x < p) {
      segIdx++;
    }

    const p0 = pts[segIdx];
    const p1 = pts[segIdx + 1];
    const p2 = pts[segIdx + 2];
    const p3 = pts[segIdx + 3];

    // Evaluate cubic Bezier equivalent of Catmull-Rom for X and Y
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    // Binary search for t that yields X(t) == p
    let tLow = 0,
      tHigh = 1,
      t = 0.5;
    for (let i = 0; i < 15; i++) {
      const inv = 1 - t;
      const xt =
        inv * inv * inv * p1.x +
        3 * inv * inv * t * cp1x +
        3 * inv * t * t * cp2x +
        t * t * t * p2.x;
      if (xt < p) tLow = t;
      else tHigh = t;
      t = (tLow + tHigh) / 2;
    }

    const inv = 1 - t;
    const yt =
      inv * inv * inv * p1.y +
      3 * inv * inv * t * cp1y +
      3 * inv * t * t * cp2y +
      t * t * t * p2.y;
    return Math.max(0, Math.min(1, yt));
  }

  public strokeTo(
    x: number,
    y: number,
    pressure: number = 0.5,
    tiltX: number = 0,
    tiltY: number = 0,
    dt: number = 0.1,
    twist: number = 0,
  ) {
    if (!this.brush) return;

    // Update stroke distance for taper calculation
    const dx = x - this.lastStrokeX;
    const dy = y - this.lastStrokeY;
    this.strokeDistance += Math.sqrt(dx * dx + dy * dy);
    this.lastStrokeX = x;
    this.lastStrokeY = y;

    let finalPressure = pressure;

    // Apply pressure curve remapping
    if (this.activeSettings?.pressureCurve) {
      finalPressure = this.evaluatePressureCurve(
        this.activeSettings.pressureCurve,
        pressure,
      );
    }

    // ── Taper Start/End: modulate pressure based on stroke distance
    if (this.activeSettings) {
      const taperStartDist = (this.activeSettings.taperStart / 100) * 300; // pixels
      const taperEndDist = (this.activeSettings.taperEnd / 100) * 300;

      // Taper start: fade in at the beginning of the stroke
      if (taperStartDist > 0 && this.strokeDistance < taperStartDist) {
        const t = this.strokeDistance / taperStartDist;
        // Smooth ease-in
        const ease = this.activeSettings.taperTipAnimation
          ? t * t * (3 - 2 * t) // smoothstep
          : t; // linear
        finalPressure *= ease;
      }

      // Taper end: scale pressure down when the user's pressure decreases.
      // taperEndDist controls how aggressively the fade-out happens.
      if (taperEndDist > 0 && finalPressure < 0.9) {
        const endFade = Math.max(0, finalPressure / 0.9);
        const ease = this.activeSettings.taperTipAnimation
          ? endFade * endFade * (3 - 2 * endFade)
          : endFade;
        finalPressure *= ease;
      }

      // taperLinkTips: mirror start taper to end when only start is set
      if (this.activeSettings.taperLinkTips && taperStartDist > 0 && taperEndDist === 0) {
        if (finalPressure < 0.9) {
          const endFade = Math.max(0, finalPressure / 0.9);
          finalPressure *= endFade;
        }
      }
    }

    // Feed barrel roll (twist) into the MyPaint custom input state
    // Normalize twist from degrees (-180..180) to -1..1 range
    if (twist !== 0) {
      this.brush.states[17] = twist / 180; // STATE.CUSTOM_INPUT = 17
    }

    // If hardware tilt is exactly 0 and 0 (e.g., mouse), fallback to 90
    // so that flat markers don't completely disappear.
    const xtilt = tiltX === 0 && tiltY === 0 ? 90 : tiltX;
    const ytilt = tiltY;

    this.brush.stroke_to(x, y, finalPressure, xtilt, ytilt, dt);

    // Composite the dynamically expanding stroke layer physically over the base image
    if (this.baseImageData) {
      this.compositor.compositeStrokeToMain(this.canvasCtx, this.baseImageData);
    }
  }
}
