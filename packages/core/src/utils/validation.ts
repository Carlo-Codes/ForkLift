import type { z } from "zod";

import { ApiError } from "@forklift/debug";

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map(i => i.message).join("; "), "ValidationError");
  }

  return parsed.data;
}
