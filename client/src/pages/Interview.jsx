import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import api from '../api/api';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Joyride } from 'react-joyride';
import './Interview.css';
import useInterviewSpeech from '../hooks/useInterviewSpeech';
import { clearActiveSession, loadJson, saveCompletedSession } from '../utils/sessionStorage';
import Scorecard from '../components/Scorecard';
import {
  DESKTOP_TOUR_STEPS,
  MOBILE_TOUR_STEPS,
  hasCompletedTour,
} from '../utils/interviewTour';

const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const VolumeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const MessageSquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const CodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;

const DEFAULT_CONFIG = {
  role: 'Full-Stack Developer',
  level: 'junior',
  duration: 20,
  style: 'balanced',
  focus: 'resume',
};
const DEFAULT_INTERVIEW_STATE = {
  phase: 'introduction',
  current_topic: '',
  difficulty: 1,
  follow_ups_on_topic: 0,
  questions_answered: 0,
  target_questions: 7,
};

// ─── Voice selection: match by language, not fragile index ───────────────────
const Interview = ({ onInterviewEnd }) => {
  const [messages, setMessages] = useState(() => loadJson('interviewMessages', []));

  const [resumeContext, setResumeContext] = useState(() => {
    return localStorage.getItem('interviewResumeContext') || '';
  });

  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState(""); 
  const [code, setCode] = useState("// Write your solution here...\n"); 
  const [language, setLanguage] = useState("javascript"); 
  const [attachCode, setAttachCode] = useState(false);
  const [scorecard, setScorecard] = useState(null); 
  const [activePanel, setActivePanel] = useState('chat'); // 'chat' or 'code' for mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCodeNudge, setShowCodeNudge] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [interviewConfig, setInterviewConfig] = useState(() =>
    loadJson('interviewConfig', DEFAULT_CONFIG)
  );
  const [interviewState, setInterviewState] = useState(() =>
    loadJson('interviewState', DEFAULT_INTERVIEW_STATE)
  );
  
  // FIX #4: Tour should only be marked complete AFTER the user finishes/skips it,
  // not the moment it starts. Removed the premature localStorage.setItem effect.
  const [runTour, setRunTour] = useState(() => {
    return !localStorage.getItem('interviewTourCompleted');
  });

  const messagesRef = useRef(messages);
  const resumeContextRef = useRef(resumeContext);
  const interviewConfigRef = useRef(interviewConfig);
  const interviewStateRef = useRef(interviewState);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const {
    isListening,
    isTranscribing,
    isSpeaking,
    toggleListening,
    speak,
    stopSpeaking,
  } = useInterviewSpeech((transcript) => {
    setInputText((current) => current ? `${current.trim()} ${transcript}` : transcript);
    requestAnimationFrame(() => textareaRef.current?.focus());
  });

  const handleJoyrideCallback = (data) => {
    if (hasCompletedTour(data.status)) {
      localStorage.setItem('interviewTourCompleted', 'true');
      setRunTour(false);
    } else if (data.action === 'close') {
      // Closing is a pause, not completion; the user can restart from Take tour.
      setRunTour(false);
    }
  };

  const startTour = () => {
    localStorage.removeItem('interviewTourCompleted');
    setIsMobileMenuOpen(false);
    setActivePanel('chat');
    setRunTour(true);
  };

  // Persist messages (needed for resume-in-progress recovery)
  useEffect(() => {
    messagesRef.current = messages;
    try {
      localStorage.setItem('interviewMessages', JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not persist messages:', e);
    }
  }, [messages]);

  useEffect(() => {
    resumeContextRef.current = resumeContext;
    localStorage.setItem('interviewResumeContext', resumeContext);
  }, [resumeContext]);

  useEffect(() => {
    interviewConfigRef.current = interviewConfig;
    localStorage.setItem('interviewConfig', JSON.stringify(interviewConfig));
  }, [interviewConfig]);

  useEffect(() => {
    interviewStateRef.current = interviewState;
    localStorage.setItem('interviewState', JSON.stringify(interviewState));
  }, [interviewState]);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e) => e.key === 'Escape' && setIsMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 768px)');
    const updateViewport = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener?.('change', updateViewport);
    return () => media.removeEventListener?.('change', updateViewport);
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputText]);

  const handleInput = (e) => {
    setInputText(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping || isSpeaking || isTranscribing) return;

    let finalMessage = inputText;
    // Only attach code if the user explicitly checked "attach code"
    if (attachCode && code.trim() !== '' && code !== '// Write your solution here...\n') {
      finalMessage += `\n\nHere is my code in ${language}:\n\`\`\`${language}\n${code}\n\`\`\``;
      // Clear editor and toggle after sending so it doesn't carry over
      setCode('// Write your solution here...\n');
      setAttachCode(false);
    }

    handleUserMessage(finalMessage); 
    setInputText(""); 
  };

  const handleUserMessage = async (text) => {
    if (window.speechSynthesis?.speaking) stopSpeaking();

    const newMsg = { sender: 'user', text: text.trim() };
    const previousHistory = messagesRef.current;
    const newHistory = [...previousHistory, newMsg];
    messagesRef.current = newHistory;
    setMessages(newHistory);
    setIsTyping(true);

    try {
      const res = await api.post('/interview', {
        message: text,
        history: previousHistory,
        resumeContext: resumeContextRef.current,
        interviewConfig: interviewConfigRef.current,
        interviewState: interviewStateRef.current,
      });
      const { response, interviewState: nextInterviewState } = res.data;
      if (nextInterviewState) {
        interviewStateRef.current = nextInterviewState;
        setInterviewState(nextInterviewState);
      }
      
      setIsTyping(false);
      setMessages((prev) => {
        const next = [...prev, { sender: 'INTERVIEWER', text: response }];
        messagesRef.current = next;
        return next;
      });
      
      // Nudge logic: simple heuristic to see if AI asked for code
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('code') || lowerResponse.includes('function') || lowerResponse.includes('program')) {
        setShowCodeNudge(true);
      } else {
        setShowCodeNudge(false);
      }

      speak(response, true);
    } catch (error) {
      console.error('Error talking to AI:', error);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: 'Sorry, I encountered an error connecting to the server.' },
      ]);
    }
  };

  // FIX #1: New interview button — clears active session from localStorage
  const startNewInterview = () => {
    if (messages.length > 0) {
      if (!window.confirm('Start a new interview? The current conversation will be cleared.')) return;
    }
    setMessages([]);
    setResumeContext('');
    setScorecard(null);
    setInputText('');
    setCode('// Write your solution here...\n');
    setShowCodeNudge(false);
    setActivePanel('chat');
    setInterviewConfig(DEFAULT_CONFIG);
    setInterviewState(DEFAULT_INTERVIEW_STATE);
    interviewConfigRef.current = DEFAULT_CONFIG;
    interviewStateRef.current = DEFAULT_INTERVIEW_STATE;
    messagesRef.current = [];
    clearActiveSession();
  };

  const handlePanic = async () => {
    if (isTyping) return;
    setIsTyping(true);
    try {
      const res = await api.post('/hint', { history: messagesRef.current });
      const hintText = res.data.hint;
      setIsTyping(false);
      // FIX: mark hint messages so agent.js can filter them out of history
      setMessages((prev) => [...prev, { sender: 'HR_WHISPER', text: hintText, _isHint: true }]);
      speak(hintText, false);
    } catch {
      setIsTyping(false);
    }
  };

  const endInterview = async () => {
    const hasUserSpoken = messages.some((msg) => msg.sender === 'user');
    if (!hasUserSpoken) {
      alert("You haven't answered any questions yet!");
      return;
    }
    if (!window.confirm('End the interview and get your score?')) return;

    try {
      const res = await api.post('/end-interview', { history: messagesRef.current });
      const { scorecard: sc, title } = res.data;
      setScorecard(sc);

      const newSession = {
        _id: Date.now().toString(),
        title: title || 'Mock Interview',
        createdAt: new Date().toISOString(),
        scorecard: sc,
        messages: messagesRef.current,
      };
      saveCompletedSession(newSession);

      // Clear active interview state
      clearActiveSession();

      if (onInterviewEnd) onInterviewEnd();
    } catch (err) {
      console.error('Failed to end interview:', err);
      alert('Could not generate scorecard. Please try again.');
    }
  };

  // FIX #5: Warn before wiping conversation on re-upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Server-side guard: only accept PDF by MIME type, not just browser hint
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      event.target.value = '';
      return;
    }

    if (
      messages.length > 0 &&
      !window.confirm(
        'Uploading a new resume will restart the interview. Continue?'
      )
    ) {
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    setMessages([{ sender: 'system', text: 'Reading resume...' }]);
    setIsTyping(true);

    try {
      const res = await api.post('/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { resumeText } = res.data;
      setResumeContext(resumeText);
      setInterviewState(DEFAULT_INTERVIEW_STATE);
      interviewStateRef.current = DEFAULT_INTERVIEW_STATE;
      setIsTyping(false);
      const startMsg = `Thanks, I have your resume. We'll run a ${interviewConfigRef.current.duration}-minute ${interviewConfigRef.current.role} interview. To begin, please give me a concise introduction.`;
      setMessages([{ sender: 'INTERVIEWER', text: startMsg }]);
      speak(startMsg, true);
    } catch (error) {
      setIsTyping(false);
      console.error('Upload failed:', error);
      alert('Failed to upload resume. Make sure it is a valid PDF.');
    }

    event.target.value = '';
  };

  // FIX #3: Avatar uses INTERVIEWER (the single agent) not TECH_LEAD/HR
  const getAvatar = (sender) => {
    if (sender === 'HR_WHISPER') return '🤫';
    if (sender === 'user') return null;
    return '🧑💻'; // Single interviewer persona
  };

  const getAvatarClass = (sender) => {
    if (sender === 'HR_WHISPER') return 'hr';
    return 'tech';
  };

  return (
    <div className="app-container theme-tech">
      <Joyride
        callback={handleJoyrideCallback}
        continuous={true}
        run={runTour}
        showProgress={true}
        showSkipButton={true}
        disableScrolling={true}
        floaterProps={{ disableAnimation: true }}
        steps={isMobile ? MOBILE_TOUR_STEPS : DESKTOP_TOUR_STEPS}
        styles={{ options: { primaryColor: '#10a37f', zIndex: 10000 } }}
      />

      <header className="app-header">
        <div className="logo-area">
          <SparklesIcon />
          <span>Interview Agent</span>
        </div>
        {messages.length > 0 && (
          <div style={{ minWidth: 180, maxWidth: 280, flex: 1, margin: '0 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span>{String(interviewState.phase || 'introduction').replaceAll('_', ' ')}</span>
              <span>{interviewState.questions_answered || 0}/{interviewState.target_questions || 7}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--border-color)', marginTop: 4 }}>
              <div style={{
                height: '100%',
                borderRadius: 4,
                background: '#10a37f',
                width: `${Math.min(100, ((interviewState.questions_answered || 0) / (interviewState.target_questions || 7)) * 100)}%`,
              }} />
            </div>
          </div>
        )}
        
        <button
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <div className={`header-actions ${isMobileMenuOpen ? 'open' : ''}`}>
          <button onClick={startTour} className="btn-secondary">
            <HelpIcon /> Take tour
          </button>
          <button onClick={() => { startNewInterview(); setIsMobileMenuOpen(false); }} className="btn-secondary">
            <PlusIcon /> New
          </button>
          <label className="btn-secondary tour-resume-step">
            <UploadIcon /> Resume
            <input type="file" accept="application/pdf" hidden
              onChange={(e) => { handleFileUpload(e); setIsMobileMenuOpen(false); }} />
          </label>
          <button onClick={() => { endInterview(); setIsMobileMenuOpen(false); }}
            className="btn-secondary btn-danger tour-end-step">
            <StopIcon /> End
          </button>
        </div>
      </header>
      
      <div
        className={`mobile-menu-backdrop ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div className="workspace-container">
        <main className={`chat-main ${activePanel === 'chat' ? 'active' : ''}`}>
          <div className="messages-list">
            <div className="messages-center">
              {showCodeNudge && activePanel === 'chat' && (
                <div className="code-nudge-banner" onClick={() => setActivePanel('code')}>
                  <span>The interviewer asked for code. Open sandbox →</span>
                </div>
              )}
              {messages.length === 0 && (
                <div className="empty-state-container">
                  <div className="empty-state-header">
                    <div className="empty-state-icon"><SparklesIcon /></div>
                    <h2>AI Mock Interviewer</h2>
                    <p>Choose your interview setup, then upload a resume or simply say hello.</p>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.75rem',
                    width: '100%',
                    maxWidth: 760,
                    margin: '0 auto 1.5rem',
                    padding: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    background: 'var(--input-bg)',
                  }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                      Target role
                      <input
                        value={interviewConfig.role}
                        maxLength={80}
                        onChange={(event) => setInterviewConfig((current) => ({
                          ...current,
                          role: event.target.value,
                        }))}
                        style={{ padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                      />
                    </label>
                    {[
                      ['level', 'Level', ['junior', 'mid', 'senior']],
                      ['duration', 'Duration', [20, 40, 60]],
                      ['style', 'Style', ['supportive', 'balanced', 'strict']],
                      ['focus', 'Focus', ['resume', 'frontend', 'backend', 'full-stack', 'behavioral']],
                    ].map(([key, label, options]) => (
                      <label key={key} style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        {label}
                        <select
                          value={interviewConfig[key]}
                          onChange={(event) => setInterviewConfig((current) => ({
                            ...current,
                            [key]: key === 'duration' ? Number(event.target.value) : event.target.value,
                          }))}
                          style={{ padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                        >
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {key === 'duration' ? `${option} minutes` : String(option).replace('-', ' ')}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="feature-grid">
                    <div className="feature-card">
                      <div className="feature-icon">🤖</div>
                      <h3>Adaptive Interviewer</h3>
                      <p>One intelligent agent that adapts tone — technical when you answer well, supportive when you're stuck.</p>
                    </div>
                    <div className="feature-card">
                      <div className="feature-icon">📄</div>
                      <h3>Resume-Tailored Questions</h3>
                      <p>Upload your PDF and the AI asks targeted questions based on your actual experience.</p>
                    </div>
                    <div className="feature-card">
                      <div className="feature-icon">💻</div>
                      <h3>Live Code Sandbox</h3>
                      <p>Write and submit real code in multiple languages via the Monaco Editor.</p>
                    </div>
                    <div className="feature-card">
                      <div className="feature-icon">🎤</div>
                      <h3>Voice-to-Voice</h3>
                      <p>Speak your answers and hear the AI respond — just like a real phone screen.</p>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={index} className="message-row ai">
                      <div className="message-content" style={{ opacity: 0.6, fontSize: '0.9rem', fontStyle: 'italic' }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={index} className={`message-row ${msg.sender === 'user' ? 'user' : 'ai'}`}>
                    <div className="message-content">
                      {msg.sender !== 'user' && (
                        <div className={`avatar ${getAvatarClass(msg.sender)}`}>
                          {getAvatar(msg.sender)}
                        </div>
                      )}
                      <div className="bubble text-content">
                        <ReactMarkdown
                          children={msg.text}
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  children={String(children).replace(/\n$/, '')}
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                />
                              ) : (
                                <code
                                  className={className}
                                  style={{ backgroundColor: '#2f2f2f', padding: '2px 4px', borderRadius: '4px', color: '#d63384' }}
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="message-row ai">
                  <div className="message-content">
                    <div className="avatar tech">🧑💻</div>
                    <div className="bubble typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="input-container">
            <div className="input-center">
              <form className="input-box tour-chat-step" onSubmit={handleTextSubmit}>
                <div className="left-controls">
                  <button
                    type="button"
                    className="action-icon-btn"
                    onClick={handlePanic}
                    title="Need a hint?"
                    disabled={isTyping || isSpeaking}
                  >
                    <HelpIcon />
                  </button>
                  {isSpeaking && (
                    <button type="button" className="action-icon-btn" onClick={stopSpeaking} title="Stop AI audio">
                      <VolumeIcon />
                    </button>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  className="input-textarea"
                  placeholder={
                    isSpeaking
                      ? 'AI is speaking...'
                      : isTranscribing
                        ? 'Transcribing your answer...'
                        : isListening
                          ? 'Recording... click stop when finished'
                          : 'Message AI Interviewer...'
                  }
                  value={inputText}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={isSpeaking || isTyping || isTranscribing}
                  rows="1"
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={`action-icon-btn mic ${isListening ? 'active' : ''}`}
                    onClick={toggleListening}
                    disabled={isTyping || isSpeaking || isTranscribing}
                    title={isListening ? 'Stop and transcribe' : 'Record answer'}
                  >
                    {isListening ? <StopIcon /> : <MicIcon />}
                  </button>
                  <button
                    type="submit"
                    className={`action-icon-btn send ${inputText.trim() ? 'active' : ''}`}
                    disabled={!inputText.trim() || isTyping || isSpeaking || isTranscribing}
                    title="Send message"
                  >
                    <SendIcon />
                  </button>
                </div>
              </form>
              <div className="input-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={attachCode}
                    onChange={(e) => setAttachCode(e.target.checked)}
                  />
                  Attach sandbox code
                </label>
                <span className="footer-disclaimer">Interview Agent can make mistakes. Focus on highlighting your strengths.</span>
              </div>
            </div>
          </div>
        </main>

        <div className={`editor-panel tour-code-step ${activePanel === 'code' ? 'active' : ''}`}>
          <div className="editor-header">
            <div className="editor-header-left">
              <h3>Code Sandbox</h3>
              <label className="mobile-attach-checkbox">
                <input
                  type="checkbox"
                  checked={attachCode}
                  onChange={(e) => setAttachCode(e.target.checked)}
                />
                Attach code
              </label>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                backgroundColor: '#333', color: 'white', border: '1px solid #555',
                padding: '4px 8px', borderRadius: '4px', outline: 'none',
                cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>
          </div>
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value)}
            options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', padding: { top: 16 } }}
          />
        </div>
      </div>

      <nav className="mobile-tab-bar">
        <button 
          className={`tab-item ${activePanel === 'chat' ? 'active' : ''}`}
          onClick={() => setActivePanel('chat')}
        >
          <MessageSquareIcon />
          <span>Chat</span>
        </button>
        <button 
          className={`tab-item tour-code-tab ${activePanel === 'code' ? 'active' : ''}`}
          onClick={() => setActivePanel('code')}
        >
          <CodeIcon />
          <span>Code</span>
          {showCodeNudge && <span className="tab-dot" />}
        </button>
      </nav>

      {scorecard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <Scorecard scorecard={scorecard} />
            <button onClick={() => setScorecard(null)} className="modal-close-btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
