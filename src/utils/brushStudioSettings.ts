// Brush Studio types and defaults — extracted for Fast Refresh compatibility

export interface BrushStudioSettings {
  // Stroke
  spacing: number;
  spacingJitter: number;
  jitterLateral: number;
  jitterLinear: number;
  fallOff: number;
  // Stabilization
  streamlineAmount: number;
  streamlinePressure: number;
  stabilizationAmount: number;
  motionFilterAmount: number;
  motionFilterExpression: number;
  // Taper
  // Taper
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
}

export const DEFAULT_BRUSH_STUDIO_SETTINGS: BrushStudioSettings = {
  spacing: 1,
  spacingJitter: 0,
  jitterLateral: 0,
  jitterLinear: 0,
  fallOff: 0,
  streamlineAmount: 23,
  streamlinePressure: 16,
  stabilizationAmount: 17,
  motionFilterAmount: 0,
  motionFilterExpression: 0,
  taperSize: 50,
  taperOpacity: 15,
  taperPressure: 43,
  taperTip: 5,
  taperLinkTips: false,
  taperTipAnimation: true,
  renderingMode: "Intense Blending",
  blendMode: "Normal",
  flow: 45,
  wetEdges: 0,
  burnEdges: 0,
  burnEdgesMode: "Multiply",
  luminanceBlending: false,
  alphaThreshold: false,
  thresholdAmount: 0,
};
