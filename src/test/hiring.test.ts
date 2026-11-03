import { expect, it } from "vitest";
import { applicantAccess, hiringStage, INTERVIEW_TIMES, validateResume } from "../lib/hiring";
it("a new customer/applicant has no cleaner access", () => { expect(applicantAccess(["customer"])).toBe(false); });
it("only an actual cleaner role enables cleaner access", () => { expect(applicantAccess(["customer", "cleaner"])).toBe(true); expect(applicantAccess(["hired"])).toBe(false); });
it("accepts resume documents but rejects executable uploads", () => { expect(() => validateResume({ name: "resume.pdf", size: 100 })).not.toThrow(); expect(() => validateResume({ name: "resume.docx", size: 100 })).not.toThrow(); expect(() => validateResume({ name: "resume.exe", size: 100 })).toThrow(); });
it("enforces the 5 MB resume maximum", () => { expect(() => validateResume({ name: "resume.pdf", size: 5 * 1024 * 1024 })).not.toThrow(); expect(() => validateResume({ name: "resume.pdf", size: 5 * 1024 * 1024 + 1 })).toThrow(); });
it("tracks submitted, reviewing, interview and hired in order", () => { expect(hiringStage("submitted")).toBe(1); expect(hiringStage("reviewing")).toBe(2); expect(hiringStage("interview")).toBe(3); expect(hiringStage("hired")).toBe(4); });
it("offers only 9am, 12pm, 3pm and 6pm interview calls", () => { expect(INTERVIEW_TIMES.map(t => t.label)).toEqual(["9am","12pm","3pm","6pm"]); });