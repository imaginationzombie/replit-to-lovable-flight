import { supabase } from "@/integrations/supabase/client";
export const RESUME_LIMIT = 5 * 1024 * 1024;
export function validateResume(file: { name: string; size: number }) {
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) throw new Error("Choose a PDF, DOC or DOCX resume.");
  if (file.size <= 0 || file.size > RESUME_LIMIT) throw new Error("Your resume must be between 1 byte and 5 MB.");
}
export function applicantAccess(roles: string[]) { return roles.includes("cleaner"); }
export function hiringStage(status: string) {
  return status === "hired" ? 3 : status === "reviewing" ? 2 : 1;
}
export async function openResume(path: string) {
  const { data, error } = await supabase.storage.from("hiring-resumes").createSignedUrl(path, 60);
  if (error) throw new Error("Could not open the resume. Please try again.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}