import type { BrushStudioSettings } from "./brushStudioSettings";

/**
 * Custom Compositor Layer
 * Wraps the output of the Brushlib engine and applies advanced
 * compositing effects (Glaze modes, Blend modes, Burn edges, etc.)
 */
export class CustomCompositor {
  public strokeCanvas: HTMLCanvasElement;
  public strokeCtx: CanvasRenderingContext2D;

  private activeSettings: BrushStudioSettings | null = null;
  private width: number = 0;
  private height: number = 0;

  // Grain texture cache
  private grainTexture: ImageData | null = null;
  private grainTextureKey: string = "";

  constructor() {
    this.strokeCanvas = document.createElement("canvas");
    this.strokeCtx = this.strokeCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.strokeCanvas.width = width;
    this.strokeCanvas.height = height;
  }

  /**
   * Map logical blend modes to Canvas2D globalCompositeOperation
   */
  private getCompositeOperation(blendMode: string): GlobalCompositeOperation {
    switch (blendMode) {
      case "Multiply":
        return "multiply";
      case "Screen":
        return "screen";
      case "Overlay":
        return "overlay";
      case "Darken":
        return "darken";
      case "Lighten":
        return "lighten";
      case "Color Dodge":
        return "color-dodge";
      case "Color Burn":
        return "color-burn";
      case "Linear Burn":
        return "multiply"; // Approximate fallback
      default:
        return "source-over";
    }
  }

  /**
   * Calculate internal glaze opacity multiplier based on mode
   */
  private getGlazeMultiplier(mode: string): number {
    switch (mode) {
      case "Light Glaze":
        return 0.25;
      case "Uniformed Glaze":
        return 0.5;
      case "Intense Glaze":
        return 0.75;
      case "Heavy Glaze":
        return 1.0;
      case "Uniform Blending":
        return 0.6;
      case "Intense Blending":
        return 0.9;
      default:
        return 1.0;
    }
  }

  /**
   * Called when a new stroke begins.
   * Clears the internal stroke canvas but keeps it the same size.
   */
  public beginStroke(settings: BrushStudioSettings) {
    this.activeSettings = settings;
    if (
      this.strokeCanvas.width !== this.width ||
      this.strokeCanvas.height !== this.height
    ) {
      this.strokeCanvas.width = this.width;
      this.strokeCanvas.height = this.height;
    }
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Composites the temporary stroke layer onto the main canvas
   * This should be called during the pointer move event, after restoring the main canvas from history.
   */
  public compositeStrokeToMain(
    mainCtx: CanvasRenderingContext2D,
    baseImageData: ImageData,
  ) {
    if (!this.activeSettings) return;

    // Restore the underlying snapshot (the canvas before this stroke started)
    mainCtx.putImageData(baseImageData, 0, 0);

    const glazeMult = this.getGlazeMultiplier(
      this.activeSettings.renderingMode,
    );

    // Draw the entire stroke buffer over the base image
    mainCtx.save();
    mainCtx.globalAlpha = glazeMult;
    mainCtx.globalCompositeOperation = this.getCompositeOperation(
      this.activeSettings.blendMode,
    );

    // Luminance blending: convert to luminosity composite operation
    if (this.activeSettings.luminanceBlending) {
      mainCtx.globalCompositeOperation = "luminosity";
    }

    mainCtx.drawImage(this.strokeCanvas, 0, 0);
    mainCtx.restore();
  }

  /**
   * Post-processing step for pixel-level effects (Wet edges, Alpha threshold)
   * Applied directly to the final main canvas or stroke canvas before committing.
   */
  public applyPostProcessEffects(
    ctx: CanvasRenderingContext2D,
    settings: BrushStudioSettings,
  ) {
    if (
      !settings.alphaThreshold &&
      settings.wetEdges === 0 &&
      settings.burnEdges === 0
    ) {
      return;
    }

    const w = this.width;
    const h = this.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const threshold = (settings.thresholdAmount / 100) * 255;
    const wetAmount = settings.wetEdges / 100;
    const burnAmount = settings.burnEdges / 100;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const alpha = data[i + 3];

        // 1. Alpha Threshold
        if (settings.alphaThreshold && alpha < threshold) {
          data[i + 3] = 0;
          continue;
        }

        if (alpha <= 5) continue;

        // Detect edge pixels by checking neighbor alpha gradient
        let isEdge = false;
        if ((wetAmount > 0 || burnAmount > 0) && alpha > 10) {
          // Sample neighbors (up, down, left, right)
          const neighbors = [
            y > 0 ? data[((y - 1) * w + x) * 4 + 3] : 0,
            y < h - 1 ? data[((y + 1) * w + x) * 4 + 3] : 0,
            x > 0 ? data[(y * w + (x - 1)) * 4 + 3] : 0,
            x < w - 1 ? data[(y * w + (x + 1)) * 4 + 3] : 0,
          ];
          const minNeighborAlpha = Math.min(...neighbors);
          const gradient = alpha - minNeighborAlpha;
          isEdge = gradient > 30; // Significant alpha drop = edge
        }

        // 2. Wet Edge: darken boundary pixels where alpha gradient is steep
        if (wetAmount > 0 && isEdge) {
          const darken = 1.0 - wetAmount * 0.4;
          data[i] = Math.max(0, data[i] * darken);
          data[i + 1] = Math.max(0, data[i + 1] * darken);
          data[i + 2] = Math.max(0, data[i + 2] * darken);
          // Slightly boost alpha at edges to simulate paint pooling
          data[i + 3] = Math.min(255, alpha + wetAmount * 40);
        }

        // 3. Burn Edge: darken edge pixels based on burnEdgesMode
        if (burnAmount > 0 && isEdge) {
          const burnMode = settings.burnEdgesMode;
          const burnFactor = burnAmount * 0.6;
          if (burnMode === "Multiply" || burnMode === "Linear Burn") {
            data[i] = Math.max(0, data[i] * (1 - burnFactor));
            data[i + 1] = Math.max(0, data[i + 1] * (1 - burnFactor));
            data[i + 2] = Math.max(0, data[i + 2] * (1 - burnFactor));
          } else if (burnMode === "Color Burn") {
            // More aggressive darkening
            data[i] = Math.max(0, data[i] - burnFactor * 80);
            data[i + 1] = Math.max(0, data[i + 1] - burnFactor * 80);
            data[i + 2] = Math.max(0, data[i + 2] - burnFactor * 80);
          } else if (burnMode === "Overlay") {
            // Overlay: darkens darks, lightens lights
            for (let c = 0; c < 3; c++) {
              const v = data[i + c] / 255;
              const result =
                v < 0.5
                  ? 2 * v * v * (1 - burnFactor) + v * burnFactor * 0.3
                  : 1 - 2 * (1 - v) * (1 - v) * (1 - burnFactor);
              data[i + c] = Math.max(0, Math.min(255, result * 255));
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // 4. Grain texture overlay
    this.applyGrainOverlay(ctx, settings);
  }

  /**
   * Generate or retrieve a cached grain noise texture.
   */
  private getOrCreateGrainTexture(settings: BrushStudioSettings): ImageData {
    const isMoving = settings.grainBehavior === "Moving";
    const zoom = isMoving ? settings.grainMovingZoom : settings.grainTexZoom;
    const scale = isMoving ? settings.grainMovingScale : settings.grainTexScale;
    const key = `${this.width}x${this.height}_${zoom}_${scale}_${settings.grainBrightness}_${settings.grainContrast}`;

    if (this.grainTexture && this.grainTextureKey === key) {
      return this.grainTexture;
    }

    const w = this.width;
    const h = this.height;
    const imgData = new ImageData(w, h);
    const data = imgData.data;
    const texScale = Math.max(1, zoom / 50) * Math.max(1, (scale + 10) / 10);
    const brightnessOffset = (settings.grainBrightness / 100) * 128;
    const contrastFactor = 1 + settings.grainContrast / 100;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.floor(x / texScale) * 1337;
        const sy = Math.floor(y / texScale) * 7919;
        // Hash-based noise
        let noise = (((sx ^ sy) * 2654435761) >>> 0) % 256;
        // Apply brightness and contrast
        noise = Math.max(
          0,
          Math.min(
            255,
            (noise - 128) * contrastFactor + 128 + brightnessOffset,
          ),
        );
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = noise;
        data[i + 3] = 255;
      }
    }

    this.grainTexture = imgData;
    this.grainTextureKey = key;
    return imgData;
  }

  /**
   * Apply grain texture overlay to the stroke canvas.
   * Grain modulates stroke pixel brightness/alpha using the noise texture.
   */
  private applyGrainOverlay(
    ctx: CanvasRenderingContext2D,
    settings: BrushStudioSettings,
  ) {
    const isMoving = settings.grainBehavior === "Moving";
    const depth = isMoving ? settings.grainMovingDepth : settings.grainTexDepth;
    const depthMin = isMoving
      ? settings.grainMovingDepthMin
      : settings.grainTexDepthMin;

    // Skip if grain has no effect
    if (depth <= 0) return;

    const w = this.width;
    const h = this.height;
    const grain = this.getOrCreateGrainTexture(settings);
    const grainData = grain.data;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const depthFactor = depth / 100;
    const minFactor = depthMin / 100;
    const blendMode = settings.grainBlendMode;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha <= 2) continue;

      // Grain luminance (0-1)
      const grainVal = grainData[i] / 255;

      // Apply depth: mix between full effect and minimum
      const effectStrength =
        depthFactor * (grainVal * (1 - minFactor) + minFactor);

      if (blendMode === "Multiply") {
        data[i] = Math.max(0, data[i] * effectStrength);
        data[i + 1] = Math.max(0, data[i + 1] * effectStrength);
        data[i + 2] = Math.max(0, data[i + 2] * effectStrength);
      } else if (blendMode === "Screen") {
        data[i] = Math.min(
          255,
          255 - (255 - data[i]) * (1 - effectStrength * 0.5),
        );
        data[i + 1] = Math.min(
          255,
          255 - (255 - data[i + 1]) * (1 - effectStrength * 0.5),
        );
        data[i + 2] = Math.min(
          255,
          255 - (255 - data[i + 2]) * (1 - effectStrength * 0.5),
        );
      } else if (blendMode === "Overlay") {
        for (let c = 0; c < 3; c++) {
          const v = data[i + c] / 255;
          const g = effectStrength;
          const result = v < 0.5 ? 2 * v * g : 1 - 2 * (1 - v) * (1 - g);
          data[i + c] = Math.max(0, Math.min(255, result * 255));
        }
      } else {
        // Default: alpha-based depth modulation
        data[i + 3] = Math.max(0, Math.min(255, alpha * effectStrength));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}
