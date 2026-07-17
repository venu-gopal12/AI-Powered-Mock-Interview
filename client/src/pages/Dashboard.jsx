import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2, TrendingUp, MessageSquare, Award, AlertCircle, RefreshCw } from 'lucide-react';

const Dashboard = () => {
  // Dashboard reads completed sessions from localStorage; there is no backend
  // analytics store in this app.
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // FIX #7 & #8: Extracted into a useCallback so it can be called on mount
  // AND manually triggered (refresh button). Also only reads scorecard fields —
  // no longer loads full message arrays into memory.
  const fetchAnalytics = useCallback(() => {
    try {
      setLoading(true);
      setError(null);

      const saved = localStorage.getItem('savedSessions');
      const pastSessions = saved ? JSON.parse(saved) : [];

      // Flatten each saved scorecard into the shape Recharts and feedback cards
      // need, while tolerating older sessions with missing fields.
      const formattedData = pastSessions.map((s, index) => ({
        name: `Attempt ${index + 1}`,
        Tech: s.scorecard?.technical_score ?? 0,
        Comm: s.scorecard?.communication_score ?? 0,
        feedback: s.scorecard?.feedback || '',
        improvement: s.scorecard?.improvement || '',
        Overall: s.scorecard?.overall_score ??
          Math.round((s.scorecard?.technical_score ?? 0) * 0.6 + (s.scorecard?.communication_score ?? 0) * 0.4),
        recommendedActions: s.scorecard?.recommended_actions || [],
        title: s.title || 'Mock Interview',
        dateFormatted: s.createdAt
          ? new Date(s.createdAt).toLocaleDateString()
          : '—',
      }));

      setData(formattedData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Unable to load performance data from local storage.');
    } finally {
      setLoading(false);
    }
  }, []);

  // FIX #7: Run on every mount so navigating back from an interview always
  // shows the latest data (not a stale snapshot from the previous render).
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)',
        }}
      >
        <div
          style={{
            width: '40px', height: '40px', border: '3px solid var(--border-color)',
            borderTopColor: 'var(--btn-primary)', borderRadius: '50%',
            animation: 'spin 1s linear infinite', marginBottom: '1rem',
          }}
        />
        <p>Loading analytics...</p>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '2rem', textAlign: 'center', color: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '1rem', margin: '2rem',
        }}
      >
        <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
        <h3>Data Unavailable</h3>
        <p>{error}</p>
        <button
          onClick={fetchAnalytics}
          style={{
            marginTop: '1rem', padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
            border: '1px solid #ef4444', background: 'transparent',
            color: '#ef4444', cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '60vh', textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <BarChart2 size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          No Data Yet
        </h2>
        <p style={{ maxWidth: '400px' }}>
          Take some practice interviews to generate your performance history and unlock analytics.
        </p>
      </div>
    );
  }

  const avgTech = (data.reduce((acc, cur) => acc + cur.Tech, 0) / data.length).toFixed(1);
  const avgComm = (data.reduce((acc, cur) => acc + cur.Comm, 0) / data.length).toFixed(1);
  const avgOverall = (data.reduce((acc, cur) => acc + cur.Overall, 0) / data.length).toFixed(1);
  // Best technical score is highlighted because it is often the easiest growth
  // signal for repeated mock interviews.
  const best = Math.max(...data.map((d) => d.Tech));

  return (
    <div
      className="dashboard-container"
      style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}
    >
      {/* Header row with refresh button */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={28} color="#10a37f" />
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>Performance Analytics</h1>
        </div>
        {/* FIX #7: Manual refresh so user can force reload without navigating away */}
        <button
          onClick={fetchAnalytics}
          title="Refresh"
          style={{
            background: 'transparent', border: '1px solid var(--border-color)',
            borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.85rem',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', marginBottom: '2rem',
        }}
      >
        {[
          { label: 'Total Interviews', value: data.length, icon: <BarChart2 size={18} />, color: 'var(--text-secondary)' },
          { label: 'Avg Tech Score', value: avgTech, icon: <Award size={18} color="#d32f2f" />, color: '#d32f2f' },
          { label: 'Avg Comm Score', value: avgComm, icon: <MessageSquare size={18} color="#1976d2" />, color: '#1976d2' },
          { label: 'Avg Overall', value: avgOverall, icon: <TrendingUp size={18} color="#7c3aed" />, color: '#7c3aed' },
          { label: 'Best Tech Score', value: `${best}/10`, icon: <TrendingUp size={18} color="#10a37f" />, color: '#10a37f' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: 'var(--input-bg)', padding: '1.5rem',
              borderRadius: '1rem', border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {stat.icon}
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Score Progression Chart */}
      <div
        style={{
          backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1rem',
          border: '1px solid var(--border-color)', marginBottom: '2rem',
        }}
      >
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 600 }}>Score Progression</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-primary)',
                }}
                itemStyle={{ fontWeight: 600 }}
                formatter={(value, name) => [value, name === 'Tech' ? 'Technical' : 'Communication']}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${label} — ${item.dateFormatted}` : label;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              <Line type="monotone" dataKey="Tech" name="Technical" stroke="#d32f2f" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} animationDuration={800} />
              <Line type="monotone" dataKey="Comm" name="Communication" stroke="#1976d2" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Feedback */}
      <div
        style={{
          backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 600 }}>Recent Feedback</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data
            .slice(-5)
            .reverse()
            .map((session, i) => (
              <div
                key={i}
                style={{
                  padding: '1rem', backgroundColor: 'var(--input-bg)',
                  borderRadius: '0.75rem', borderLeft: '4px solid #10a37f',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{session.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{session.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#d32f2f', fontWeight: 600 }}>T: {session.Tech}/10</span>
                    <span style={{ fontSize: '0.82rem', color: '#1976d2', fontWeight: 600 }}>C: {session.Comm}/10</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{session.dateFormatted}</span>
                  </div>
                </div>
                {session.feedback && (
                  <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem', lineHeight: 1.5 }}>
                    <strong style={{ color: '#d32f2f' }}>Feedback: </strong>{session.feedback}
                  </p>
                )}
                {session.improvement && (
                  <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5 }}>
                    <strong style={{ color: '#1976d2' }}>Needs work: </strong>{session.improvement}
                  </p>
                )}
                {session.recommendedActions?.[0] && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.92rem', lineHeight: 1.5 }}>
                    <strong style={{ color: '#10a37f' }}>Next practice: </strong>
                    {session.recommendedActions[0].practice_question}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
