import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Joyride, STATUS } from 'react-joyride';
import './Interview.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Max sessions to keep in localStorage (saves scorecard only, not messages) ─
const MAX_SAVED_SESSIONS = 30;

const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const VolumeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

// ─── Voice selection: match by language, not fragile index ───────────────────
function pickVoice(voices, preferMale = false) {
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  if (englishVoices.length === 0) return voices[0] || null;

  // Heuristic: names containing 'Male', 'David', 'Daniel', 'Alex' → male-ish
  const maleHints = ['male', 'david', 'daniel', 'alex', 'fred', 'tom', 'aaron', 'arthur'];
  const femaleHints = ['female', 'samantha', 'karen', 'victoria', 'moira', 'fiona', 'tessa'];

  if (preferMale) {
    const male = englishVoices.find(v => maleHints.some(h => v.name.toLowerCase().includes(h)));
    if (male) return male;
  } else {
    const female = englishVoices.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h)));
    if (female) return female;
  }

  // Fallback: just pick different voices for variety
  return preferMale ? englishVoices[0] : (englishVoices[1] || englishVoices[0]);
}

const Interview = ({ onInterviewEnd }) => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('interviewMessages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [resumeContext, setResumeContext] = useState(() => {
    return localStorage.getItem('interviewResumeContext') || '';
  });

  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState(""); 
  const [code, setCode] = useState("// Write your solution here...\n"); 
  const [language, setLanguage] = useState("javascript"); 
  const [attachCode, setAttachCode] = useState(false);
  const [scorecard, setScorecard] = useState(null); 
  const [currentAgent, setCurrentAgent] = useState(null);
  
  // FIX #4: Tour should only be marked complete AFTER the user finishes/skips it,
  // not the moment it starts. Removed the premature localStorage.setItem effect.
  const [runTour, setRunTour] = useState(() => {
    return !localStorage.getItem('interviewTourCompleted');
  });

  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const tourSteps = [
    {
      target: '.tour-resume-step',
      content: 'Start by uploading your resume. The AI will parse it and tailor the interview to your experience.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '.tour-chat-step',
      content: 'Type your answers here, or use the microphone to speak naturally.',
      placement: 'top',
    },
    {
      target: '.tour-code-step',
      content: 'Write and submit real code here for technical questions.',
      placement: 'left',
    },
    {
      target: '.tour-end-step',
      content: "When you're done, click here to end the interview and get your scorecard.",
      placement: 'bottom-end',
    },
  ];

  // FIX #4: Only mark tour complete when the user actually finishes or skips
  const handleJoyrideCallback = (data) => {
    const { status, action, type } = data;
    const done = [STATUS.FINISHED, STATUS.SKIPPED].includes(status)
      || action === 'close'
      || type === 'tour:end'
      || type === 'error';

    if (done) {
      localStorage.setItem('interviewTourCompleted', 'true');
      setRunTour(false);
    }
  };

  // Persist messages (needed for resume-in-progress recovery)
  useEffect(() => {
    try {
      localStorage.setItem('interviewMessages', JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not persist messages:', e);
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('interviewResumeContext', resumeContext);
  }, [resumeContext]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        transcriptRef.current = '';
      };
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcriptRef.current.trim().length > 0) {
          handleUserMessage(transcriptRef.current);
        }
      };
      recognitionRef.current.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        setIsListening(false);
      };
      recognitionRef.current.onresult = (event) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        if (final) transcriptRef.current += final + ' ';
      };
    }
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleInput = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition isn't supported in your browser. Please use text.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      transcriptRef.current = '';
      recognitionRef.current.start();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping || isSpeaking) return;

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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleUserMessage = async (text) => {
    setIsListening(false);
    if (window.speechSynthesis.speaking) stopSpeaking();

    const newMsg = { sender: 'user', text: text.trim() };
    const newHistory = [...messages, newMsg];
    setMessages(newHistory);
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/interview`, {
        message: text,
        history: newHistory,
        resumeContext,
      });
      const { agent, response } = res.data;
      setIsTyping(false);
      setMessages((prev) => [...prev, { sender: agent, text: response }]);
      speak(response, agent);
    } catch (error) {
      console.error('Error talking to AI:', error);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: 'Sorry, I encountered an error connecting to the server.' },
      ]);
    }
  };

  const cleanTextForSpeech = (text) =>
    text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, 'link');

  // FIX #2: Pick voice by language/name heuristic, not brittle index
  const speak = (text, agent) => {
    const spokenText = cleanTextForSpeech(text);
    if (isListening && recognitionRef.current) recognitionRef.current.stop();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voices = window.speechSynthesis.getVoices();

    const preferMale = agent === 'INTERVIEWER' || agent === 'TECH_LEAD';
    utterance.voice = pickVoice(voices, preferMale);
    utterance.pitch = preferMale ? 0.85 : 1.1;
    utterance.rate = preferMale ? 1.05 : 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
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
    localStorage.removeItem('interviewMessages');
    localStorage.removeItem('interviewResumeContext');
  };

  const handlePanic = async () => {
    if (isTyping) return;
    setIsTyping(true);
    try {
      const res = await axios.post(`${API_URL}/hint`, { history: messages });
      const hintText = res.data.hint;
      setIsTyping(false);
      // FIX: mark hint messages so agent.js can filter them out of history
      setMessages((prev) => [...prev, { sender: 'HR_WHISPER', text: hintText, _isHint: true }]);
      speak(hintText, 'HR');
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
      const res = await axios.post(`${API_URL}/end-interview`, { history: messages });
      const { scorecard: sc, title } = res.data;
      setScorecard(sc);

      // FIX #6: Save scorecard only — NOT the full message array.
      // This keeps localStorage small regardless of how many sessions accumulate.
      const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
      const newSession = {
        _id: Date.now().toString(),
        title: title || 'Mock Interview',
        createdAt: new Date().toISOString(),
        scorecard: sc,
        // Intentionally omitting `messages` to stay within the 5MB cap
      };

      // Keep only the most recent MAX_SAVED_SESSIONS sessions
      const trimmed = [...savedSessions, newSession].slice(-MAX_SAVED_SESSIONS);
      localStorage.setItem('savedSessions', JSON.stringify(trimmed));

      // Clear active interview state
      localStorage.removeItem('interviewMessages');
      localStorage.removeItem('interviewResumeContext');

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
      const res = await axios.post(`${API_URL}/upload-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { resumeText } = res.data;
      setResumeContext(resumeText);
      setIsTyping(false);
      const startMsg = "I have your resume. Let's see if your skills match the paper. Introduce yourself.";
      setMessages([{ sender: 'INTERVIEWER', text: startMsg }]);
      speak(startMsg, 'INTERVIEWER');
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
        steps={tourSteps}
        styles={{ options: { primaryColor: '#10a37f', zIndex: 10000 } }}
      />

      <header className="app-header">
        <div className="logo-area">
          <SparklesIcon />
          <span>Interview Agent</span>
        </div>
        <div className="header-actions">
          {/* FIX #1: New interview button */}
          <button
            onClick={startNewInterview}
            className="btn-secondary"
            title="Start a new interview"
          >
            <PlusIcon /> New
          </button>
          <label className="btn-secondary tour-resume-step">
            <UploadIcon /> Resume
            <input type="file" accept=".pdf" hidden onChange={handleFileUpload} />
          </label>
          <button
            onClick={endInterview}
            className="btn-secondary btn-danger tour-end-step"
            title="End & Grade"
          >
            <StopIcon /> End
          </button>
        </div>
      </header>

      <div className="workspace-container">
        <main className="chat-main">
          <div className="messages-list">
            <div className="messages-center">
              {messages.length === 0 && (
                <div className="empty-state-container">
                  <div className="empty-state-header">
                    <div className="empty-state-icon"><SparklesIcon /></div>
                    <h2>AI Mock Interviewer</h2>
                    <p>Upload your resume to get started, or simply say hello.</p>
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
                    isSpeaking ? 'AI is speaking...' : isListening ? 'Listening...' : 'Message AI Interviewer...'
                  }
                  value={inputText}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={isSpeaking || isTyping}
                  rows="1"
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={`action-icon-btn mic ${isListening ? 'active' : ''}`}
                    onClick={toggleListening}
                    disabled={isTyping || isSpeaking}
                    title={isListening ? 'Stop listening' : 'Use microphone'}
                  >
                    {isListening ? <StopIcon /> : <MicIcon />}
                  </button>
                  <button
                    type="submit"
                    className={`action-icon-btn send ${inputText.trim() ? 'active' : ''}`}
                    disabled={!inputText.trim() || isTyping || isSpeaking}
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
                <span>Interview Agent can make mistakes. Focus on highlighting your strengths.</span>
              </div>
            </div>
          </div>
        </main>

        <div className="editor-panel tour-code-step">
          <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Code Sandbox</h3>
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

      {scorecard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Interview Results 📊</h2>
            <p><strong>Technical Score:</strong> {scorecard.technical_score}/10</p>
            <p><strong>Communication:</strong> {scorecard.communication_score}/10</p>
            <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)', opacity: 0.2 }} />
            <p><strong>Feedback:</strong> {scorecard.feedback}</p>
            <p><strong>Study This:</strong> {scorecard.improvement}</p>
            <button onClick={() => setScorecard(null)} className="modal-close-btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
