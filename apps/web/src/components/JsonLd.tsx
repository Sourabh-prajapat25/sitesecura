import React from "react";
import { safeJsonLd } from "@/lib/seo";

interface JsonLdProps {
  data: Record<string, any> | Array<Record<string, any>> | null | undefined;
}

/**
 * Renders safe Schema.org JSON-LD scripts inside the HTML head or body.
 * Guaranteed immunization against </script> breakouts by encoding < and > into unicode escapes.
 */
export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;

  const serialized = safeJsonLd(data);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
}
