import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { useServiceTowns } from '@/hooks/use-service-towns';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export const Route = createFileRoute('/_authenticated/admin-settings')({
  head: () => ({ meta: [
    { title: 'Service Town Settings | HousekeepingBooking.com' },
    { name: 'description', content: 'Administrator controls for active cleaning service towns.' },
    { property: 'og:title', content: 'Service Town Settings | HousekeepingBooking.com' },
    { property: 'og:description', content: 'Manage towns currently accepting cleaning appointments.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }), component: Settings,
});
function Settings() {
  const { isAdmin, loading } = useAuth();
  const towns = useServiceTowns();
  const qc = useQueryClient();
  const [message,setMessage] = useState('');
  const update = useMutation({
    mutationFn: async ({ name,active }: { name: string; active: boolean }) => {
      const { data,error } = await supabase.from('service_towns').update({ active }).eq('name',name).select('name,active').single();
      if (error) throw new Error('Could not save this town. Administrator access is required.');
      return data;
    },
    onSuccess: async town => {
      setMessage(`${town.name} is now ${town.active ? 'active' : 'inactive'}.`);
      await qc.invalidateQueries({ queryKey: ['service-towns'] });
      await qc.invalidateQueries({ queryKey: ['available-slot-cleaners'] });
    },
  });
  return <div className="min-h-screen bg-background"><AppHeader/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Admin settings</h1><Button asChild variant="outline"><Link to="/admin" search={{ tab: 'scheduler' }}>Back to admin</Link></Button></div>
    {loading ? <p className="mt-6">Loading…</p> : !isAdmin ? <p role="alert" className="mt-6">Administrator access required.</p> : <section className="mt-8 border-t border-border pt-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><MapPin className="text-primary"/>Service towns <span className="text-sm font-normal text-muted-foreground">{towns.areas.length} active</span></h2>
      {towns.isPending && <p className="mt-5">Loading towns…</p>}
      {(towns.error || update.error) && <p role="alert" className="mt-4 text-destructive">{towns.error?.message || update.error?.message}</p>}
      {message && <p role="status" className="mt-4 text-primary">{message}</p>}
      <div className="mt-5 divide-y divide-border">{towns.data?.map(town => <div key={town.name} className="flex items-center justify-between gap-4 py-5"><div className="min-w-0"><label htmlFor={`town-${town.sort_order}`} className="break-words font-semibold">{town.name}</label><p className="mt-1 text-sm text-muted-foreground">{town.active ? 'Active' : 'Inactive'}</p></div><Switch id={`town-${town.sort_order}`} aria-label={`${town.name} active`} checked={town.active} disabled={update.isPending} onCheckedChange={active => update.mutate({ name: town.name,active })}/></div>)}</div>
    </section>}
  </main></div>;
}