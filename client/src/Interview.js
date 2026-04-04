import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Joyride, STATUS } from 'react-joyride';
import './Interview.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const VolumeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;

const Interview = ({ onInterviewEnd }) => {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null); 
  
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const messagesEndRef = useRef(null);
  
  const [inputText, setInputText] = useState(""); 
  const [code, setCode] = useState("// Write your solution here...\n"); 
  const [language, setLanguage] = useState("javascript"); 
  const [scorecard, setScorecard] = useState(null); 
  const textareaRef = useRef(null);

  const [runTour, setRunTour] = useState(() => {
    return !localStorage.getItem('interviewTourCompleted');
  });

  const tourSteps = [
    {
      target: '.tour-resume-step',
      content: 'Start by uploading your resume. The AI will parse it and tailor the interview specifically to your experience.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '.tour-chat-step',
      content: 'Type your answers here, or use the microphone to speak naturally to the AI.',
      placement: 'top',
    },
    {
      target: '.tour-code-step',
      content: 'You can write, test, and submit real code here for technical questions.',
      placement: 'left',
    },
    {
      target: '.tour-end-step',
      content: "When you're finished, click here to end the interview and receive your detailed scorecard!",
      placement: 'bottom-end',
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status, action, type } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status) || action === 'close' || type === 'tour:end' || type === 'error') {
      localStorage.setItem('interviewTourCompleted', 'true');
      setRunTour(false);
    }
  };

  useEffect(() => {
    // As soon as the tour is launched once, immediately flag it so a page reload never shows it again
    if (runTour) {
      localStorage.setItem('interviewTourCompleted', 'true');
    }
  }, [runTour]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        transcriptRef.current = ""; 
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcriptRef.current.trim().length > 0) {
          handleUserMessage(transcriptRef.current);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
           transcriptRef.current += finalTranscript + " ";
        }
      };
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      transcriptRef.current = "";
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
    if (code.trim() !== "" && code !== "// Write your solution here...\n") {
      finalMessage += `\n\nHere is my code written in ${language}:\n\`\`\`${language}\n${code}\n\`\`\``;
    }

    handleUserMessage(finalMessage); 
    setInputText(""); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleUserMessage = async (text) => {
    setIsListening(false);
    if (window.speechSynthesis.speaking) stopSpeaking();

    const newMsg = { sender: 'user', text: text.trim() };
    setMessages((prev) => [...prev, newMsg]);
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/interview`, { message: text });
      const { agent, response } = res.data;
      
      setCurrentAgent(agent);
      setIsTyping(false);
      setMessages((prev) => [...prev, { sender: agent, text: response }]);
      speak(response, agent);

    } catch (error) {
      console.error("Error talking to AI:", error);
      setIsTyping(false);
      setMessages((prev) => [...prev, { sender: 'system', text: "Sorry, I encountered an error connecting to the server." }]);
    }
  };

  const cleanTextForSpeech = (text) => {
    return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '')
               .replace(/#/g, '').replace(/\[.*?\]/g, '').replace(/https?:\/\/\S+/g, 'link'); 
  };

  const speak = (text, agent) => {
    const spokenText = cleanTextForSpeech(text); 
    
    if (isListening && recognitionRef.current) recognitionRef.current.stop();
    
    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voices = window.speechSynthesis.getVoices();
    
    if (agent === 'TECH_LEAD') {
      utterance.pitch = 0.8; 
      utterance.rate = 1.1;  
      utterance.voice = voices[1] || voices[0]; 
    } else {
      utterance.pitch = 1.2; 
      utterance.rate = 0.9;  
      utterance.voice = voices[2] || voices[0];
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handlePanic = async () => {
    if (isTyping) return;
    setIsTyping(true);
    try {
      const res = await axios.post(`${API_URL}/hint`);
      const hintText = res.data.hint;
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: 'HR_WHISPER', text: hintText }]);
      speak(hintText, 'HR'); 
    } catch (error) {
      console.error("Hint failed");
      setIsTyping(false);
    }
  };

  const endInterview = async () => {
    const hasUserSpoken = messages.some(msg => msg.sender === 'user');
    
    if (!hasUserSpoken) {
      alert("You haven't answered any questions yet! Speak or type an answer before ending the interview.");
      return; 
    }

    if (window.confirm("End the interview and get your score?")) {
      try {
        const res = await axios.post(`${API_URL}/end-interview`, { frontendMessages: messages });
        setScorecard(res.data);
        if (onInterviewEnd) onInterviewEnd(); // Add this to refresh sidebar
      } catch (err) {
        console.error("Failed to end interview");
      }
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('resume', file);

    setMessages(prev => [...prev, { sender: 'system', text: 'Reading resume... (This might take a moment)' }]);
    setIsTyping(true);

    try {
      await axios.post(`${API_URL}/upload-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setIsTyping(false);
      setMessages(prev => [...prev, { sender: 'TECH_LEAD', text: "I have your resume. Let's see if your skills match the paper. Introduce yourself." }]);
      speak("I have your resume. Let's see if your skills match the paper. Introduce yourself.", "TECH_LEAD");
      
    } catch (error) {
      setIsTyping(false);
      console.error("Upload failed", error);
      alert("Failed to upload resume.");
    }
  };



  return (
    <div className={`app-container ${currentAgent === 'TECH_LEAD' ? 'theme-tech' : 'theme-hr'}`}>
      <Joyride
        callback={handleJoyrideCallback}
        continuous={true}
        run={runTour}
        showProgress={true}
        showSkipButton={true}
        disableScrolling={true}
        floaterProps={{ disableAnimation: true }}
        steps={tourSteps}
        styles={{
          options: {
            primaryColor: '#10a37f',
            zIndex: 10000,
          }
        }}
      />
      <header className="app-header">
        <div className="logo-area">
          <SparklesIcon />
          <span>Interview Agent</span>
        </div>
        <div className="header-actions">
           <label className="btn-secondary tour-resume-step">
             <UploadIcon /> Resume
             <input type="file" accept=".pdf" hidden onChange={handleFileUpload} />
           </label>
           <button onClick={endInterview} className="btn-secondary btn-danger tour-end-step" title="End & Grade">
             <StopIcon /> End
           </button>
        </div>
      </header>
      
      <div className="workspace-container">
        {/* LEFT PANEL: Chat & Voice */}
        <main className="chat-main">
          <div className="messages-list">
            <div className="messages-center">
            {messages.length === 0 && (
              <div className="empty-state-container">
                <div className="empty-state-header">
                  <div className="empty-state-icon"><SparklesIcon /></div>
                  <h2>AI Mock Interviewer</h2>
                  <p>Welcome! Upload your resume to get started, or simply say hello. This platform simulates a real technical interview environment.</p>
                </div>
                
                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon">🤖</div>
                    <h3>Multi-Agent Personas</h3>
                    <p>Experience dynamic routing between a strict Tech Lead evaluating code and a supportive HR manager assessing culture fit.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">📄</div>
                    <h3>RAG Resume Parsing</h3>
                    <p>Upload your PDF to extract context. The AI will ask highly targeted, project-specific questions tailored to your background.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">💻</div>
                    <h3>Live Code Sandbox</h3>
                    <p>Write, execute, and submit code dynamically in multiple languages via our integrated Monaco Editor workspace.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">🎤</div>
                    <h3>Real-Time Voice-to-Voice</h3>
                    <p>Transcribe your speech to answer questions verbally and listen to the AI respond synchronously, just like a phone screen.</p>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, index) => {
              if (msg.sender === 'system') {
                return (
                  <div key={index} className="message-row ai">
                     <div className="message-content" style={{opacity: 0.6, fontSize: '0.9rem', fontStyle: 'italic'}}>
                        {msg.text}
                     </div>
                  </div>
                );
              }

              return (
                <div key={index} className={`message-row ${msg.sender === 'user' ? 'user' : 'ai'}`}>
                  <div className="message-content">
                    {msg.sender !== 'user' && (
                      <div className={`avatar ${msg.sender === 'TECH_LEAD' ? 'tech' : 'hr'}`}>
                        {msg.sender === 'TECH_LEAD' ? '😠' : '👩‍💼'} 
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
                              <code className={className} style={{ backgroundColor: '#2f2f2f', padding: '2px 4px', borderRadius: '4px', color: '#d63384' }} {...props}>
                                {children}
                              </code>
                            );
                          }
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
                   <div className="avatar">🤖</div>
                   <div className="bubble typing-indicator">
                     <span className="typing-dot"></span>
                     <span className="typing-dot"></span>
                     <span className="typing-dot"></span>
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
                   <button 
                     type="button" 
                     className="action-icon-btn" 
                     onClick={stopSpeaking} 
                     title="Stop AI audio"
                   >
                     <VolumeIcon />
                   </button>
                 )}
               </div>

               <textarea
                 ref={textareaRef}
                 className="input-textarea"
                 placeholder={isSpeaking ? "AI is speaking..." : isListening ? "Listening..." : "Message AI Interviewer..."}
                 value={inputText}
                 onChange={handleInput}
                 onKeyDown={handleKeyDown}
                 disabled={isSpeaking || isTyping}
                 rows="1"
               />

               <div style={{display: 'flex', gap: '4px'}}>
                 <button 
                   type="button" 
                   className={`action-icon-btn mic ${isListening ? 'active' : ''}`}
                   onClick={toggleListening}
                   disabled={isTyping || isSpeaking}
                   title={isListening ? "Stop listening" : "Use microphone"}
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
             <div className="input-footer">
               Interview Agent can make mistakes. Focus on highlighting your strengths.
             </div>
          </div>
        </div>
        </main>

        {/* RIGHT PANEL: Live Code Editor */}
        <div className="editor-panel tour-code-step">
          <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Code Sandbox</h3>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              style={{ 
                backgroundColor: '#333', 
                color: 'white', 
                border: '1px solid #555', 
                padding: '4px 8px', 
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem'
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
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              padding: { top: 16 }
            }}
          />
        </div>
      </div>

      {scorecard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Interview Results 📊</h2>
            <p><strong>Technical Score:</strong> {scorecard.technical_score}/10</p>
            <p><strong>Communication:</strong> {scorecard.communication_score}/10</p>
            <hr style={{margin: '1.5rem 0', borderColor: 'var(--border-color)', opacity: 0.2}}/>
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
