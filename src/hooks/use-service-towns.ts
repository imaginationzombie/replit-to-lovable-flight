import { useQuery } from '@tanstack/react-query';
import { listServiceTowns } from '@/lib/service-towns.functions';
import { activeTownNames } from '@/lib/service-towns';
export function useServiceTowns() {
  const query = useQuery({ queryKey: ['service-towns'], queryFn: () => listServiceTowns(), refetchInterval: 15000 });
  return { ...query, areas: activeTownNames(query.data ?? []) };
}