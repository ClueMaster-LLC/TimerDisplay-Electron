# Ubuntu Core SNAP Deployment Guide

This guide explains how to build, deploy, and run ClueMaster Video Player on Ubuntu Core with ubuntu-frame (Wayland compositor).

## Overview

The application has been optimized for Ubuntu Core with the following features:

- **SNAP packaging** - Full confinement with proper plugs for hardware access
- **ubuntu-frame support** - Wayland compositor optimizations for zero-copy video overlays
- **Hardware video decode** - VA-API/VDPAU support for GPU-accelerated playback
- **Platform detection** - Automatically detects SNAP environment and adjusts paths
- **Linux USB support** - Handles Linux mount paths (/media, /mnt) for removable media
- **No auto-updater** - Uses `snap refresh` instead of Windows auto-update mechanism

## Platform-Specific Differences

### Windows vs Linux Behavior

| Feature | Windows | Ubuntu Core/Linux |
|---------|---------|-------------------|
| **Auto-update** | electron-updater (GitHub releases) | `snap refresh` (Snap Store) |
| **Data directory** | `%USERPROFILE%\ClueMaster-TimerDisplay\` | `$SNAP_USER_DATA/ClueMaster-TimerDisplay/` |
| **USB drives** | `E:\`, `F:\`, etc. | `/media/root/drive-name` or `/mnt/drive-name` |
| **Video decode** | D3D11 (DirectX) | VA-API/VDPAU (Linux) |
| **Compositor** | DWM (Desktop Window Manager) | ubuntu-frame (Wayland) |
| **Window mode** | Fullscreen kiosk | Wayland fullscreen overlay |

## Building for Linux

### Using Snapcraft (Recommended)

The production snap is built via **snapcraft.io** or **local LXD**. This includes all hardware acceleration, audio, and USB support.

```bash
# Build locally using LXD (recommended for testing)
snapcraft --use-lxd

# Or build via snapcraft.io by pushing to GitHub
# The snapcraft.yaml defines all dependencies and configuration
```

The `snapcraft.yaml` file includes:
- Mesa/VA-API drivers for hardware video acceleration
- FFmpeg for H.265 to H.264 transcoding
- apulse for audio support
- USB auto-mount scripts
- All required Electron dependencies

### Build Mode Configuration

To switch between dev and prod builds, edit `snap/snapcraft.yaml`:

```yaml
# ════════════════════════════════════════════════════════════
#  BUILD MODE: Change 'dev' to 'prod' for production builds
# ════════════════════════════════════════════════════════════
build-environment:
  - BUILD_MODE: 'prod'  # Change to 'dev' for development
```

## Quick Start (New Device Provisioning)

### Step-by-Step Installation

```bash
# 1. Install the snaps
sudo snap install ubuntu-frame
sudo snap install cluemaster-timerdisplay-core
sudo snap set ubuntu-frame config="cursor=null"

# 3. Set up USB auto-mount (one-time)
sudo /snap/cluemaster-timerdisplay-core/current/bin/setup-usb-automount

# 4. Verify USB auto-mount (optional)
ls -la /etc/udev/rules.d/99-cluemaster-usb-automount.rules
```

### Provisioning Script (Recommended)

For deploying multiple devices, create a single provisioning script:

```bash
#!/bin/bash
# provision-device.sh - Run on each new Ubuntu Core device

set -e

echo "Installing ClueMaster Video Player..."
sudo snap install cluemaster-timerdisplay-core
sudo snap install ubuntu-frame
sudo snap set ubuntu-frame config="cursor=null"

echo "✅ Device provisioned successfully!"
echo "Reboot recommended: sudo reboot"
```

Save as `provision-device.sh`, make executable with `chmod +x provision-device.sh`, and run on each new device.

### Undo USB Auto-Mount (Testing/Reinstall)

```bash
sudo /snap/cluemaster-timerdisplay-core/current/bin/undo-usb-automount
```

## Installing on Ubuntu Core (Manual)

### Method 1: Install from Snap Store (Production)

```bash
sudo snap install cluemaster-timerdisplay-core
```

### Method 2: Install from file (Testing)

```bash
# Install the snap (dangerous flag allows local installation)
sudo snap install --dangerous cluemaster-timerdisplay-core_*.snap
```

### Connect Required Plugs

Most plugs auto-connect. The `snapd-control` plug requires manual connection:

```bash
sudo snap connect cluemaster-mediadisplay-core:snapd-control
```

## Ubuntu Frame Setup

Ubuntu Frame is the Wayland compositor for Ubuntu Core kiosk applications.

### Install and Configure ubuntu-frame

```bash
# Install ubuntu-frame
sudo snap install ubuntu-frame

# Hide cursor for kiosk mode
sudo snap set ubuntu-frame config="cursor=null"
```

This hides the cursor completely while still allowing:
- Touch screen input (fully functional)
- Mouse clicks (work without visual cursor)
- Mouse movement (works, just no visual feedback)

### Restart the Application

```bash
sudo snap restart cluemaster-timerdisplay-core
```

## Audio Configuration

The snap automatically configures ALSA audio for escape room deployments with multiple outputs.

### Supported Audio Outputs

Audio is duplicated to all these outputs simultaneously:

| Output | ALSA Device | Typical Use |
|--------|-------------|-------------|
| Analog (headphone jack) | `hw:0,0` | Overhead speakers via 3.5mm |
| HDMI 0 | `hw:0,3` | Primary monitor speakers |
| HDMI 1 | `hw:0,7` | Secondary monitor speakers |

### Audio Components

- **apulse**: Provides PulseAudio API that redirects to ALSA (Chromium requires PulseAudio)
- **ALSA multi plugin**: Combines multiple hardware outputs into a single virtual device
- **ALSA route plugin**: Duplicates stereo audio to all outputs

### Automatic Volume Setup

On startup, the wrapper script:
1. Creates `.asoundrc` with multi-output configuration
2. Unmutes the Master mixer control
3. Sets Master volume to 100%

### Troubleshooting Audio

```bash
# Enter snap shell for testing
sudo snap run --shell cluemaster-timerdisplay-core.daemon

# Test individual outputs
speaker-test -D hw:0,0 -c 2 -t sine -l 1  # Analog
speaker-test -D hw:0,3 -c 2 -t sine -l 1  # HDMI 0
speaker-test -D hw:0,7 -c 2 -t sine -l 1  # HDMI 1

# Test combined output (should play on all)
speaker-test -D default -c 2 -t sine -l 1

# Check/set mixer volumes
amixer -c 0 scontrols
amixer -c 0 set 'Master' unmute
amixer -c 0 set 'Master' 100%

# List available audio devices
cat /proc/asound/pcm

# Exit snap shell
exit
```

### Changing HDMI Output Port

If using a different HDMI port, edit the `.asoundrc` file:

```bash
# View available HDMI devices
cat /proc/asound/pcm

# Edit .asoundrc (change hw:0,3 or hw:0,7 to correct device)
nano /root/snap/cluemaster-timerdisplay-core/current/.asoundrc

# Restart snap
sudo snap restart cluemaster-timerdisplay-core
```

## Data Directories

### SNAP Confinement Paths

The application uses SNAP-specific directories:

- **User data**: `$SNAP_USER_DATA/ClueMaster-TimerDisplay/`
  - Typical: `/home/ubuntu/snap/ClueMaster-TimerDisplay/current/ClueMaster-TimerDisplay/`
- **Media files**: `$SNAP_USER_DATA/ClueMaster-TimerDisplay/application-data/media-files/`
- **Device config**: `$SNAP_USER_DATA/ClueMaster-TimerDisplay/device-configs/`

## Hardware Video Decoding

### VA-API (Intel/AMD GPUs)

```bash
# Check if VA-API is available
vainfo

# Install VA-API drivers if needed
sudo apt install intel-media-va-driver  # Intel
sudo apt install mesa-va-drivers        # AMD
```

### VDPAU (NVIDIA GPUs)

```bash
# Check if VDPAU is available
vdpauinfo

# Install VDPAU drivers if needed
sudo apt install nvidia-vdpau-driver
```

### Verification

The application logs video resolution when hardware decode is active:

```
Video resolution: 1920x1080 (hardware decode active)
```

If you see codec errors, check:
1. GPU drivers installed
2. VA-API/VDPAU working (`vainfo` or `vdpauinfo`)
3. Use H.264 baseline profile for maximum compatibility

## Running the Application

### Automatic Startup

The snap runs as a daemon and starts automatically on boot. No additional configuration needed.

```bash
# Check daemon status
sudo snap services cluemaster-timerdisplay-core

# Manually control the daemon
sudo snap stop cluemaster-timerdisplay-core
sudo snap start cluemaster-timerdisplay-core
sudo snap restart cluemaster-timerdisplay-core
```

### View Logs

```bash
# View live logs
sudo snap logs cluemaster-timerdisplay-core.daemon -f

# View recent logs
sudo snap logs cluemaster-timerdisplay-core -n 100

# Filter for specific messages
sudo snap logs cluemaster-timerdisplay-core | grep -i "audio\|error"
```

### Kiosk Mode

For fullscreen kiosk deployment, the app automatically:
- Runs in fullscreen mode (on PROD builds)
- Uses Wayland overlay for zero-copy video
- Hides cursor
- Stays always-on-top

## Troubleshooting

### App won't start

```bash
# Check logs
sudo snap logs cluemaster-timerdisplay-core.daemon -f

# Verify SNAP interfaces
snap connections cluemaster-timerdisplay-core

# Ensure ubuntu-frame is running
snap services ubuntu-frame

# Check daemon status
snap services cluemaster-timerdisplay-core
```

### Video playback issues

```bash
# Check logs for hardware acceleration status
sudo snap logs cluemaster-timerdisplay-core | grep -i "decode\|gpu\|vaapi"

# Enter snap shell for testing
sudo snap run --shell cluemaster-timerdisplay-core.daemon

# Inside snap shell, check FFmpeg
$SNAP/bin/ffmpeg -codecs | grep h264
$SNAP/bin/ffprobe -version

exit
```

### Network connectivity issues

```bash
# Verify network plugs
snap connections cluemaster-timerdisplay-core | grep network

# Connect if needed
sudo snap connect cluemaster-timerdisplay-core:network
sudo snap connect cluemaster-timerdisplay-core:network-bind
```

### Audio not working

```bash
# Check ALSA devices exist
cat /proc/asound/pcm

# Enter snap shell
sudo snap run --shell cluemaster-timerdisplay-core.daemon

# Test audio output
speaker-test -D hw:0,3 -c 2 -t sine -l 1

# Check mixer volumes
amixer -c 0 scontrols
amixer -c 0 get 'Master'

# Unmute and set volume
amixer -c 0 set 'Master' unmute
amixer -c 0 set 'Master' 100%

exit
```

## Updates

### SNAP Refresh

Updates are handled by the SNAP system (not electron-updater):

```bash
# Manual update
sudo snap refresh cluemaster-timerdisplay-core

# Check for updates
snap refresh --list
sudo snap refresh ClueMaster-TimerDisplay

# Check for updates
snap refresh --list

# Enable automatic updates (default)
sudo snap set system refresh.timer=00:00-24:00

# View update history
snap changes
```

## Performance Optimization

### Debug Overlay

Press the debug key during video playback to toggle a diagnostic overlay:

- **FPS**: Real-time frames per second (green ≥55, yellow ≥45, red <45)
- **Jitter**: Frame timing issues (green=0, yellow <10, red ≥10)
- **Codec**: Video codec info via ffprobe
- **Decode**: Shows ⬢ GPU (hardware) or ⬡ CPU (software) decode
- **Dropped Frames**: Frames dropped since overlay opened

**Note**: The overlay uses standard Unicode symbols (not emojis) for Linux compatibility.

### Wayland Zero-Copy

The app automatically enables zero-copy video overlays on ubuntu-frame:

```javascript
// Detected in video-player.jsx
if (isUbuntuFrame) {
  console.log('Ubuntu Frame compositor detected - using Wayland zero-copy video overlays');
}
```

### GPU Optimization

Chromium flags for Linux hardware acceleration:

```javascript
// Automatically set in main.mjs for Linux
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('enable-gpu-rasterization');
```

### Memory Management

Monitor memory usage:

```bash
# View snap memory usage
snap tasks

# Check system resources
free -h
top -p $(pidof ClueMaster-TimerDisplay)
```

## Development Testing

### Local Testing (non-SNAP)

For testing without SNAP packaging:

```bash
# Run in dev mode
npm run dev

# The app will detect it's not in a SNAP environment
# and use standard Linux paths
```

### SNAP Testing

```bash
# Build and install locally
npm run package:linux-dev
sudo snap install --dangerous dist-linux-dev/*.snap

# View logs in real-time
sudo journalctl -f -u snap.ClueMaster-TimerDisplay.*
```

## Security Considerations

### SNAP Confinement

The app uses `strict` confinement with specific plugs:

- `home` - Access to home directory
- `network` / `network-bind` - API and WebSocket communication
- `opengl` - GPU acceleration
- `wayland` - Display server (ubuntu-frame)
- `audio-playback` - Video audio
- `hardware-observe` - System stats (CPU/RAM)
- `mount-observe` - Detect USB mounts
- `snapd-control` - Snap update management via snapd API

### Path Security

The media protocol handler validates paths to prevent directory traversal:

```javascript
// Security check in main.mjs
if (!filePath.startsWith(usbDrivePath)) {
  return new Response("Forbidden", { status: 403 });
}
```

## Additional Resources

- [Ubuntu Frame Documentation](https://mir-server.io/ubuntu-frame)
- [Snapcraft Documentation](https://snapcraft.io/docs)
- [VA-API Hardware Acceleration](https://wiki.archlinux.org/title/Hardware_video_acceleration)
- [Electron on Linux](https://www.electronjs.org/docs/latest/development/build-instructions-linux)

## Support

For issues specific to Ubuntu Core deployment:

1. Check application logs: `sudo snap logs cluemaster-timerdisplay-core.daemon -f`
2. Verify SNAP connections: `snap connections cluemaster-timerdisplay-core`
3. Test audio: `snap run --shell cluemaster-timerdisplay-core.daemon` then `speaker-test -D default -c 2 -t sine -l 1`
4. Review ubuntu-frame logs: `sudo snap logs ubuntu-frame -f`

