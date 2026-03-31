import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Interview from './Interview';
import Dashboard from './Dashboard'; 
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('NEW'); // 'NEW', 'DASHBOARD', or a mongo _id
  const [viewingPastChat, setViewingPastChat] = useState(null); 

  useEffect(() => {
    fetchSidebar();
  }, []);

  const fetchSidebar = async () => {
    try {
      const res = await axios.get(`${API_URL}/sessions`);
      setSessions(res.data);
    } catch (error) {
      console.error("Sidebar fetch failed", error);
    }
  };

  const loadPastSession = async (id) => {
    setActiveSessionId(id);
    try {
      const res = await axios.get(`${API_URL}/sessions/${id}`);
      setViewingPastChat(res.data);
    } catch (error) {
      console.error("Failed to load chat history");
    }
  };

  const startNewInterview = () => {
    setActiveSessionId('NEW');
    setViewingPastChat(null);
    fetchSidebar(); 
  };

  const showDashboard = () => {
    setActiveSessionId('DASHBOARD');
    setViewingPastChat(null);
  }

  return (
    <div className="app-layout">
      
      {/* LEFT SIDEBAR (ChatGPT Style) */}
      <div className="sidebar">
        <button className="new-chat-btn" onClick={startNewInterview}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Interview
        </button>
        
        <button className="dashboard-nav-btn" onClick={showDashboard} style={{
          backgroundColor: activeSessionId === 'DASHBOARD' ? '#ececf1' : 'transparent',
          color: 'var(--text-primary)'
        }}>
          📊 Analytics Dashboard
        </button>
        
        <div className="session-list">
          <p className="sidebar-title">Past Interviews</p>
          {sessions.map(session => (
            <div 
              key={session._id} 
              className={`sidebar-item ${activeSessionId === session._id ? 'active' : ''}`}
              onClick={() => loadPastSession(session._id)}
            >
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                💬 {session.title}
              </div>
              <small style={{ color: '#aaa', display: 'block', marginTop: '4px' }}>
                Tech: {session.scorecard?.technical_score}/10 | Comm: {session.scorecard?.communication_score}/10
              </small>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN AREA */}
      <div className="main-content">
        {activeSessionId === 'NEW' ? (
          <Interview onInterviewEnd={fetchSidebar} /> 
        ) : activeSessionId === 'DASHBOARD' ? (
          <Dashboard />
        ) : (
          <div className="past-chat-view">
            <h2 style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
              {viewingPastChat?.title} <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 'normal'}}>(Read-Only)</span>
            </h2>
            <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
              {/* Scorecard Summary in Read-Only View */}
              {viewingPastChat?.scorecard && (
                <div style={{ backgroundColor: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                  <h3 style={{ marginTop: 0 }}>Results</h3>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                    <div><strong>Tech Score:</strong> {viewingPastChat.scorecard.technical_score}/10</div>
                    <div><strong>Comm Score:</strong> {viewingPastChat.scorecard.communication_score}/10</div>
                  </div>
                  <p><strong>Feedback:</strong> {viewingPastChat.scorecard.feedback}</p>
                  <p style={{ marginBottom: 0 }}><strong>Improvement:</strong> {viewingPastChat.scorecard.improvement}</p>
                </div>
              )}

              {/* Chat History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {viewingPastChat?.messages.map((msg, index) => (
                  <div key={index} style={{ display: 'flex', gap: '1rem', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    
                    {msg.sender !== 'user' && (
                      <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: msg.sender === 'TECH_LEAD' ? '#10a37f' : msg.sender === 'system' ? '#888' : '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {msg.sender === 'TECH_LEAD' ? '😠' : msg.sender === 'HR' ? '👩‍💼' : '🤖'}
                      </div>
                    )}

                    <div style={{ 
                      backgroundColor: msg.sender === 'user' ? 'var(--user-bubble)' : 'transparent',
                      padding: msg.sender === 'user' ? '0.75rem 1.25rem' : '0.5rem 0',
                      borderRadius: msg.sender === 'user' ? '1.5rem 1.5rem 0.25rem 1.5rem' : '0',
                      maxWidth: '85%',
                      lineHeight: 1.5
                    }}>
                      {msg.text}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
