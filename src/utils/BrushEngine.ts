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
  // @ts-expect-error TS6133 — kept for future tilt angle preservation
  private presetEllipticalDabAngle: number = 0;
  private presetOpaqueLinearize: number = 0;
  private presetSmudgeRadiusLog: number = 0;
  private presetTrackingNoise: number = 0;

  // New Native MyPaint Properties
  private presetOpacityMultiply: number = 0;
  private presetDabsPerSecond: number = 0;
  private presetSpeed1Gamma: number = 0;
  private presetSpeed2Gamma: number = 0;
  private presetOffsetBySpeedSlowness: number = 0;
  private presetStrokeThreshold: number = 0;
  private presetStrokeHoldtime: number = 0;
  private presetCustomInputSlowness: number = 0;

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

  public currentBrushName: string = "";

  public setBrush(name: string) {
    this.currentBrushName = name;
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
      this.presetOpaqueLinearize =
        this.brush.settings[BRUSH.OPAQUE_LINEARIZE].base_value;
      this.presetSmudgeRadiusLog =
        this.brush.settings[BRUSH.SMUDGE_RADIUS_LOG].base_value;
      this.presetTrackingNoise =
        this.brush.settings[BRUSH.TRACKING_NOISE].base_value;

      this.presetOpacityMultiply =
        this.brush.settings[BRUSH.OPAQUE_MULTIPLY].base_value;
      this.presetDabsPerSecond =
        this.brush.settings[BRUSH.DABS_PER_SECOND].base_value;
      this.presetSpeed1Gamma =
        this.brush.settings[BRUSH.SPEED1_GAMMA].base_value;
      this.presetSpeed2Gamma =
        this.brush.settings[BRUSH.SPEED2_GAMMA].base_value;
      this.presetOffsetBySpeedSlowness =
        this.brush.settings[BRUSH.OFFSET_BY_SPEED_SLOWNESS].base_value;
      this.presetStrokeThreshold =
        this.brush.settings[BRUSH.STROKE_THRESHOLD].base_value;
      this.presetStrokeHoldtime =
        this.brush.settings[BRUSH.STROKE_HOLDTIME].base_value;
      this.presetCustomInputSlowness =
        this.brush.settings[BRUSH.CUSTOM_INPUT_SLOWNESS].base_value;
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
    const maxScale = this.activeSettings
      ? this.activeSettings.maxSize / 100
      : 1.0;
    this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value =
      this.defaultBaseRadius + Math.log(scale * maxScale);
  }

  public setOpacity(opacity: number) {
    if (!this.brush) return;
    // Store the user-facing opacity so we can combine it with flow and maxOpacity
    this.userOpacity = opacity;
    // We update the actual engine value inside applyStudioSettings where we have access
    // to activeSettings.maxOpacity. If it's not set yet, just do a basic multiply.
    const maxOpacFactor = this.activeSettings
      ? this.activeSettings.maxOpacity / 100
      : 1.0;
    this.brush.settings[BRUSH.OPAQUE].base_value =
      this.defaultBaseOpacity * opacity * maxOpacFactor;
  }

  /**
   * Scale an existing native curve or inject a new one if missing.
   * If sliderValue == 50, scaleFactor is 1.0 (no change to native).
   * If native missing and sliderValue > 0, injects standard curve.
   */
  private scaleOrInjectInputCurve(
    brushSettingIdx: number,
    inputIdx: number,
    sliderValue: number, // 0 to 100
    x0: number,
    y0: number,
    x1: number,
    y1: number, // Default inject values if curve missing
    alternativeSettingIdx?: number,
  ) {
    let mapping = this.brush.settings[brushSettingIdx];
    let pts =
      mapping && mapping.pointsList ? mapping.pointsList[inputIdx] : null;

    if (alternativeSettingIdx !== undefined) {
      const altMapping = this.brush.settings[alternativeSettingIdx];
      const altPts =
        altMapping && altMapping.pointsList
          ? altMapping.pointsList[inputIdx]
          : null;
      if (altPts && altPts.n >= 2 && (!pts || pts.n < 2)) {
        mapping = altMapping;
        pts = altPts;
      }
    }

    if (!mapping || !pts) return;

    if (pts.n >= 2) {
      // Native curve exists. Scale its magnitude. 50 = no change (1.0).
      const scaleFactor = sliderValue / 50;
      for (let i = 0; i < pts.n; i++) {
        pts.yvalues[i] *= scaleFactor;
      }
    } else {
      // Native curve missing. Inject standard UI-driven curve if slider > 0.
      if (sliderValue > 0) {
        pts.n = 2;
        pts.xvalues[0] = x0;
        pts.yvalues[0] = y0 * (sliderValue / 100);
        pts.xvalues[1] = x1;
        pts.yvalues[1] = y1 * (sliderValue / 100);
        mapping.inputs_used = 1;
      }
    }
  }

  /**
   * Apply Brush Studio settings to the active MyPaint brush.
   * Maps UI slider values (0-100%) to actual MyPaint BRUSH parameters.
   */
  public applyStudioSettings(s: BrushStudioSettings) {
    if (!this.brush || !this.currentBrushName) return;

    // Reset brush to pristine JSON state to clear any previous scaled/injected curves
    const preset = BrushEngine.presets.find(
      (p) => p.name === this.currentBrushName,
    );
    if (preset) {
      for (let i = 0; i < this.brush.settings.length; i++) {
        const m = this.brush.settings[i];
        if (!m) continue;
        m.inputs_used = 0;
        if (m.pointsList) {
          for (let j = 0; j < m.pointsList.length; j++) {
            if (m.pointsList[j]) m.pointsList[j].n = 0;
          }
        }
      }
      this.brush.readmyb_json(preset.setting);
    }

    // ── STROKE PROPERTIES ──────────────────────────────────

    // Spacing: controls dab density. spacing=1% → dense, spacing=100% → sparse
    const spacingFactor =
      s.spacing > 0 ? Math.max(0.1, 1.0 / ((s.spacing / 100) * 3 + 0.1)) : 1.0;
    const countMultiplier = Math.max(1, s.shapeCount || 1);
    this.brush.settings[BRUSH.DABS_PER_BASIC_RADIUS].base_value =
      this.presetDabsPerBasicRadius * spacingFactor * countMultiplier;
    this.brush.settings[BRUSH.DABS_PER_ACTUAL_RADIUS].base_value =
      this.presetDabsPerActualRadius * spacingFactor * countMultiplier;

    this.scaleOrInjectInputCurve(
      BRUSH.DABS_PER_BASIC_RADIUS,
      INPUT.RANDOM,
      s.spacingJitter ?? 0,
      0,
      0,
      1.0,
      1.0,
    );

    // Spacing Jitter: randomness to radius → visual spacing variation
    if (s.spacingJitter > 0) {
      this.brush.settings[BRUSH.RADIUS_BY_RANDOM].base_value =
        (s.spacingJitter / 100) * 1.5;
    }

    // Jitter Lateral: random offset perpendicular to stroke direction (single write)
    if (s.jitterLateral > 0) {
      this.brush.settings[BRUSH.OFFSET_BY_RANDOM].base_value =
        this.presetOffsetByRandom + (s.jitterLateral / 100) * 3.0;
    }

    // Jitter Linear: tracking noise + offset along stroke direction (single write each)
    if (s.jitterLinear > 0) {
      this.brush.settings[BRUSH.TRACKING_NOISE].base_value =
        this.presetTrackingNoise + s.jitterLinear / 50;
      this.brush.settings[BRUSH.OFFSET_BY_SPEED].base_value =
        this.presetOffsetBySpeed + (s.jitterLinear / 100) * 2.0;
    }

    // Native stroke MyPaint params (guarded — only touch if slider moved from default 0)
    if (s.dabsPerSecond !== 0) {
      this.brush.settings[BRUSH.DABS_PER_SECOND].base_value =
        this.presetDabsPerSecond + s.dabsPerSecond;
    }
    if (s.strokeHoldtime !== 0) {
      this.brush.settings[BRUSH.STROKE_HOLDTIME].base_value =
        this.presetStrokeHoldtime + s.strokeHoldtime / 10;
    }

    // HARDNESS: consolidated single write. fallOff=0 + shapeHardness=50 → preserve native
    {
      let h = this.presetHardness;
      if (s.fallOff > 0) {
        h = h * (1 - s.fallOff / 100) + s.fallOff / 100;
      }
      if (s.shapeHardness !== 50) {
        h = Math.max(0, h + (s.shapeHardness - 50) / 50);
      }
      this.brush.settings[BRUSH.HARDNESS].base_value = h;
    }

    // ── STABILIZATION (consolidated single writes) ──────────
    // SLOW_TRACKING: native param + streamlineAmount, consolidated
    {
      let st = this.presetSlowTracking;
      if (s.slowTracking !== 0) st += s.slowTracking / 20;
      if (s.streamlineAmount > 0) st += (s.streamlineAmount / 100) * 15.0;
      this.brush.settings[BRUSH.SLOW_TRACKING].base_value = st;
    }

    // SLOW_TRACKING_PER_DAB: native param + streamlinePressure, consolidated
    {
      let stpd = this.presetSlowTrackingPerDab;
      if (s.slowTrackingPerDab !== 0) stpd += s.slowTrackingPerDab / 20;
      if (s.streamlinePressure > 0) stpd += (s.streamlinePressure / 100) * 8.0;
      this.brush.settings[BRUSH.SLOW_TRACKING_PER_DAB].base_value = stpd;
    }

    // SPEED1_SLOWNESS: native param + stabilization, consolidated
    {
      let s1s = this.presetSpeed1Slowness;
      if (s.speed1Slowness !== 50) s1s *= s.speed1Slowness / 50;
      if (s.stabilizationAmount > 0) s1s += (s.stabilizationAmount / 100) * 5.0;
      this.brush.settings[BRUSH.SPEED1_SLOWNESS].base_value = s1s;
    }

    // SPEED2_SLOWNESS: native param + motionFilter, consolidated
    {
      let s2s = this.presetSpeed2Slowness;
      if (s.speed2Slowness !== 50) s2s *= s.speed2Slowness / 50;
      if (s.motionFilterAmount > 0) s2s += (s.motionFilterAmount / 100) * 6.0;
      this.brush.settings[BRUSH.SPEED2_SLOWNESS].base_value = s2s;
    }

    // DIRECTION_FILTER: native param + motionFilterExpression, consolidated
    {
      let df = this.presetDirectionFilter;
      if (s.directionFilter !== 50) df += (s.directionFilter - 50) / 10;
      if (s.motionFilterExpression > 0)
        df += (s.motionFilterExpression / 100) * 10.0;
      this.brush.settings[BRUSH.DIRECTION_FILTER].base_value = df;
    }

    // ── PROPERTIES ─────────────────────────────────────────
    if (s.opacityMultiply !== 50) {
      this.brush.settings[BRUSH.OPAQUE_MULTIPLY].base_value =
        this.presetOpacityMultiply + (s.opacityMultiply - 50) / 25;
    }

    // STROKE_THRESHOLD: guarded — only overwrite if taperPressure > 0 OR strokeThreshold slider moved
    if (s.taperPressure > 0 || s.strokeThreshold !== 0) {
      let thresh = this.presetStrokeThreshold;
      if (s.taperPressure > 0) thresh = (1 - s.taperPressure / 100) * 0.1;
      if (s.strokeThreshold !== 0) thresh += s.strokeThreshold / 50;
      this.brush.settings[BRUSH.STROKE_THRESHOLD].base_value = thresh;
    }

    // Taper Tip Animation: controls stroke duration behavior (only if explicitly toggled)
    if (s.taperTipAnimation) {
      this.brush.settings[BRUSH.STROKE_DURATION_LOGARITHMIC].base_value = 4.0;
    }

    // ── RENDERING ──────────────────────────────────────────
    const flowFactor = s.flow / 100;
    const pressureFlowFactor = s.pressureFlow / 100;
    const maxOpacFactor = s.maxOpacity / 100;
    const minOpacFactor = s.minOpacity / 100;

    this.brush.settings[BRUSH.OPAQUE].base_value = Math.max(
      minOpacFactor,
      this.defaultBaseOpacity *
        this.userOpacity *
        flowFactor *
        pressureFlowFactor *
        maxOpacFactor,
    );

    // Store settings so compositor can use them during stroke
    this.activeSettings = s;

    // ── SMUDGE: consolidated single write ──────────────────
    {
      let sm = this.presetSmudge;
      if (s.smudgePull > 0) sm += s.smudgePull / 100;
      if (s.wetMixPull > 0) sm += s.wetMixPull / 100;
      this.brush.settings[BRUSH.SMUDGE].base_value = sm;
    }

    // ── SHAPE (consolidated — ELLIPTICAL_DAB_RATIO written once) ──
    // shapeRoundness (100% = 1.0 ratio = round, 0% = 10.0 ratio = flat)
    const baseRatio = 1.0 + ((100 - (s.shapeRoundness ?? 100)) / 100) * 9.0;
    // Only overwrite native ratio if the user changed roundness from 100 or taperTip from 0
    if (s.shapeRoundness !== 100 || s.taperTip > 0) {
      const tipRatio = s.taperTip > 0 ? 1.0 + (s.taperTip / 100) * 2.0 : 1.0;
      this.brush.settings[BRUSH.ELLIPTICAL_DAB_RATIO].base_value = Math.max(
        baseRatio,
        tipRatio,
      );
    }

    // shapeRotation (degrees 0 - 360) — only overwrite if non-zero
    if (s.shapeRotation !== 0) {
      this.brush.settings[BRUSH.ELLIPTICAL_DAB_ANGLE].base_value =
        s.shapeRotation;
    }

    // shapeScatter (Rotation random scatter: offsets dab angle across random inputs)
    this.scaleOrInjectInputCurve(
      BRUSH.ELLIPTICAL_DAB_ANGLE,
      INPUT.RANDOM,
      s.shapeScatter ?? 0,
      0.0,
      -180.0,
      1.0,
      180.0,
    );

    // shapePressureRoundness (Compress ratio dynamically based on Pressure)
    this.scaleOrInjectInputCurve(
      BRUSH.ELLIPTICAL_DAB_RATIO,
      INPUT.PRESSURE,
      s.shapePressureRoundness ?? 0,
      0.0,
      -baseRatio + 1.0,
      1.0,
      0.0,
    );

    // shapeTiltRoundness
    this.scaleOrInjectInputCurve(
      BRUSH.ELLIPTICAL_DAB_RATIO,
      INPUT.TILT_DECLINATION,
      s.shapeTiltRoundness ?? 0,
      0.0,
      -baseRatio + 1.0,
      1.0,
      0.0,
    );

    // shapeRoundnessVerticalJitter / Horizontal Jitter → Random Roundness Jitter
    const totalRoundnessJitter = Math.max(
      s.shapeRoundnessVerticalJitter ?? 0,
      s.shapeRoundnessHorizontalJitter ?? 0,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.ELLIPTICAL_DAB_RATIO,
      INPUT.RANDOM,
      totalRoundnessJitter,
      0.0,
      0.0,
      1.0,
      5.0,
    );

    // ── WET MIX ────────────────────────────────────────────
    // NOTE: SMUDGE base_value is already consolidated in the single write above.
    // We still handle the curves (jitter, random) here.

    // Charge: How much paint is on the brush. Low charge = runs out of paint.
    const chargeVal = Math.max(0, 100 - (s.wetMixCharge ?? 50));
    if (chargeVal > 0 && !s.taperTipAnimation) {
      this.brush.settings[BRUSH.STROKE_DURATION_LOGARITHMIC].base_value =
        chargeVal / 20;
    }

    // Dilution: amount of water
    if ((s.wetMixDilution ?? 0) > 0) {
      this.brush.settings[BRUSH.SMUDGE_LENGTH].base_value =
        this.presetSmudgeLength + s.wetMixDilution / 100;
      this.brush.settings[BRUSH.OPAQUE_LINEARIZE].base_value =
        this.presetOpaqueLinearize + (s.wetMixDilution / 100) * 0.5;
    }

    // Grade: smoothness of smudge
    if ((s.wetMixGrade ?? 0) > 0) {
      this.brush.settings[BRUSH.SMUDGE_RADIUS_LOG].base_value =
        this.presetSmudgeRadiusLog + (s.wetMixGrade / 100) * 2.0;
    }

    // Blur: Tracking noise
    if ((s.wetMixBlur ?? 0) > 0) {
      this.brush.settings[BRUSH.TRACKING_NOISE].base_value =
        this.presetTrackingNoise + (s.wetMixBlur / 100) * 3.0;
    }

    // Blur Jitter
    this.scaleOrInjectInputCurve(
      BRUSH.TRACKING_NOISE,
      INPUT.RANDOM,
      s.wetMixBlurJitter ?? 0,
      0.0,
      0.0,
      1.0,
      3.0,
    );

    // Wetness Jitter
    this.scaleOrInjectInputCurve(
      BRUSH.SMUDGE,
      INPUT.RANDOM,
      s.wetMixWetnessJitter ?? 0,
      0.0,
      0.0,
      1.0,
      1.0,
    );

    // ── DYNAMICS ───────────────────────────────────────────

    // Native Slowness & Gamma Smoothing
    if (s.speed1Slowness !== 50)
      this.brush.settings[BRUSH.SPEED1_SLOWNESS].base_value =
        this.presetSpeed1Slowness * ((s.speed1Slowness ?? 50) / 50);
    if (s.speed2Slowness !== 50)
      this.brush.settings[BRUSH.SPEED2_SLOWNESS].base_value =
        this.presetSpeed2Slowness * ((s.speed2Slowness ?? 50) / 50);
    if (s.speed1Gamma !== 50)
      this.brush.settings[BRUSH.SPEED1_GAMMA].base_value =
        this.presetSpeed1Gamma + ((s.speed1Gamma ?? 50) - 50) / 25;
    if (s.speed2Gamma !== 50)
      this.brush.settings[BRUSH.SPEED2_GAMMA].base_value =
        this.presetSpeed2Gamma + ((s.speed2Gamma ?? 50) - 50) / 25;
    if (s.offsetBySpeedSlowness !== 50)
      this.brush.settings[BRUSH.OFFSET_BY_SPEED_SLOWNESS].base_value =
        this.presetOffsetBySpeedSlowness *
        ((s.offsetBySpeedSlowness ?? 50) / 50);

    // Speed -> Size
    this.scaleOrInjectInputCurve(
      BRUSH.RADIUS_LOGARITHMIC,
      INPUT.SPEED1,
      s.dynamicsSpeedSize ?? 0,
      0.0,
      -2.0,
      1.0,
      2.0,
    );

    // Speed -> Opacity
    this.scaleOrInjectInputCurve(
      BRUSH.OPAQUE,
      INPUT.SPEED1,
      s.dynamicsSpeedOpacity ?? 0,
      0.0,
      -1.0,
      1.0,
      1.0,
    );

    // Speed -> Spacing
    this.brush.settings[BRUSH.OFFSET_BY_SPEED].base_value +=
      ((s.dynamicsSpeedSpacing ?? 0) / 100) * 2.5;

    // Jitter -> Size
    this.scaleOrInjectInputCurve(
      BRUSH.RADIUS_LOGARITHMIC,
      INPUT.RANDOM,
      s.dynamicsJitterSize ?? 0,
      0.0,
      0.0,
      1.0,
      2.0,
    );

    // Jitter -> Opacity
    this.scaleOrInjectInputCurve(
      BRUSH.OPAQUE,
      INPUT.RANDOM,
      s.dynamicsJitterOpacity ?? 0,
      0.0,
      -1.0,
      1.0,
      1.0,
    );

    // ── COLOR DYNAMICS ─────────────────────────────────────

    // Stamp Jitter (Random base values)
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_HUE,
      INPUT.RANDOM,
      s.colorStampHue ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_SATURATION,
      INPUT.RANDOM,
      s.colorStampSaturation ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.RANDOM,
      s.colorStampLightness ?? 0,
      0.0,
      0.0,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.RANDOM,
      s.colorStampDarkness ?? 0,
      0.0,
      -0.5,
      1.0,
      0.0,
    );

    // Stroke Jitter (Speed based)
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_HUE,
      INPUT.SPEED1,
      s.colorStrokeHue ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_SATURATION,
      INPUT.SPEED1,
      s.colorStrokeSaturation ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.SPEED1,
      s.colorStrokeLightness ?? 0,
      0.0,
      0.0,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.SPEED1,
      s.colorStrokeDarkness ?? 0,
      0.0,
      -0.5,
      1.0,
      0.0,
    );

    // Color Pressure
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_HUE,
      INPUT.PRESSURE,
      s.colorPressureHue ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_SATURATION,
      INPUT.PRESSURE,
      s.colorPressureSaturation ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.PRESSURE,
      s.colorPressureBrightness ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );

    // Color Tilt
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_HUE,
      INPUT.TILT_DECLINATION,
      s.colorTiltHue ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_SATURATION,
      INPUT.TILT_DECLINATION,
      s.colorTiltSaturation ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.TILT_DECLINATION,
      s.colorTiltBrightness ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );

    // Color Barrel Roll
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_HUE,
      INPUT.CUSTOM,
      s.colorBarrelHue ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_SATURATION,
      INPUT.CUSTOM,
      s.colorBarrelSaturation ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );
    this.scaleOrInjectInputCurve(
      BRUSH.COLOR_VALUE,
      INPUT.CUSTOM,
      s.colorBarrelBrightness ?? 0,
      0.0,
      -0.5,
      1.0,
      0.5,
    );

    if (s.customInputSlowness !== 0) {
      this.brush.settings[BRUSH.CUSTOM_INPUT_SLOWNESS].base_value =
        this.presetCustomInputSlowness + (s.customInputSlowness ?? 0) / 20;
    }

    // ── PENCIL & STYLUS — PRESSURE ─────────────────────────

    // Pressure → Size
    const minSizeScale = Math.max(0.01, s.minSize / 100);
    const minSizeLogFloor = Math.log(minSizeScale);
    this.scaleOrInjectInputCurve(
      BRUSH.RADIUS_LOGARITHMIC,
      INPUT.PRESSURE,
      s.pressureSize,
      0.0,
      Math.max(-2.0, minSizeLogFloor),
      1.0,
      0.6,
    );

    // Pressure → Opacity
    this.scaleOrInjectInputCurve(
      BRUSH.OPAQUE,
      INPUT.PRESSURE,
      s.pressureOpacity,
      0.0,
      -0.7,
      1.0,
      0.0,
      BRUSH.OPAQUE_MULTIPLY,
    );

    // Pressure → Bleed: additive smudge boost (SMUDGE base is consolidated above)
    if (s.pressureBleed > 0) {
      this.brush.settings[BRUSH.SMUDGE].base_value +=
        (s.pressureBleed / 100) * 0.8;
      this.brush.settings[BRUSH.SMUDGE_LENGTH].base_value =
        this.presetSmudgeLength + (s.pressureBleed / 100) * 0.3;
    }

    // ── PENCIL & STYLUS — TILT ─────────────────────────────

    // Tilt → Angle: map tilt ascension to elliptical dab angle rotation
    // NOTE: DAB_ANGLE base_value is already set correctly by the SHAPE section above.
    this.scaleOrInjectInputCurve(
      BRUSH.ELLIPTICAL_DAB_ANGLE,
      INPUT.TILT_ASCENSION,
      s.tiltAngle,
      -180.0,
      -180.0,
      180.0,
      180.0,
    );

    // Tilt → Opacity: more tilt = lower opacity (flat shading)
    this.scaleOrInjectInputCurve(
      BRUSH.OPAQUE_MULTIPLY,
      INPUT.TILT_DECLINATION,
      s.tiltOpacity,
      0.0,
      0.0,
      90.0,
      -0.8,
      BRUSH.OPAQUE,
    );

    // Tilt → Gradation: tilt softens the dab edge (reduces hardness)
    this.scaleOrInjectInputCurve(
      BRUSH.HARDNESS,
      INPUT.TILT_DECLINATION,
      s.tiltGradation,
      0.0,
      0.0,
      90.0,
      -0.6,
    );

    // Tilt → Bleed: tilt increases smudge
    this.scaleOrInjectInputCurve(
      BRUSH.SMUDGE,
      INPUT.TILT_DECLINATION,
      s.tiltBleed,
      0.0,
      0.0,
      90.0,
      0.6,
    );

    // Tilt → Size: dynamic size change based on actual tilt input
    if (s.tiltSizeCompression) {
      this.scaleOrInjectInputCurve(
        BRUSH.RADIUS_LOGARITHMIC,
        INPUT.TILT_DECLINATION,
        s.tiltSize,
        0.0,
        0.0,
        90.0,
        1.5,
      );
    } else {
      this.scaleOrInjectInputCurve(
        BRUSH.RADIUS_LOGARITHMIC,
        INPUT.TILT_DECLINATION,
        s.tiltSize,
        0.0,
        0.0,
        90.0,
        -1.5,
      );
    }

    // ── PENCIL & STYLUS — BARREL ROLL ──────────────────────

    this.scaleOrInjectInputCurve(
      BRUSH.RADIUS_LOGARITHMIC,
      INPUT.CUSTOM,
      s.barrelRollSize,
      -1.0,
      -1.0,
      1.0,
      1.0,
    );

    this.scaleOrInjectInputCurve(
      BRUSH.OPAQUE_MULTIPLY,
      INPUT.CUSTOM,
      s.barrelRollOpacity,
      -1.0,
      -0.6,
      1.0,
      0.0,
      BRUSH.OPAQUE,
    );

    this.scaleOrInjectInputCurve(
      BRUSH.SMUDGE,
      INPUT.CUSTOM,
      s.barrelRollBleed,
      -1.0,
      0.0,
      1.0,
      0.5,
    );

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
      if (
        this.activeSettings.taperLinkTips &&
        taperStartDist > 0 &&
        taperEndDist === 0
      ) {
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
