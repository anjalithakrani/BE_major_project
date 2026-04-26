'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  patientId: string;
  patientName: string;
  stats: any;
}

export default function PatientReportAction({ patientId, patientName, stats }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setReport('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Not authenticated'); setLoading(false); return; }

      const res = await fetch('/api/physio/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ patientId, patientName }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to generate report'); setLoading(false); return; }

      setReport(data.summary);
    } catch (err) {
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!report) handleGenerate();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="gap-2 border-blue-200 text-blue-700"
      >
        <FileText className="w-4 h-4 text-blue-600" />
        AI Report
      </Button>

      {/* Modal backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 24,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, width: '100%',
              maxWidth: 720, maxHeight: '85vh', display: 'flex',
              flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
              padding: '20px 24px', color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  🩺 AI Progress Report
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 2 }}>
                  {patientName} · Last 30 days
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
                  <Spinner className="w-8 h-8" />
                  <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                    Analysing session data...
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, padding: '12px 16px', color: '#b91c1c',
                }}>
                  ⚠ {error}
                  <button
                    onClick={handleGenerate}
                    style={{ marginLeft: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {report && (
                <div style={{ lineHeight: 1.7, fontSize: '0.95rem', color: '#1f2937' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 style={{ fontSize: '1.3rem', color: '#1e3a8a', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.25rem', margin: '1.2rem 0 0.5rem' }}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ fontSize: '1.1rem', color: '#2563eb', margin: '1rem 0 0.4rem', fontWeight: 700 }}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ fontSize: '1rem', color: '#374151', margin: '0.8rem 0 0.3rem', fontWeight: 600 }}>
                          {children}
                        </h3>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ color: '#111827' }}>{children}</strong>
                      ),
                      li: ({ children }) => (
                        <li style={{ marginBottom: '0.3rem', marginLeft: '1.2rem' }}>{children}</li>
                      ),
                      p: ({ children }) => (
                        <p style={{ marginBottom: '0.75rem' }}>{children}</p>
                      ),
                    }}
                  >
                    {report}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Footer */}
            {report && !loading && (
              <div style={{
                padding: '16px 24px', borderTop: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
              }}>
                <Button variant="outline" onClick={handleGenerate} disabled={loading} className="gap-2">
                  <FileText className="w-4 h-4" /> Regenerate
                </Button>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}