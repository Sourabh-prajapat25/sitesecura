import React from "react";

interface BlogGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BlogGrid({ children, className = "" }: BlogGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 ${className}`}
    >
      {children}
    </div>
  );
}
