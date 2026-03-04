import type { BrushStudioSettings } from "./brushStudioSettings";
import { DEFAULT_BRUSH_STUDIO_SETTINGS } from "./brushStudioSettings";

export function deriveStudioSettingsFromBrush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawSetting: any,
): BrushStudioSettings {
  const s: BrushStudioSettings = { ...DEFAULT_BRUSH_STUDIO_SETTINGS };

  if (!rawSetting) return s;

  // Helper to check if a curve exists and contains valid data points
  const hasCurve = (settingName: string, inputName: string) => {
    const prop = rawSetting[settingName];
    if (prop && prop.pointsList && prop.pointsList[inputName]) {
      return prop.pointsList[inputName].length >= 4; // At least [x0, y0, x1, y1]
    }
    return false;
  };
  // --- STROKE & STABILIZATION ---
  // (Left at 0 by default, which instructs BrushEngine.ts to just use native preset baselines without adding extra jitter)

  // --- PROPERTIES ---
  // (Left at 0 by default so we don't accidentally double smudge natively smudgy brushes)

  // --- WET MIX ---
  if ((rawSetting["smudge"]?.base_value || 0) > 0) {
    s.wetMixPull = 50;
  }
  if ((rawSetting["stroke_duration_logarithmic"]?.base_value || 0) > 0) {
    s.wetMixCharge = 50;
  }
  if ((rawSetting["smudge_length"]?.base_value || 0) > 0.5) {
    s.wetMixDilution = 50;
  }
  if ((rawSetting["smudge_radius_log"]?.base_value || 0) > 0) {
    s.wetMixGrade = 50;
  }
  if ((rawSetting["tracking_noise"]?.base_value || 0) > 0) {
    s.wetMixBlur = 50;
  }
  if (hasCurve("tracking_noise", "random")) s.wetMixBlurJitter = 50;
  if (hasCurve("smudge", "random")) s.wetMixWetnessJitter = 50;

  // --- DYNAMICS ---
  if (
    hasCurve("radius_logarithmic", "speed1") ||
    hasCurve("radius_logarithmic", "speed2")
  ) {
    s.dynamicsSpeedSize = 50;
  }
  if (hasCurve("opaque", "speed1") || hasCurve("opaque", "speed2")) {
    s.dynamicsSpeedOpacity = 50;
  }
  if ((rawSetting["offset_by_speed"]?.base_value || 0) > 0) {
    s.dynamicsSpeedSpacing = 50;
  }
  if (hasCurve("radius_logarithmic", "random")) {
    s.dynamicsJitterSize = 50;
  }
  if (hasCurve("opaque", "random")) {
    s.dynamicsJitterOpacity = 50;
  }

  // --- COLOR DYNAMICS ---
  if (hasCurve("color_h", "random")) s.colorStampHue = 50;
  if (hasCurve("color_s", "random")) s.colorStampSaturation = 50;
  if (hasCurve("color_v", "random")) s.colorStampLightness = 50;

  if (hasCurve("color_h", "speed1") || hasCurve("color_h", "speed2"))
    s.colorStrokeHue = 50;
  if (hasCurve("color_s", "speed1") || hasCurve("color_s", "speed2"))
    s.colorStrokeSaturation = 50;
  if (hasCurve("color_v", "speed1") || hasCurve("color_v", "speed2"))
    s.colorStrokeLightness = 50;

  if (hasCurve("color_h", "pressure")) s.colorPressureHue = 50;
  if (hasCurve("color_s", "pressure")) s.colorPressureSaturation = 50;
  if (hasCurve("color_v", "pressure")) s.colorPressureBrightness = 50;

  if (
    hasCurve("color_h", "tilt_declination") ||
    hasCurve("color_h", "tilt_ascension")
  )
    s.colorTiltHue = 50;
  if (
    hasCurve("color_s", "tilt_declination") ||
    hasCurve("color_s", "tilt_ascension")
  )
    s.colorTiltSaturation = 50;
  if (
    hasCurve("color_v", "tilt_declination") ||
    hasCurve("color_v", "tilt_ascension")
  )
    s.colorTiltBrightness = 50;

  if (hasCurve("color_h", "custom")) s.colorBarrelHue = 50;
  if (hasCurve("color_s", "custom")) s.colorBarrelSaturation = 50;
  if (hasCurve("color_v", "custom")) s.colorBarrelBrightness = 50;

  // --- SHAPE ---
  const ratio = rawSetting["elliptical_dab_ratio"]?.base_value;
  if (typeof ratio === "number" && ratio > 1.0) {
    // Inverse mapping: ratio = 1.0 + ((100 - roundness)/100) * 9.0
    // roundness = 100 - ((ratio - 1.0) / 9.0) * 100
    s.shapeRoundness = Math.max(
      0,
      Math.min(100, 100 - ((ratio - 1.0) / 9.0) * 100),
    );
  } else {
    s.shapeRoundness = 100;
  }

  const angle = rawSetting["elliptical_dab_angle"]?.base_value;
  if (typeof angle === "number") {
    let normalizedAngle = angle % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;
    s.shapeRotation = normalizedAngle;
  }

  if (hasCurve("elliptical_dab_angle", "random")) {
    s.shapeScatter = 50; // Indicates some rotational scatter is natively present
  }

  if (hasCurve("elliptical_dab_ratio", "pressure")) {
    s.shapePressureRoundness = 50;
  }

  if (hasCurve("elliptical_dab_ratio", "random")) {
    s.shapeRoundnessVerticalJitter = 50; // Just picking one to signify jitter is present
  }

  // --- PENCIL / STYLUS (PRESSURE) ---
  if (hasCurve("radius_logarithmic", "pressure")) {
    s.pressureSize = 50; // 50% = 1.0x native curve modifier
  } else {
    s.pressureSize = 0;
  }

  if (
    hasCurve("opaque", "pressure") ||
    hasCurve("opaque_multiply", "pressure")
  ) {
    s.pressureOpacity = 50;
  } else {
    s.pressureOpacity = 0;
  }

  if (hasCurve("smudge", "pressure")) {
    s.pressureBleed = 50;
  } else {
    s.pressureBleed = 0;
  }

  // --- TILT ---
  if (
    hasCurve("elliptical_dab_angle", "tilt_ascension") ||
    hasCurve("elliptical_dab_angle", "tilt_declination")
  ) {
    s.tiltAngle = 50;
  }

  if (
    hasCurve("opaque_multiply", "tilt_declination") ||
    hasCurve("opaque", "tilt_declination") ||
    hasCurve("opaque_linearize", "tilt_declination")
  ) {
    s.tiltOpacity = 50;
  }

  if (hasCurve("hardness", "tilt_declination")) {
    s.tiltGradation = 50;
  }

  if (
    hasCurve("radius_logarithmic", "tilt_declination") ||
    hasCurve("radius_logarithmic", "tilt_ascension")
  ) {
    s.tiltSize = 50;
  }

  if (
    hasCurve("smudge", "tilt_declination") ||
    hasCurve("smudge", "tilt_ascension")
  ) {
    s.tiltBleed = 50;
  }

  // --- BARREL ROLL (CUSTOM) ---
  if (hasCurve("radius_logarithmic", "custom")) {
    s.barrelRollSize = 50;
  }

  if (hasCurve("opaque_multiply", "custom") || hasCurve("opaque", "custom")) {
    s.barrelRollOpacity = 50;
  }

  if (hasCurve("smudge", "custom")) {
    s.barrelRollBleed = 50;
  }

  return s;
}
