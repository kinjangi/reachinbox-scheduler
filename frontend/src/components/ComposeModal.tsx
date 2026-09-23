'use client';

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';
import { scheduleEmails } from '@/lib/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderEmail: string;
}

export default function ComposeModal({ isOpen, onClose, senderEmail }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientText, setRecipientText] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayMs, setDelayMs] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseTextEmails = useCallback((text: string): string[] => {
    return [...new Set(
      text.split(/[,;\n\r]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@') && e.includes('.')),
    )];
  }, []);

  const derivedEmails = recipientText.trim() ? parseTextEmails(recipientText) : parsedEmails;
  const emailCount = derivedEmails.length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const emailColumn = Object.keys(results.data[0] || {}).find((k) =>
          k.toLowerCase().includes('email') || k.toLowerCase().includes('recipient'),
        );
        let emails: string[] = [];
        if (emailColumn) {
          emails = results.data.map((r) => r[emailColumn]?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes('@'));
        } else {
          emails = results.data.flatMap((r) =>
            Object.values(r).map((v) => v?.trim().toLowerCase()).filter((v): v is string => !!v && v.includes('@') && v.includes('.')),
          );
        }
        setParsedEmails([...new Set(emails)]);
        setRecipientText('');
      },
    });
  };

  const resetForm = () => {
    setSubject(''); setBody(''); setRecipientText(''); setParsedEmails([]);
    setStartTime(''); setDelayMs(''); setHourlyLimit(''); setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSchedule = async () => {
    if (!subject || !body || emailCount === 0) return;
    setIsSubmitting(true);

    const result = await scheduleEmails({
      senderEmail,
      subject,
      body,
      recipients: derivedEmails,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      delayMs: delayMs ? parseInt(delayMs, 10) : undefined,
      hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
    });

    setIsSubmitting(false);
    if (result?.status === 'success') {
      resetForm();
      onClose();
    }
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
      <Button
        onClick={handleSchedule}
        isLoading={isSubmitting}
        disabled={!subject || !body || emailCount === 0}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
        {isSubmitting ? 'Scheduling…' : `Schedule${emailCount > 0 ? ` (${emailCount})` : ''}`}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Compose &amp; Schedule" size="lg" footer={footer}>
      <div className="space-y-5">
        {/* Recipients */}
        <div>
          <Textarea
            label="Recipients"
            value={recipientText}
            onChange={(e) => { setRecipientText(e.target.value); setParsedEmails([]); setFileName(''); }}
            placeholder="Paste emails separated by commas, semicolons, or newlines…"
            rows={3}
          />

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-2 text-sm text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload CSV / TXT
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} className="hidden" />
            {fileName && <span className="text-xs text-slate-500 truncate max-w-[200px]">{fileName}</span>}
          </div>

          {emailCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 ring-1 ring-indigo-500/20">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">{emailCount} email{emailCount !== 1 ? 's' : ''} detected</span>
            </div>
          )}
        </div>

        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter email subject…" />

        <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Compose your email body…" rows={5} />

        {/* Scheduling Options */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wider">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition [color-scheme:dark]"
            />
          </div>
          <Input label="Delay (ms)" type="number" value={delayMs} onChange={(e) => setDelayMs(e.target.value)} placeholder="0" min={0} />
          <Input label="Hourly Limit" type="number" value={hourlyLimit} onChange={(e) => setHourlyLimit(e.target.value)} placeholder="100" min={1} />
        </div>
      </div>
    </Modal>
  );
}
