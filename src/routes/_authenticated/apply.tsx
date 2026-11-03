import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { applicationsOptions, applicationSchema } from "@/lib/people-portals";
import { useAuth } from "@/hooks/use-auth";
import { hiringStage, openResume, validateResume } from "@/lib/hiring";
import { FileText, CheckCircle2, Clock, BriefcaseBusiness } from "lucide-react";
export const Route = createFileRoute("/_authenticated/apply")({ loader: ({ context }) => context.queryClient.ensureQueryData(applicationsOptions), head: () => ({ meta: [{ title:"Housekeeper Application | HousekeepingBooking.com" },{ name:"description",content:"Apply to join our housekeepers and follow your application." },{ property:"og:title",content:"Housekeeper Application | HousekeepingBooking.com" },{ property:"og:description",content:"Apply to join our cleaning team." },{ property:"og:type",content:"website" },{ name:"twitter:card",content:"summary" }] }), errorComponent: ApplyError, notFoundComponent: () => <p>Application page not found.</p>, component: Apply });
function ApplyError() { const router=useRouter(); return <div><AppHeader /><main className="p-6"><p>Couldn’t load applications.</p><Button onClick={()=>router.invalidate()}>Try again</Button></main></div>; }
function Apply() {
  const { user, isCleaner } = useAuth(); const qc = useQueryClient();
  const applications = useSuspenseQuery(applicationsOptions);
  const mine = applications.data.filter(a => a.user_id === user?.id);
  const active = mine.some(a => a.status === "submitted" || a.status === "reviewing" || a.status === "hired");
  const [form, setForm] = useState({ full_name: "", phone: "", service_areas: "", experience: "", availability: "" });
  const [resume, setResume] = useState<File | null>(null); const [fileError, setFileError] = useState("");
  const viewResume = useMutation({ mutationFn: openResume });
  const submit = useMutation({ mutationFn: async () => {
    if (!user) throw new Error("Please sign in.");
    const clean = applicationSchema.parse(form);
    let path = "";
    if (resume) {
      validateResume(resume);
      path = `${user.id}/${crypto.randomUUID()}.${resume.name.split(".").pop()?.toLowerCase()}`;
      const { error } = await supabase.storage.from("hiring-resumes").upload(path, resume, { upsert: false });
      if (error) throw new Error("Resume upload failed. Please try again.");
    }
    const { error } = await supabase.from("hiring_applications").insert({ ...clean, user_id: user.id, resume_path: path, resume_name: resume?.name.slice(0, 200) ?? "" });
    if (error) { if (path) await supabase.storage.from("hiring-resumes").remove([path]); throw new Error("Could not submit your application. Please try again."); }
  }, onSuccess: () => { setResume(null); qc.invalidateQueries({ queryKey: ["hiring-applications"] }); } });
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Housekeeper applications</p><h1 className="mt-1 text-3xl font-bold">{mine.length ? "My hiring progress" : "Join our housekeepers"}</h1></div>{isCleaner && <Button asChild><Link to="/cleaner"><BriefcaseBusiness />Open cleaner portal</Link></Button>}</div>
    <section className="mt-8 space-y-5" aria-label="My applications">{mine.map(a => <article key={a.id} className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{a.full_name}</h2><span className="text-sm font-semibold capitalize text-primary">{a.status === "hired" ? "Approved" : a.status}</span></div>
      <p className="mt-1 text-sm text-muted-foreground">Applied {new Date(a.created_at).toLocaleDateString()}</p>
      <ol className="mt-5 grid grid-cols-3 gap-2">{["Submitted", "Under review", "Approved"].map((label, index) => <li key={label} className={`border-t-2 pt-3 text-sm ${hiringStage(a.status) > index && a.status !== "declined" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}><span className="mb-1 block">{hiringStage(a.status) > index && a.status !== "declined" ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}</span>{label}</li>)}</ol>
      <p className="mt-5 text-sm text-muted-foreground">{a.status === "submitted" ? "Your application has been received." : a.status === "reviewing" ? "Your application is being reviewed." : a.status === "declined" ? "Your application was not selected." : "Your application was approved. Your cleaner account is enabled."}</p>
      {a.resume_path && <Button variant="outline" className="mt-4 max-w-full" disabled={viewResume.isPending} onClick={() => viewResume.mutate(a.resume_path)}><FileText className="shrink-0" /><span className="truncate">{a.resume_name || "View resume"}</span></Button>}
    </article>)}</section>
    {viewResume.error && <p role="alert" className="mt-3 text-destructive">{viewResume.error.message}</p>}
    {!active && !isCleaner && <form className="mt-6 space-y-4" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
      {([{ key: "full_name", label: "Full name", max: 100 }, { key: "phone", label: "Phone", max: 30 }, { key: "service_areas", label: "Service areas", max: 500 }, { key: "experience", label: "Cleaning experience", max: 3000 }, { key: "availability", label: "Availability", max: 1000 }] as const).map(f => <label key={f.key} className="block text-sm font-semibold">{f.label}<textarea required={f.key !== "phone"} rows={f.key === "experience" ? 4 : 2} maxLength={f.max} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background p-3 text-foreground" /></label>)}
      <label className="block text-sm font-semibold">Resume <span className="font-normal text-muted-foreground">(optional)</span><input type="file" accept=".pdf,.doc,.docx" className="mt-2 block w-full min-w-0 rounded-md border border-input p-3 text-sm" onChange={e => { const file = e.target.files?.[0]; setFileError(""); setResume(null); if (file) { try { validateResume(file); setResume(file); } catch (error) { setFileError(error instanceof Error ? error.message : "Invalid resume."); e.target.value = ""; } } }} /><span className="mt-1 block text-xs font-normal text-muted-foreground">PDF, DOC or DOCX · up to 5 MB · private to you and hiring admins</span></label>
      {(fileError || submit.error) && <p role="alert" className="text-destructive">{fileError || submit.error?.message}</p>}
      <Button disabled={submit.isPending || !!fileError}>{submit.isPending ? "Submitting…" : "Submit application"}</Button>
    </form>}
  </main></div>;
}