'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const fieldBase =
  'w-full rounded-xl border bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition focus:outline-none focus:ring-1';

const fieldNormal = 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500';
const fieldError  = 'border-red-500/60 focus:border-red-500 focus:ring-red-500';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...rest }, ref) => (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        ref={ref}
        className={[fieldBase, error ? fieldError : fieldNormal, className].join(' ')}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...rest }, ref) => (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      )}
      <textarea
        ref={ref}
        className={[fieldBase, error ? fieldError : fieldNormal, className].join(' ')}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';
