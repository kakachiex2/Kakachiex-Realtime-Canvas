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

    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imgData.data;
    const threshold = (settings.thresholdAmount / 100) * 255;
    const wetAmount = settings.wetEdges / 100;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];

      // 1. Alpha Threshold
      if (settings.alphaThreshold && alpha < threshold) {
        data[i + 3] = 0;
      }

      // 2. Wet Edge simulation approximation
      if (wetAmount > 0 && alpha > 20 && alpha < 200) {
        const wetFactor = 1.0 + wetAmount * 0.5;
        data[i] = Math.min(255, data[i] * wetFactor);
        data[i + 1] = Math.min(255, data[i + 1] * wetFactor);
        data[i + 2] = Math.min(255, data[i + 2] * wetFactor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}
