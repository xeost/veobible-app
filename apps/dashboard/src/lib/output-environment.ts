/** Request routing for the shared local generation service; never persisted in D1. */
export function outputEnvironment(): "production" | "development" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
