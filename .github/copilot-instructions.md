# ClueMaster Timer Display - AI Agent Instructions

## Project Overview
Electron-based kiosk application for escape rooms that displays countdown timers, visual clues (text/image/video/audio), and remote game control. Communicates with ClueMaster backend API via polling workers. Supports dev/prod builds with different API endpoints and behaviors.

## Critical Architecture Patterns

### Dual Environment System
**Two separate build pipelines with distinct behaviors:**
- **Development (`npm run build:dev`)**: Windowed mode, dev API (`dev-deviceapi.cluemaster.io`), separate GitHub update repo (`TimerDisplay-Updates-Dev`), app ID `com.cluemaster.timer.dev`
- **Production (`npm run build:prod`)**: Fullscreen kiosk, prod API (`deviceapi.cluemaster.io`), production update repo (`TimerDisplay-Updates`), app ID `com.cluemaster.timer.prod`

**Environment injection workflow:**
1. `build-scripts/inject-env.mjs` reads `.env.development` or `.env.production`
2. Injects values into `src/config/environment.mjs` by string replacement
3. **NEVER commit actual values in `environment.mjs`** - should always be empty strings in git
4. Vite picks up the injected values for renderer, main process reads directly from file

### State Management: Dual-Store Architecture
**Two separate state systems:**

1. **Persistent Backend State (`electron-store`):**
   - Located in `src/backends/state.mjs`
   - Stores device config, game info, room settings, clue data
   - Synced to renderer via IPC: `store:change` events push updates
   - Workers use `worker-helpers.mjs` to access via message passing

2. **React Client State (`zustand`):**
   - Located in `src/state/store.js`
   - Manages UI state: timer countdown, overlay visibility, clue display
   - Synced from electron-store via `initializeStoreSync()` in `App.jsx`
   - Use `useStoreValue(key, defaultValue)` hook to access backend data in React

**Key principle:** Backend data flows one-way from electron-store → zustand. Never modify electron-store from renderer.

### Worker Thread Architecture
**Six independent polling workers** (`src/workers/`) run in Node.js worker threads:
- `game-info.mjs`: Polls game status every 1s, updates timer and game state
- `clue.mjs`: Polls for new clues, triggers clue display
- `timer-requests.mjs`: Handles timer control commands (pause/resume/adjust)
- `device-heartbeat.mjs`: Sends keep-alive to backend
- `update-room.mjs`: Syncs room configuration changes
- `shutdown-restart.mjs`: Monitors remote shutdown/restart requests

**Worker communication pattern:**
```javascript
// Workers send events to main → main forwards to renderer
parentPort.postMessage({ type: "event", component: "game", status: 4 });
// Main process catches and forwards:
window.webContents.send("workers:event", { worker: name, ...message });
```

Workers access electron-store via message passing (see `worker-helpers.mjs`), never directly.

### Media Protocol System
**Custom `media://` protocol** serves files securely to sandboxed renderer:
- `media://local/path` - Local application data files (cached game media)
- `media://external/drive/path` - External USB drive media
- `media://tts-cache/hash.wav` - Generated TTS audio files

**Implementation:** Protocol handler in `electron/main.mjs` resolves paths, streams files with proper MIME types. All video/image/audio sources in React must use `media://` URLs.

### IPC Communication Pattern
**Preload bridge** (`electron/preload.cjs`) exposes typed APIs via `contextBridge`:
```javascript
window.GameBackend.getIntroVideo() // Namespaced by feature
window.TTSBackend.synthesize({ text })
window.SplashBackend.getVersion()
```

**Never expose raw IPC** - always wrap in semantic API methods. Main process handlers in `electron/main.mjs` use `ipcMain.handle()` for async requests.

### TTS Integration (Piper)
**Offline neural TTS** using Piper CLI:
- Voice models in `resources/piper/voices/*.onnx`
- Text → hash → check cache → synthesize with Piper → save WAV → return `media://tts-cache/hash.wav`
- Clue player automatically speaks text clues with 1s delay after alert sound
- Cache directory: `%USERPROFILE%/{productName}/tts-cache/`

**Configuration:** `src/backends/tts-config.mjs` controls voice model, speed, speaker settings.

## Development Workflows

### Running Locally
```bash
npm run dev  # Vite dev server + Electron, no environment injection needed
```
Electron loads from `http://localhost:5173`. Use F11 for fullscreen toggle.

### Building & Publishing
```bash
# Development build (windowed, dev API)
npm run package:dev  # Build installer only
npm run publish:dev  # Build + publish to GitHub (requires GH_TOKEN)

# Production build (kiosk, prod API)
npm run package:prod
npm run publish:prod

# Cleanup old releases (keeps last 2-3 for differential updates)
npm run cleanup-releases
npm run cleanup-releases:all  # Clean both dev and prod repos
```

**Always run appropriate build command** - don't manually run `vite build` (it won't inject environment).

### Testing Auto-Updates
- Dev and prod builds install side-by-side (different app IDs)
- Keep 2-3 releases in GitHub for differential updates
- Auto-updater checks on app start and every 30 minutes
- Dev build defaults to `TimerDisplay-Updates-Dev` repo

## Project-Specific Conventions

### File Organization
- **Backends (`src/backends/`)**: Node.js modules for Electron main process - APIs, game logic, state
- **Controllers (`src/controllers/`)**: React components managing complex behavior (clue display, video playback, game overlay)
- **Screens (`src/screens/`)**: Top-level route components (splash, auth, loading, player)
- **Workers (`src/workers/`)**: Background polling tasks in worker threads

### Media File Paths
All media stored in `%USERPROFILE%/{productName}/application-data/media-files/`:
- `room-media-files/intro-media/` - Game intro videos
- `room-media-files/success-media/` - Success ending videos
- `room-media-files/fail-media/` - Failure ending videos
- `room-media-files/main-media/` - Main gameplay background videos
- `room-media-files/background-music/` - Audio tracks
- `clue-media-files/{clueId}/` - Individual clue assets

### Error Handling in Workers
Workers must handle network errors gracefully:
```javascript
catch (error) {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    parentPort.postMessage({ type: "event", event: "connectionError" });
  }
}
```
Emit connection status events, never crash the worker.

### Version Numbering
Use `YYYY.MM.DD` format (e.g., `2025.11.20`). Update in `package.json` version field. Build script injects this into `environment.mjs` as `VITE_APP_VERSION`.

## Common Pitfalls

1. **Don't commit environment.mjs with real values** - Run `npm run reset-env` before committing
2. **Workers need restart after code changes** - They don't hot-reload like renderer
3. **Media files must use `media://` protocol** - Direct file paths won't work in renderer
4. **electron-store changes must notify renderer** - Use `storeWrapper.set()` not direct `electronStore.set()`
5. **Build commands inject environment** - Never run `vite build` directly
6. **Kiosk mode only in prod builds** - Dev builds are windowed by default (even when packaged)

## Key Files to Reference

- `electron/main.mjs` - Main process entry, IPC handlers, window management, protocol registration
- `src/state/store.js` - Zustand store with client-side state and electron-store sync
- `src/backends/state.mjs` - electron-store wrapper with IPC access
- `src/workers/workers.mjs` - Worker lifecycle management
- `ENVIRONMENT.md` - Complete environment/build system documentation
- `TTS-README.md` - TTS system architecture and usage
