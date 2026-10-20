"use client";

import { useEffect } from "react";
import { trackContentEvent } from "@/lib/analytics";

interface BlogArticleTelemetryProps {
  slug: string;
}

export function BlogArticleTelemetry({ slug }: BlogArticleTelemetryProps) {
  useEffect(() => {
    trackContentEvent({
      event_name: "blog_article_view",
      content_type: "blog_post",
      content_id: slug,
      source: "blog_page",
    });
  }, [slug]);

  return null;
}
