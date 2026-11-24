import { onlineDemo } from "./hosting.ts";
export const demoVerificationEnabled = () => onlineDemo() || (process.env.NODE_ENV !== "production" &&
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || process.env.BORROWBUDDY_DEMO_SEED === "1"));
