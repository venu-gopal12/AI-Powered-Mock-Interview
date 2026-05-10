# 🚀 AI-Powered Mock Interview Platform 
**An Adaptive, Full-Stack Interview Simulator with RAG, Live Code Execution, and Voice-to-Voice**

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-f55036?style=for-the-badge&logo=groq&logoColor=white)

## 📌 Overview
I built this platform to bridge the gap between solving algorithmic problems and verbally communicating solutions. 

Unlike simple chatbots, this platform uses an **Adaptive Single-Agent architecture**. Instead of slow multi-agent routing, it utilizes a sophisticated system prompt that allows the AI to dynamically adjust its tone: staying strict and technical when you're doing well, but automatically shifting to a supportive "HR" tone with hints if it detects you are struggling. This cut latency in half while creating a more natural conversation flow.

## ✨ Key Features

* **🤖 Adaptive AI Persona:** A unified "Senior Engineer" agent that balances technical grilling with human-like support based on real-time candidate performance.
* **📄 RAG-Powered Context Injection:** High-performance PDF parsing extracts resume data and injects it directly into the LLM's context window for project-specific questioning.
* **💻 Smart Code Sandbox:** Integrated Monaco Editor with an **explicit opt-in toggle**. Users can use the sandbox as a scratchpad and only "attach" their solution to the message when ready.
* **🎤 Heuristic Voice Selection:** Implemented a smart voice-picking system that uses language/name heuristics (e.g., David/Samantha) to ensure high-quality, persona-appropriate speech synthesis.
* **📊 Robust Analytics:** A specialized grading agent generates structured JSON scorecards. We implemented custom bracket-finding logic to ensure perfect parsing even when the LLM is "chatty."
* **⚡ Production-Grade Guardrails:** Server-side history guards (`MAX_HISTORY_CHARS`) and payload limits protect against context window overflows and malicious inputs.
* **💾 Performance-Optimized Storage:** Uses a "Scorecard-Only" storage strategy for past sessions. This preserves analytics history without bloating `localStorage` with massive message arrays.

## 🏗️ System Architecture

1. **Frontend:** React.js, Monaco Editor, Recharts, React-Markdown, React-Joyride (Interactive Onboarding).
2. **Backend:** Node.js, Express, Multer (Secure PDF handling), PDF-Parse.
3. **AI Layer:** LangChain.js orchestrating Groq API (Llama-3.3-70B) for ultra-low latency inference (< 500ms).

## 🛠️ Technical Problem Solving

Building this platform required solving several real-world AI engineering challenges:
* **Latency Optimization:** Switched from a router-based multi-agent system to a single adaptive persona, reducing API round-trips by 50%.
* **Memory Management:** Implemented history truncation (Defence-in-Depth) on both client and server to stay within LLM token limits (128k context window).
* **Data Integrity:** Developed a robust JSON extraction system to handle malformed LLM outputs, ensuring the analytics dashboard never crashes.
* **Voice UX:** Solved the "brittle voice index" problem by building a language-aware filter for the browser's Web Speech API.

## 🚀 Run it Locally

### Prerequisites
* Node.js (v18+)
* Groq API Key (Free)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-mock-interviewer.git
cd ai-mock-interviewer
```

### 2. Setup the Backend
```bash
# Install dependencies
npm install

# Create a .env file
touch .env
```
Add your `GROQ_API_KEY` to the `.env` file. Then start the server:
```bash
node server.js
```

### 3. Setup the Frontend
```bash
cd client
npm install
npm start
```

## 🧠 Future Roadmap
- [ ] **Real-time Streaming:** Implement Socket.io for token-by-token response streaming.
- [ ] **Code Execution:** Integrate a remote execution API (like Piston) to run and test user solutions against real cases.
- [ ] **Database Expansion:** Re-integrate MongoDB for multi-device sync once user auth (Clerk/JWT) is added.

---
*Built with ❤️ for developers preparing for their next big role.*
