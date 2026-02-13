// App.jsx
// - Uses PATHS layer built from waypoint sequence (flat but elevated, including endpoints)
// - Animated dashed path
// - Single combined labels layer:
//   * Waypoint labels (slightly larger / higher)
//   * Airway/leg labels at midpoints (slightly smaller / lower)
// - Retains mockFlights.js + styles.css
// - Uses explicit HTTPS image URLs to avoid CORS/mixed-content issues
//
// Prereqs: npm i react-globe.gl three

import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import "./styles.css";
import { mockFlights } from "./assets/mockFlights";

/** Observe element size so Globe scales to available space */
function useElementSize(ref) {
  const [size, setSize] = useState({ width: 300, height: 300 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({
        width: Math.max(1, Math.floor(cr.width)),
        height: Math.max(1, Math.floor(cr.height)),
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function normalizeWaypoint(w) {
  // mockFlights uses { lat, lng }, but keep this robust for future backend changes.
  const lat = typeof w.lat === "string" ? Number(w.lat) : w.lat;
  const lngRaw = w.lng ?? w.lon;
  const lng = typeof lngRaw === "string" ? Number(lngRaw) : lngRaw;

  // If ever receiving 0..360 lon format, normalize to -180..180
  const normLng = typeof lng === "number" && lng > 180 ? lng - 360 : lng;

  return { ...w, lat, lng: normLng };
}

function buildLegRows(flight) {
  const airwayByTo = new Map((flight.legs || []).map((l) => [l.to, l.airway]));
  return (flight.waypoints || []).map((wp, idx) => ({
    seq: idx + 1,
    fix: wp.name,
    airway: idx === 0 ? "—" : airwayByTo.get(wp.name) || "—",
    constraint: wp.constraint || "—",
    lat: typeof wp.lat === "number" ? wp.lat.toFixed(4) : "—",
    lng: typeof wp.lng === "number" ? wp.lng.toFixed(4) : "—",
  }));
}

/** Build a single continuous path from waypoint sequence */
function buildFlightPathFromWaypoints(waypoints) {
  // pathsData expects an item with a list of points; we'll store points as [lng, lat].
  return {
    id: "route",
    points: waypoints.map((w) => [w.lng, w.lat]),
  };
}

/** Build airway labels at midpoints between leg endpoints */
function buildAirwayLabelsFromLegs(legs, wpByName) {
  return (legs || [])
    .map((leg, idx) => {
      const a = wpByName.get(leg.from);
      const b = wpByName.get(leg.to);
      if (!a || !b) return null;

      return {
        id: `airway-${idx}-${leg.airway}`,
        type: "airway",
        text: leg.airway,
        // midpoint (simple average; good enough visually)
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2,
      };
    })
    .filter(Boolean);
}

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(mockFlights[0]?.id ?? "");
  const selectedFlight = useMemo(
    () => mockFlights.find((f) => f.id === selectedId) || mockFlights[0],
    [selectedId]
  );

  const filteredFlights = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return mockFlights;
    return mockFlights.filter(
      (f) => f.callsign.toUpperCase().includes(q) || f.id.toUpperCase().includes(q)
    );
  }, [query]);

  // Optional: auto-select if only one match
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (filteredFlights.length === 1) setSelectedId(filteredFlights[0].id);
  }, [query, filteredFlights]);

  // Normalize + sanitize waypoints (prevents "sticks"/NaN artifacts)
  const safeWaypoints = useMemo(() => {
    const wps = (selectedFlight?.waypoints || []).map(normalizeWaypoint);
    return wps.filter(
      (w) =>
        isFiniteNum(w.lat) &&
        isFiniteNum(w.lng) &&
        Math.abs(w.lat) <= 90 &&
        Math.abs(w.lng) <= 180
    );
  }, [selectedFlight]);

  const rows = useMemo(() => buildLegRows(selectedFlight), [selectedFlight]);

  // Build a single continuous floating path (elevated start/end)
  const pathsData = useMemo(() => {
    if (!safeWaypoints.length) return [];
    return [buildFlightPathFromWaypoints(safeWaypoints)];
  }, [safeWaypoints]);

  // Combine waypoint labels + airway labels into a single labels layer
  const combinedLabels = useMemo(() => {
    const waypointLabels = safeWaypoints.map((wp) => ({
      id: `wp-${wp.name}`,
      type: "waypoint",
      text: wp.name,
      lat: wp.lat,
      lng: wp.lng,
      constraint: wp.constraint,
    }));

    const wpByName = new Map(safeWaypoints.map((w) => [w.name, w]));
    const airwayLabels = buildAirwayLabelsFromLegs(selectedFlight?.legs || [], wpByName);

    return [...waypointLabels, ...airwayLabels];
  }, [safeWaypoints, selectedFlight]);

  // Globe responsive sizing
  const globeWrapRef = useRef(null);
  const { width: globeW, height: globeH } = useElementSize(globeWrapRef);

  return (
    <div className="app">
      {/* Top panels */}
      <div className="topGrid">
        {/* Left: Flights */}
        <aside className="panel leftPanel">
          <div className="panelHeader">
            <h2 className="panelTitle">Flights</h2>
          </div>

          <div className="searchRow">
            <input
              className="searchInput"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Callsign..."
              aria-label="Search callsign"
            />
            <button
              className="iconBtn"
              onClick={() => setQuery("")}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          </div>

          <div className="list" role="list">
            {filteredFlights.length === 0 ? (
              <div className="empty">No flights found</div>
            ) : (
              filteredFlights.map((f) => {
                const active = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    className={`listItem ${active ? "active" : ""}`}
                    onClick={() => setSelectedId(f.id)}
                    type="button"
                    role="listitem"
                  >
                    <div className="listItemMain">
                      <span className="mono">{f.callsign}</span>{" "}
                      <span className="muted">-</span> {f.summary}
                    </div>
                    <div className="listItemSub mono">
                      {f.dep} → {f.arr}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Details */}
        <section className="panel rightPanel">
          <div className="panelHeader">
            <h2 className="panelTitle">Flight Details for {selectedFlight?.callsign || "—"}</h2>
          </div>

          <div className="detailGrid">
            <div className="kv">
              <div className="k">Callsign</div>
              <div className="v mono">{selectedFlight?.callsign || "—"}</div>
            </div>
            <div className="kv">
              <div className="k">Departure</div>
              <div className="v mono">{selectedFlight?.dep || "—"}</div>
            </div>
            <div className="kv">
              <div className="k">Arrival</div>
              <div className="v mono">{selectedFlight?.arr || "—"}</div>
            </div>

            <div className="kv kvWide">
              <div className="k">Route</div>
              <div className="v routeRaw">{selectedFlight?.routeRaw || "—"}</div>
            </div>
          </div>

          <div className="tableWrap">
            <table className="routeTable">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Fix</th>
                  <th>Airway</th>
                  <th>Constraint</th>
                  <th>Lat</th>
                  <th>Lon</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="emptyCell">
                      No route details available
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={`${r.seq}-${r.fix}`}>
                      <td>{r.seq}</td>
                      <td className="mono">{r.fix}</td>
                      <td className="mono">{r.airway}</td>
                      <td className="mono">{r.constraint}</td>
                      <td className="mono">{r.lat}</td>
                      <td className="mono">{r.lng}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bottom: Globe */}
      <section className="panel bottomPanel">
        <div className="panelHeader bottomHeader">
          <h2 className="panelTitle">Flight Path for {selectedFlight?.callsign || "—"}</h2>
        </div>

        <div className="globeWrap" ref={globeWrapRef}>
          <Globe
            width={globeW}
            height={globeH}
            // Explicit HTTPS to avoid mixed-content/CORS weirdness on some setups
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
            // --- PATHS (flat but floating route) ---
            pathsData={pathsData}
            pathPoints="points"
            // points are [lng, lat]
            pathPointLng={(p) => p[0]}
            pathPointLat={(p) => p[1]}
            // Elevate ALL points (including start/end)
            pathPointAlt={() => 0.1} // try 0.02–0.12

            // Path styling
            pathStroke={1.2}

            // --- ANIMATION (moving dash along the path) ---
            pathDashLength={0.1}
            pathDashGap={0.008}
            pathDashInitialGap={0}
            pathDashAnimateTime={12000}

            // --- LABELS (waypoints + airways in one layer, different sizes/altitudes) ---
            labelsData={combinedLabels}
            labelLat="lat"
            labelLng="lng"
            labelText={(d) => d.text}
            // Waypoints slightly higher than airways to reduce overlap
            labelAltitude={(d) => (d.type === "waypoint" ? 0.1 : 0.1)}
            // Waypoints slightly larger than airways
            labelSize={(d) => (d.type === "waypoint" ? 0.5 : 0.3)}
            // Show constraint for waypoint labels on hover (nice but not noisy)
            labelLabel={(d) => {
              if (d.type === "waypoint" && d.constraint) return `${d.text} • ${d.constraint}`;
              if (d.type === "airway") return `Airway ${d.text}`;
              return d.text;
            }}
          />
        </div>
      </section>
    </div>
  );
}
