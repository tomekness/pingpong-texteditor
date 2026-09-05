'use client'

import { useEffect, useState, useCallback } from 'react'

interface Stats {
  docs:  { total: number; today: number; week: number; live: number }
  pings: { total: number; today: number; week: number }
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function AdminPage() {
  const [token, setToken] = useState<string>('')
  const [input, setInput] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('admin-token')
    if (stored) setToken(stored)
  }, [])

  const fetchStats = useCallback(async (pw: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${pw}` },
      })
      if (res.status === 401) { setError('Wrong password'); setToken(''); sessionStorage.removeItem('admin-token'); return }
      if (!res.ok) { setError(`Error ${res.status}`); return }
      setStats(await res.json())
      setLastRefresh(new Date())
    } catch {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    fetchStats(token)
    const interval = setInterval(() => fetchStats(token), 30_000)
    return () => clearInterval(interval)
  }, [token, fetchStats])

  const login = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sessionStorage.setItem('admin-token', input)
    setToken(input)
  }

  if (!token) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <img src="/logo.svg" alt="Pingpong" width={32} height={32} />
          <h1 className="admin-login-title">Admin</h1>
          <form onSubmit={login} className="admin-login-form">
            <input
              className="admin-login-input"
              type="password"
              placeholder="Password"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoFocus
            />
            <button className="overlay-start-btn" type="submit">Enter →</button>
          </form>
          {error && <p className="admin-error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/logo.svg" alt="Pingpong" width={24} height={24} />
          <span className="admin-topbar-title">Pingpong Admin</span>
        </div>
        <div className="admin-topbar-right">
          {lastRefresh && (
            <span className="admin-refresh-label">
              Updated {lastRefresh.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="topbar-icon-btn" onClick={() => fetchStats(token)} title="Refresh" disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
          <button className="topbar-icon-btn" onClick={() => { sessionStorage.removeItem('admin-token'); setToken(''); setStats(null) }} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="admin-error-bar">{error}</div>}

      {stats && (
        <div className="admin-content">
          <section className="admin-section">
            <h2 className="admin-section-title">Documents</h2>
            <div className="stat-grid">
              <StatCard label="Total" value={stats.docs.total} />
              <StatCard label="Active today" value={stats.docs.today} />
              <StatCard label="Active this week" value={stats.docs.week} />
              <StatCard label="Live now" value={stats.docs.live} sub="open connections" />
            </div>
          </section>

          <section className="admin-section">
            <h2 className="admin-section-title">Pings</h2>
            <div className="stat-grid">
              <StatCard label="Total" value={stats.pings.total} />
              <StatCard label="Today" value={stats.pings.today} />
              <StatCard label="This week" value={stats.pings.week} />
            </div>
          </section>

        </div>
      )}

      {loading && !stats && <div className="admin-loading">Loading…</div>}
    </div>
  )
}
