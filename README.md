# 🚀 AI-Powered Mock Interview Platform 
**A Multi-Agent, Full-Stack MERN Application with RAG and Live Code Execution**

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)



## 📌 Overview
As a developer transitioning from competitive programming to full-stack engineering, I realized the gap between solving algorithmic problems and verbally communicating those solutions in an interview setting. 

I built this platform to simulate high-pressure technical interviews. It uses a **Multi-Agent AI architecture** to dynamically switch between a "Strict Tech Lead" (for grilling on Big O notation and code efficiency) and a "Supportive HR Manager" (for behavioral cues and hints).

## ✨ Key Features

* **🤖 Multi-Agent Routing:** Utilizes LangChain to dynamically route user inputs to specialized AI personas based on sentiment and technical context.
* **📄 RAG-Powered Resume Parsing:** Upload a PDF resume, and the AI extracts the context to ask highly targeted, project-specific questions rather than generic trivia.
* **💻 Live Code Sandbox:** Integrated `@monaco-editor/react` (the engine behind VS Code) allowing users to write and submit live code in JavaScript, Java, C++, or Python.
* **🎤 Real-Time Voice-to-Voice:** Implemented the browser's Web Speech API for seamless Speech-to-Text and Text-to-Speech interactions, creating a realistic interview flow.
* **💾 Persistent Chat History:** ChatGPT-style sidebar architecture using **MongoDB** to store past sessions, complete with AI-generated smart titles.
* **📊 Analytics & Scoring:** A post-interview grading agent parses the transcript to generate a structured JSON scorecard, rendered via `Recharts` for performance tracking.
* **💅 Rich Text & Syntax Highlighting:** Chat UI parses Markdown and renders code blocks with VS Code dark mode themes using `react-syntax-highlighter`.

## 🏗️ System Architecture



1. **Frontend:** React.js, Monaco Editor, Recharts, React-Markdown.
2. **Backend:** Node.js, Express, Multer (PDF handling).
3. **Database:** MongoDB Atlas (Mongoose ODM).
4. **AI Layer:** LangChain.js orchestrating Groq API (Llama-3-70B) for ultra-low latency inference.

## 🚀 Run it Locally

### Prerequisites
* Node.js (v16+)
* MongoDB Atlas account (or local MongoDB)
* Groq API Key (Free)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-mock-interviewer.git
cd ai-mock-interviewer
```

### 2. Setup the Backend
```bash
# Install dependencies
npm install express cors dotenv @langchain/groq @langchain/core multer pdf-parse mongoose

# Create a .env file
touch .env
```
Add the following to your `.env` file:
```env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
MONGO_URI=your_mongodb_connection_string
```
Start the server:
```bash
node server.js
```

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd client

# Install dependencies
npm install axios @monaco-editor/react react-markdown react-syntax-highlighter recharts

# Start the React app
npm start
```

## 🧠 Future Roadmap
- [ ] Add WebSockets (Socket.io) for real-time streaming of AI responses (token-by-token).
- [ ] Integrate Piston API to actually execute the user's code and evaluate test cases.
- [ ] Implement user authentication (JWT/Clerk) for multi-user support.

---
*Built with ❤️ for developers preparing for their next big role.*
