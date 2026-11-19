export type ServiceTown = { name: string; active: boolean; sort_order: number };
export function activeTownNames(towns: ServiceTown[]) {
  return towns.filter(town => town.active).sort((a,b) => a.sort_order-b.sort_order).map(town => town.name);
}
export function activeTownSelection(current: string, towns: string[]) {
  return towns.includes(current) ? current : towns[0] ?? '';
}