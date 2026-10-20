import React from "react";

export function BlogCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between animate-pulse">
      {/* Thumbnail placeholder */}
      <div className="aspect-[16/9] w-full bg-slate-200"></div>

      {/* Body placeholder */}
      <div className="p-6 space-y-4 flex-1">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-slate-200 rounded-full"></div>
          <div className="h-4 w-16 bg-slate-100 rounded"></div>
        </div>

        <div className="space-y-2">
          <div className="h-5 w-full bg-slate-200 rounded"></div>
          <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="h-3 w-full bg-slate-100 rounded"></div>
          <div className="h-3 w-5/6 bg-slate-100 rounded"></div>
          <div className="h-3 w-2/3 bg-slate-100 rounded"></div>
        </div>

        <div className="flex gap-1.5 pt-2">
          <div className="h-4 w-12 bg-slate-100 rounded"></div>
          <div className="h-4 w-14 bg-slate-100 rounded"></div>
        </div>
      </div>

      {/* Footer placeholder */}
      <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200"></div>
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
        </div>
        <div className="h-3 w-16 bg-slate-200 rounded"></div>
      </div>
    </div>
  );
}

export function FeaturedArticleSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[360px]">
        <div className="lg:col-span-7 bg-slate-200 min-h-[240px]"></div>
        <div className="lg:col-span-5 p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-28 bg-slate-200 rounded-full"></div>
              <div className="h-6 w-20 bg-slate-100 rounded-full"></div>
            </div>
            <div className="h-7 w-full bg-slate-200 rounded"></div>
            <div className="h-7 w-4/5 bg-slate-200 rounded"></div>
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-slate-100 rounded"></div>
              <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200"></div>
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
            </div>
            <div className="h-9 w-28 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlogGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {Array.from({ length: count }).map((_, idx) => (
        <BlogCardSkeleton key={`skeleton-${idx}`} />
      ))}
    </div>
  );
}
