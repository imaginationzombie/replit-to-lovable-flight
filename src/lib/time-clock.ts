/** Seconds between live location updates while clocked in. */
export const LOCATION_INTERVAL_MS = 2 * 60 * 1000;

export type Coords = { lat: number; lng: number; accuracy: number | null };

export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device can't share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null }),
      (e) => reject(new Error(e.code === 1 ? "Allow location access to clock in or out." : "Couldn't get your location. Try again.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

export function mapLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function elapsed(fromIso: string, to: Date = new Date()) {
  const mins = Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/** Opens turn-by-turn directions from the device's current location to an address. */
export function directionsLink(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
