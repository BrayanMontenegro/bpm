import React, { useEffect, useRef, useState } from "react";

export default function HeartRateMonitor() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [bpm, setBpm] = useState(null);
  const [dataPoints, setDataPoints] = useState([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [status, setStatus] = useState("Coloca tu dedo sobre la cámara y presiona Iniciar");
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream;
    async function initCamera() {
      try {
        const constraints = {
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("Cámara trasera no disponible, usando cámara por defecto");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (finalErr) {
          setError("No se pudo acceder a la cámara. Verifica permisos y HTTPS.");
          setIsMeasuring(false);
          return;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStatus("Midiendo... mantén el dedo sobre la cámara");
      }
    }

    if (isMeasuring) {
      initCamera();
    }

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMeasuring]);

  useEffect(() => {
    let interval;
    if (isMeasuring) {
      interval = setInterval(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const reds = [];
        for (let i = 0; i < frame.data.length; i += 4) {
          reds.push(frame.data[i]);
        }

        const avgRed = reds.reduce((a, b) => a + b, 0) / reds.length;
        setDataPoints((prev) => [...prev.slice(-100), avgRed]);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isMeasuring]);

  useEffect(() => {
    if (dataPoints.length >= 100) {
      let peaks = 0;
      for (let i = 1; i < dataPoints.length - 1; i++) {
        if (dataPoints[i] > dataPoints[i - 1] && dataPoints[i] > dataPoints[i + 1]) {
          peaks++;
        }
      }
      const bpmEstimate = (peaks * 60) / 10; // Aproximado para 10 segundos
      setBpm(Math.round(bpmEstimate));
      setStatus("Medición completa ✅");
      setIsMeasuring(false);
    }
  }, [dataPoints]);

  return (
    <div className="p-4 text-center">
      <h1 className="text-xl font-bold mb-2">Medidor de Frecuencia Cardíaca</h1>
      <video ref={videoRef} width="300" height="200" className="hidden" />
      <canvas ref={canvasRef} width="300" height="200" className="hidden" />

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <p className="mb-4">{status}</p>

      <button
        onClick={() => {
          setBpm(null);
          setDataPoints([]);
          setError(null);
          setIsMeasuring(true);
          setStatus("Coloca tu dedo sobre la cámara");
        }}
        disabled={isMeasuring}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isMeasuring ? "Midiendo..." : "Iniciar Medición"}
      </button>

      {bpm && (
        <div className="mt-4">
          <p className="text-lg">BPM estimado:</p>
          <p className="text-4xl font-bold text-red-600">{bpm}</p>
        </div>
      )}
    </div>
  );
}