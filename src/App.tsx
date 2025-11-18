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

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement, 
  Tooltip, 
  Legend
);

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

  const particles = useRef([]);
  const lastTime = useRef(0);
  const histogramRef = useRef(new Array(18).fill(0));
  const [histogramDisplay, setHistogramDisplay] = useState(new Array(18).fill(0));

  const [simCount, setSimCount] = useState(0);
  const [simGoal, setSimGoal] = useState(10000);
  const [started, setStarted] = useState(false);
  const animationRef = useRef(null);
  const simulationComplete = useRef(false);

  const simulationState = useRef({
    active: false,
    emitting: false,
    processingExisting: false,
    complete: false
  });

  const resetSimulation = () => {
    particles.current = [];
    histogramRef.current = new Array(18).fill(0);
    setHistogramDisplay(new Array(18).fill(0));
    setSimCount(0);
    lastTime.current = 0;
    setStarted(false);
    
    simulationComplete.current = false;
    simulationState.current = {
      active: false,
      emitting: false,
      processingExisting: false,
      complete: false
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const emitParticle = () => {
    if (simCount >= simGoal || !simulationState.current.emitting) {
      return false;
    }
    
    // Focus particles to see more interactions
    const impact = (Math.random() - 0.5) * 10000;
    
    particles.current.push({
      x: -200,
      y: impact,
      vx: alphaEnergy * 0.5 + 60, // Moderate speed
      vy: 0,
      trail: [],
      alive: true,
    });
    setSimCount((c) => c + 1);
    return true;
  };

  const rutherfordTheory = useCallback(() => {
    const totalParticles = Math.max(simCount, 1);
    
    const values = [...Array(18)].map((_, i) => {
      const theta = ((i * 10 - 90) * Math.PI) / 180;
      const thetaRad = Math.abs(theta);
      
      if (thetaRad < 0.01) {
        return totalParticles * 0.9; // Most at very small angles
      }
      
      const sinHalfTheta = Math.sin(thetaRad / 2);
      
      // Avoid division by zero for very small angles
      if (sinHalfTheta < 0.01) {
        return totalParticles * 0.5;
      }
      
      const denom = Math.pow(sinHalfTheta, 4);
      
      // Proper Rutherford cross section
      const crossSection = 1 / denom;
      
      // Normalization for rare large-angle events
      const normalization = totalParticles * 0.00001;
      const count = normalization * crossSection;
      
      return Math.min(count, totalParticles * 0.05);
    });
    
    return values;
  }, [simCount]);  


  const updateHistogramDisplay = useCallback(() => {
    setHistogramDisplay([...histogramRef.current]);
  }, []);

    

  const updatePhysics = (dt) => {
    let histogramUpdated = false;
  
    particles.current.forEach((p) => {
      if (!p.alive) return;
  
      const dx = p.x;
      const dy = p.y;
      const r = Math.sqrt(dx * dx + dy * dy);
  
      if (mode === "rutherford") {
        // STRONG BUT SHORT-RANGE COULOMB FORCE
        if (r > 0.5) {
          // Very strong force but with rapid falloff
          const forceMag = (k * Z * 140) / (r * r); // Strong force
          
          const fx = (forceMag * dx) / r;
          const fy = (forceMag * dy) / r;
          
          // RAPID falloff - force only significant within 15 pixels
          const distanceScaling = Math.pow(Math.max(0, 4 - r) / 4, 5); // Cubic falloff!
          p.vx += fx * dt * distanceScaling * 0.5; // Strong effect but only when very close
          p.vy += fy * dt * distanceScaling * 0.5;
        }
      }
  
      if (mode === "plum") {
        if (r < 100) {
          const fx = (-k * 0.0001 * dx) / 10000;
          const fy = (-k * 0.0001 * dy) / 10000;
          p.vx += fx * dt;
          p.vy += fy * dt;
        }
      }
  
      p.x += p.vx * dt;
      p.y += p.vy * dt;
  
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 50) p.trail.shift();
  
      // Remove particles that go out of bounds
      if (p.x > 350 || Math.abs(p.y) > 350 || p.x < -400) {
        p.alive = false;
        const angle = Math.atan2(p.vy, p.vx);
        const degrees = angle * (180 / Math.PI);
        const bin = Math.min(17, Math.max(0, Math.floor((degrees + 90) / 10)));
        histogramRef.current[bin] += 1;
        histogramUpdated = true;
      }
    });
  
    particles.current = particles.current.filter((p) => p.alive);
    
    if (histogramUpdated && simulationState.current.active) {
      updateHistogramDisplay();
    }
  };


  const draw = useCallback((ctx) => {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, 800, 600);
  
    ctx.save();
    ctx.translate(400 + panX, 300 + panY);
    ctx.scale(zoom, zoom);
  
    // Draw nucleus
    ctx.fillStyle = mode === "rutherford" ? "red" : "purple";
    ctx.beginPath();
    ctx.arc(0, 0, mode === "rutherford" ? 2 : 40, 0, 2 * Math.PI);
    ctx.fill();
  
    // Draw particles
    particles.current.forEach((p) => {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      for (let i = 0; i < p.trail.length - 1; i++) {
        const t1 = p.trail[i];
        const t2 = p.trail[i + 1];
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
      }
      ctx.stroke();
  
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  
    // Remove the force field visualization for now to simplify
    // We can add it back later once the basic physics is working
  
    ctx.restore(); // Only one restore for the one save
  }, [mode, panX, panY, zoom]);

  const animate = useCallback((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (simulationState.current.emitting && time - lastTime.current > 1000 / (beamRate * 60)) {
      const emitted = emitParticle();
      if (emitted) {
        lastTime.current = time;
      } else if (simCount >= simGoal) {
        simulationState.current.emitting = false;
        simulationComplete.current = true;
      }
    }

    if (simulationState.current.active) {
      updatePhysics(0.05);
    }
    
    draw(ctx);
    
    const shouldContinue = simulationState.current.active && 
                          (simulationState.current.emitting || particles.current.length > 0);
    
    if (shouldContinue) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      draw(ctx);
      simulationState.current.active = false;
      setStarted(false);
      animationRef.current = null;
    }
  }, [beamRate, draw, simCount, simGoal]);

  useEffect(() => {
    if (started) {
      simulationComplete.current = false;
      simulationState.current = {
        active: true,
        emitting: true,
        processingExisting: false,
        complete: false
      };
      lastTime.current = performance.now();
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    } else {
      simulationState.current.active = false;
      simulationState.current.emitting = false;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        draw(ctx);
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [started, animate, draw]);

  useEffect(() => {
    if (!started) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        draw(ctx);
      }
    }
  }, [mode, beamRate, alphaEnergy, k, Z, zoom, panX, panY, started, draw]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleStart = () => {
    setStarted(true);
  };

  const handlePause = () => {
    setStarted(false);
  };

  const getYAxisMax = () => {
    const currentMax = Math.max(...histogramDisplay, 10);
    return Math.max(currentMax, simGoal * 0.1);
  };

  const chartData = React.useMemo(() => ({
    labels: [...Array(18)].map((_, i) => `${i * 10 - 90}°`),
    datasets: [
      {
        label: `Observed (${simCount} particles)`,
        data: histogramDisplay,
        backgroundColor: "rgba(0,200,255,0.6)",
        borderColor: "rgba(0,200,255,1)",
        borderWidth: 1,
      },
      {
        label: "Rutherford Theory",
        data: rutherfordTheory(),
        type: "line",
        borderColor: "yellow",
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }), [histogramDisplay, rutherfordTheory, simCount]);

  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    hover: {
      animationDuration: 0
    },
    responsiveAnimationDuration: 0,
    scales: {
      x: {
        type: "category",
        title: {
          display: true,
          text: 'Scattering Angle'
        }
      },
      y: {
        beginAtZero: true,
        max: getYAxisMax(),
        title: {
          display: true,
          text: 'Number of Particles'
        },
        ticks: {
          stepSize: Math.max(1, Math.floor(getYAxisMax() / 10))
        }
      },
    },
    plugins: {
      legend: {
        display: true,
      },
      tooltip: {
        enabled: true,
      },
    },
  }), [histogramDisplay, simGoal]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Advanced Rutherford Scattering Simulator</h1>
        <p className="text-lg max-w-4xl mx-auto">
          <strong>Rutherford's Gold Foil Experiment:</strong> Most alpha particles pass through, 
          but a few scatter at large angles, revealing the atomic nucleus.
        </p>
        <p className="text-sm text-gray-300 mt-1">
          Expected: ~99.99% small angle scattering (&lt;1°), ~0.01% large angle scattering (&gt;90°)
        </p>
      </div>

      {/* Main Content Area - Visualization and Controls Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 max-w-7xl mx-auto">
        {/* Left Column: Visualization */}
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-800 rounded-2xl shadow-xl p-4 flex justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="max-w-full h-auto rounded-lg"
            />
          </div>
          
          {/* Start/Pause Button - Now below visualization */}
          <div className="flex justify-center mt-4">
            {!started ? (
              <button
                onClick={handleStart}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl shadow-lg text-xl font-semibold transition-colors"
              >
                Start Simulation ({simGoal.toLocaleString()} particles)
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-4 rounded-xl shadow-lg text-xl font-semibold transition-colors"
              >
                Pause Simulation
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-gray-800 rounded-2xl shadow-xl p-6 h-full">
            <h2 className="text-xl font-bold mb-4 text-center">Simulation Controls</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Model Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="rutherford">Rutherford (Nuclear Model)</option>
                  <option value="plum">Plum-Pudding (Thomson Model)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nuclear Charge Z: <span className="text-blue-300">{Z}</span>
                  <span className="text-gray-400 ml-2">
                    {Z === 79 ? '(Gold)' : Z === 29 ? '(Copper)' : Z === 13 ? '(Aluminum)' : ''}
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="79"
                  step="1"
                  value={Z}
                  onChange={(e) => setZ(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Alpha Energy: <span className="text-blue-300">{alphaEnergy.toFixed(1)} MeV</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={alphaEnergy}
                  onChange={(e) => setAlphaEnergy(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Coulomb Constant: <span className="text-blue-300">{k.toFixed(3)}</span>
                </label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={k}
                  onChange={(e) => setK(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Beam Rate: <span className="text-blue-300">{beamRate.toFixed(1)} particles/sec</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={beamRate}
                  onChange={(e) => setBeamRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Simulation Goal: <span className="text-blue-300">{simGoal.toLocaleString()} particles</span>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={simGoal}
                  onChange={(e) => setSimGoal(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-xs text-gray-400 mt-1">
                  More particles = better statistics for rare large-angle scattering
                </div>
              </div>

              {/* Progress and Stats */}
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-lg font-semibold mb-2">
                  Progress: {Math.min(simCount, simGoal).toLocaleString()} / {simGoal.toLocaleString()}
                </div>
                <div className="text-sm text-gray-300">
                  Large angle (&gt;90°) count: <span className="text-yellow-300 font-bold">
                    {histogramDisplay[17] + histogramDisplay[0]}
                  </span>
                </div>
                {simCount >= simGoal && (
                  <div className="text-green-400 font-bold mt-2 text-lg">SIMULATION COMPLETE!</div>
                )}
              </div>

              <button
                onClick={resetSimulation}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Reset Simulation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Histogram - Full width below everything */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold mb-4">Scattering Angle Distribution</h2>
          <div className="text-sm text-gray-300 mb-4">
            <strong>Key Observation:</strong> In Rutherford scattering, most particles show minimal deflection (forward peaks), 
            but the few large-angle scatterings reveal the nuclear structure.
          </div>
          <div style={{ height: "400px" }}>
            <Bar
              ref={chartRef}
              data={chartData}
              options={chartOptions}
            />
          </div>
        </div>
      </div>

      {/* Add some custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
      `}</style>
    </div>
  );
}
