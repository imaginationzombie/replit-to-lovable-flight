import { createFileRoute, redirect } from "@tanstack/react-router";

// The site is a set of static HTML pages served from /public; send "/" to the home page.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/index.html" });
  },
  head: () => ({
    meta: [
      { title: "HousekeepingBooking.com | Pristine Living in Central PA" },
      { name: "description", content: "Book trusted house cleaners in Central PA." },
      { property: "og:title", content: "HousekeepingBooking.com" },
      { property: "og:description", content: "Book trusted house cleaners in Central PA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
