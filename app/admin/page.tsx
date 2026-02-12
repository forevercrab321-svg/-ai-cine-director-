
'use client';

import React, { useState, useEffect } from 'react';
import { LoaderIcon, CheckIcon } from '../components/IconComponents';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  // We can't strictly check DISABLE_ADMIN on client, but the API will 403
  // Here we just handle the UI

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/admin/replicate-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setStatus({ type: 'success', msg: 'Production Token Updated Successfully' });
      setToken(''); // Clear sensitive input
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
      if (err.message.includes('disabled')) setIsDisabled(true);
    } finally {
      setLoading(false);
    }
  };

  if (isDisabled) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
          <p className="text-slate-600">Admin interface is permanently disabled for this deployment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Production Control</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">System Admin v3.1</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Admin Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">New Replicate Token</label>
            <input 
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="r8_..."
            />
            <p className="text-[10px] text-slate-600 mt-2 px-1 italic">
              * This token will be stored in a persistent server-side database.
            </p>
          </div>

          {status && (
            <div className={`p-3 rounded-lg text-sm border ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <div className="flex items-center gap-2">
                {status.type === 'success' ? <CheckIcon className="w-4 h-4" /> : '⚠️'}
                {status.msg}
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <LoaderIcon className="w-5 h-5" /> : "Authorize & Deploy Key"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-slate-500 hover:text-white transition-colors">Return to Studio &rarr;</a>
        </div>
      </div>
    </div>
  );
}
