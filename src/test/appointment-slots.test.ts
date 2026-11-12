import { expect, it } from "vitest";
import { validateSlot, slotWindow } from "../lib/appointment-slots";
it("permits individual appointments outside standard arrival windows", () => { expect(() => validateSlot("06:00", "07:30")).not.toThrow(); expect(() => validateSlot("21:00", "23:00")).not.toThrow(); });
it("requires an appointment end after its start", () => { expect(() => validateSlot("11:00", "10:00")).toThrow(); expect(() => validateSlot("11:00", "11:00")).toThrow(); });
it("maps exact appointments to the existing schedule window without changing exact times", () => { expect(slotWindow("09:30")).toBe("Morning (8am–12pm)"); expect(slotWindow("13:30")).toBe("Afternoon (12pm–4pm)"); expect(slotWindow("18:30")).toBe("Evening (4pm–7pm)"); });