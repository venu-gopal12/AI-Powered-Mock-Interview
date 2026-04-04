import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  BarChart2, 
  TrendingUp, 
  MessageSquare, 
  Award,
  AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/analytics`);
        
        // Format the date so it looks nice on the chart's X-axis
        const formattedData = res.data.map((item, index) => ({
          ...item,
          name: `Attempt ${index + 1}`,
          Tech: item.technical_score,
          Comm: item.communication_score,
          dateFormatted: new Date(item.date).toLocaleDateString()
        }));
        
        setData(formattedData);
        setError(null);
      } catch (error) {
        console.error("Failed to load analytics", error);
        setError("Unable to load performance data from the database.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <div className="loader" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--btn-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
        <p>Loading analytics...</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '1rem', margin: '2rem' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
        <h3>Data Unavailable</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="dashboard-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <BarChart2 size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Data Yet</h2>
        <p style={{ maxWidth: '400px' }}>Take some practice interviews to generate your performance history and unlock analytics.</p>
      </div>
    );
  }

  // Calculate averages
  const avgTech = (data.reduce((acc, curr) => acc + curr.Tech, 0) / data.length).toFixed(1);
  const avgComm = (data.reduce((acc, curr) => acc + curr.Comm, 0) / data.length).toFixed(1);

  return (
    <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '48px' }}>
        <TrendingUp size={28} color="#10a37f" />
        <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>Performance Analytics</h1>
      </div>
      
      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <BarChart2 size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Total Interviews</span>
           </div>
           <div style={{ fontSize: '2rem', fontWeight: 700 }}>{data.length}</div>
        </div>
        
        <div style={{ backgroundColor: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <Award size={18} color="#d32f2f" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Avg Tech Score</span>
           </div>
           <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d32f2f' }}>{avgTech}</div>
        </div>

        <div style={{ backgroundColor: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <MessageSquare size={18} color="#1976d2" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Avg Comm Score</span>
           </div>
           <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>{avgComm}</div>
        </div>
      </div>

      {/* Main Chart */}
      <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 600 }}>Score Progression</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                itemStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              <Line type="monotone" dataKey="Tech" stroke="#d32f2f" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} animationDuration={1000} />
              <Line type="monotone" dataKey="Comm" stroke="#1976d2" strokeWidth={3} activeDot={{ r: 8 }} dot={{ strokeWidth: 2, r: 4 }} animationDuration={1000} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feedback History */}
      <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 600 }}>Recent Feedback History</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data.slice(-5).reverse().map((session, i) => (
            <div key={i} style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.75rem', borderLeft: '4px solid #10a37f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{session.name}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{session.dateFormatted}</span>
              </div>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <strong style={{ color: '#d32f2f' }}>Feedback:</strong> {session.feedback}
              </p>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
                <strong style={{ color: '#1976d2' }}>Needs Work:</strong> {session.improvement}
              </p>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;
