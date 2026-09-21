import { randomBytes } from "node:crypto";

const referencePrefix = "RYC-";

/** Human-friendly booking reference, e.g. "RYC-2A4F9C". Unique per DB unique rule. */
export function generateReference(): string {
  return `${referencePrefix}${randomBytes(3).toString("hex").toUpperCase()}`;
}