async function getDataJSON(url) {
  try {
    const response = await fetch(url);
    const jsonData = await response.json();

    return jsonData;
  } catch (error) {
    return new Error(error);
  }
}

// https://gist.github.com/mjackson/5311256#file-color-conversion-algorithms-js-L84
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    h,
    s,
    v = max,
    d = max - min;
  s = max == 0 ? 0 : d / max;

  if (max == min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return [h, s, v];
}

function hex2rgb(hex) {
  return [
    ("0x" + hex[1] + hex[2]) | 0,
    ("0x" + hex[3] + hex[4]) | 0,
    ("0x" + hex[5] + hex[6]) | 0,
  ];
}

class Manager {
  _instance = null;
  constructor() {
    if (Manager._instance) {
      return Manager._instance;
    }

    Manager._instance = this;

    this.basePath = `/brushlib.js`;

    this.surface;
    this.brush;
    this.brushName = "charcoal";
    this.currentBrushSetting = {};
    this.t1;
    this.canvas;

    this.onLoad();
  }

  async onLoad() {
    if (null != document.getElementById("NotSupported")) {
      alert(
        "Many apologies.  This demo is not supported on Internet Explorer. Please try Firefox!"
      );
      return;
    }

    this.canvas = document.createElement("canvas");
    this.canvas.width = 800;
    this.canvas.height = 500;
    document.querySelector(".box__canvas").append(this.canvas);

    // ---
    this.bsel = document.getElementById("brushselector");
    this.bsel.addEventListener("change", this.selectbrush.bind(this));
    // ---
    const brushesData = await getDataJSON(
      `${this.basePath}/js/brushes_data.json`
    );

    let currentDir = null;
    let defaultLoad = false;
    let pathDef = null;

    Object.keys(brushesData).forEach((dir) => {
      const { items, path } = brushesData[dir];
      if (!currentDir) currentDir = dir;

      if (currentDir !== dir) {
        const option = document.createElement("option");
        option.value = "separator";
        option.textContent = `-------------- ${dir} --------------`;
        currentDir = dir;
        this.bsel.append(option);
      }

      items.forEach((brushData) => {
        const option = document.createElement("option");
        option.value = brushData;
        option.textContent = brushData[0].toUpperCase() + brushData.slice(1);
        option.dataset.path = `brushes/${path === "/" ? "" : path + "/"}`;

        if (brushData === this.brushName) {
          defaultLoad = true;
          option.selected = true;
          pathDef = `${option.dataset.path}${this.brushName}`;
        }

        this.bsel.append(option);
        currentDir = dir;
      });
    });

    // Default brush not exists load first in the avaibles brushes
    if (!defaultLoad) {
      var optionsDef = Array.from(this.bsel.options).filter(
        (opEl) => opEl.value !== "separator"
      );
      optionsDef[0].selected = true;
      this.brushName = optionsDef[0].value;
      pathDef = encodeURI(`${optionsDef[0].dataset.path}${this.brushName}`);
    }

    this.currentBrushSetting = await getDataJSON(
      `${this.basePath}/${pathDef}.myb.json`
    );

    // Surface and brush make and settings
    this.surface = new MypaintSurface(this.canvas);
    this.surface.clearCanvas();
    this.brush = new MypaintBrush(this.currentBrushSetting, this.surface);

    // ---
    this.pointerMoveHandler = this.pointermove.bind(this);
    this.canvas.addEventListener("pointerdown", this.pointerdown.bind(this));
    this.canvas.addEventListener("pointerup", this.pointerup.bind(this));
    this.canvas.addEventListener("pointermove", this.pointerMoveHandler);

    // --- color h,s,v
    this.color_h = document.getElementById("color_h");
    this.color_s = document.getElementById("color_s");
    this.color_v = document.getElementById("color_v");

    this.color_h.addEventListener("change", this.colorchanged.bind(this));
    this.color_s.addEventListener("change", this.colorchanged.bind(this));
    this.color_v.addEventListener("change", this.colorchanged.bind(this));

    // ---
    this.divelapse = document.getElementById("divelapse");
    // --
    this.mousepressure = document.getElementById("mousepressure");
    this.mousepressure.addEventListener(
      "change",
      this.pressurechanged.bind(this)
    );
    // ---
    this.dab_count = document.getElementById("dab_count");
    this.getcolor_count = document.getElementById("getcolor_count");
    // ---
    this.colorbox = document.getElementById("colorbox");
    // ---
    this.colorBrush = document.getElementById("brushcolor");
    this.colorBrush.addEventListener("input", this.colorBrushSet.bind(this));
    // ---
    this.sizeBrush = document.getElementById("brushsize");
    this.sizeBrush.addEventListener("input", this.setBrushSize.bind(this));
    // ---
    this.brush_img = document.getElementById("brush_img");
    this.brush_img.onerror = function () {
      this.src = "/brushlib.js/assets/img/image_invalid.svg";
    };
    this.brush_img.src = `${this.basePath}/${pathDef}_prev.png`;

    this.cls = document.getElementById("cls_canvas");
    this.cls.addEventListener("click", this.clearCanvas.bind(this));

    this.updateui();
  }

  clearCanvas() {
    this.surface.clearCanvas();
  }

  pointerdown(evt) {
    // console.log('down', evt)
    let curX = evt.clientX;
    let curY = evt.clientY;

    this.canvas.addEventListener("pointermove", this.pointerMoveHandler);

    this.t1 = new Date().getTime();
    this.brush.new_stroke(curX, curY);

    this.divelapse.innerHTML = `X: ${curX} Y: ${curY}`;
  }

  pointerup(evt) {
    // console.log("up", evt);
    this.canvas.removeEventListener("pointermove", this.pointerMoveHandler);

    this.updatestatus();
  }

  pointermove(evt) {
    // Wacom Browser Plugin can be download from
    // http://www.wacom.com/CustomerCare/Plugin.aspx
    const plugin = document.embeds["wacom-plugin"];

    let { pressure: pressurePointer, pointerType, button } = evt;
    let pressure = this.mousepressure.value / 100;

    let isEraser;
    let curX = 0;
    let curY = 0;

    // Pen
    if (pointerType === "pen") {
      if (plugin) {
        pressure = plugin.pressure;
        isEraser = plugin.isEraser;
      }

      // Pointer pressure
      if (!pressure) pressure = pressurePointer;
      if (button === 5) isEraser = true;

      if (!isEraser) isEraser = false;
      if ((!pressure && !pressurePointer) || pressure === 0)
        pressure = this.mousepressure.value / 100;
    }

    // Mouse
    if (pointerType === "mouse" || pointerType === "touch") {
      if (pressure === undefined || pressure === 0) {
        pressure = this.mousepressure.value / 100;
      }
      isEraser = false;
    }

    curX = evt.clientX;
    curY = evt.clientY;

    this.mousepressure.nextElementSibling.textContent = pressure;

    this.divelapse.innerHTML = `X: ${curX} Y: ${curY}`;

    const time = (new Date().getTime() - this.t1) / 1000;
    this.brush.stroke_to(curX, curY, pressure, 90, 0, time);
  }

  updatestatus() {
    //how many dab is drawn for this stroke ?
    this.dab_count.innerHTML = this.surface.dab_count;
    //how may calls to getcolor ?
    this.getcolor_count.innerHTML = this.surface.getcolor_count;
    //time elpase for this stroke
    this.divelapse.innerHTML = new Date().getTime() - this.t1;
  }

  updateui() {
    this.color_h.value = this.currentBrushSetting.color_h.base_value * 100;
    this.color_s.value = this.currentBrushSetting.color_s.base_value * 100;
    this.color_v.value = this.currentBrushSetting.color_v.base_value * 100;

    this.color_h.nextElementSibling.textContent = this.color_h.value;
    this.color_s.nextElementSibling.textContent = this.color_s.value;
    this.color_v.nextElementSibling.textContent = this.color_v.value;

    this.colorbox.innerHTML = this.brushName;

    this.sizeBrush.value =
      this.currentBrushSetting.radius_logarithmic.base_value;
    this.sizeBrush.nextElementSibling.textContent = this.sizeBrush.value;

    this.colorchanged();
  }

  pressurechanged() {
    this.mousepressure.nextElementSibling.textContent = (
      this.mousepressure.value / 100
    ).toFixed(2);
  }

  setBrushSize(e) {
    const sizeBrush = e.currentTarget || e;
    const bs = this.currentBrushSetting;

    bs.radius_logarithmic.base_value = +sizeBrush.value;
    sizeBrush.nextElementSibling.textContent = sizeBrush.value;
    this.brush.readmyb_json(bs);
  }

  colorBrushSet(e) {
    const colorBrush = e.currentTarget || e;
    const [r, g, b] = hex2rgb(colorBrush.value);
    const [h, s, v] = rgbToHsv(r, g, b);

    this.currentBrushSetting.color_h.base_value = h;
    this.currentBrushSetting.color_s.base_value = s;
    this.currentBrushSetting.color_v.base_value = v;

    colorBrush.nextElementSibling.textContent = `${r} ${g} ${b}`;
    colorBrush.nextElementSibling.nextElementSibling.textContent = `${h.toFixed(
      1
    )} ${s.toFixed(1)} ${v.toFixed(1)}`;

    this.updateui();
  }

  colorchanged() {
    const bs = this.currentBrushSetting;

    bs.color_h.base_value = this.color_h.value / 100;
    bs.color_s.base_value = this.color_s.value / 100;
    bs.color_v.base_value = this.color_v.value / 100;
    this.brush.readmyb_json(bs);

    this.color_h.nextElementSibling.textContent =
      bs.color_h.base_value.toFixed(2);
    this.color_s.nextElementSibling.textContent =
      bs.color_s.base_value.toFixed(2);
    this.color_v.nextElementSibling.textContent =
      bs.color_v.base_value.toFixed(2);

    const colorhsv = new ColorHSV(
      bs.color_h.base_value,
      bs.color_s.base_value,
      bs.color_v.base_value
    );
    colorhsv.hsv_to_rgb_float();

    let rr = Math.floor(colorhsv.r * 255).toString(16);
    let gg = Math.floor(colorhsv.g * 255).toString(16);
    let bb = Math.floor(colorhsv.b * 255).toString(16);

    if (rr.length < 2) rr = `0${rr}`;
    if (gg.length < 2) gg = `0${gg}`;
    if (bb.length < 2) bb = `0${bb}`;

    let res =
      Math.floor(colorhsv.r * 255) +
      Math.floor(colorhsv.g * 255) +
      Math.floor(colorhsv.b * 255);

    res = res <= 510;

    const colorStr = `#${rr}${gg}${bb}`;
    this.colorbox.style.backgroundColor = colorStr;
    this.colorbox.style.color = res ? "white" : "black";
    this.colorBrush.value = colorStr;
  }

  async selectbrush() {
    const brushName = this.bsel.options[this.bsel.selectedIndex].value;
    const pathToBrush = this.bsel.options[this.bsel.selectedIndex].dataset.path;

    if (brushName === "separator" || !pathToBrush) {
      console.error(
        "Not isset path dataset or brush name incorrect (separator)!"
      );
      return;
    }

    this.brushName = brushName;

    const pathToJsonBrush = `${this.basePath}/${pathToBrush}${this.brushName}`;
    this.currentBrushSetting = await getDataJSON(`${pathToJsonBrush}.myb.json`);

    this.brush = new MypaintBrush(this.currentBrushSetting, this.surface);
    this.brush_img.src = encodeURI(`${pathToJsonBrush}_prev.png`);

    this.updateui();
  }
}

document.addEventListener("DOMContentLoaded", () => new Manager());
