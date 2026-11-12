export function roomCare(bedrooms: number, bathrooms: number) {
  return [
    { room: "Kitchen", product: "Food-safe surface cleaner, mild dish soap and microfiber cloths", tasks: ["Wipe counters and cabinet fronts", "Clean sink and faucet", "Wipe appliance exteriors", "Sweep and mop floor"] },
    ...Array.from({ length: bedrooms }, (_, i) => ({ room: `Bedroom ${i + 1}`, product: "Gentle surface cleaner and a vacuum with upholstery attachment", tasks: ["Dust furniture and reachable surfaces", "Vacuum floor and rugs", "Empty wastebasket", "Straighten bed"] })),
    ...Array.from({ length: bathrooms }, (_, i) => ({ room: `Bathroom ${i + 1}`, product: "Bathroom cleaner suitable for the surface, glass cleaner and toilet cleaner", tasks: ["Clean and disinfect toilet", "Clean sink, shower and tub", "Wipe mirrors and fixtures", "Mop floor and empty bin"] })),
    { room: "Living areas", product: "pH-neutral floor cleaner and microfiber dusting cloths", tasks: ["Dust reachable surfaces", "Vacuum rugs and upholstery", "Sweep and mop hard floors", "Empty bins and final walkthrough"] },
  ];
}
