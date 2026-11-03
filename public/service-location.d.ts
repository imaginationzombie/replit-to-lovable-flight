export interface ServiceLocation {
  label: string;
  corridor: string;
  latitude: number;
  longitude: number;
}
export const SERVICE_LOCATIONS: ServiceLocation[];
export function nearestServiceLocation(latitude: number, longitude: number): ServiceLocation | null;
export function initializeServiceLocation(): void;