'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import ComposeModal from '@/components/ComposeModal';
import { getScheduledEmails, getSentEmails, getFailedEmails, retryEmail, EmailRecord } from '@/lib/api';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [failedEmails, setFailedEmails] = useState<EmailRecord[]>([]);
  const [totalScheduled, setTotalScheduled] = useState<number>(0);
  const [totalSent, setTotalSent] = useState<number>(0);
  const [totalFailed, setTotalFailed] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const fetchData = async () => {
    if (!session?.user?.email) return;
    
    const [scheduledRes, sentRes, failedRes] = await Promise.all([
      getScheduledEmails({ sender: session.user.email, limit: 10 }),
      getSentEmails({ sender: session.user.email, limit: 10 }),
      getFailedEmails({ sender: session.user.email, limit: 10 }),
    ]);

    if (scheduledRes) {
      setScheduledEmails(scheduledRes.emails);
      setTotalScheduled(scheduledRes.total);
    }
    
    if (sentRes) {
      setSentEmails(sentRes.emails);
      setTotalSent(sentRes.total);
    }
    
    if (failedRes) {
      setFailedEmails(failedRes.emails);
      setTotalFailed(failedRes.total);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      
      // Setup Real-time SSE Connection
      const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/events/stream`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'email_scheduled') {
            toast.success(`Email to ${data.data.recipientEmail} added to queue!`);
            fetchData();
          } else if (data.type === 'email_status_update') {
            if (data.data.status === 'SENT') {
              toast.success('An email was successfully sent!');
            } else if (data.data.status === 'FAILED') {
              toast.error('An email failed to send.');
            }
            fetchData(); // Refresh lists on status change
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      return () => eventSource.close();
    }
  }, [status, session]);

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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Title Row with Compose Button */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-slate-400">
              Welcome back, {session.user?.name?.split(' ')[0]}! Manage your scheduled emails below.
            </p>
          </div>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose
          </button>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Scheduled</div>
            <div className="mt-2 text-3xl font-bold text-indigo-400">{isLoading ? '...' : totalScheduled}</div>
            <div className="mt-1 text-xs text-slate-500">Pending emails in queue</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Sent</div>
            <div className="mt-2 text-3xl font-bold text-emerald-400">{isLoading ? '...' : totalSent}</div>
            <div className="mt-1 text-xs text-slate-500">Successfully delivered</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Failed</div>
            <div className="mt-2 text-3xl font-bold text-amber-400">{isLoading ? '...' : totalFailed}</div>
            <div className="mt-1 text-xs text-slate-500">Delivery failures</div>
          </div>
        </div>

        {/* Active Scheduled Emails Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-lg font-medium leading-6 text-white">Pending Scheduled Emails</h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading emails...</div>
          ) : scheduledEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No scheduled emails in the queue.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Scheduled For</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scheduledEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                        {email.subject.length > 40 ? `${email.subject.substring(0, 40)}...` : email.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{email.recipientEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {new Date(email.scheduledTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                          {email.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sent Emails Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-lg font-medium leading-6 text-white">Recently Sent Emails</h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading emails...</div>
          ) : sentEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No sent emails yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Sent At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sentEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                        {email.subject.length > 40 ? `${email.subject.substring(0, 40)}...` : email.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{email.recipientEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {email.sentTime ? new Date(email.sentTime).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
                          {email.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Failed Emails Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-slate-800">
            <h3 className="text-lg font-medium leading-6 text-white">Failed Emails</h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading emails...</div>
          ) : failedEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No failed emails! 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {failedEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                        {email.subject.length > 40 ? `${email.subject.substring(0, 40)}...` : email.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{email.recipientEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700/50">
                          {email.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <button
                          onClick={async () => {
                            await retryEmail(email.id);
                            fetchData();
                          }}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-900/20 px-3 py-1 rounded-md border border-indigo-800/50 hover:bg-indigo-900/40"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          fetchData(); // Refresh data immediately after closing modal
        }}
        senderEmail={session.user?.email || ''}
      />
    </div>
  );
}
