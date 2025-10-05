import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const [version, setVersion] = useState("");
  const [localIP, setLocalIP] = useState("");
  const [status, setStatus] = useState("Initializing");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVersionAndNetworkAddress = async () => {
      const version = await window.SplashBackend.getVersion();
      const networkAddress = await window.SplashBackend.getLocalIP();
      setVersion(version);
      setLocalIP(networkAddress);
    };
    fetchVersionAndNetworkAddress();

    window.SplashBackend.worker();
    const unsubscribe = window.SplashBackend.authenticate((authRequired) => {
      if (authRequired) {
        setStatus("Device not authenticated");
        setTimeout(() => navigate("/authentication"), 2000);
      } else {
        setStatus("Device authenticated");
        setTimeout(() => navigate("/loading"), 2000);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-medium mb-8">ClueMaster Video Player</h1>
      <p className="text-xl mb-2">Version: {version}</p>
      <p className="text-xl mb-4">Local IP: {localIP}</p>
      <p className="text-xl text-gray-400">{status}</p>
      <div className="mt-8">
        <img src="./assets/security_loading.gif" className="w-48 h-auto" />
      </div>
    </div>
  );
}
