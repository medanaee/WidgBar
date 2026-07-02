# WidgBar

<p align="center">
  <img src="./public/banner.png" alt="WidgBar Banner" width="100%" />
</p>

<p align="center">
  <strong>A premium, lightweight, and highly customizable desktop widget bar for Windows.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2.0-blue?style=flat-square&logo=tauri" alt="Tauri Version" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react" alt="React Version" />
  <img src="https://img.shields.io/badge/Rust-1.75+-orange?style=flat-square&logo=rust" alt="Rust Version" />
  <img src="https://img.shields.io/badge/Platform-Windows-0078d7?style=flat-square&logo=windows" alt="Platform Support" />
</p>

---

## 🌟 Overview

**WidgBar** is a modern desktop utility built using Tauri v2, Rust, React, and TypeScript. It allows users to place lightweight widgets directly on their desktop wallpaper or dock them inside a dedicated screen bar (AppBar) at the top of their monitors. 

WidgBar uses low-level Windows APIs to integrate seamlessly with the desktop window manager (DWM), ensuring that widgets look like they are native to your desktop wallpaper while maintaining interactive capabilities.

---

## 🚀 Key Features

*   **Custom Screen Bar (AppBar)**: An interactive bar pinned to the top of your monitor that reserves system work area space (meaning maximized windows won't overlap it) using Windows AppBar messages.
*   **Desktop Widget Area**: Place widgets directly onto your desktop. Interactive elements support transparent hit-testing, allowing clicks to pass through empty regions to your desktop wallpaper while remaining clickable on actual widget buttons and inputs.
*   **Per-Monitor DPI & Scale Awareness**: Automatically handles layout changes when monitors are connected/disconnected or when display scaling factors (e.g., 100%, 125%, 150%) are updated.
*   **Layout Manager**: Save, load, and manage custom widget arrangements.
*   **Built-in Widgets**:
    *   **Clock**: Fully customizable clock with stopwatch, timezone settings, and theme customization.
    *   **Timer**: Sleek timer with visual progress indicators.
    *   **Calendar**: Visual calendar with Persian/English localization.
    *   **Todo**: Lightweight checklist for tracking daily tasks.

---

## 🛠️ Tech Stack

*   **Backend**: Rust, Tauri v2
*   **Frontend**: React, TypeScript, Vite, Tailwind CSS
*   **State Management**: Zustand
*   **Native Integration**: `windows-sys` / `windows` crates (for AppBar, Window styling, and Mouse Tracking)

---

## 📦 Getting Started

### Prerequisites

To build and run WidgBar, you need to set up your system for Rust and Node.js development.

1.  **Rust**: Install Rust via [rustup.rs](https://rustup.rs/).
2.  **Node.js**: Install Node.js (v18 or higher recommended).
3.  **Windows Build Tools**: Make sure you have C++ Build Tools installed (via Visual Studio Build Tools).

### Installation & Run

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/medanaee/WidgBar.git
    cd WidgBar
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run in Development Mode**:
    ```bash
    npm run tauri dev
    ```

4.  **Build Production Binary**:
    ```bash
    npm run tauri build
    ```
    The compiled `.exe` will be located under `src-tauri/target/release/bundle/nsis/`.

---

## 📂 Project Structure

```
├── src/                    # Frontend React code
│   ├── assets/             # Images, fonts, and styling assets
│   ├── components/         # React Components (Layouts, Widgets Area, Panels)
│   ├── lib/                # Shared utilities and localization helpers
│   ├── stores/             # Zustand State Stores (layouts, settings)
│   ├── types/              # TypeScript types
│   └── widgets/            # Core Widget components (Clock, Calendar, Timer, Todo)
├── src-tauri/              # Backend Rust code
│   ├── src/
│   │   ├── acrylic_layer.rs  # OS-level window creation, transparency, and DPI sync
│   │   ├── database.rs       # Local JSON database configuration storage
│   │   ├── listener.rs       # OS event listeners
│   │   ├── windows_utils.rs  # Low-level Windows API wrapper functions
│   │   └── main.rs           # Tauri entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── package.json            # Node.js dependencies & scripts
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/medanaee/WidgBar/issues).

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
