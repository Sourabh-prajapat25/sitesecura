"use client";

import { useEffect } from "react";
import { trackContentEvent } from "@/lib/analytics";

interface ResourceDetailTelemetryProps {
  slug: string;
  resourceType?: string;
}

export function ResourceDetailTelemetry({ slug, resourceType }: ResourceDetailTelemetryProps) {
  useEffect(() => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: resourceType || "resource",
      content_id: slug,
      source: "resource_page",
    });
  }, [slug, resourceType]);

  return null;
}
