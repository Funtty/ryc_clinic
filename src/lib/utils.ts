import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

/**
 * Serialize a value for embedding inside an inline <script> tag.
 *
 * `JSON.stringify` alone is unsafe there: DB-controlled strings containing
 * `</script>` terminate the element and execute as markup. Escaping the JSON
 * punctuation and the U+2028/2029 line separators (valid in JSON, illegal in a
 * JS string literal) produces an equivalent document that a parser can still
 * read, but that can never break out of the script element.
 */
export function toEmbeddedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Formats an integer amount in the clinic currency. */
export function formatMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}