# Environment Configuration

This project supports multiple build environments (Development and Production).

## Environment Files

- `.env.development` - Development API endpoints (committed to git)
- `.env.production` - Production API endpoints (committed to git)
- `.env.local` - Local overrides (NOT committed, for testing)

## API Endpoints

**Development:**
- Base URL: `https://dev-deviceapi.cluemaster.io`
- Used for: Testing, internal development

**Production:**
- Base URL: `https://deviceapi.cluemaster.io` (update this in `.env.production`)
- Used for: Customer-facing releases

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
- **Repository:** `ClueMaster-LLC/TimerDisplay-Electron-Updates-Dev`
- **Filename:** `ClueMaster-Timer-Dev Setup.exe`
- **Download URL:** `https://github.com/ClueMaster-LLC/TimerDisplay-Electron-Updates-Dev/releases/latest/download/ClueMaster-Timer-Dev%20Setup.exe`
- **Tag format:** `v2025.11.23-dev-1`, `v2025.11.23-dev-2`, etc.

### Production Releases
- **Repository:** `ClueMaster-LLC/TimerDisplay-Electron-Updates`
- **Filename:** `ClueMaster-Timer Setup.exe`
- **Download URL:** `https://github.com/ClueMaster-LLC/TimerDisplay-Electron-Updates/releases/latest/download/ClueMaster-Timer%20Setup.exe`
- **Tag format:** `v2025.11.23`, `v2025.11.24`, etc.

**Note:** You need to create the `TimerDisplay-Electron-Updates-Dev` repository on GitHub before publishing dev builds.

## Testing Locally

To test with custom API URLs without committing changes:
1. Create `.env.local` (ignored by git)
2. Add: `VITE_API_BASE_URL=http://localhost:3000`
3. Run `npm run dev`

## Verifying Environment

When the app starts, check the console for:
```
API Backend initialized with: https://dev-deviceapi.cluemaster.io (development mode)
Environment config loaded: { apiBaseUrl: '...', environment: '...' }
```
