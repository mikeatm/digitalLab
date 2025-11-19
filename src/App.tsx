import React, { useRef, useEffect, useState, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

export default function RutherfordDemo() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mode, setMode] = useState("rutherford");
  const [beamRate, setBeamRate] = useState(0.5);
  const [alphaEnergy, setAlphaEnergy] = useState(3.0);
  const [k, setK] = useState(3.0);
  const [Z, setZ] = useState(79);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [simCount, setSimCount] = useState(0);
  const [simGoal, setSimGoal] = useState(5000);
  const [started, setStarted] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(2.0);
  const [showTheory, setShowTheory] = useState(true);
  const impactFlashes = useRef([]);

  const particles = useRef([]);
  const histogramRef = useRef(new Array(18).fill(0));
  const [histogramDisplay, setHistogramDisplay] = useState(new Array(18).fill(0));

  const animationRef = useRef(null);
  const lastTime = useRef(0);
  const lastHistogramUpdate = useRef(0);
  const simulationState = useRef({ active: false, emitting: false });

  const resetSimulation = () => {
    particles.current = [];
    histogramRef.current = new Array(18).fill(0);
    setHistogramDisplay(new Array(18).fill(0));
    setSimCount(0);
    setStarted(false);
    simulationState.current = { active: false, emitting: false };
    impactFlashes.current = [];
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const emitParticle = () => {
    if (simCount >= simGoal || !simulationState.current.emitting) return false;
    const impact = (Math.random() - 0.5) * 3500;
    particles.current.push({
      x: -300 + (Math.random() - 0.5) * 30,
      y: impact,
      vx: alphaEnergy * 8,
      vy: 0,
      trail: [],
      alive: true,
    });
    setSimCount((c) => c + 1);
    return true;
  };

  const rutherfordTheory = useCallback(() => {
    const observedMax = Math.max(...histogramRef.current, 1);
    const theory = [...Array(18)].map((_, i) => {
      const theta = ((i * 10 - 90) * Math.PI) / 180;
      const sinHalf = Math.sin(Math.abs(theta) / 2) || 0.001;
      return 1 / Math.pow(sinHalf, 4);
    });
    const maxT = Math.max(...theory);
    return theory.map((t) => (t / maxT) * observedMax);
  }, [histogramRef.current]);

  const updateHistogramDisplay = useCallback((force = false) => {
    const now = performance.now();
    if (force || now - lastHistogramUpdate.current > 500) {
      setHistogramDisplay([...histogramRef.current]);
      lastHistogramUpdate.current = now;
    }
  }, []);

  const updatePhysics = (dt) => {
    const adjustedDt = dt * timeSpeed;
    let histogramUpdated = false;
    particles.current.forEach((p) => {
      if (!p.alive) return;
      const dx = p.x;
      const dy = p.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (mode === "rutherford" && r > 0.2) {
        const forceMag = (k * Z * 600) / (r * r + 100);
        const fx = (forceMag * dx) / r;
        const fy = (forceMag * dy) / r;
        const scaling = Math.pow(Math.max(0, 6 - r) / 2, 4);
        p.vx += fx * adjustedDt * scaling;
        p.vy += fy * adjustedDt * scaling;
      } else if (mode === "plum") {
        const fx = (-k * dx) / 30000;
        const fy = (-k * dy) / 30000;
        p.vx += fx * adjustedDt;
        p.vy += fy * adjustedDt;
      }
      p.x += p.vx * adjustedDt;
      p.y += p.vy * adjustedDt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 50) p.trail.shift();
      if (p.x > 350 || Math.abs(p.y) > 350) {
        p.alive = false;
        const deg = (Math.atan2(p.vy, p.vx) * 180) / Math.PI;
        const bin = Math.min(17, Math.max(0, Math.floor((deg + 90) / 10)));
        histogramRef.current[bin]++;
        histogramUpdated = true;
        
        // Only create flash for significantly deflected particles (not straight through)
        const deflectionAngle = Math.abs(deg);
        if (deflectionAngle > 10) { // Deflected more than 10 degrees
          impactFlashes.current.push({
            x: p.x + 400,
            y: p.y + 300,
            intensity: (Z / 79) * (deflectionAngle / 180), // Scale by both Z and deflection angle
            life: 1.0
          });
        }
      }
    });
    particles.current = particles.current.filter((p) => p.alive);
    
    // Update flashes
    impactFlashes.current = impactFlashes.current.filter(flash => {
      flash.life *= 0.85;
      return flash.life > 0.01;
    });
    
    if (histogramUpdated) updateHistogramDisplay();
  };

  const draw = useCallback(
    (ctx) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, 800, 600);
      
      // Impact flashes - drawn first, in canvas coordinates
      impactFlashes.current.forEach(flash => {
        ctx.save();
        const flashGrad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, 80);
        flashGrad.addColorStop(0, `rgba(0, 255, 100, ${flash.life * flash.intensity * 0.8})`);
        flashGrad.addColorStop(0.5, `rgba(0, 255, 100, ${flash.life * flash.intensity * 0.3})`);
        flashGrad.addColorStop(1, 'rgba(0, 255, 100, 0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(flash.x - 80, flash.y - 80, 160, 160);
        ctx.restore();
      });
      
      ctx.save();
      ctx.translate(400 + panX, 300 + panY);
      ctx.scale(zoom, zoom);
      
      // Nucleus with enhanced glow
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.5, "rgba(255,100,100,0.6)");
      grad.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-12, -12, 24, 24);
      
      // Particles
      particles.current.forEach((p) => {
        ctx.strokeStyle = "rgba(0,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < p.trail.length - 1; i++) {
          const t1 = p.trail[i];
          const t2 = p.trail[i + 1];
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
        }
        ctx.stroke();
        ctx.fillStyle = "cyan";
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    },
    [zoom, panX, panY]
  );

  const animate = useCallback(
    (time) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      if (simulationState.current.emitting && time - lastTime.current > 1000 / (beamRate * 60)) {
        if (emitParticle()) lastTime.current = time;
        else simulationState.current.emitting = false;
      }
      if (simulationState.current.active) updatePhysics(0.05);
      draw(ctx);
      if (simulationState.current.active && (simulationState.current.emitting || particles.current.length > 0))
        animationRef.current = requestAnimationFrame(animate);
      else simulationState.current.active = false;
    },
    [beamRate, draw]
  );

  useEffect(() => {
    if (started) {
      simulationState.current = { active: true, emitting: true };
      lastTime.current = performance.now();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, [started, animate]);

  const largeAngleHits = histogramDisplay[0] + histogramDisplay[17];

  const chartData = React.useMemo(
    () => {
      const datasets = [
        { label: "Observed", data: histogramDisplay, backgroundColor: "rgba(0,200,255,0.6)" }
      ];
      
      if (showTheory) {
        datasets.push({
          label: "Rutherford Theory",
          data: rutherfordTheory(),
          type: "line",
          borderColor: "yellow",
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
        });
      }
      
      return {
        labels: [...Array(18)].map((_, i) => `${i * 10 - 90}°`),
        datasets: datasets,
      };
    },
    [histogramDisplay, rutherfordTheory, showTheory]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Rutherford Scattering Simulator
          </h1>
          <p className="text-gray-300 text-sm">Interactive visualization of alpha particle scattering</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 mb-8">
          <div className="flex flex-col w-full">
            <div
              className={`rounded-2xl p-4 border-2 transition-all duration-500 bg-black/40 backdrop-blur-sm ${
                started
                  ? "border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.6)] animate-pulse"
                  : "border-slate-600/50 shadow-[0_0_20px_rgba(100,116,139,0.3)]"
              }`}
            >
              <canvas ref={canvasRef} width={800} height={600} className="rounded-lg w-full h-auto" />
            </div>

            <div className="flex gap-4 mt-6 justify-center">
              {!started ? (
                <button
                  onClick={() => setStarted(true)}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-emerald-500/50 transition-all transform hover:scale-105"
                >
                  ▶ Start Simulation
                </button>
              ) : (
                <button
                  onClick={() => setStarted(false)}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-amber-500/50 transition-all transform hover:scale-105"
                >
                  ⏸ Pause
                </button>
              )}
              <button
                onClick={resetSimulation}
                className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-rose-500/50 transition-all transform hover:scale-105"
              >
                ↻ Reset
              </button>
            </div>

            <div className="mt-4 text-center">
              <div className="inline-block bg-slate-800/60 backdrop-blur-sm rounded-xl px-6 py-3 border border-slate-700/50">
                <div className="text-amber-400 font-mono text-sm mb-1">Large-angle scattering</div>
                <div className="text-3xl font-bold text-cyan-400">{largeAngleHits}</div>
                <div className="text-xs text-gray-400 mt-1">particles deflected &gt;90°</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-2xl h-fit">
            <h2 className="text-xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Simulation Controls
            </h2>

            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="block text-xs font-semibold text-cyan-400 mb-2">Atomic Model</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full p-2 text-sm bg-slate-700 rounded-lg border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                >
                  <option value="rutherford">⚛️ Rutherford (Nuclear)</option>
                  <option value="plum">🍮 Plum-Pudding</option>
                </select>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="block text-xs font-semibold text-cyan-400 mb-2">
                  Nuclear Charge (Z): <span className="text-white font-mono">{Z}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="79"
                  value={Z}
                  onChange={(e) => setZ(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="text-[10px] text-gray-400 mt-1">1 (Hydrogen) → 79 (Gold)</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="block text-xs font-semibold text-cyan-400 mb-2">
                  Alpha Energy: <span className="text-white font-mono">{alphaEnergy.toFixed(1)} MeV</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={alphaEnergy}
                  onChange={(e) => setAlphaEnergy(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="text-[10px] text-gray-400 mt-1">Particle kinetic energy</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="block text-xs font-semibold text-cyan-400 mb-2">
                  Beam Intensity: <span className="text-white font-mono">{beamRate.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={beamRate}
                  onChange={(e) => setBeamRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="text-[10px] text-gray-400 mt-1">Particles per second</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="block text-xs font-semibold text-cyan-400 mb-2">
                  Time Speed: <span className="text-white font-mono">{timeSpeed.toFixed(2)}×</span>
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={timeSpeed}
                  onChange={(e) => setTimeSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="text-[10px] text-gray-400 mt-1">Simulation speed multiplier</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-cyan-400">Show Theory Line</span>
                  <input
                    type="checkbox"
                    checked={showTheory}
                    onChange={(e) => setShowTheory(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-2 focus:ring-cyan-500/50"
                  />
                </label>
                <div className="text-[10px] text-gray-400 mt-1">Toggle Rutherford prediction</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-cyan-400 font-semibold">Progress</span>
                  <span className="text-white font-mono text-[11px]">
                    {simCount}/{simGoal}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(simCount / simGoal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Scattering Angle Distribution
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Yellow line shows Rutherford's theoretical prediction: dσ/dΩ ∝ 1/sin⁴(θ/2)
          </p>
          <div style={{ height: "400px" }}>
            <Bar
              ref={chartRef}
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                  x: {
                    type: "category",
                    grid: { color: "rgba(100,116,139,0.2)" },
                    ticks: { color: "#94a3b8" },
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(100,116,139,0.2)" },
                    ticks: { color: "#94a3b8" },
                  },
                },
                plugins: {
                  legend: {
                    labels: { color: "#e2e8f0", font: { size: 14 } },
                  },
                  tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    titleColor: "#22d3ee",
                    bodyColor: "#e2e8f0",
                    borderColor: "#334155",
                    borderWidth: 1,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
