import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'ReachInbox Scheduler',
  description: 'ReachInbox Scheduler Application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-900 text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
