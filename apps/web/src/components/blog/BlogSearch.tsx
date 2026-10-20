import React from "react";
import { Search, X } from "lucide-react";

interface BlogSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function BlogSearch({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search technical guides (e.g. SSL, CSP, SPF, HSTS)...",
  className = "",
}: BlogSearchProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      role="search"
      aria-label="Search articles"
      onSubmit={handleSubmit}
      className={`relative flex items-center w-full ${className}`}
    >
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={150}
        className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-500 transition-all shadow-inner"
      />

      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search query"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="submit"
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
        >
          Search
        </button>
      </div>
    </form>
  );
}
