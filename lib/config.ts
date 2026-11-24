export const catalogPhotoCapacity = 3 * 1024 * 1024;

type DemoConfig = {
  paymentMode: "simulation" | "disabled";
  campusEmailDomains: readonly string[];
  servicePercent: number;
  promotion: { price: number; days: number };
};

export const demoConfig: DemoConfig = {
  paymentMode: "simulation",
  campusEmailDomains: ["binus.ac.id", "binus.edu"],
  servicePercent: 10,
  promotion: { price: 10000, days: 7 },
};
