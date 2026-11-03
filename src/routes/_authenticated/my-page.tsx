import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Upload, Trash2, ExternalLink, Save, UserRound, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { portfolioOptions, photoUrl } from "@/lib/people-portals";

export const Route = createFileRoute("/_authenticated/my-page")({
  head: () => ({ meta: [
    { title: "Edit My Housekeeper Page | HousekeepingBooking.com" },
    { name: "description", content: "Manage your public housekeeper details, portrait, cleaning gallery and page visibility." },
    { property: "og:title", content: "Edit My Housekeeper Page | HousekeepingBooking.com" },
    { property: "og:description", content: "Manage your housekeeper profile and before-and-after photos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyPage,
});

function MyPage() {
  const { user, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const id = user?.id ?? "";
  const portfolio = useQuery({ ...portfolioOptions(id), enabled: Boolean(id) && isCleaner });
  const [form, setForm] = useState({ display_name: "", headline: "", bio: "", service_areas: "", portrait_path: "", published: false });
  const [portraitPreview, setPortraitPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [galleryVersion, setGalleryVersion] = useState(0);
  useEffect(() => {
    if (portfolio.data) {
      const p = portfolio.data;
      setForm({ display_name: p.display_name, headline: p.headline, bio: p.bio, service_areas: p.service_areas, portrait_path: p.portrait_path, published: p.published });
      setPortraitPreview(p.portrait);
    }
  }, [portfolio.data]);

  async function upload(file: File) {
    if (!id || !isCleaner) throw new Error("Housekeeper access required.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 5 MB.");
    const path = `${id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("housekeeper-portfolios").upload(path, file);
    if (error) throw error;
    return path;
  }
  async function refreshPage() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["housekeeper-portfolio", id] }),
      qc.invalidateQueries({ queryKey: ["public-housekeeper", id] }),
    ]);
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!isCleaner || !id) throw new Error("Housekeeper access required.");
      const { error } = await supabase.from("housekeeper_portfolios").upsert({ user_id: id, ...form });
      if (error) throw error;
    },
    onSuccess: async () => { setNotice(form.published ? "Your public page is saved." : "Page saved. Your page is hidden from customers."); await refreshPage(); },
  });
  const portrait = useMutation({
    mutationFn: async (file: File) => { const path = await upload(file); return { path, url: await photoUrl(path) }; },
    onSuccess: ({ path, url }) => { setForm(f => ({ ...f, portrait_path: path })); setPortraitPreview(url); setNotice("Portrait uploaded. Save your page to keep this change."); },
  });
  const gallery = useMutation({
    mutationFn: async () => {
      if (!before || !after) throw new Error("Choose both photos.");
      if (!portfolio.data) throw new Error("Save your page first.");
      const before_path = await upload(before);
      const after_path = await upload(after);
      const { error } = await supabase.from("housekeeper_gallery").insert({ user_id: id, caption, before_path, after_path });
      if (error) throw error;
    },
    onSuccess: async () => { setBefore(null); setAfter(null); setCaption(""); setGalleryVersion(v => v + 1); setNotice("Before-and-after photos added."); await refreshPage(); },
  });
  const remove = useMutation({
    mutationFn: async (g: { id: string; before_path: string; after_path: string }) => {
      const { error } = await supabase.from("housekeeper_gallery").delete().eq("id", g.id).eq("user_id", id);
      if (error) throw error;
      await supabase.storage.from("housekeeper-portfolios").remove([g.before_path, g.after_path]);
    },
    onSuccess: async () => { setNotice("Photo pair removed."); await refreshPage(); },
  });
  const error = portfolio.error || save.error || portrait.error || gallery.error || remove.error;
  const input = "mt-2 w-full min-w-0 rounded-md border border-input bg-background p-3 text-base font-normal";
  const busy = save.isPending || portrait.isPending || gallery.isPending || remove.isPending;

  return <div className="min-h-screen bg-background"><AppHeader />
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" className="mb-4"><Link to="/cleaner"><ArrowLeft />Housekeeper panel</Link></Button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Edit my public page</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">{portfolio.data?.published ? "Published" : "Not published"}</span>
          {portfolio.data?.published && <Button asChild variant="outline"><Link to="/housekeepers/$id" params={{ id }}><ExternalLink />View public page</Link></Button>}
        </div>
      </div>
      {loading || (isCleaner && portfolio.isPending) ? <p className="mt-6 text-muted-foreground">Loading your page…</p> : !isCleaner ? <p className="mt-6">Housekeeper access required.</p> : <>
        {notice && <p role="status" className="mt-5 text-primary">{notice}</p>}
        {error && <p role="alert" className="mt-5 text-destructive">{error.message}</p>}
        {portfolio.isError ? <Button className="mt-4" onClick={() => portfolio.refetch()}>Try again</Button> : <>
          <form className="mt-8" onSubmit={e => { e.preventDefault(); setNotice(""); save.mutate(); }}>
            <section className="border-t border-border py-6">
              <h2 className="text-xl font-bold">Page details</h2>
              <div className="mt-5 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="min-w-0">
                  {portraitPreview ? <img src={portraitPreview} alt="Your portrait" className="aspect-square w-48 max-w-full rounded-md object-cover" /> : <div className="flex aspect-square w-48 max-w-full items-center justify-center rounded-md bg-muted"><UserRound className="h-16 w-16 text-muted-foreground" /></div>}
                  <label className="mt-4 block text-sm font-semibold">Your portrait<input type="file" aria-label="Upload portrait" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full min-w-0 text-sm" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) portrait.mutate(f); e.target.value = ""; }} /></label>
                  {form.portrait_path && <Button type="button" variant="ghost" size="sm" className="mt-3" disabled={busy} onClick={() => { setForm(f => ({ ...f, portrait_path: "" })); setPortraitPreview(""); setNotice("Portrait removed from your draft. Save your page to keep this change."); }}><Trash2 />Remove portrait</Button>}
                </div>
                <div className="min-w-0 space-y-4">
                  {([{ key: "display_name", label: "Display name", max: 100 }, { key: "headline", label: "Headline", max: 180 }, { key: "service_areas", label: "Service areas", max: 500 }] as const).map(f => <label key={f.key} className="block text-sm font-semibold">{f.label}<input required={f.key === "display_name"} maxLength={f.max} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className={input} /></label>)}
                  <label className="block text-sm font-semibold">About you<textarea maxLength={3000} rows={5} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className={input} /></label>
                </div>
              </div>
            </section>
            <section className="flex flex-wrap items-center justify-between gap-5 border-y border-border py-6">
              <div><h2 className="text-xl font-bold">Public visibility</h2><label htmlFor="page-published" className="mt-3 flex items-center gap-3 text-sm font-semibold"><Switch id="page-published" checked={form.published} disabled={busy} onCheckedChange={published => setForm(f => ({ ...f, published }))} />Publish my page and photos</label></div>
              <Button type="submit" disabled={busy}><Save />{save.isPending ? "Saving…" : "Save page"}</Button>
            </section>
          </form>
          <section className="pt-8">
            <h2 className="text-xl font-bold">Before & after gallery</h2>
            <form key={galleryVersion} className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); setNotice(""); gallery.mutate(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-semibold">Before photo<input aria-label="Before photo" required type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full min-w-0" onChange={e => setBefore(e.target.files?.[0] ?? null)} /></label>
                <label className="min-w-0 text-sm font-semibold">After photo<input aria-label="After photo" required type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full min-w-0" onChange={e => setAfter(e.target.files?.[0] ?? null)} /></label>
              </div>
              <label className="block text-sm font-semibold">Caption<input maxLength={200} value={caption} onChange={e => setCaption(e.target.value)} className={input} /></label>
              <Button type="submit" disabled={busy || !portfolio.data}><Upload />{gallery.isPending ? "Uploading…" : "Add photo pair"}</Button>
            </form>
            <div className="mt-8 space-y-8">{portfolio.data?.gallery.map(g => <article key={g.id} className="border-t border-border pt-6"><div className="grid gap-3 sm:grid-cols-2">{([{ label: "Before", url: g.before }, { label: "After", url: g.after }]).map(photo => <figure key={photo.label}><img src={photo.url} alt={`${photo.label}: ${g.caption}`} className="aspect-[4/3] w-full rounded-md object-cover" /><figcaption className="mt-2 text-sm font-semibold">{photo.label}</figcaption></figure>)}</div><div className="mt-3 flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm">{g.caption}</p><Button type="button" variant="outline" size="icon" className="shrink-0" title="Remove photo pair" aria-label="Remove photo pair" disabled={busy} onClick={() => remove.mutate(g)}><Trash2 /></Button></div></article>)}</div>
          </section>
        </>}
      </>}
    </main>
  </div>;
}
