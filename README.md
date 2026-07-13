# Redmine-Desktop

A powerful, high-performance, and beautiful cross-platform Redmine client built with Electron, React, and Vite.

Redmine-Desktop provides a premium native-like experience for managing your Redmine issues with a focus on design aesthetics and smooth interaction.

## ✨ Features

- **Multi-Grouping Support**: Group your issues by **Status** or **Assignee** with a single click.
- **Dynamic Filtering**: Smart filtering system that adapts based on your grouping mode.
- **macOS Vibrancy**: Native "Glassmorphism" effect with macOS Vibrancy support (exclusive to macOS Dark Mode).
- **GPU Accelerated UI**: Smooth animations and selection indicators powered by hardware acceleration.
- **Fast Search**: Instant search across your current projects and issues.
- **Project & Version Management**: Easy navigation through projects and their respective versions.
- **Rich Task Interaction**: Update status, priority, assignee, and fixed versions directly from the list.
- **Responsive Layout**: Adjust your sidebar and list widths to match your workflow.

## 🚀 Tech Stack

- **Framework**: [React](https://reactjs.org/)
- **Runtime**: [Electron](https://www.electronjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: Vanilla CSS (Optimized for performance)

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Recommended version 18 or higher)
- npm or yarn

### Installation

**📦 Download Pre-built Binaries**

Pre-built binaries are available on the [Releases](https://github.com/buluma/Redmine-desktop/releases) page.

**⚠️ macOS Installation Note**

Due to macOS Gatekeeper security policies, applications downloaded from the internet that are not code-signed may show an error saying the app is "damaged" or "can't be opened".

To fix this, run the following command in Terminal after installing:

```bash
xattr -cr /Applications/Redmine.app
```

This removes the quarantine attribute that macOS adds to downloaded files.

**🛠️ Build from Source**

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd redmine-desktop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the application in development mode:
```bash
npm run dev
```

### Building & Packaging

To build and package the application for your current platform:

```bash
# General build (detects current OS)
npm run build

# Specific platform builds
npx electron-builder --mac --arm64
npx electron-builder --win --x64
```

Output files will be located in the `release/` directory.

## 📄 Documentation

For more detailed technical documentation and development history, please refer to:
- [AGENTS.md](./AGENTS.md) - Technical implementation details and development log.

## 🛡️ License

MIT License.
