import { createFileRoute } from '@tanstack/react-router';
import { listServiceTowns } from '@/lib/service-towns.functions';
export const Route = createFileRoute('/api/public/service-towns')({
  server: { handlers: { GET: async () => {
    try {
      return Response.json(await listServiceTowns(), { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ error: 'Service locations unavailable' }, { status: 503 });
    }
  } } },
});