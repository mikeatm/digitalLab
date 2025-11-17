import React, { useRef, useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

// ✔ FIX: Ensure ALL required scales + elements are registered BEFORE any component renders
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function RutherfordDemo() {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("rutherford");
  const [beamRate, setBeamRate] = useState(0.5);
  const [alphaEnergy, setAlphaEnergy] = useState(1.2);
  const [k, setK] = useState(1.0);
  const [Z, setZ] = useState(1.0);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const particles = useRef([]);
  const lastTime = useRef(0);
  const histogram = useRef(new Array(18).fill(0));

  // NEW: Track simulation progress
  const [simCount, setSimCount] = useState(0);
  const [simGoal, setSimGoal] = useState(500); // adjustable goal

  const resetSimulation = () => {
    particles.current = [];
    histogram.current = new Array(18).fill(0);
    setSimCount(0);
    lastTime.current = 0;
  };

  const emitParticle = () => {
    if (simCount >= simGoal) return;
    const impact = (Math.random() - 0.5) * 300;
    particles.current.push({
      x: -200,
      y: impact,
      vx: alphaEnergy * 2 + 1,
      vy: 0,
      trail: [],
      alive: true,
    });
    setSimCount((c) => c + 1);
  };

  const updatePhysics = (dt) => {
    particles.current.forEach((p) => {
      if (!p.alive) return;

      const dx = p.x;
      const dy = p.y;
      const r = Math.sqrt(dx * dx + dy * dy) + 0.001;

      if (mode === "rutherford") {
        const forceMag = (k * Z) / (r * r);
        const fx = (forceMag * dx) / r;
        const fy = (forceMag * dy) / r;
        p.vx += fx * dt;
        p.vy += fy * dt;
      }

      if (mode === "plum") {
        const fx = (k * dx) / 80000;
        const fy = (k * dy) / 80000;
        p.vx += fx * dt;
        p.vy += fy * dt;
      }

      p.x += p.vx;
      p.y += p.vy;

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 50) p.trail.shift();

      if (p.x > 350 || Math.abs(p.y) > 350) {
        p.alive = false;
        const angle = Math.atan2(p.vy, p.vx);
        const bin = Math.min(17, Math.max(0, Math.floor((angle + 0.9) / 0.1)));
        histogram.current[bin] += 1;
      }
    });

    particles.current = particles.current.filter((p) => p.alive);
  };

  const draw = (ctx) => {
    ctx.clearRect(0, 0, 800, 600);

    ctx.save();
    ctx.translate(400 + panX, 300 + panY);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = mode === "rutherford" ? "red" : "purple";
    ctx.beginPath();
    ctx.arc(0, 0, mode === "rutherford" ? 12 : 40, 0, 2 * Math.PI);
    ctx.fill();

    particles.current.forEach((p) => {
      ctx.strokeStyle = "#999";
      ctx.beginPath();
      for (let i = 0; i < p.trail.length - 1; i++) {
        const t1 = p.trail[i];
        const t2 = p.trail[i + 1];
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
      }
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    ctx.restore();
  };

  const animate = (time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (simCount < simGoal && time - lastTime.current > 1000 / (beamRate * 60)) {
      emitParticle();
      lastTime.current = time;
    }

    updatePhysics(0.05);
    draw(ctx);
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestAnimationFrame(animate);
  }, [mode, beamRate, alphaEnergy, k, Z, zoom, panX, panY, simGoal]);

  return (
    <div className="flex flex-col items-center text-white gap-6 p-6 w-full">
      <h1 className="text-3xl font-bold">Advanced Rutherford Scattering Simulator</h1>

      {/* NEW LAYOUT: Controls placed beside visualization */}
      <div className="flex flex-row w-full max-w-6xl gap-6">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="bg-gray-900 rounded-2xl shadow-xl"
        />

        <div className="flex flex-col gap-4 bg-gray-800 p-4 rounded-xl w-80">
          <div>
            <label>Model Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded"
            >
              <option value="rutherford">Rutherford (Correct)</option>
              <option value="plum">Plum-Pudding (Incorrect)</option>
            </select>
          </div>

          <div>
            <label>Nuclear Charge Z</label>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={Z}
              onChange={(e) => setZ(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label>Beam Rate</label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={beamRate}
              onChange={(e) => setBeamRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label>Simulation Goal: {simGoal} particles</label>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={simGoal}
              onChange={(e) => setSimGoal(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="p-2 bg-gray-700 rounded text-center">
            Simulation Progress: {simCount} / {simGoal}
          </div>

          <button
            onClick={resetSimulation}
            className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Reset Simulation
          </button>
        </div>
      </div>

      {/* HISTOGRAM BELOW */}
      <div className="bg-gray-800 p-4 rounded-xl w-full max-w-4xl">
        <h2 className="text-xl mb-2">Scattering-Angle Histogram</h2>
        <div style={{ height: "300px" }}>
          <Bar
            data={{
              labels: [...Array(18)].map((_, i) => `${i * 10 - 90}°`),
              datasets: [
                {
                  label: "Counts",
                  data: histogram.current,
                  backgroundColor: "rgba(0,200,255,0.6)",
                  borderColor: "rgba(0,200,255,1)",
                  borderWidth: 1,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: "category",
                },
                y: {
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

