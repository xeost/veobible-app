import { z } from "zod";

// Store a bare hostname for display in the video, without a scheme or path.
export const videoDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$|^$/)
  .default("");
