import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const publicPortfolio = createServerFn({ method: "GET" }).inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Housekeeper pages are temporarily unavailable.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const { data: profile, error } = await db.from("housekeeper_portfolios").select("user_id,display_name,headline,bio,service_areas,portrait_path,published,updated_at").eq("user_id", data.id).eq("published", true).maybeSingle();
  if (error) throw new Error("Could not load this housekeeper page.");
  if (!profile) return null;
  const { data: gallery, error: galleryError } = await db.from("housekeeper_gallery").select("id,caption,before_path,after_path").eq("user_id", data.id).order("created_at", { ascending: false });
  if (galleryError) throw new Error("Could not load cleaning photos.");
  async function photo(path: string) {
    if (!path) return "";
    const { data: signed, error } = await db.storage.from("housekeeper-portfolios").createSignedUrl(path, 3600);
    if (error) throw new Error("Could not load this photo.");
    return signed.signedUrl;
  }
  return { ...profile, portrait: await photo(profile.portrait_path), gallery: await Promise.all((gallery ?? []).map(async g => ({ ...g, before: await photo(g.before_path), after: await photo(g.after_path) }))) } as {
    user_id: string; display_name: string; headline: string; bio: string; service_areas: string; portrait_path: string; published: boolean; updated_at: string; portrait: string;
    gallery: { id: string; caption: string; before_path: string; after_path: string; before: string; after: string }[];
  };
});