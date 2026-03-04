// Brush Studio types and defaults — extracted for Fast Refresh compatibility

export interface BrushStudioSettings {
  // Stroke
  spacing: number;
  spacingJitter: number;
  jitterLateral: number;
  jitterLinear: number;
  fallOff: number;
  dabsPerSecond: number;
  strokeThreshold: number;
  strokeHoldtime: number;
  // Stabilization
  streamlineAmount: number;
  streamlinePressure: number;
  stabilizationAmount: number;
  motionFilterAmount: number;
  motionFilterExpression: number;
  slowTracking: number;
  slowTrackingPerDab: number;
  // Taper
  taperStart: number;
  taperEnd: number;
  taperSize: number;
  taperOpacity: number;
  taperPressure: number;
  taperTip: number;
  taperLinkTips: boolean;
  taperTipAnimation: boolean;
  // Rendering
  renderingMode: string;
  blendMode: string;
  flow: number;
  wetEdges: number;
  burnEdges: number;
  burnEdgesMode: string;
  luminanceBlending: boolean;
  alphaThreshold: boolean;
  thresholdAmount: number;

  // Grain
  grainEnabled: boolean;
  grainBehavior: "Moving" | "Texturized";
  grainMovement: string;
  grainMovingScale: number;
  grainMovingZoom: number;
  grainMovingRotation: number;
  grainMovingDepth: number;
  grainMovingDepthMin: number;
  grainMovingDepthJitter: number;
  grainTexScale: number;
  grainTexZoom: number;
  grainTexRotation: number;
  grainTexDepth: number;
  grainTexDepthMin: number;
  grainTexDepthJitter: number;
  grainOffsetJitter: boolean;
  grainBlendMode: string;
  grainBrightness: number;
  grainContrast: number;
  grainFiltering: string;
  grainFollowsCamera: boolean;

  // Shape
  shapeInputStyle: string;
  shapeRelativeToStroke: boolean;
  shapeTouchRotation: number;
  shapeScatter: number;
  shapeCount: number;
  shapeCountJitter: number;
  shapeRandomized: boolean;
  shapeFlipX: boolean;
  shapeFlipY: boolean;
  shapeRotation: number;
  shapeRoundness: number;
  shapePressureRoundness: number;
  shapeTiltRoundness: number;
  shapeRoundnessVerticalJitter: number;
  shapeRoundnessHorizontalJitter: number;
  shapeFiltering: string;
  shapeHardness: number;
  directionFilter: number;

  // Wet Mix
  wetMixDilution: number;
  wetMixCharge: number;
  wetMixAttack: number;
  wetMixPull: number;
  wetMixGrade: number;
  wetMixBlur: number;
  wetMixBlurJitter: number;
  wetMixWetnessJitter: number;

  // Dynamics
  dynamicsSpeedSize: number;
  dynamicsSpeedOpacity: number;
  dynamicsSpeedSpacing: number;
  dynamicsJitterSize: number;
  dynamicsJitterOpacity: number;
  speed1Slowness: number;
  speed2Slowness: number;
  speed1Gamma: number;
  speed2Gamma: number;
  offsetBySpeedSlowness: number;

  // Color Dynamics
  colorStampHue: number;
  colorStampSaturation: number;
  colorStampLightness: number;
  colorStampDarkness: number;
  colorStampSecondary: number;

  colorStrokeHue: number;
  colorStrokeSaturation: number;
  colorStrokeLightness: number;
  colorStrokeDarkness: number;
  colorStrokeSecondary: number;

  colorPressureHue: number;
  colorPressureSaturation: number;
  colorPressureBrightness: number;
  colorPressureSecondary: number;

  colorTiltHue: number;
  colorTiltSaturation: number;
  colorTiltBrightness: number;
  colorTiltSecondary: number;

  colorBarrelHue: number;
  colorBarrelSaturation: number;
  colorBarrelBrightness: number;
  colorBarrelSecondary: number;

  // Properties
  orientToScreen: boolean;
  smudgePull: number;
  maxSize: number;
  minSize: number;
  maxOpacity: number;
  minOpacity: number;
  opacityMultiply: number;

  // Pencil / Stylus
  pressureSize: number;
  pressureOpacity: number;
  pressureFlow: number;
  pressureBleed: number;
  pressureCurve: { x: number; y: number }[];

  tiltAngle: number;
  tiltOpacity: number;
  tiltGradation: number;
  tiltBleed: number;
  tiltSize: number;
  tiltSizeCompression: boolean;

  barrelRollSize: number;
  barrelRollOpacity: number;
  barrelRollBleed: number;
  customInputSlowness: number;

  cursorOutline: string;
  hoverEstimatedPressure: number;
  hoverFill: string;
  hoverFillAll: boolean;

  previewUseStamp: boolean;
  previewSize: number;
  previewPressureMin: number;
  previewPressureScale: number;
  previewWetMix: boolean;
  previewTiltAngle: number;
}

export const DEFAULT_BRUSH_STUDIO_SETTINGS: BrushStudioSettings = {
  // Stroke defaults: no jitter, minimal spacing
  spacing: 0,
  spacingJitter: 0,
  jitterLateral: 0,
  jitterLinear: 0,
  fallOff: 0,
  dabsPerSecond: 0,
  strokeThreshold: 0,
  strokeHoldtime: 0,

  // Stabilization defaults: zero for clean mouse strokes
  streamlineAmount: 0,
  streamlinePressure: 0,
  stabilizationAmount: 0,
  motionFilterAmount: 0,
  motionFilterExpression: 0,
  slowTracking: 0,
  slowTrackingPerDab: 0,

  // Taper defaults: all zero for continuous mouse strokes
  taperStart: 0,
  taperEnd: 0,
  taperSize: 0,
  taperOpacity: 0,
  taperPressure: 0,
  taperTip: 0,
  taperLinkTips: false,
  taperTipAnimation: false,

  // Rendering
  renderingMode: "Intense Blending",
  blendMode: "Normal",
  flow: 100,
  wetEdges: 0,
  burnEdges: 0,
  burnEdgesMode: "Multiply",
  luminanceBlending: false,
  alphaThreshold: false,
  thresholdAmount: 0,

  // Grain defaults
  grainEnabled: false,
  grainBehavior: "Moving",
  grainMovement: "Rolling",
  grainMovingScale: 0,
  grainMovingZoom: 96,
  grainMovingRotation: 0,
  grainMovingDepth: 100,
  grainMovingDepthMin: 0,
  grainMovingDepthJitter: 0,
  grainTexScale: 0,
  grainTexZoom: 96,
  grainTexRotation: 0,
  grainTexDepth: 100,
  grainTexDepthMin: 0,
  grainTexDepthJitter: 0,
  grainOffsetJitter: true,
  grainBlendMode: "Multiply",
  grainBrightness: 0,
  grainContrast: 0,
  grainFiltering: "None",
  grainFollowsCamera: true,

  // Shape defaults
  shapeInputStyle: "Touch only",
  shapeRelativeToStroke: false,
  shapeTouchRotation: 0,
  shapeScatter: 0,
  shapeCount: 1,
  shapeCountJitter: 0,
  shapeRandomized: false,
  shapeFlipX: false,
  shapeFlipY: false,
  shapeRotation: 0,
  shapeRoundness: 100,
  shapePressureRoundness: 0,
  shapeTiltRoundness: 0,
  shapeRoundnessVerticalJitter: 0,
  shapeRoundnessHorizontalJitter: 0,
  shapeFiltering: "Improved",
  shapeHardness: 50,
  directionFilter: 50,

  // Wet Mix defaults
  wetMixDilution: 0,
  wetMixCharge: 50,
  wetMixAttack: 0,
  wetMixPull: 75,
  wetMixGrade: 0,
  wetMixBlur: 0,
  wetMixBlurJitter: 0,
  wetMixWetnessJitter: 0,

  // Dynamics defaults
  dynamicsSpeedSize: 0,
  dynamicsSpeedOpacity: 0,
  dynamicsSpeedSpacing: 0,
  dynamicsJitterSize: 0,
  dynamicsJitterOpacity: 0,
  speed1Slowness: 50,
  speed2Slowness: 50,
  speed1Gamma: 50,
  speed2Gamma: 50,
  offsetBySpeedSlowness: 50,

  // Color Dynamics defaults
  colorStampHue: 0,
  colorStampSaturation: 0,
  colorStampLightness: 0,
  colorStampDarkness: 0,
  colorStampSecondary: 0,

  colorStrokeHue: 0,
  colorStrokeSaturation: 0,
  colorStrokeLightness: 0,
  colorStrokeDarkness: 0,
  colorStrokeSecondary: 0,

  colorPressureHue: 0,
  colorPressureSaturation: 0,
  colorPressureBrightness: 0,
  colorPressureSecondary: 0,

  colorTiltHue: 0,
  colorTiltSaturation: 0,
  colorTiltBrightness: 0,
  colorTiltSecondary: 0,

  colorBarrelHue: 0,
  colorBarrelSaturation: 0,
  colorBarrelBrightness: 0,
  colorBarrelSecondary: 0,

  // Properties defaults
  orientToScreen: false,
  smudgePull: 10,
  maxSize: 100,
  minSize: 0,
  maxOpacity: 100,
  minOpacity: 0,
  opacityMultiply: 50,

  // Pressure: zero by default for mouse usage
  pressureSize: 0,
  pressureOpacity: 0,
  pressureFlow: 100,
  pressureBleed: 0,
  pressureCurve: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],

  tiltAngle: 0,
  tiltOpacity: 0,
  tiltGradation: 0,
  tiltBleed: 0,
  tiltSize: 0,
  tiltSizeCompression: true,

  barrelRollSize: 0,
  barrelRollOpacity: 0,
  barrelRollBleed: 0,
  customInputSlowness: 0,

  cursorOutline: "Active color",
  hoverEstimatedPressure: 10,
  hoverFill: "Shape",
  hoverFillAll: true,

  // Preview defaults
  previewUseStamp: false,
  previewSize: 69,
  previewPressureMin: 0,
  previewPressureScale: 100,
  previewWetMix: false,
  previewTiltAngle: 0,
};
