<div align="center">
  <img src="src/assets/Kakachiex-01.png" alt="Kakachiex Realtime Canvas Logo" width="200" style="border-radius: 20%;" onerror="this.src='https://ui-avatars.com/api/?name=Kakachiex+Canvas&background=0D8ABC&color=fff&size=256&rounded=true'" />

  <h1>🎨 Kakachiex Realtime Canvas</h1>
  
  <p>
    <strong>A high-performance React application for real-time sketch-to-image generation powered by ComfyUI and Flux.</strong>
  </p>

  <p>
    <a href="https://reactjs.org/"><img src="./src/assets//Screenshot_20-2-2026_172945_localhost.jpeg" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
    <img src="https://img.shields.io/badge/ComfyUI-Active-success?style=for-the-badge&color=8A2BE2" alt="ComfyUI Integration" />
  </p>
</div>

---

## 🚀 Overview

**Kakachiex Realtime Canvas** bridges the gap between rough ideation and beautiful renders. By seamlessly connecting a web-based drawing canvas to a local or remote **ComfyUI** websocket backend, the application transforms your rough sketches into highly detailed, curated material renders in _real-time_.

Whether you are sketching an industrial product, a glossy ceramic toy, or a neon cyberpunk prop, Kakachiex translates your brush strokes through Flux into stunning imagery instantly.

<br />
<div align="center">
  <!-- Placeholder for a beautiful screenshot of the app -->
  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" alt="App Screenshot Placeholder" width="100%" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
  <p><em>* Replace with an actual screenshot of the Split/Merge workspace.</em></p>
</div>
<br />

## ✨ Key Features

- **🖌️ Low-Latency Sketch Engine**: Smooth, responsive drawing canvas with pressure simulation and multiple brush modes.
- **⚡ Dynamic & Manual Rendering**: Auto-generate images instantly on stroke completion, or toggle into _Manual Mode_ to save GPU resources for lower-end hardware.
- **🎨 Curated Material Styles**: Over 10+ built-in aesthetic profiles including _Studio, Ceramic, Plush, Anime, Neon, Glass,_ and _Sumi-e Fox Ink_.
- **🖥️ Split & Merge Workspaces**: Flexible UI layouts that let you draw side-by-side with your render, or overlay your sketch directly on top of the output.
- **⚙️ Native ComfyUI Websocket**: Deep integration with ComfyUI workflows, supporting custom nodes, Lora injection, and Flux 1024x1024 latent generation.

## 🛠️ Tech Stack

Kakachiex Realtime Canvas is built for modern browser performance:

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **APIs**: ComfyUI Websocket Client, Fal.ai Fallback
- **Build**: Node environments with strict ESLint & SWC compiling

## 📦 Installation & Setup

### 1. Requirements

Ensure you have Node.js installed, as well as a running instance of **ComfyUI** configured with the Flux models and necessary custom nodes (like `ImageResizeKJv2` and `comfyui-flux2fun-controlnet`).

### 2. Install Project Dependencies

Clone the repository and install the NPM packages:

```bash
cd realtime-canvas
npm install
```

### 3. Start the Development Server

```bash
npm run dev
```

The application will be running at `http://localhost:5173`.

### 4. Connect to ComfyUI

1. Open the application in your browser.
2. Click the **Settings (Gear Icon)** in the Control Bar.
3. Input your ComfyUI Host URL (usually `http://127.0.0.1:8188`).
4. Make sure your base `Workflow` JSON is loaded or selected from the folder.
5. Click **Connect**.

## 🎮 How to Use

1. **Select a Style**: Open the Style Selector dropdown and choose a material aesthetic (e.g., _Toy_ or _Ceramic_).
2. **Draw**: Paint your sketch on the active canvas.
3. **Generate**: If _Dynamic Rendering_ is enabled, releasing your pen will automatically trigger the render. If _Manual Rendering_ is enabled, press the blue `Render` button.
4. **Compare**: Use the **Split/Merge** toggle to shift between a side-by-side view and a direct composite overlay.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/kakachiex2">Kakachiex</a>.</p>
</div>
