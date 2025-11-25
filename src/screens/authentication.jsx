import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StartupMessage from '../components/StartupMessage';

export default function Authentication() {
  const [deviceCode, setDeviceCode] = useState('');
  const [localIP, setLocalIP] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDeviceIDAndNetworkAddress = async () => {
      const deviceID = await window.AuthenticationBackend.getDeviceID()
      const networkAddress = await window.AuthenticationBackend.getLocalIP()
      setDeviceCode(deviceID)
      setLocalIP(networkAddress)
    }
    fetchDeviceIDAndNetworkAddress()

    window.AuthenticationBackend.worker()

    const authEventHandler = window.AuthenticationBackend.onAuthEvent((event) => {
      if (event.authSuccess === true){
        setStatus('Authentication complete')
        setTimeout(() => navigate('/loading'), 2000)
      } else {
        if (event.authSuccess === false){
          setStatus('Authentication failed. Restarting the app...')
          setTimeout(() => navigate('/'), 2000)
        }
      }
    });
    const progressEventHandler = window.AuthenticationBackend.onLoadingProgressEvent((event) => {
      if (event.progressMax !== null){ 
        setProgressMax(event.progressMax) 
      }
      if (event.progress === true){
        setProgress(progress => progress + 1)
      }
    })
    const statusEventHandler = window.AuthenticationBackend.onStatusEvent((event) => {
      if (event.status !== null){
        setStatus(event.status)
      }
    })

    return () => { 
      authEventHandler ()
      statusEventHandler() 
      progressEventHandler()
    }
  }, []);

  return (
    <>
      <StartupMessage mode="other" />
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#191F26] text-white">
        <h1 className="text-4xl font-medium mb-16">ClueMaster TV Display Timer</h1>
      <h2 className="text-2xl mb-4">DEVICE KEY</h2>
      <p className="text-4xl font-bold text-[#4e71cf]">{deviceCode}</p>
      <p className="mt-10 text-xl">{status}</p>
      <p className="mt-6 text-xl text-gray-300">Local IP: {localIP}</p>
      {progressMax > 0 && (
        <div className="w-1/3">
          <div className="h-3 rounded border-2 border-[#4e71cf]">
            <div
              className="h-full bg-[#4e71cf] transition-all duration-300"
              style={{ width: `${(progress / progressMax) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
