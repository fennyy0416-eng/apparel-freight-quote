/* Demo rules. Replace with supplier rules before issuing binding quotes.
   Quantities below are pricing estimates, not capacity guarantees. */
globalThis.FreightRules={cbmPerPallet:2,fullLoadThresholdCbm:60,referenceCbmPerLoad:60,defaultContainer:'40HQ',demoPalletRates:{west:90,central:150,east:200},demoTruckRates:{west:1300,central:3600,east:4800},demoDrayageRates:{west:650,central:1100,east:1450},demoTransloadPerCbm:12};

// Owner-supplied LA–NY costs, 2026-10-01. Markup is cost × 10%, not gross margin.
globalThis.FreightRules.laNy={ftlCost:8700,ltlCostPerPallet:350,markup:0.10,updated:'2026-10-01'};
