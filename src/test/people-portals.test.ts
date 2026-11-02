import { describe,it,expect } from "vitest";
import { messageSchema,applicationSchema } from "../lib/people-portals";
describe("people portal validation",()=>{
 it("rejects blank messages and messages exceeding 3000 characters",()=>{expect(messageSchema.safeParse("   ").success).toBe(false);expect(messageSchema.safeParse("x".repeat(3001)).success).toBe(false);expect(messageSchema.parse(" hello ")).toBe("hello");});
 it("requires applicant experience and availability",()=>{const form={full_name:"Applicant",phone:"",service_areas:"Central PA",experience:"Cleaning homes",availability:"Weekdays"};expect(applicationSchema.safeParse(form).success).toBe(true);expect(applicationSchema.safeParse({...form,experience:""}).success).toBe(false);expect(applicationSchema.safeParse({...form,availability:""}).success).toBe(false);});
});