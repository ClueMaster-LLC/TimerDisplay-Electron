import React from "react";

export default function StartupMessage({ mode = "splash" }) {
  const animationClass = mode === "splash" ? "fade-in-stay" : "fade-out";

  return (
    <>
      <div className={`fixed top-10 w-full text-center z-50 pointer-events-none ${animationClass}`}>
        <p className="text-3xl text-gray-300">
          Press F11 to exit full screen mode
        </p>
      </div>
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes stayThenFadeOut {
          0% { opacity: 1; }
          71.43% { opacity: 1; }
          100% { opacity: 0; }
        }
        .fade-in-stay {
          animation: fadeIn 1s ease-in forwards;
        }
        .fade-out {
          opacity: 1;
          animation: stayThenFadeOut 7s ease-out forwards;
        }
      `}</style>
    </>
  );
}
