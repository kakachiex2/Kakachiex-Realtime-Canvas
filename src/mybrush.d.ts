/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "*/vendor/brushlib/js/mybrush.js" {
  export class MypaintBrush {
    constructor(settings?: any, surface?: any);
    settings: any[];
    settings_value: any[];
    states: any[];
    new_stroke(x: number, y: number): void;
    stroke_to(
      x: number,
      y: number,
      pressure: number,
      xtilt: number,
      ytilt: number,
      dtime: number,
    ): void;
    reset(): void;
    settings_base_values_have_changed(): void;
    readmyb_json(settings: any): void;
  }
  export class MypaintSurface {
    constructor(canvas?: any);
  }
  export const BRUSH: any;
  export const INPUT: any;
  export const STATE: any;
  export const ColorRGB: any;
  export const ACTUAL_RADIUS_MIN: number;
  export const ACTUAL_RADIUS_MAX: number;
}
