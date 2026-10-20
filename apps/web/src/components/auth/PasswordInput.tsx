"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string | null;
  helperText?: string;
  rightAction?: React.ReactNode;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      id,
      label = "Password",
      error,
      helperText,
      rightAction,
      className = "",
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || "password-input";

    return (
      <div className="w-full space-y-1">
        {(label || rightAction) && (
          <div className="flex items-center justify-between">
            {label && (
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold text-slate-700 tracking-tight"
              >
                {label} {required && <span className="text-red-500">*</span>}
              </label>
            )}
            {rightAction && <div className="text-xs">{rightAction}</div>}
          </div>
        )}

        <div className="relative rounded-xl shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Lock className="w-4 h-4" />
          </div>

          <input
            {...props}
            ref={ref}
            id={inputId}
            type={showPassword ? "text" : "password"}
            required={required}
            disabled={disabled}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            className={`w-full rounded-xl border bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                : "border-slate-300 focus:border-sky-500 focus:ring-sky-500/20"
            } ${className}`}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={disabled}
            aria-label={showPassword ? "Hide password text" : "Show password text"}
            aria-pressed={showPassword}
            tabIndex={0}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:text-sky-600 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-600 font-medium pt-0.5" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-[11px] text-slate-500 pt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
