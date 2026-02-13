// Placeholder coords for UI wiring only.
// In production: your backend should resolve waypoint -> lat/lon and return it.

export const mockFlights = [
  {
    id: "SQ12",
    callsign: "SQ12",
    summary: "SIN → NRT",
    dep: "WSSS",
    arr: "RJAA",
    routeRaw:
      "AGELA N571 GURAS/N046F410 N571 LAGOG/M082F410 N571 GUNIP/N046F410 R467 VKL A464 ARAMA",
    waypoints: [
      { name: "AGELA", lat: 16.61, lng: 75.47 },
      { name: "GURAS", lat: 14, lng: 80.83, constraint: "N046F410" },
      { name: "LAGOG", lat: 8.59, lng: 92.0, constraint: "M082F410" },
      { name: "GUNIP", lat: 4.5, lng: 99.53, constraint: "N046F410" },
      { name: "VKL", lat: 2.38, lng: 101.95 },
      { name: "ARAMA", lat: 1.61, lng: 103.12 },
    ],
    legs: [
      { from: "AGELA", to: "GURAS", airway: "N571" },
      { from: "GURAS", to: "LAGOG", airway: "N571" },
      { from: "LAGOG", to: "GUNIP", airway: "N571" },
      { from: "GUNIP", to: "VKL", airway: "R467" },
      { from: "VKL", to: "ARAMA", airway: "A464" },
    ],
  },

  { id: "JL36", callsign: "JL36", summary: "BKK → KIX", dep: "VTBS", arr: "RJBB", routeRaw: "—", waypoints: [], legs: [] },
  { id: "CX450", callsign: "CX450", summary: "HKG → TPE", dep: "VHHH", arr: "RCTP", routeRaw: "—", waypoints: [], legs: [] },
  { id: "QF21", callsign: "QF21", summary: "SYD → NRT", dep: "YSSY", arr: "RJAA", routeRaw: "—", waypoints: [], legs: [] },
  { id: "KE641", callsign: "KE641", summary: "ICN → MNL", dep: "RKSI", arr: "RPLL", routeRaw: "—", waypoints: [], legs: [] },
];
