# Snapcraft Cloud Build Checklist

## ✅ Files Created/Modified

- [x] `snap/snapcraft.yaml` - SNAP build configuration
- [x] `.github/workflows/build-snap.yml` - GitHub Actions workflow for testing
- [x] `SNAPCRAFT_CLOUD.md` - Complete setup documentation
- [x] `.gitignore` - Added SNAP build artifacts

## 🚀 Next Steps to Enable Cloud Builds

### 1. Commit and Push to GitHub
```bash
git add snap/ .github/workflows/ SNAPCRAFT_CLOUD.md .gitignore
git commit -m "Add Snapcraft.io cloud build configuration"
git push origin main
```

### 2. Register on Snapcraft.io
1. Go to https://snapcraft.io/account
2. Sign in with Ubuntu One account
3. Click "Register a snap name"
4. Enter: `cluemaster-timerdisplay-core`
5. Click "Register"

### 3. Connect GitHub Repository
1. Go to your snap: https://snapcraft.io/cluemaster-timerdisplay-core
2. Click "Builds" tab
3. Click "Set up automatic builds"
4. Authorize GitHub access
5. Select: `ClueMaster-LLC/TimerDisplay-Electron`
6. Configure:
   - Branch: `main`
   - Snapcraft.yaml: `snap/snapcraft.yaml` ✅

### 4. Trigger First Build
**Option A**: Push commits (automatic trigger)
**Option B**: Manual trigger on Snapcraft.io Builds page

### 5. Monitor Build
- View at: https://snapcraft.io/cluemaster-timerdisplay-core/builds
- Build time: ~10-20 minutes
- Check logs for any errors

### 6. Test Installation
```bash
# Install from edge channel (latest build)
sudo snap install cluemaster-timerdisplay-core --edge

# Run the app
cluemaster-timerdisplay-core

# View logs
sudo snap logs cluemaster-timerdisplay-core -f
```

### 7. Promote to Stable
Once tested:
1. Go to "Releases" tab on Snapcraft.io
2. Promote: edge → beta → candidate → stable

## 📋 What the Build Does

1. **Install Node.js 20** (via build-snaps)
2. **Install system dependencies** (build-packages)
3. **Run `npm ci`** - Install project dependencies
4. **Run `npm run build:prod`** - Build production Vite bundle
5. **Run electron-builder** - Package Electron app for Linux
6. **Create launch script** - Sets up SNAP environment variables
7. **Bundle everything** - Copy to SNAP package

## 🔧 Build Configuration

### Name
`cluemaster-timerdisplay-core` (must match registered name on Snapcraft.io)

### Version
`2025.12.9` (from snapcraft.yaml - update as needed)

### Architectures
- amd64 (x86_64)
- arm64 (ARM 64-bit)

### Base
core22 (Ubuntu 22.04 LTS)

### Confinement
strict (full security sandboxing)

### Plugs (Permissions)
- `home` - Read user files
- `network` / `network-bind` - API and WebSocket
- `opengl` - GPU acceleration
- `wayland` / `x11` - Display
- `audio-playback` - Video audio
- `hardware-observe` - System stats
- `mount-observe` - Detect mounts
- `snapd-control` - Snap update management

## 🐛 Troubleshooting

### Build fails with "npm ci" error
**Fix**: Ensure `package-lock.json` is committed to git

### Build fails with environment variable errors
**Fix**: The build automatically uses `.env.production` via `build:prod` script

### App crashes on launch
**Fix**: Check logs with `sudo snap logs cluemaster-timerdisplay-core -f`

### Video playback issues
**Fix**: Ensure VA-API/VDPAU drivers installed on target system

## 📚 Documentation

- Setup Guide: `SNAPCRAFT_CLOUD.md`
- Ubuntu Core Guide: `UBUNTU_CORE.md`
- Environment Config: `ENVIRONMENT.md`

## 🎯 Channels Strategy

| Channel | Purpose | Auto-Deploy |
|---------|---------|-------------|
| **edge** | Development builds | ✅ Every push to `main` |
| **beta** | Pre-release testing | Manual promotion |
| **candidate** | Release candidate | Manual promotion |
| **stable** | Production | Manual promotion |

## 🔄 Update Process

```
Push to GitHub
     ↓
Snapcraft builds automatically
     ↓
Deployed to edge channel
     ↓
Test installation
     ↓
Promote to stable (manual)
     ↓
Users get automatic updates
```

Users on stable channel get updates automatically via `snap refresh`.

---

**Ready to build!** Follow the steps above to enable Snapcraft.io cloud builds. 🚀
