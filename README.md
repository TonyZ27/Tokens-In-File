# Tokens in Page 🎨

> **A Figma plugin to find, audit, and clean Design Tokens with surgical precision.**

[![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-F24E1E?logo=figma&logoColor=white)](https://www.figma.com/community/plugin/your-id)
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20Tailwind-61DAFB?logo=react&logoColor=white)](https://vitejs.dev/)

## 📖 Overview

**Tokens in Page** was born out of the need to manage large-scale Design Systems (like the one we use at Volvo). As files grow, keeping track of Local, Linked, and Missing variables becomes a nightmare. This plugin provides a high-performance, structured way to audit your design assets and fix "design debt" in seconds.

Built with a **UX-first approach**, it focuses on helping Design System Leads and UX Engineers maintain a single source of truth.

## ✨ Key Features

-   **Deep Scan:** Search across the `Entire File` or `Current Page` with high-performance layer traversal.
-   **Smart Filtering:** Filter by source (**Local**, **Linked**, or **Missing**) and layer types (Components, Frames, etc.).
-   **Structured Inventory:** Organize tokens by `Collection` and `Variable Group`. Items without a group are automatically categorized under **Global**.
-   **Visual Audit (Zoom-in):** Click any layer name to instantly jump to and zoom in on that specific node in the Figma canvas.
-   **Batch Actions:** Select multiple nodes to `Duplicate` or `Replace Variables` in one click, significantly reducing manual labor.
-   **Native Experience:** A UI designed to feel like a native part of the Figma interface, minimizing cognitive load.

## 🛠️ Tech Stack

-   **Framework:** [React](https://reactjs.org/)
-   **Build Tool:** [Vite](https://vitejs.dev/) (optimized for Figma's `ui.html` constraints)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **Language:** TypeScript

## 🚀 Getting Started

### Prerequisites
-   Node.js (v18+)
-   Figma Desktop App

### Installation
1.  Clone the repository:
    ```bash
    git clone [https://github.com/your-username/tokens-in-page.git](https://github.com/your-username/tokens-in-page.git)
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  In Figma, go to `Plugins -> Development -> Import plugin from manifest...` and select the `manifest.json` in the project folder.

## 📐 Design Philosophy

This plugin isn't just a tool; it's an extension of the **UX Engineering** mindset:
1.  **Transparency:** Clearly show where design debt exists.
2.  **Efficiency:** Batch operations are prioritized to avoid repetitive tasks.
3.  **Safety:** Prevent "blind" changes by providing visual context (Zoom-in) before modification.
