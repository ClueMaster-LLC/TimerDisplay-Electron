import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { initializeStoreSync, cleanupStoreSync } from "./state/store";
import Splash from "./screens/splash";
import Authentication from "./screens/authentication";
import Loading from "./screens/loading";
import Player from "./screens/player";

export default function main() {
  useEffect(() => {
    initializeStoreSync();
    return () => {
      cleanupStoreSync();
    };
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/authentication" element={<Authentication />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/player" element={<Player />} />
      </Routes>
    </HashRouter>
  );
}
