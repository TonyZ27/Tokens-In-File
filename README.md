# Tokens in Page 🎨

> **A surgical-grade Figma plugin for auditing, managing, and cleaning Design Tokens with high precision.**

<!-- [![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-F24E1E?logo=figma&logoColor=white)](https://www.figma.com/community/search?model=plugins&q=Tokens%20in%20Page) -->
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20Tailwind%20%7C%20TypeScript-61DAFB?logo=react&logoColor=white)](https://vitejs.dev/)
[![Project](https://img.shields.io/badge/GitHub-Repository-black?logo=github)](https://github.com/TonyZ27/Tokens-In-File)

---

## 📖 Overview

**Tokens in Page** is a powerful utility designed for Design System Managers and UX Engineers. As Figma files scale, managing the sprawl of local, linked, and missing variables can become a significant source of design debt. 

This plugin provides a high-performance scanning engine to identify every token reference in your file, allowing you to audit, replace, or detach them with confidence.

> [!TIP]
> Use this plugin to identify "hardcoded" values that should be replaced with tokens, or to find and fix "Missing" variable references after a library update.

## ✨ Core Features

### 🔍 Surgical Scanning
- **Flexible Scope**: Scan the `Entire File` or limit your search to the `Current Page`.
- **High Performance**: Optimized layer traversal that handles complex files with thousands of nodes without lag.
- **Precise Filtering**:
  - **By Source**: Local, Linked, Missing, or Hardcoded.
  - **By Layer Type**: Components, Instances, Frames, Shapes, and Text.

### 📦 Structured Inventory
- **Collections & Groups**: Tokens are automatically organized by their native Figma Collections and Groups.
- **Global Fallback**: Any tokens without a specific group are neatly categorized under a **Global** section for easy access.
- **Type-Specific Filters**: Quickly toggle between Color, Number, String, and Boolean tokens in your inventory.

### 🎯 Interactive Audit (Zoom-in)
- **Visual Context**: Click any layer in the list to instantly jump to and zoom in on that specific node in the Figma canvas.
- **Real-time Sync**: The plugin tracks selection changes to ensure your audit context remains fresh.

### 🛠️ Batch Operations
- **Bulk Replacement**: Select multiple nodes and map them to a new variable in one click.
- **Smart Detach**: Safely unbind variables or styles into hardcoded values with a built-in undo notification.
- **Main Component Sourcing**: When a node is inside a Main Component, the plugin guides you to the source for root-level fixes.

## 🛠️ Tech Stack

- **Framework**: [React](https://reactjs.org/) (Functional Components + Hooks)
- **Build Tool**: [Vite](https://vitejs.dev/) (Optimized for Figma's `ui.html` constraints)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: TypeScript
- **State Management**: React Context / Hooks

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Figma Desktop App](https://www.figma.com/downloads/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TonyZ27/Tokens-In-File.git
   cd Tokens-In-File
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Import to Figma**:
   - Open Figma Desktop.
   - Go to `Plugins` -> `Development` -> `Import plugin from manifest...`.
   - Select the `manifest.json` in the project folder.

## 📐 UX Philosophy

This project follows a **UX-first engineering** approach:
1.  **Transparency**: Clearly visualize design debt and "Missing" assets.
2.  **Native Feel**: UI elements, icons, and interactions are designed to match the Figma environment.
3.  **Efficiency**: Heavy focus on batch operations and "AND" logic filtering to reduce repetitive tasks.
4.  **Safety**: Prevent "blind" changes by leveraging the Zoom-to-node feature for visual verification.

---

> [!IMPORTANT]
> This plugin requires `currentuser` and `teamlibrary` permissions to accurately identify linked variables and current file context.
