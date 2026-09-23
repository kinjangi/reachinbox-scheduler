'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-10 shadow-2xl text-center">
          {/* Logo */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-indigo-500/30">
            <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            ReachInbox Scheduler
          </h1>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Schedule and manage your email campaigns with intelligent rate limiting, queue management, and Slack notifications.
          </p>

          {/* Login Form */}
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (email) {
                try {
                  const res = await signIn('credentials', { 
                    email, 
                    password: 'password', 
                    redirect: false 
                  });
                  if (res?.ok) {
                    router.push('/dashboard');
                  } else {
                    console.error('Sign in failed:', res?.error);
                    alert('Sign in failed: ' + res?.error);
                  }
                } catch (err) {
                  console.error('Sign in error:', err);
                }
              }
            }}
            className="space-y-4"
          >
            <div>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your personal email"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <button
              type="submit"
              className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Sign In
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-600">
          <span>Express + BullMQ</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span>Next.js + Tailwind</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span>PostgreSQL + Redis</span>
        </div>
      </div>
    </main>
  );
}
