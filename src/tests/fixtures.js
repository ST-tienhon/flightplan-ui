export const flightsPayload = {
  data: [
    { id: "F1", callsign: "SQ11", dep: "WSSS", arr: "RJAA" },
    { id: "F2", callsign: "TR18", dep: "WSSS", arr: "WMKK" },
    { id: "F3", callsign: "SQ222", dep: "WSSS", arr: "VHHH" }
  ]
};

export const detailsById = {
  F1: {
    id: "F1",
    callsign: "SQ11",
    dep: "WSSS",
    arr: "RJAA",
    routeText: "WSSS SID BOBAG M635 VPK A464 IGARI STAR RJAA",
    waypoints: [
      { name: "WSSS", lat: 1.3502, lng: 103.994 },
      { name: "BOBAG", lat: 6.0, lng: 103.0 },
      { name: "VPK", lat: 13.912, lng: 100.607 },
      { name: "IGARI", lat: 6.936, lng: 103.586 },
      { name: "RJAA", lat: 35.7719, lng: 140.3929 }
    ],
    legs: [
      { from: "WSSS", to: "BOBAG", airway: "SID" },
      { from: "BOBAG", to: "VPK", airway: "M635" },
      { from: "VPK", to: "IGARI", airway: "A464" },
      { from: "IGARI", to: "RJAA", airway: "STAR" }
    ]
  },

  // Includes an invalid lat/lon to prove your sanitizer works
  F2: {
    id: "F2",
    callsign: "TR18",
    dep: "WSSS",
    arr: "WMKK",
    routeText: "WSSS DCT BADPT DCT WMKK",
    waypoints: [
      { name: "WSSS", lat: 1.3502, lng: 103.994 },
      { name: "BADPT", lat: 999, lng: 200 }, // invalid -> should be dropped
      { name: "WMKK", lat: 2.7456, lng: 101.709 }
    ],
    legs: [
      { from: "WSSS", to: "BADPT", airway: "DCT" },
      { from: "BADPT", to: "WMKK", airway: "DCT" }
    ]
  }
};
