import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const [version, setVersion] = useState("");
  const [localIP, setLocalIP] = useState("");
  const [status, setStatus] = useState("Initializing");
  const [updateStatus, setUpdateStatus] = useState("");
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [updatesChecked, setUpdatesChecked] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [authRequired, setAuthRequired] = useState(null);
  const navigate = useNavigate();
  
  // Use refs to track current values for intervals
  const updatesCheckedRef = useRef(false);
  const updateInProgressRef = useRef(false);

  useEffect(() => {
    const fetchVersionAndNetworkAddress = async () => {
      const version = await window.SplashBackend.getVersion();
      const networkAddress = await window.SplashBackend.getLocalIP();
      setVersion(version);
      setLocalIP(networkAddress);
    };
    fetchVersionAndNetworkAddress();

    window.SplashBackend.worker();

    let updaterUnsub = null;

    // Start update check via UpdaterBackend (preload exposes UpdaterBackend)
    const startUpdateCheck = async () => {
      try {
        if (window.UpdaterBackend && window.UpdaterBackend.onUpdateEvent) {
          updaterUnsub = window.UpdaterBackend.onUpdateEvent((payload) => {
            const t = payload && payload.type;
            if (t === "checking") {
              setUpdateStatus("Checking for updates...");
            } else if (t === "available") {
              setUpdateInProgress(true);
              updateInProgressRef.current = true;
              const remoteVersion = payload.info && payload.info.version ? payload.info.version : "unknown";
              setLatestVersion(remoteVersion);
              // Check if it's a snap update
              if (remoteVersion === "snap-update") {
                setUpdateStatus("Snap update available — refreshing...");
              } else {
                setUpdateStatus(`Update available (${remoteVersion}) — starting download...`);
              }
              setDownloadPercent(0);
            } else if (t === "not-available") {
              const remoteVersion = payload.info && payload.info.version ? payload.info.version : "";
              if (remoteVersion) setLatestVersion(remoteVersion);
              setUpdateStatus("No updates available.");
              setUpdateInProgress(false);
              updateInProgressRef.current = false;
              setUpdatesChecked(true);
              updatesCheckedRef.current = true;
            } else if (t === "download-progress") {
              const pct = Math.floor(payload.percent || 0);
              setDownloadPercent(pct);
              setUpdateStatus(`Downloading update: ${pct}%`);
            } else if (t === "downloaded") {
              setDownloadPercent(100);
              const ver = payload.info && payload.info.version ? payload.info.version : "";
              if (ver === "snap-updated") {
                setUpdateStatus("Snap updated. Restarting...");
              } else {
                setUpdateStatus("Update downloaded. Installing and restarting...");
              }
              // main process will quit & install; nothing else to do here
            } else if (t === "error") {
              setUpdateStatus(`Update error: ${payload && payload.message ? payload.message : 'unknown'}`);
              setUpdateInProgress(false);
              updateInProgressRef.current = false;
              setUpdatesChecked(true);
              updatesCheckedRef.current = true;
            } else if (t === "manual-download-start") {
              const { remoteVersion, asset } = payload;
              if (remoteVersion) setLatestVersion(remoteVersion);
              setUpdateStatus(`Manual update available (${remoteVersion}) — downloading installer (${asset})...`);
              setDownloadPercent(0);
              setUpdateInProgress(true);
              setUpdatesChecked(false);
            } else if (t === "manual-download-progress") {
              const pct = Math.floor(payload.percent || 0);
              setDownloadPercent(pct);
              setUpdateStatus(`Manual download in progress: ${pct}%`);
              setUpdateInProgress(true);
            } else if (t === "manual-download-error") {
              setUpdateStatus(`Manual update error: ${payload && payload.message ? payload.message : 'unknown'}`);
              setUpdateInProgress(false);
              setUpdatesChecked(true);
            } else if (t === "manual-download-complete") {
              setDownloadPercent(100);
              setUpdateStatus("Manual update downloaded. Launching installer...");
              setUpdateInProgress(true);
            } else if (t === "manual-download-launched") {
              setUpdateStatus("Installer launched. Application will update shortly.");
              // Allow navigation if user remains; installer should restart app automatically
              setUpdateInProgress(false);
              setUpdatesChecked(true);
            }
          });

          // trigger check
          try {
            // For dev testing: set DEV_UPDATE_TEST to true to force a simulated update flow
            // Change to false (or remove the option) when you want real packaged behavior only.
            const DEV_UPDATE_TEST = false; // simulation disabled; showing real GitHub release version
            await window.UpdaterBackend.checkForUpdates({ forceDev: DEV_UPDATE_TEST, allowQuit: false });
          } catch (e) {
            setUpdateStatus(`Update check failed: ${e && e.message ? e.message : String(e)}`);
            setUpdatesChecked(true);
            updatesCheckedRef.current = true;
          }
        } else {
          // no updater available -> treat as checked
          setUpdateStatus("Auto-updater unavailable");
          setUpdatesChecked(true);
          updatesCheckedRef.current = true;
        }
      } catch (e) {
        setUpdateStatus(`Updater init error: ${e && e.message ? e.message : String(e)}`);
        setUpdatesChecked(true);
        updatesCheckedRef.current = true;
      }
    };

    startUpdateCheck();

    // authentication -> only navigate after update check if no update to apply
    const unsubscribe = window.SplashBackend.authenticate((authRequiredFlag) => {
      setAuthRequired(authRequiredFlag);
      if (authRequiredFlag) {
        setStatus("Device not authenticated");
      } else {
        setStatus("Device authenticated");
      }
    });

    return () => {
      unsubscribe && unsubscribe();
      if (updaterUnsub) updaterUnsub();
    };
  }, []);

  // Separate effect to handle navigation when conditions are met
  useEffect(() => {
    if (authRequired === null) return; // Wait for auth status
    if (!updatesChecked || updateInProgress) return; // Wait for updates to complete

    // Navigate based on authentication status
    if (authRequired) {
      const timer = setTimeout(() => navigate("/authentication"), 2000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => navigate("/loading"), 700);
      return () => clearTimeout(timer);
    }
  }, [authRequired, updatesChecked, updateInProgress, navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-medium mb-8">ClueMaster Timer Display</h1>
      <p className="text-xl mb-2">Version: {version}</p>
      {latestVersion && <p className="text-lg mb-2 text-gray-500">Latest: {latestVersion}</p>}
      <p className="text-xl mb-4">Local IP: {localIP}</p>
      <p className="text-xl text-gray-400">{updateStatus ? updateStatus : status}</p>
      {updateInProgress && (
        <div className="w-64 mt-3">
          <div className="h-3 w-full bg-gray-700 rounded overflow-hidden">
            <div className="bg-green-500 h-full" style={{ width: `${downloadPercent}%` }} />
          </div>
          <div className="text-sm text-gray-400 mt-1">{downloadPercent}%</div>
        </div>
      )}
      <div className="mt-8">
        <img src="./assets/security_loading.gif" className="w-48 h-auto" />
      </div>
    </div>
  );
}
