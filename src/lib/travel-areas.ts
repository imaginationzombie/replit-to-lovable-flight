import { SERVICE_AREAS } from './pricing';
// Town-centre radius, not driving distance. Both ends of a grouped area count.
const points: Record<string, [number, number][]> = {
 'DuBois & Sandy Twp': [[41.1192,-78.7600]], Punxsutawney: [[40.9437,-78.9709]],
 Reynoldsville: [[41.0970,-78.8886]], Sykesville: [[41.0503,-78.8223]],
 'Falls Creek / Brockway': [[41.1451,-78.8045],[41.2492,-78.7995]], 'Lewistown, PA': [[40.5992,-77.5714]],
};
export function areaDistanceMiles(from: string, to: string) {
 if (!points[from] || !points[to]) return Infinity;
 if (from === to) return 0;
 const rad = (n: number) => n * Math.PI / 180;
 return Math.max(...(points[from] ?? []).flatMap(([a,b]) => (points[to] ?? []).map(([c,d]) =>
 3958.7613 * 2 * Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2))))));
}
export function eligibleAreas(selected: string[], base: string, radius: number | null) {
 return SERVICE_AREAS.filter(a => selected.includes(a) && (radius === null || areaDistanceMiles(base,a) <= radius));
}
export function validateTravel(base: string, radius: string) {
 if (radius === '') return null;
 const n = Number(radius);
 if (!SERVICE_AREAS.includes(base) || !Number.isFinite(n) || n < 0 || n > 500) throw new Error('Choose a base location and a distance from 0 to 500 miles.');
 return n;
}
