'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

export default function Header() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo / Title */}
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-lg font-bold tracking-tight text-white">
            ReachInbox Scheduler
          </span>
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-sm font-medium text-slate-200 leading-tight">
              {session.user.name}
            </span>
            <span className="text-xs text-slate-400 leading-tight">
              {session.user.email}
            </span>
          </div>

          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? 'User avatar'}
              width={36}
              height={36}
              className="rounded-full ring-2 ring-slate-700"
            />
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="ml-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
