// Componente mejorado sin flash por defecto, con opción para encenderlo manualmente, e incluye señal captada con chart.js
import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

export default function HeartRateMonitor() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [bpm, setBpm] = useState(null);
  const [dataPoints, setDataPoints] = useState([]);
  const [centeredPoints, setCenteredPoints] = useState([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [status, setStatus] = useState("Coloca tu dedo sobre la cámara y presiona Iniciar");
  const [error, setError] = useState(null);
  const [useTorch, setUseTorch] = useState(false);

  const SAMPLE_DURATION = 450;
  const PEAK_THRESHOLD = 1;
  const OFFSET = 30;

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

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (useTorch && capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
        }
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
  }, [isMeasuring, useTorch]);

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
        setDataPoints((prev) => {
          const updated = [...prev.slice(-SAMPLE_DURATION + 1), avgRed];
          const media = updated.reduce((a, b) => a + b, 0) / updated.length;
          const centrado = updated.map(v => v - media);
          setCenteredPoints(centrado);
          return updated;
        });
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isMeasuring]);

  useEffect(() => {
    if (centeredPoints.length >= SAMPLE_DURATION) {
      const smoothed = centeredPoints.map((val, i, arr) => {
        if (i === 0 || i === arr.length - 1) return val;
        return (arr[i - 1] + val + arr[i + 1]) / 3;
      });

      const trimmed = smoothed.slice(OFFSET);
      const min = Math.min(...trimmed);
      const max = Math.max(...trimmed);

      if (max - min < 2) {
        setStatus("No se detecta señal válida. Ajusta tu dedo o prueba de nuevo.");
        setIsMeasuring(false);
        return;
      }

      let peaks = 0;
      for (let i = 1; i < trimmed.length - 1; i++) {
        if (
          trimmed[i] > trimmed[i - 1] &&
          trimmed[i] > trimmed[i + 1] &&
          (trimmed[i] - trimmed[i - 1]) > PEAK_THRESHOLD &&
          (trimmed[i] - trimmed[i + 1]) > PEAK_THRESHOLD
        ) {
          peaks++;
        }
      }

      const durationInSeconds = SAMPLE_DURATION * 0.033;
      const bpmEstimate = (peaks * 60) / durationInSeconds;
      setBpm(Math.round(bpmEstimate));
      setStatus("Medición completa ✅");
      setIsMeasuring(false);
    }
  }, [centeredPoints]);

  const chartData = {
    labels: centeredPoints.map((_, i) => i),
    datasets: [
      {
        label: "Señal captada",
        data: centeredPoints,
        fill: false,
        borderColor: "#f43f5e",
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-xl font-bold mb-2">Medidor de Frecuencia Cardíaca</h1>
      <video ref={videoRef} width="300" height="200" className="hidden" />
      <canvas ref={canvasRef} width="300" height="200" className="hidden" />

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <p className="mb-4">{status}</p>

      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => {
            setBpm(null);
            setDataPoints([]);
            setCenteredPoints([]);
            setError(null);
            setIsMeasuring(true);
            setStatus("Coloca tu dedo sobre la cámara");
          }}
          disabled={isMeasuring}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isMeasuring ? "Midiendo..." : "Iniciar Medición"}
        </button>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useTorch}
            onChange={() => setUseTorch(!useTorch)}
            disabled={isMeasuring}
          />
          Activar Flash
        </label>
      </div>

      {bpm !== null && (
        <div className="mt-4">
          <p className="text-lg">BPM estimado:</p>
          <p className="text-4xl font-bold text-red-600">{bpm}</p>
        </div>
      )}

      {centeredPoints.length > 10 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Señal captada</h2>
          <Line data={chartData} options={{ responsive: true, scales: { x: { display: false }, y: { beginAtZero: false } } }} />
        </div>
      )}
    </div>
  );
}