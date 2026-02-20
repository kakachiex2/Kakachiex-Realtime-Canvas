/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @ts-expect-error - mybrush.js has no types
import { MypaintBrush, MypaintSurface, BRUSH, ColorRGB } from '../vendor/brushlib/js/mybrush.js';

// We need to map the brush names to their JSON content.
// Since we are in Vite, we can use glob import to get all json files.
const brushModules = import.meta.glob('../vendor/brushlib/brushes/*.myb.json', { eager: true });
const brushImages = import.meta.glob('../vendor/brushlib/brushes/*_prev.png', { eager: true, query: '?url', import: 'default' });

export interface BrushPreset {
    name: string;
    category: string;
    setting: any;
    preview?: string;
}

const CATEGORIES: Record<string, string[]> = {
    "Sketching": ["pencil", "charcoal", "b000"],
    "Inking": ["pen", "calligraphy", "maobi"],
    "Painting": ["brush", "impressionism", "watercolor"],
    "Texture": ["coarse_bulk_1", "fur", "glow", "leaves", "short_grass", "texture_03", "texture_06"],
    "Artistic": ["sewing", "eraser"]
};

export class BrushEngine {
    private surface: MypaintSurface;
    private brush: MypaintBrush | null = null;
    public static presets: BrushPreset[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.surface = new MypaintSurface(canvas);
        if (BrushEngine.presets.length === 0) {
             BrushEngine.loadPresets();
        }
    }

    public static loadPresets() {
        // Load all brushes
        const loaded: BrushPreset[] = [];
        for (const path in brushModules) {
            const setting = (brushModules[path] as any).default || brushModules[path];
            const filename = path.split('/').pop() || '';
            const name = filename.replace('.myb.json', '');
            
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
            const imagePath = path.replace('.myb.json', '_prev.png');
            const preview = brushImages[imagePath] as string | undefined;

            loaded.push({
                name,
                category,
                setting,
                preview
            });
        }
        BrushEngine.presets = loaded;
    }

    public setBrush(name: string) {
        const preset = BrushEngine.presets.find(p => p.name === name);
        if (preset) {
            this.brush = new MypaintBrush(preset.setting, this.surface);
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
        // Map simplified size (e.g. 1-100) to logarithmic radius
        // MyPaint radius is log.
        // base_value = log(radius)
        // If size is radius in pixels:
        this.brush.settings[BRUSH.RADIUS_LOGARITHMIC].base_value = Math.log(size);
    }

    public startStroke(x: number, y: number) {
        if (!this.brush) return;
        this.brush.new_stroke(x, y);
    }

    public strokeTo(x: number, y: number, pressure: number = 0.5, dtime: number = 0.1) {
        if (!this.brush) return;
        this.brush.stroke_to(x, y, pressure, 0, 0, dtime);
    }

    public endStroke() {
        // MypaintBrush doesn't strictly need an end method, but we can reset if needed
        // this.brush.stroke_to(x, y, 0, ...)? 
        // usually we just stop calling stroke_to
    }
}
