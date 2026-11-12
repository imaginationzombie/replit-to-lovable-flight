// Published price comparisons checked 2026-11-12; estimates are 10% below the selected benchmark.
export const ESTIMATE_SOURCES = {
 office: 'https://www.dreammakerscleaning.com/office-cleaning-prices',
 dubois: 'https://www.uhaul.com/MovingHelp/Du-Bois-PA/1/Results/',
 lewistown: 'https://www.uhaul.com/MovingHelp/Lewistown-PA-17044/1/Results/',
};
export function officeEstimate(hours: number, cleaners: number, visits: number) {
 if (!Number.isFinite(hours) || hours < 2 || hours > 8 || ![1,2].includes(cleaners) || !Number.isInteger(visits) || visits < 1 || visits > 31) throw new Error('Choose 2–8 hours, 1–2 cleaners and 1–31 visits.');
 const billableHours = Math.ceil(hours * 2) / 2;
 const benchmark = 12 + 30 * cleaners * billableHours;
 const perVisit = Math.round(benchmark * 90) / 100;
 return { billableHours, benchmark, perVisit, total: Math.round(perVisit * visits * 100) / 100 };
}
export function movingEstimate(hours: number, area: string) {
 if (!Number.isFinite(hours) || hours < 2 || hours > 12) throw new Error('Choose 2–12 hours.');
 const billableHours = Math.ceil(hours * 2) / 2;
 const benchmarkRate = area === 'Lewistown, PA' ? 100 : 81;
 const rate = benchmarkRate * 0.9;
 return { billableHours, benchmarkRate, rate, total: Math.round(rate * billableHours * 100) / 100 };
}
