import React, { useEffect, useRef, useState } from "react";

export default function HeartRateFitStyle() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [bpm, setBpm] = useState(null);
  const [status, setStatus] = useState("Coloca tu dedo sobre la cámara y presiona Iniciar");
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [error, setError] = useState(null);
  const [torchWarning, setTorchWarning] = useState(false);

  useEffect(() => {
    let stream;
    async function initCamera() {
      try {
        const constraints = {
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
            advanced: [{ torch: true }]
          }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Torch no disponible o cámara trasera no accesible:", e);
        setTorchWarning(true);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err) {
          console.error("No se pudo acceder a ninguna cámara:", err);
          setError("No se pudo acceder a la cámara. Verifica los permisos y que estés en HTTPS.");
          setIsMeasuring(false);
          return;
        }
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStatus("Midiendo... mantén el dedo sobre la cámara");
    }

    if (isMeasuring) {
      initCamera();
    }

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMeasuring]);

  useEffect(() => {
    let interval;
    const reds = [];
    if (isMeasuring) {
      interval = setInterval(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const redValues = [];
        for (let i = 0; i < frame.data.length; i += 4) {
          redValues.push(frame.data[i]);
        }

        const avgRed = redValues.reduce((a, b) => a + b, 0) / redValues.length;
        reds.push(avgRed);
        if (reds.length > 100) reds.shift();

        if (reds.length === 100) {
          let peaks = 0;
          for (let i = 1; i < reds.length - 1; i++) {
            if (reds[i] > reds[i - 1] && reds[i] > reds[i + 1]) peaks++;
          }
          const bpmEstimate = (peaks * 60) / 10;
          setBpm(Math.round(bpmEstimate));
          setStatus("Medición completa ✅");
          setPulsing(false);
          setIsMeasuring(false);
        } else {
          setPulsing(p => !p);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isMeasuring]);

  return (
    <div className="p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4 text-center">Medición de Ritmo Cardíaco</h2>

      <div className="relative w-32 h-32 mb-4">
        <div
          className={`w-32 h-32 rounded-full border-8 transition-all duration-500 ${pulsing ? 'border-red-500' : 'border-red-300'}`}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <p className="text-sm text-center">{status}</p>
        </div>
      </div>

      {torchWarning && (
        <div className="text-yellow-600 text-center mb-2 max-w-xs">
          🔦 Tu dispositivo no permite activar el flash automáticamente. Por favor, enciéndelo manualmente antes de comenzar.
        </div>
      )}

      {error && (
        <div className="text-red-600 text-center mb-4 max-w-xs">
          <p>{error}</p>
        </div>
      )}

      <button
        onClick={() => {
          setBpm(null);
          setError(null);
          setTorchWarning(false);
          setIsMeasuring(true);
          setStatus("Coloca tu dedo sobre la cámara");
        }}
        disabled={isMeasuring}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isMeasuring ? "Midiendo..." : "Iniciar Medición"}
      </button>

      {bpm && (
        <div className="mt-6 text-center">
          <p className="text-xl">Frecuencia Cardíaca Estimada:</p>
          <p className="text-4xl font-bold text-red-600">{bpm} BPM</p>
        </div>
      )}

      <video ref={videoRef} className="hidden" width="300" height="200" />
      <canvas ref={canvasRef} className="hidden" width="300" height="200" />
    </div>
  );
}