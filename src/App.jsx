// App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import "./styles.css";

/* ---------- Resize Hook (responsive Globe) ---------- */
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
  const lat = typeof w.lat === "string" ? Number(w.lat) : w.lat;
  const lngRaw = w.lng ?? w.lon;
  const lng = typeof lngRaw === "string" ? Number(lngRaw) : lngRaw;

  // Normalize 0..360 -> -180..180 if it ever happens
  const normLng = typeof lng === "number" && lng > 180 ? lng - 360 : lng;

  return { ...w, lat, lng: normLng };
}

function createCirclePolygon(lat, lng, radiusKm = 150) {
  const points = [];
  const steps = 32;
  const earthRadiusKm = 6371;

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;

    const dx = (radiusKm / earthRadiusKm) * Math.cos(angle);
    const dy = (radiusKm / earthRadiusKm) * Math.sin(angle);

    const newLat = lat + (dy * 180) / Math.PI;
    const newLng =
      lng + ((dx * 180) / Math.PI) / Math.cos((lat * Math.PI) / 180);

    points.push([newLng, newLat]);
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [points],
    },
  };
}

function buildRowsFromWaypointsAndLegs(waypoints, legs) {
  const airwayByTo = new Map((legs || []).map((l) => [l.to, l.airway]));
  return waypoints.map((wp, idx) => ({
    seq: idx + 1,
    fix: wp.name,
    airway: idx === 0 ? "—" : airwayByTo.get(wp.name) || "—",
    lat: wp.lat.toFixed(4),
    lng: wp.lng.toFixed(4),
  }));
}

export default function App() {
  const FLIGHTS_URL = "/api/flights";
  const DETAILS_URL = "/api/flightDetails";

  const [flights, setFlights] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // select by backend-provided unique id
  const [selectedFlightId, setSelectedFlightId] = useState(null);

  const [flightDetails, setFlightDetails] = useState(null);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorFlights, setErrorFlights] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showAirways, setShowAirways] = useState(true);


  // optional: cache details to avoid refetch when reselecting
  const detailsCacheRef = useRef(new Map());

  /* ---------- Load flight list ---------- */
  useEffect(() => {
    let cancelled = false;
    setLoadingFlights(true);
    setErrorFlights(null);

    fetch(FLIGHTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Flights HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setFlights(payload?.data || []);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setErrorFlights("Failed to load flights.");
      })
      .finally(() => {
        if (!cancelled) setLoadingFlights(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- Filter list by callsign ---------- */
  const filteredFlights = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter((f) => (f.callsign || "").toLowerCase().includes(q));
  }, [flights, searchQuery]);

  /* ---------- Load details by id ---------- */
  useEffect(() => {
    if (!selectedFlightId) {
      setFlightDetails(null);
      setErrorDetails(null);
      setLoadingDetails(false);
      return;
    }

    // cache hit
    const cached = detailsCacheRef.current.get(selectedFlightId);
    if (cached) {
      setFlightDetails(cached);
      setErrorDetails(null);
      setLoadingDetails(false);
      return;
    }

    let cancelled = false;
    setLoadingDetails(true);
    setErrorDetails(null);

    fetch(`${DETAILS_URL}?id=${encodeURIComponent(selectedFlightId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Details HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        detailsCacheRef.current.set(selectedFlightId, data);
        setFlightDetails(data);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setErrorDetails("Failed to load flight details.");
        setFlightDetails(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFlightId]);

  /* ---------- Sanitize waypoints ---------- */
  const safeWaypoints = useMemo(() => {
    const raw = flightDetails?.waypoints || [];
    const normalized = raw.map(normalizeWaypoint);

    return normalized.filter(
      (w) =>
        w &&
        typeof w.name === "string" &&
        w.name.length > 0 &&
        isFiniteNum(w.lat) &&
        isFiniteNum(w.lng) &&
        Math.abs(w.lat) <= 90 &&
        Math.abs(w.lng) <= 180
    );
  }, [flightDetails]);

  /* ---------- Build arrival departure polygon ---------- */
  const airportHexPolygons = useMemo(() => {
    if (!safeWaypoints.length) return [];

    const dep = safeWaypoints[0];
    const arr = safeWaypoints[safeWaypoints.length - 1];

    if (!dep || !arr) return [];

    return [
      {
        ...createCirclePolygon(dep.lat, dep.lng, 50),
        role: "departure",
      },
      {
        ...createCirclePolygon(arr.lat, arr.lng, 50),
        role: "arrival",
      },
    ];
  }, [safeWaypoints]);


  /* ---------- Build pathsData from waypoint list ---------- */
  const pathsData = useMemo(() => {
    if (!safeWaypoints.length) return [];
    return [
      {
        id: "route",
        points: safeWaypoints.map((w) => [w.lng, w.lat]), // [lng, lat]
      },
    ];
  }, [safeWaypoints]);

  /* ---------- Combined labels (waypoints + airways) ---------- */
  const combinedLabels = useMemo(() => {
    if (!flightDetails) return [];

    const waypointLabels = safeWaypoints.map((wp, idx) => ({
      id: `wp-${wp.name}`,
      type: "waypoint",
      text: wp.name,
      lat: wp.lat,
      lng: wp.lng,
      isMajor: idx === 0 || idx === safeWaypoints.length - 1, // DEP + ARR
      isDeparture: idx === 0,
      isArrival: idx === safeWaypoints.length - 1
    }));

    // compute airway midpoints using legs
    const wpMap = new Map(safeWaypoints.map((w) => [w.name, w]));
    const airwayLabels = (flightDetails.legs || [])
      .map((leg, idx) => {
        const a = wpMap.get(leg.from);
        const b = wpMap.get(leg.to);
        if (!a || !b) return null;
        return {
          id: `airway-${idx}-${leg.airway}`,
          type: "airway",
          text: leg.airway,
          lat: (a.lat + b.lat) / 2,
          lng: (a.lng + b.lng) / 2,
        };
      })
      .filter(Boolean);

    return [...waypointLabels, ...airwayLabels];
  }, [flightDetails, safeWaypoints]);

  /* ---------- Route table rows ---------- */
  const routeRows = useMemo(() => {
    if (!flightDetails) return [];
    if (!safeWaypoints.length) return [];
    return buildRowsFromWaypointsAndLegs(safeWaypoints, flightDetails.legs || []);
  }, [flightDetails, safeWaypoints]);

  /* ---------- Globe sizing ---------- */
  const globeWrapRef = useRef(null);
  const globeRef = useRef();

  const { width: globeW, height: globeH } = useElementSize(globeWrapRef);

  const selectedTitle = flightDetails?.callsign
    ? `Flight Details for ${flightDetails.callsign}`
    : "Flight Details";

  function computeViewFromWaypoints(waypoints) {
    // Basic bounds
    const lats = waypoints.map(w => w.lat);
    const lngs = waypoints.map(w => w.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Handle dateline crossing by picking the smaller span:
    const sorted = [...lngs].sort((a, b) => a - b);
    const directSpan = sorted[sorted.length - 1] - sorted[0];

    // Wrap-around span (across -180/180)
    let bestMinLng = sorted[0];
    let bestMaxLng = sorted[sorted.length - 1];
    let bestSpan = directSpan;

    // Try "cutting" the circle between each adjacent pair to minimize span
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1] - sorted[i];
      const wrapSpan = 360 - gap; // span if we cut at this gap
      if (wrapSpan < bestSpan) {
        bestSpan = wrapSpan;
        bestMinLng = sorted[i + 1];
        bestMaxLng = sorted[i] + 360;
      }
    }

    const centerLat = (minLat + maxLat) / 2;
    let centerLng = (bestMinLng + bestMaxLng) / 2;
    if (centerLng > 180) centerLng -= 360;

    const latSpan = maxLat - minLat;
    const lngSpan = bestSpan;

    // Heuristic altitude: bigger span => higher altitude
    // Clamp to keep it sane for tiny/huge routes
    const span = Math.max(latSpan, lngSpan);
    const altitude = Math.min(2.2, Math.max(0.25, span / 35)); // tweak to taste

    return { lat: centerLat, lng: centerLng, altitude };
  }

  useEffect(() => {
    if (!globeRef.current) return;
    if (!safeWaypoints || safeWaypoints.length < 2) return;

    const { lat, lng, altitude } = computeViewFromWaypoints(safeWaypoints);

    // Smooth fly-to
    globeRef.current.pointOfView({ lat, lng, altitude }, 1200);
  }, [safeWaypoints]);


  return (
    <div className="app">
      <div className="topGrid">
        {/* ---------- LEFT: FLIGHTS ---------- */}
        <aside className="panel leftPanel">
          <div className="panelHeader">
            <h2 className="panelTitle">Flights</h2>
          </div>

          <div className="searchRow">
            <input
              className="searchInput"
              placeholder="Search Callsign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search callsign"
            />
            <button
              className="iconBtn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          </div>

          <div className="list" role="list">
            {loadingFlights && <div className="empty">Loading flights...</div>}
            {errorFlights && <div className="empty">{errorFlights}</div>}

            {!loadingFlights && !errorFlights && filteredFlights.length === 0 && (
              <div className="empty">No flights found</div>
            )}

            {!loadingFlights &&
              !errorFlights &&
              filteredFlights.map((f) => {
                const active = f.id === selectedFlightId;
                return (
                  <button
                    key={f.id}
                    className={`listItem ${active ? "active" : ""}`}
                    onClick={() => setSelectedFlightId(f.id)}
                    type="button"
                    role="listitem"
                  >
                    <div className="listItemMain">
                      <span className="mono">{f.callsign}</span>{" "}
                      <span className="muted">-</span> {f.dep} → {f.arr}
                    </div>
                    {/* <div className="listItemSub mono">id: {f.id}</div> */}
                  </button>
                );
              })}
          </div>
        </aside>

        {/* ---------- RIGHT: DETAILS ---------- */}
        <section className="panel rightPanel">
          <div className="panelHeader">
            <h2 className="panelTitle">{selectedTitle}</h2>
          </div>

          {errorDetails && <div className="empty">{errorDetails}</div>}
          {loadingDetails && <div className="empty">Loading flight details...</div>}

          {/* Placeholder to keep panel visually stable before first selection */}
          {!flightDetails && !loadingDetails && !errorDetails && (
            <div className="detailsPlaceholder">
              <div className="placeholderTitle">Select a flight on the left</div>
              <div className="placeholderText">
                Route summary, waypoint table, and globe path will appear here.
              </div>

              <div className="detailGrid">
                <div className="kv">
                  <div className="k">Callsign</div>
                  <div className="v mono placeholderBar" />
                </div>
                <div className="kv">
                  <div className="k">Departure</div>
                  <div className="v mono placeholderBar" />
                </div>
                <div className="kv">
                  <div className="k">Arrival</div>
                  <div className="v mono placeholderBar" />
                </div>
                <div className="kv kvWide">
                  <div className="k">Route</div>
                  <div className="v placeholderBarWide" />
                </div>
              </div>

              <div className="tableWrap">
                <div className="placeholderTable">
                  <div className="placeholderRow" />
                  <div className="placeholderRow" />
                  <div className="placeholderRow" />
                  <div className="placeholderRow" />
                  <div className="placeholderRow" />
                </div>
              </div>
            </div>
          )}

          {/* Real details */}
          {flightDetails && !loadingDetails && (
            <>
              <div className="detailGrid">
                <div className="kv">
                  <div className="k">Callsign</div>
                  <div className="v mono">{flightDetails.callsign}</div>
                </div>
                <div className="kv">
                  <div className="k">Departure</div>
                  <div className="v mono">{flightDetails.dep}</div>
                </div>
                <div className="kv">
                  <div className="k">Arrival</div>
                  <div className="v mono">{flightDetails.arr}</div>
                </div>

                <div className="kv kvWide">
                  <div className="k">Route</div>
                  <div className="v routeRaw">{flightDetails.routeText}</div>
                </div>
              </div>

              <div className="tableWrap">
                <table className="routeTable">
                  <thead>
                    <tr>
                      <th>Seq</th>
                      <th>Fix</th>
                      <th>Airway</th>
                      <th>Lat</th>
                      <th>Lon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="emptyCell">
                          No route points available
                        </td>
                      </tr>
                    ) : (
                      routeRows.map((r) => (
                        <tr key={`${r.seq}-${r.fix}`}>
                          <td>{r.seq}</td>
                          <td className="mono">{r.fix}</td>
                          <td className="mono">{r.airway}</td>
                          <td className="mono">{r.lat}</td>
                          <td className="mono">{r.lng}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ---------- BOTTOM: GLOBE ---------- */}
      <section className="panel bottomPanel">
        <div className="panelHeader bottomHeader globeHeader">
          <h2 className="panelTitle">
            Flight Path {flightDetails?.callsign ? `for ${flightDetails.callsign}` : ""}
          </h2>

          <div className="labelControls">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showWaypoints}
                onChange={(e) => setShowWaypoints(e.target.checked)}
              />
              Fixes/ Navaids
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={showAirways}
                onChange={(e) => setShowAirways(e.target.checked)}
              />
              Airways
            </label>
          </div>
        </div>


        <div className="globeWrap" ref={globeWrapRef}>
          {/* KEEP THIS PORTION EXACTLY AS REQUESTED */}
          <Globe
            ref={globeRef}
            width={globeW}
            height={globeH}
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
            // --- PATHS (from waypoint list) ---
            pathsData={pathsData}
            pathPoints="points"
            pathPointLng={(p) => p[0]}
            pathPointLat={(p) => p[1]}
            // Elevate ALL points (including start/end)
            pathPointAlt={() => 0.01} // try 0.02–0.12

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
            labelAltitude={(d) => (d.type === "waypoint" ? 0.01 : 0.01)}
            // Waypoints slightly larger than airways
            labelSize={(d) => {
              if (d.type === "waypoint") {
                // hide minor waypoint TEXT only
                if (!showWaypoints && !d.isMajor) return 0;
                return d.isMajor ? 0.5 : 0.35;
              }

              if (d.type === "airway") {
                // hide airway TEXT
                if (!showAirways) return 0;
                return 0.3;
              }

              return 0.3;
            }}
            // Show constraint for waypoint labels on hover (nice but not noisy)
            labelLabel={(d) => {
              if (d.type === "airway") return `Airway ${d.text}`;
              return d.text;
            }}
            labelColor={(d) => {
              if (d.type === "waypoint") {
                if (d.isDeparture) return "#00aaff";  // blue
                if (d.isArrival) return "#00e08a";    // green
                return "rgba(255,255,255,0.75)";      // neutral minor
              }

              // airway labels
              return "rgba(255,255,255,0.55)";
            }}
            // --- HEX POLYGONS (DEP/ARR highlight) ---
            hexPolygonsData={airportHexPolygons}
            hexPolygonResolution={6}
            hexPolygonMargin={0.05}
            hexPolygonAltitude={0.01}
            hexPolygonColor={(d) =>
              d.role === "departure"
                ? "rgba(0, 170, 255, 0.65)"
                : "rgba(0, 220, 140, 0.65)"
            }
          />
        </div>
      </section>
    </div>
  );
}
