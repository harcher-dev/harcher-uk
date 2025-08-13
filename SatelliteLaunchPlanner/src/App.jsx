import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Rocket, Satellite, Sparkles, TrendingUp, ChevronRight, Printer, RefreshCw, Calendar, DollarSign, Compass, Gauge, MapPin, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

/**
 * Satellite Launch Planner — Liquid Glass UI
 * Single-file React app with glassmorphism, animations, and decision logic.
 * TailwindCSS required in the host environment.
 */

// ---------------------- Utility & Types ----------------------
const fmtUSD = (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const ORBITS = [
  { key: "LEO", name: "LEO (Low Earth Orbit)", defaultAlt: 550, range: [200, 2000], typicalInc: [0, 98], notes: "Great for Earth observation and comms. Lower radiation, frequent launch windows." },
  { key: "SSO", name: "SSO (Sun-Synchronous)", defaultAlt: 525, range: [450, 800], typicalInc: [96, 99], notes: "Sun-synchronous for consistent local time imaging passes." },
  { key: "MEO", name: "MEO (Medium Earth Orbit)", defaultAlt: 20000, range: [2000, 35000], typicalInc: [0, 65], notes: "Navigation constellations and some comms." },
  { key: "GTO", name: "GTO (Geostationary Transfer)", defaultAlt: 35786, range: [250, 35786], typicalInc: [0, 28], notes: "Transfer to GEO using onboard propulsion or kick stage." },
  { key: "GEO", name: "GEO (Geostationary)", defaultAlt: 35786, range: [35786, 35786], typicalInc: [0, 5], notes: "Continuous coverage of a region; high latency, high Δv to reach." },
  { key: "HEO", name: "HEO (Molniya/Tundra)", defaultAlt: 40000, range: [1000, 50000], typicalInc: [63, 63.5], notes: "Highly-elliptical for high-latitude dwell time." },
];

// Provider capabilities (indicative, simplified). Capacities are conservative approximations.
// All prices are rough ballparks for planning and comparison only.
const PROVIDERS = [
  {
    name: "SpaceX Falcon 9",
    id: "falcon9",
    reliability: 0.99,
    dedicatedBaseUSD: 65000000,
    rideshareUSDkg: 5500,
    leadMonths: 6,
    sites: ["CCSFS SLC-40 (FL)", "KSC LC-39A (FL)", "VAFB SLC-4E (CA)"],
    capacities: { LEO: 22800, SSO: 16000, MEO: 8000, GTO: 8300, GEO: 3500, HEO: 4000 },
  },
  {
    name: "Rocket Lab Electron",
    id: "electron",
    reliability: 0.93,
    dedicatedBaseUSD: 7500000,
    rideshareUSDkg: 25000,
    leadMonths: 5,
    sites: ["Māhia LC-1 (NZ)", "VAFB LC-2 (CA)", "Wallops LC-2 (VA)"],
    capacities: { LEO: 300, SSO: 200, MEO: 50, GTO: 50, GEO: 0, HEO: 80 },
  },
  {
    name: "Rocket Lab Neutron",
    id: "neutron",
    reliability: 0.90,
    dedicatedBaseUSD: 50000000,
    rideshareUSDkg: 12000,
    leadMonths: 9,
    sites: ["MARS Pad-0A (VA)"],
    capacities: { LEO: 13000, SSO: 8000, MEO: 4000, GTO: 6000, GEO: 2000, HEO: 2500 },
  },
  {
    name: "Arianespace Ariane 6",
    id: "ariane6",
    reliability: 0.98,
    dedicatedBaseUSD: 90000000,
    rideshareUSDkg: 14000,
    leadMonths: 9,
    sites: ["CSG ELA-4 (GUF)"],
    capacities: { LEO: 21000, SSO: 15000, MEO: 8000, GTO: 10000, GEO: 4500, HEO: 5000 },
  },
  {
    name: "ISRO PSLV",
    id: "pslv",
    reliability: 0.95,
    dedicatedBaseUSD: 30000000,
    rideshareUSDkg: 18000,
    leadMonths: 8,
    sites: ["Satish Dhawan (IND)"],
    capacities: { LEO: 3800, SSO: 1600, MEO: 800, GTO: 1300, GEO: 0, HEO: 700 },
  },
  {
    name: "ULA Vulcan",
    id: "vulcan",
    reliability: 0.98,
    dedicatedBaseUSD: 110000000,
    rideshareUSDkg: 15000,
    leadMonths: 10,
    sites: ["CCSFS SLC-41 (FL)"],
    capacities: { LEO: 27000, SSO: 18000, MEO: 9000, GTO: 14000, GEO: 6000, HEO: 6000 },
  },
  {
    name: "Firefly Alpha",
    id: "alpha",
    reliability: 0.85,
    dedicatedBaseUSD: 15000000,
    rideshareUSDkg: 18000,
    leadMonths: 7,
    sites: ["VAFB SLC-2 (CA)", "CCSFS SLC-20 (FL)"],
    capacities: { LEO: 1170, SSO: 740, MEO: 200, GTO: 300, GEO: 0, HEO: 250 },
  },
  {
    name: "Blue Origin New Glenn",
    id: "newglenn",
    reliability: 0.90,
    dedicatedBaseUSD: 85000000,
    rideshareUSDkg: 13000,
    leadMonths: 10,
    sites: ["CCSFS LC-36 (FL)"],
    capacities: { LEO: 45000, SSO: 25000, MEO: 12000, GTO: 13000, GEO: 6000, HEO: 7000 },
  },
];

// ---------------------- Scoring Logic ----------------------
function estimateCost(provider, kg, mode) {
  if (mode === "rideshare") return Math.max(kg * provider.rideshareUSDkg, Math.min(provider.dedicatedBaseUSD * 0.15, kg * provider.rideshareUSDkg * 1.2));
  // Dedicated: scale with payload fraction to discourage under-filling heavy rockets
  const fill = clamp(kg / (provider.capacities.LEO || kg), 0.1, 1);
  const scaler = 0.6 + 0.6 * fill; // 0.6x to 1.2x
  return Math.round(provider.dedicatedBaseUSD * scaler);
}

function capacityForOrbit(provider, orbitKey) {
  return provider.capacities[orbitKey] || 0;
}

function feasible(provider, kg, orbitKey) {
  const cap = capacityForOrbit(provider, orbitKey);
  return cap >= kg * 1.05; // 5% margin
}

function scoreProvider(provider, inputs) {
  const { payloadKg, orbitKey, budgetUSD, mode, netMonths, risk } = inputs;
  if (!feasible(provider, payloadKg, orbitKey)) return -Infinity;

  const cost = estimateCost(provider, payloadKg, mode);
  const costScore = 1 - clamp((cost - budgetUSD) / (budgetUSD * 0.75), 0, 1); // <= budget → 1, 75% over → 0

  const relScore = provider.reliability * (1 - 0.3 * risk); // high risk tolerance reduces weight of reliability

  const schedScore = 1 - clamp((provider.leadMonths - netMonths) / 12, 0, 1); // meeting schedule → 1; 12+ months late → 0

  const fit = payloadKg / capacityForOrbit(provider, orbitKey); // closer to 0.6–0.9 is ideal
  const fillPenalty = Math.abs(0.75 - fit); // penalize under/over-fill
  const fitScore = clamp(1 - fillPenalty * 1.2, 0, 1);

  const total = 0.38 * costScore + 0.28 * relScore + 0.18 * schedScore + 0.16 * fitScore;
  return total;
}

// Generate a minimal orbit blueprint based on inputs
function makeOrbitDetails(orbitKey, altitudeKm, inclinationDeg) {
  const o = ORBITS.find((o) => o.key === orbitKey);
  const a = clamp(altitudeKm, o.range[0], o.range[1]);
  const inc = clamp(inclinationDeg, o.typicalInc[0], o.typicalInc[1]);
  // very rough period calc for circular-ish LEO/SSO; fallback for others
  const mu = 398600.4418; // km^3/s^2
  const Re = 6378.137; // km
  const r = Re + a;
  const T = 2 * Math.PI * Math.sqrt((r * r * r) / mu); // seconds
  const periodMin = orbitKey === "LEO" || orbitKey === "SSO" ? Math.round(T / 60) : undefined;
  return {
    name: o.name,
    altitudeKm: a,
    inclinationDeg: inc,
    periodMin,
    notes: o.notes,
  };
}

// ---------------------- UI Components ----------------------
const GlassCard = ({ className = "", children }) => (
  <div className={`rounded-3xl p-5 md:p-6 bg-white/10 backdrop-blur-2xl border border-white/15 shadow-xl ${className}`}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <label className="block text-xs uppercase tracking-wide text-white/80 mb-2">{children}</label>
);

const Slider = ({ value, min, max, step = 1, onChange }) => (
  <input
    type="range"
    className="w-full accent-white/80"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(e) => onChange(Number(e.target.value))}
  />
);

const Toggle = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-full bg-white/10 p-1 border border-white/15">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 md:px-4 py-1.5 rounded-full text-sm transition ${
          value === opt.value
            ? "bg-white/90 text-slate-900 shadow"
            : "text-white/80 hover:bg-white/20"
        }`}
        aria-pressed={value === opt.value}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

function OrbitBadge({ orbitKey }) {
  const m = {
    LEO: "bg-emerald-400/20 text-emerald-100",
    SSO: "bg-cyan-400/20 text-cyan-100",
    MEO: "bg-indigo-400/20 text-indigo-100",
    GTO: "bg-fuchsia-400/20 text-fuchsia-100",
    GEO: "bg-amber-400/20 text-amber-100",
    HEO: "bg-rose-400/20 text-rose-100",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full border border-white/15 ${m[orbitKey]}`}>{orbitKey}</span>
  );
}

// Simple orbit sketch (not to scale)
function OrbitSketch({ altitudeKm = 550, orbitKey = "LEO", inclinationDeg = 97 }) {
  const size = 220;
  const center = size / 2;
  const Re = 40; // earth radius in px
  const r = 50 + Math.log10(altitudeKm + 10) * 18; // fake radial mapping
  const incTilt = (inclinationDeg / 180) * Math.PI;
  return (
    <svg width={size} height={size} className="block">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
        </radialGradient>
      </defs>
      <circle cx={center} cy={center} r={Re} fill="url(#g)" />
      <ellipse
        cx={center}
        cy={center}
        rx={r}
        ry={Math.max(20, r * Math.cos(incTilt))}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
      />
      <circle cx={center + r} cy={center} r={3} fill="white" />
    </svg>
  );
}

// ---------------------- Main Component ----------------------
export default function SatelliteLaunchPlanner() {
  const [mission, setMission] = useState("Aurora-1");
  const [payloadKg, setPayloadKg] = useState(120);
  const [orbitKey, setOrbitKey] = useState("SSO");
  const [altitudeKm, setAltitudeKm] = useState(525);
  const [inclination, setInclination] = useState(97);
  const [mode, setMode] = useState("rideshare");
  const [budgetUSD, setBudgetUSD] = useState(6000000);
  const [netMonths, setNetMonths] = useState(7);
  const [risk, setRisk] = useState(0.3); // 0 (risk averse) → 1 (risk seeking)

  const orbit = useMemo(() => makeOrbitDetails(orbitKey, altitudeKm, inclination), [orbitKey, altitudeKm, inclination]);

  const ranked = useMemo(() => {
    const scored = PROVIDERS.map((p) => ({
      provider: p,
      cost: estimateCost(p, payloadKg, mode),
      cap: capacityForOrbit(p, orbitKey),
      score: scoreProvider(p, { payloadKg, orbitKey, budgetUSD, mode, netMonths, risk }),
    }))
      .filter((x) => x.score !== -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return scored;
  }, [payloadKg, orbitKey, budgetUSD, mode, netMonths, risk]);

  const totalCostRange = useMemo(() => {
    if (!ranked.length) return [0, 0];
    const vals = ranked.map((r) => r.cost);
    return [Math.min(...vals), Math.max(...vals)];
  }, [ranked]);

  function reset() {
    setMission("Aurora-1");
    setPayloadKg(120);
    setOrbitKey("SSO");
    setAltitudeKm(525);
    setInclination(97);
    setMode("rideshare");
    setBudgetUSD(6000000);
    setNetMonths(7);
    setRisk(0.3);
  }

  function exportPlan(rec) {
    const data = {
      generatedAt: new Date().toISOString(),
      mission,
      payloadKg,
      orbit,
      mode,
      budgetUSD,
      netMonths,
      recommendation: {
        provider: rec.provider.name,
        sites: rec.provider.sites,
        estimatedCostUSD: rec.cost,
        capacityToOrbitKg: rec.cap,
        reliability: rec.provider.reliability,
        leadMonths: rec.provider.leadMonths,
      },
      notes: "All values are planning estimates for trade studies only; confirm with providers.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mission.replace(/\s+/g, "_")}_launch_plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        {/* Liquid blobs */}
        <motion.div
          className="absolute w-[60rem] h-[60rem] bg-fuchsia-500/20 rounded-full blur-3xl"
          initial={{ x: -300, y: -200, scale: 0.8, opacity: 0.6 }}
          animate={{ x: 200, y: -150, scale: 1.1, opacity: 0.75 }}
          transition={{ duration: 18, repeat: Infinity, repeatType: "reverse" }}
        />
        <motion.div
          className="absolute right-[-10rem] top-40 w-[55rem] h-[55rem] bg-cyan-400/20 rounded-full blur-3xl"
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1.05, opacity: 0.7 }}
          transition={{ duration: 16, repeat: Infinity, repeatType: "reverse" }}
        />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Satellite Launch Planner</h1>
        </div>
        <p className="text-white/70 mt-2 max-w-3xl">Choose your satellite configuration and get a tailored launch recommendation — rocket provider, orbit blueprint, costs, lead time, and launch sites — in a sleek liquid‑glass interface.</p>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inputs */}
        <section className="lg:col-span-5 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Satellite className="w-5 h-5" />
                <h2 className="text-lg font-medium">Mission Setup</h2>
              </div>
              <button onClick={reset} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15">
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label>Mission name</Label>
                <input value={mission} onChange={(e) => setMission(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 placeholder-white/50 focus:outline-none" placeholder="e.g., Aurora-1" />
              </div>
              <div>
                <Label>Payload mass (kg)</Label>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} value={payloadKg} onChange={(e) => setPayloadKg(Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none" />
                  <Slider min={1} max={45000} step={1} value={payloadKg} onChange={setPayloadKg} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Orbit</Label>
                <div className="flex flex-wrap gap-2">
                  {ORBITS.map((o) => (
                    <button key={o.key} onClick={() => { setOrbitKey(o.key); setAltitudeKm(o.defaultAlt); setInclination(o.typicalInc[0]); }} className={`px-3 py-1.5 rounded-full text-sm border ${orbitKey === o.key ? "bg-white text-slate-900 border-white" : "bg-white/10 border-white/15 hover:bg-white/20"}`}>
                      {o.key}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/70 mt-2">{ORBITS.find(o=>o.key===orbitKey)?.notes}</p>
              </div>
              <div>
                <Label>Altitude (km)</Label>
                <div className="flex items-center gap-3">
                  <input type="number" value={altitudeKm} onChange={(e)=>setAltitudeKm(Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none" />
                  <Slider min={ORBITS.find(o=>o.key===orbitKey).range[0]} max={ORBITS.find(o=>o.key===orbitKey).range[1]} value={altitudeKm} onChange={setAltitudeKm} />
                </div>
              </div>
              <div>
                <Label>Inclination (°)</Label>
                <div className="flex items-center gap-3">
                  <input type="number" value={inclination} onChange={(e)=>setInclination(Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none" />
                  <Slider min={0} max={120} value={inclination} onChange={setInclination} />
                </div>
              </div>
              <div>
                <Label>Mode</Label>
                <Toggle value={mode} onChange={setMode} options={[{label:"Rideshare", value:"rideshare"},{label:"Dedicated", value:"dedicated"}]} />
              </div>
              <div>
                <Label>Budget (USD)</Label>
                <div className="flex items-center gap-3">
                  <input type="number" value={budgetUSD} onChange={(e)=>setBudgetUSD(Number(e.target.value))} className="w-40 px-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none" />
                  <Slider min={1000000} max={150000000} step={500000} value={budgetUSD} onChange={setBudgetUSD} />
                </div>
              </div>
              <div>
                <Label>NET (months from now)</Label>
                <div className="flex items-center gap-3">
                  <input type="number" value={netMonths} onChange={(e)=>setNetMonths(Number(e.target.value))} className="w-28 px-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none" />
                  <Slider min={1} max={24} value={netMonths} onChange={setNetMonths} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Risk tolerance</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/70 w-16">Low</span>
                  <Slider min={0} max={1} step={0.05} value={risk} onChange={setRisk} />
                  <span className="text-xs text-white/70 w-16 text-right">High</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5" />
                <h2 className="text-lg font-medium">Orbit Blueprint</h2>
              </div>
              <OrbitBadge orbitKey={orbitKey} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div>
                <OrbitSketch altitudeKm={altitudeKm} orbitKey={orbitKey} inclinationDeg={inclination} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Gauge className="w-4 h-4" /><span>Altitude:</span><span className="ml-auto font-semibold">{Math.round(orbit.altitudeKm)} km</span></div>
                <div className="flex items-center gap-2"><Compass className="w-4 h-4" /><span>Inclination:</span><span className="ml-auto font-semibold">{Math.round(orbit.inclinationDeg)}°</span></div>
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /><span>Estimated period:</span><span className="ml-auto font-semibold">{orbit.periodMin ? `${orbit.periodMin} min` : "n/a"}</span></div>
                <p className="text-white/70 pt-2 flex gap-2 text-xs"><Info className="w-4 h-4 shrink-0"/> {orbit.notes}</p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Right: Recommendations */}
        <section className="lg:col-span-7 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5" />
                <h2 className="text-lg font-medium">Launch Recommendations</h2>
              </div>
              <div className="text-sm text-white/80 flex items-center gap-3">
                <DollarSign className="w-4 h-4" />
                <span>Range:</span>
                <span className="font-semibold">{fmtUSD(totalCostRange[0])}–{fmtUSD(totalCostRange[1])}</span>
              </div>
            </div>

            {!ranked.length ? (
              <p className="mt-4 text-white/80">No feasible providers found. Try lowering mass, changing orbit, or increasing budget/NET.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {ranked.map((r, idx) => (
                  <motion.div key={r.provider.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="rounded-2xl p-4 bg-white/5 border border-white/10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center"><Rocket className="w-5 h-5"/></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{r.provider.name}</h3>
                            <OrbitBadge orbitKey={orbitKey} />
                          </div>
                          <div className="text-xs text-white/70">Cap: {r.cap.toLocaleString()} kg • Reliability: {(r.provider.reliability*100).toFixed(1)}% • Lead time: {r.provider.leadMonths} mo</div>
                        </div>
                      </div>
                      <div className="sm:ml-auto flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-white/70">Est. cost</div>
                          <div className="text-lg font-semibold">{fmtUSD(r.cost)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/70">Score</div>
                          <div className="text-lg font-semibold">{(r.score*100).toFixed(0)}</div>
                        </div>
                        <button onClick={() => exportPlan(r)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-white/90">
                          <Download className="w-4 h-4"/> Export
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="text-white/70 text-xs mb-1">Best launch sites</div>
                        <div className="flex flex-wrap gap-1">
                          {r.provider.sites.map((s) => (
                            <span key={s} className="px-2 py-1 rounded-lg bg-white/10 text-xs border border-white/10 inline-flex items-center gap-1"><MapPin className="w-3 h-3"/>{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="text-white/70 text-xs mb-1">Why it fits</div>
                        <ul className="list-disc list-inside space-y-1 text-white/90">
                          <li>Capacity margin: {(100 - (payloadKg / r.cap) * 100).toFixed(1)}%</li>
                          <li>{mode === "rideshare" ? "Competitive rideshare $/kg" : "Efficient dedicated price for mass"}</li>
                          <li>Schedule alignment: {netMonths >= r.provider.leadMonths ? "meets" : `${r.provider.leadMonths - netMonths} mo late`} </li>
                        </ul>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="text-white/70 text-xs mb-1">Mission profile</div>
                        <ul className="list-disc list-inside space-y-1 text-white/90">
                          <li>{orbit.name}</li>
                          <li>{Math.round(altitudeKm)} km @ {Math.round(inclination)}°</li>
                          <li>Mode: {mode}</li>
                        </ul>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="text-white/70 text-xs mb-1">Notes</div>
                        <p className="text-white/90">Values are indicative. Confirm deployment constraints (volume, separation system, ICD) with provider.</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Analytics */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" />
              <h2 className="text-lg font-medium">Cost & Capacity Analytics</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ranked.map((r) => ({ name: r.provider.name.split(" ")[0], Cost: r.cost }))}>
                    <XAxis dataKey="name" tick={{ fill: "#E5E7EB" }} />
                    <YAxis tick={{ fill: "#E5E7EB" }} />
                    <RTooltip contentStyle={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, color: "#0f172a" }} />
                    <Bar dataKey="Cost" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ranked.map((r) => ({ name: r.provider.name, value: clamp(payloadKg / r.cap, 0, 1) }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      label={({ name, value }) => `${name.split(" ")[0]} ${(value * 100).toFixed(0)}%`}
                    >
                      {ranked.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, color: "#0f172a" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </GlassCard>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-slate-900 hover:bg-white/90">
              <Printer className="w-4 h-4" /> Print Plan
            </button>
            <a
              href="https://raw.githubusercontent.com/plotly/datasets/master/launches.csv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15"
            >
              <Calendar className="w-4 h-4" /> Explore historical launches (sample data)
            </a>
            <div className="text-xs text-white/60 ml-auto">This tool provides planning estimates only and does not constitute a launch services offer.</div>
          </div>
        </section>
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-6 inset-x-0 pointer-events-none">
        <div className="max-w-7xl mx-auto px-6 flex justify-end">
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pointer-events-auto">
            <button
              onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 text-slate-900 hover:bg-white shadow-2xl border border-white/60"
            >
              Generate Full Plan <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
