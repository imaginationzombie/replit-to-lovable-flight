import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, onClick, search }: { children: React.ReactNode; onClick: () => void; search: { housekeeper: string } }) => <a href={`/book?housekeeper=${search.housekeeper}`} onClick={e => { e.preventDefault(); onClick(); }}>{children}</a> }));
import { HousekeeperEstimator } from "../components/HousekeeperEstimator";
afterEach(() => { cleanup(); sessionStorage.clear(); });
it("carries the client's estimate selections and chosen housekeeper into booking", () => {
  render(<HousekeeperEstimator id="11111111-1111-4111-8111-111111111111" name="Housekeeper" areas="Lewistown, PA" />);
  fireEvent.change(screen.getByLabelText("Bedrooms"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Bathrooms"), { target: { value: "2" } });
  fireEvent.click(screen.getByLabelText(/Microwave & Hood/));
  fireEvent.click(screen.getByRole("button", { name: /Medium/ }));
  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toBe("/book?housekeeper=11111111-1111-4111-8111-111111111111");
  fireEvent.click(link);
  expect(JSON.parse(sessionStorage.getItem("hkb-booking-draft") ?? "{}")).toMatchObject({ source: "estimator", bedrooms: 3, bathrooms: 2, cleaningLevel: "Medium", addOns: ["Microwave & Hood"], serviceArea: "Lewistown, PA" });
});