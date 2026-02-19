# Snapcraft.io Cloud Build Setup

This guide explains how to set up automatic SNAP builds using Snapcraft.io's cloud build system connected to your GitHub repository.

## Prerequisites

1. GitHub repository with the Electron app code ✅
2. Snapcraft.io account (create at https://snapcraft.io)
3. Ubuntu One account (used to login to Snapcraft.io)

## Setup Steps

### 1. Connect GitHub to Snapcraft.io

1. Go to https://snapcraft.io/account
2. Click **"Register a snap name"**
3. Enter: `cluemaster-timerdisplay-core` (or your preferred name)
4. Click **"Register name"**

### 2. Set Up Automatic Builds

1. Navigate to your snap page: https://snapcraft.io/cluemaster-timerdisplay-core
2. Click **"Builds"** tab
3. Click **"Set up automatic builds"**
4. Authorize Snapcraft to access your GitHub account
5. Select your repository: `ClueMaster-LLC/TimerDisplay-Electron`
6. Configure build settings:
   - **Branch**: `main` (or `develop` for testing)
   - **Snapcraft.yaml location**: `snap/snapcraft.yaml` ✅
   - **Architecture**: amd64, arm64 (both supported)

### 3. Trigger First Build

Option A: **Push to GitHub**
```bash
git add .
git commit -m "Add Snapcraft configuration"
git push origin main
```

Option B: **Manual trigger**
1. Go to Builds tab on Snapcraft.io
2. Click **"Request builds"**
3. Select branch and architectures
4. Click **"Build"**

### 4. Monitor Build Progress

1. Go to https://snapcraft.io/cluemaster-timerdisplay-core/builds
2. View build logs in real-time
3. Build typically takes 10-20 minutes

### 5. Publish to Snap Store

Once build succeeds:

1. Go to **"Releases"** tab
2. Select the build from **edge** channel
3. Click **"Release"** to promote:
   - **edge** → Development testing (unstable)
   - **beta** → Pre-release testing
   - **candidate** → Release candidate
   - **stable** → Production release

## Automatic Build Triggers

Snapcraft.io automatically builds when you push to configured branches:

```bash
# Every push to main triggers a build
git push origin main

# Create a release tag for versioned builds
git tag v2025.12.9
git push origin v2025.12.9
```

## Build Configuration

The `snap/snapcraft.yaml` file defines:

- **Name**: cluemaster-timerdisplay-core
- **Base**: core24 (Ubuntu 24)
- **Confinement**: strict (security)
- **Architectures**: amd64, arm64
- **Plugs**: home, network, wayland, opengl, audio-playback

## Environment Variables for Build

If you need secrets (like API keys) during build:

1. Go to snap settings on Snapcraft.io
2. Add environment variables
3. Reference in snapcraft.yaml:
   ```yaml
   parts:
     cluemaster-videoplayer:
       override-build: |
         export MY_SECRET=$SNAPCRAFT_PROJECT_SECRET
   ```

## Testing the Published SNAP

### From Stable Channel
```bash
sudo snap install cluemaster-timerdisplay-core
```

### From Edge Channel (latest builds)
```bash
sudo snap install cluemaster-timerdisplay-core --edge
```

### From Beta Channel
```bash
sudo snap install cluemaster-timerdisplay-core --beta
```

## Update Strategy

### DEV vs PROD Builds

**Option 1: Separate Snap Names**
- Register two snaps: `cluemaster-timerdisplay-core` and `cluemaster-timerdisplay-core-dev`
- Point to different branches
- Users can install both simultaneously

**Option 2: Use Channels** (Recommended)
- One snap name: `cluemaster-timerdisplay-core`
- DEV builds → **edge** channel
- PROD builds → **stable** channel
- Users switch with: `sudo snap refresh cluemaster-timerdisplay-core --edge`

### Configure Branch-Based Channels

In Snapcraft.io settings:
- `main` branch → **stable** channel
- `develop` branch → **edge** channel
- `beta` branch → **beta** channel

## Versioning

Version is defined in `snap/snapcraft.yaml`:

```yaml
version: '2025.12.9'
```

**Important**: Update this manually or use git tags:

```yaml
# Use git describe for automatic versioning
version: git
```

## Troubleshooting

### Build Fails with "npm ci" errors

**Solution**: Ensure `package-lock.json` is committed to git:
```bash
git add package-lock.json
git commit -m "Add package-lock.json"
```

### Build Fails with "electron-builder not found"

**Solution**: Already handled in snapcraft.yaml with `npx electron-builder`

### Build Fails with Environment Variables

**Problem**: `.env.development` or `.env.production` not found

**Solution**: The build script automatically handles this with `build:prod` command

### "Module not found" errors

**Solution**: Make sure all dependencies are in `package.json` dependencies (not devDependencies for production)

### Architecture-Specific Issues

**arm64 builds fail**: May need to add architecture-specific overrides:
```yaml
architectures:
  - build-on: amd64
  - build-on: arm64
    build-for: arm64
```

## Local Testing Before Cloud Build

Test the snapcraft.yaml locally:

```bash
# Install snapcraft
sudo snap install snapcraft --classic

# Build locally
cd VideoPlayer-Electron
snapcraft

# Test the built snap
sudo snap install --dangerous *.snap
```

## Webhook Integration

Snapcraft can trigger builds from GitHub webhooks (auto-configured when you connect the repo).

To manually configure:
1. GitHub repo → Settings → Webhooks
2. Webhook URL from Snapcraft.io
3. Events: Push events, Release events

## Store Listing

Configure your snap's public page:

1. Go to https://snapcraft.io/cluemaster-timerdisplay-core/listing
2. Add:
   - **Icon** (512x512 PNG)
   - **Screenshots** (720p or 1080p)
   - **Description** (Markdown supported)
   - **Website** link
   - **Contact** email
3. Click **"Update"**

## Publishing Process

```
developer push → GitHub
                    ↓
            Snapcraft.io builds
                    ↓
              edge channel (automatic)
                    ↓
          [manual promotion]
                    ↓
          beta → candidate → stable
```

## CI/CD Integration

The included `.github/workflows/build-snap.yml` provides:
- Automatic build testing on PRs
- SNAP artifact uploads
- Installation testing

## Support

- Snapcraft Forum: https://forum.snapcraft.io
- Snapcraft Docs: https://snapcraft.io/docs
- GitHub Issues: https://github.com/ClueMaster-LLC/TimerDisplay-Electron/issues

## Next Steps

1. ✅ Commit `snap/snapcraft.yaml` to your repository
2. ✅ Register snap name on Snapcraft.io
3. ✅ Connect GitHub repository
4. ✅ Push to trigger first build
5. ✅ Test installation from edge channel
6. ✅ Promote to stable when ready
