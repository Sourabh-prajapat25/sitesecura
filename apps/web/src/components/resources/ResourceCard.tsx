"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  CheckSquare,
  Wrench,
  Download,
  ExternalLink,
  ArrowRight,
  Shield,
  BookOpen,
} from "lucide-react";
import { Resource } from "@/types";
import { trackContentEvent } from "@/lib/analytics";

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "checklist":
        return CheckSquare;
      case "tool":
        return Wrench;
      case "template":
        return FileText;
      case "guide":
        return BookOpen;
      default:
        return Shield;
    }
  };

  const Icon = getIcon(resource.resource_type);

  const handleDownload = () => {
    trackContentEvent({
      event_name: "resource_download",
      content_type: "resource",
      content_id: resource.slug,
      source: "resource_card",
    });
  };

  const handleExternalClick = () => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: "resource",
      content_id: resource.slug,
      source: "resource_card_external",
    });
  };

  return (
    <article className="group bg-white hover:bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
      <div className="space-y-4">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 uppercase tracking-wide">
              <Icon className="w-3 h-3 text-sky-600" />
              <span>{resource.resource_type}</span>
            </span>
            {resource.category && (
              <span className="inline-block text-xs text-slate-600 font-medium px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60">
                {resource.category}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
          <Link href={`/resources/${resource.slug}`}>{resource.title}</Link>
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
          {resource.description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <Link
          href={`/resources/${resource.slug}`}
          className="font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 transition-colors"
        >
          <span>View Resource</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="flex items-center gap-2">
          {resource.file_url && (
            <a
              href={resource.file_url}
              onClick={handleDownload}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
              title="Download file asset"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>
          )}
          {resource.external_url && (
            <a
              href={resource.external_url}
              onClick={handleExternalClick}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
              title="Open external documentation"
            >
              <ExternalLink className="w-3 h-3" />
              <span>External</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
