type JsonLdProps = {
  data: Record<string, unknown>;
};

import { toEmbeddedJson } from "@/lib/utils";

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toEmbeddedJson(data) }}
    />
  );
}