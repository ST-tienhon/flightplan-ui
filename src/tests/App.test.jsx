import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";
import { flightsPayload, detailsById } from "../tests/fixtures.js";

// We will capture props passed to Globe so we can assert pathsData etc.
let lastGlobeProps = null;

// Mock react-globe.gl to avoid WebGL in jsdom/CI
vi.mock("react-globe.gl", () => {
  return {
    default: (props) => {
      lastGlobeProps = props;
      return <div data-testid="globe-mock" />;
    }
  };
});

function mockFetchRouter() {
  // Node 24 has fetch, but in tests we want deterministic behavior
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);

    if (u.endsWith("/api/flights")) {
      return {
        ok: true,
        status: 200,
        json: async () => flightsPayload
      };
    }

    if (u.startsWith("/api/flightDetails?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] || "");
      const data = detailsById[id];

      if (!data) {
        return { ok: false, status: 404, json: async () => ({}) };
      }

      return {
        ok: true,
        status: 200,
        json: async () => data
      };
    }

    return { ok: false, status: 500, json: async () => ({}) };
  });
}

describe.sequential("Flightplan UI (App)", () => {
  beforeEach(() => {
    lastGlobeProps = null;
    //  vi.restoreAllMocks(); 
    mockFetchRouter();
  });
  afterEach(() => cleanup());

  it("1) on load: shows flights in the Flights panel", async () => {
    render(<App />);

    // Wait for one of the callsigns to appear
    // expect(await screen.findByText(/SQ11\s*-\s*WSSS/i)).toBeInTheDocument();
    expect(await screen.findByText(/SQ11/i)).toBeInTheDocument();

    // Assert other flights are also rendered
    expect(screen.getByText(/TR18/i)).toBeInTheDocument();
    expect(screen.getByText(/SQ222/i)).toBeInTheDocument();

    // Ensure correct endpoint called
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/flights");
  });

  it("2) search filters properly by callsign (type-to-filter)", async () => {
    render(<App />);

    await screen.findByText(/SQ11/i);
    const input = screen.getByLabelText("Search callsign");
    await userEvent.type(input, "sq2");

    // Now only SQ222 should remain
    expect(screen.getByText(/SQ222/i)).toBeInTheDocument();
    expect(screen.queryByText(/SQ11/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TR18/i)).not.toBeInTheDocument();
  });

  it("3) clicking a flight triggers second API call to load flight details", async () => {
    render(<App />);

    // const sq11Row = await screen.findByRole("listitem", { name: /SQ11/i });
    // await userEvent.click(sq11Row);
    const sq11Text = await screen.findByText(/SQ11/i);
    const sq11Row = sq11Text.closest("button");
    expect(sq11Row).toBeTruthy();
    await userEvent.click(sq11Row);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/flightDetails?id=F1"
      );
    });
  });

  it("4) flight details display properly after selecting a flight", async () => {
    render(<App />);

    // const sq11Row = await screen.findByRole("listitem", { name: /SQ11/i });
    // await userEvent.click(sq11Row);
    const sq11Text = await screen.findByText(/SQ11/i);
    const sq11Row = sq11Text.closest("button");
    expect(sq11Row).toBeTruthy();
    await userEvent.click(sq11Row);

    // Title changes to include callsign (per your code)
    expect(
      await screen.findByRole("heading", { name: /Flight Details for SQ11/i })
    ).toBeInTheDocument();

    // Details fields
    // expect(screen.getByText("Callsign")).toBeInTheDocument();
    // expect(screen.getByText("SQ11")).toBeInTheDocument();

    // expect(screen.getByText("Departure")).toBeInTheDocument();
    // expect(screen.getByText("WSSS")).toBeInTheDocument();

    // expect(screen.getByText("Arrival")).toBeInTheDocument();
    // expect(screen.getByText("RJAA")).toBeInTheDocument();

    // expect(screen.getByText("Route")).toBeInTheDocument();
    expect(
      screen.getByText(/WSSS SID BOBAG M635 VPK A464 IGARI STAR RJAA/i)
    ).toBeInTheDocument();

    // Route table should have rows (Seq / Fix / Airway / Lat / Lon)
    // We just assert at least one fix appears in the table text.
    expect(screen.getByText("BOBAG")).toBeInTheDocument();
    expect(screen.getByText("M635")).toBeInTheDocument();
  });

  it("5) when lat/lon are valid, Globe receives pathsData (and invalid points are filtered)", async () => {
    render(<App />);

    // Select F2 which has one invalid waypoint, which should be dropped by sanitizer
    // const tr18Row = await screen.findByRole("listitem", { name: /TR18/i });
    // await userEvent.click(tr18Row);
    const tr18Text = await screen.findByText(/TR18/i);
    const tr18Row = tr18Text.closest("button");
    expect(tr18Row).toBeTruthy();
    await userEvent.click(tr18Row);

    // Ensure globe is rendered (mock)
    expect(await screen.findByTestId("globe-mock")).toBeInTheDocument();

    // Assert Globe props were set with computed route path points
    await waitFor(() => {
      expect(lastGlobeProps).toBeTruthy();
      expect(Array.isArray(lastGlobeProps.pathsData)).toBe(true);
      expect(lastGlobeProps.pathsData).toHaveLength(1);

      const points = lastGlobeProps.pathsData[0].points;
      // F2 has 3 waypoints but 1 is invalid -> should drop to 2 points
      expect(points).toHaveLength(2);

      // Points are [lng, lat]
      expect(points[0]).toEqual([103.994, 1.3502]);
      expect(points[1]).toEqual([101.709, 2.7456]);
    });
  });
});
