# Environment Configuration

This project supports multiple build environments (Development and Production) with automatic environment variable injection at build time.

## Environment Files

- `.env.development` - Development configuration (committed to git)
  - API URL: `https://dev-deviceapi.cluemaster.io`
  - Product Name: `ClueMaster-Timer-Display-DEV`
  - App ID: `com.cluemaster.timer.dev`

- `.env.production` - Production configuration (committed to git)
  - API URL: `https://deviceapi.cluemaster.io`
  - Product Name: `ClueMaster-Timer-Display`
  - App ID: `com.cluemaster.timer.prod`

**Important:** The `src/config/environment.mjs` file should always have empty strings (`''`) for all values in source control. These are replaced at build time by the `build-scripts/inject-env.mjs` script.

## API Endpoints

**Development:**
- Base URL: `https://dev-deviceapi.cluemaster.io`
- Used for: Testing, internal development
- Update Repo: `TimerDisplay-Updates-Dev`

**Production:**
- Base URL: `https://deviceapi.cluemaster.io`
- Used for: Customer-facing releases
- Update Repo: `TimerDisplay-Updates`

## Build Commands

### Development Builds
```bash
# Build for development (uses dev API)
npm run build:dev

# Package installer (no publish)
npm run package:dev

# Build and publish to GitHub (uses dev API)
set GH_TOKEN=your_github_token
npm run publish:dev
```

### Production Builds
```bash
# Build for production (uses prod API)
npm run build:prod

# Package installer (no publish)
npm run package:prod

# Build and publish to GitHub (uses prod API)
set GH_TOKEN=your_github_token
npm run publish:prod
```

## GitHub Releases Strategy

Dev and prod builds publish to **separate repositories** for clean separation:

### Development Releases
- **Repository:** `ClueMaster-LLC/TimerDisplay-Updates-Dev`
- **Filename:** `ClueMaster-Timer-Display-DEV-Setup.exe`
- **App ID:** `com.cluemaster.timer.dev`
- **Build Output:** `dist-dev/`
- **Install Location:** `%LOCALAPPDATA%\Programs\ClueMaster-Timer-Display-DEV\`
- **Windows Startup:** Disabled by default (user can enable)
- **Window Mode:** Starts in windowed mode (like npm run dev)
- **Tag format:** `v2025.11.23`, `v2025.11.24`, etc.

### Production Releases
- **Repository:** `ClueMaster-LLC/TimerDisplay-Updates`
- **Filename:** `ClueMaster-Timer-Display-Setup.exe`
- **App ID:** `com.cluemaster.timer.prod`
- **Build Output:** `dist-prod/`
- **Install Location:** `%LOCALAPPDATA%\Programs\ClueMaster-Timer-Display\`
- **Windows Startup:** Enabled by default (auto-start on boot)
- **Window Mode:** Starts in fullscreen kiosk mode
- **Tag format:** `v2025.11.23`, `v2025.11.24`, etc.

**Important Notes:**
- DEV and PROD builds can be installed side-by-side (different app IDs)
- Build outputs are separated: `dist-dev/` for dev, `dist-prod/` for prod (both gitignored)
- Installation is per-user (`perMachine: false`) to enable differential updates
- Keep last 2-3 releases in GitHub for differential update support
- Differential updates only work when both old and new versions exist on GitHub
- Installer no longer cleans up legacy "ClueMaster-Timer" registry entries (removed as of v2025.12.13)

## Testing Locally

To test with custom API URLs without committing changes:
1. Create `.env.local` (ignored by git)
2. Add: `VITE_API_BASE_URL=http://localhost:3000`
3. Run `npm run dev`

## Verifying Environment

When the app starts, check the console for:
```
Environment config - API Base URL: https://deviceapi.cluemaster.io
Environment config - Environment: production
API Backend initialized with: https://deviceapi.cluemaster.io (production mode)
UPDATER: Environment is production, detected PRODUCTION build, will check repo: TimerDisplay-Updates
```

## Differential Updates

**Requirements for differential updates to work:**
1. `perMachine: false` in NSIS config (enables per-user installation)
2. Both old and new versions must exist as GitHub releases
3. Both versions must have `.exe` and `.exe.blockmap` files
4. The currently installed version must have been installed via auto-update (not manual install)

**How it works:**
- First auto-update: Downloads full installer, caches as `installer.exe`
- Subsequent updates: Downloads only changed blocks using blockmap, applies patch
- Typical savings: 80-90% smaller download size

**Note:** If differential update fails, it automatically falls back to full download.

## Troubleshooting

### Build shows wrong environment
- Verify `build-scripts/inject-env.mjs` ran successfully
- Check console output during build for: `✅ Environment variables injected into environment.mjs`
- Confirm `src/config/environment.mjs` has empty strings (`''`) before build

### App won't exit from command line
- This is normal for packaged apps with background processes
- Use `Ctrl+C` to exit when debugging from command line
- Normal users (double-click launch) won't experience this

### Differential updates not working
- Ensure currently installed version came from GitHub release (not local package)
- Verify both old and new versions exist on GitHub with blockmap files
- Check that `installer.exe` exists in `%LOCALAPPDATA%\cluemaster-timer-updater\`
- First update after changing to per-user install requires full download
