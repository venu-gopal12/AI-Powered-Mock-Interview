const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Handles file uploads
const pdf = require('pdf-parse'); // Reads PDF text
const { runInterviewAgent, generateHint, generateScorecard, generateTitle } = require('./agent'); // Import new functions
const mongoose = require('mongoose');
const Scorecard = require('./models/Scorecard'); 
const Session = require('./models/Session'); 
require('dotenv').config();

const app = express();
const upload = multer(); // Configure multer to hold files in memory

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows your React app (on port 3000) to talk to this server
app.use(express.json()); // Allows the server to understand JSON data

// 1. Connect to MongoDB (You will need to add MONGO_URI to your .env file)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// STORE RESUME TEXT HERE (Simple in-memory storage)
let resumeContext = ""; 
let conversationHistory = [];

// 1. New Endpoint: Upload Resume
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
  console.log("📥 Received upload request");
  try {
    if (!req.file) {
      console.error("❌ No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("📄 File received:", req.file.originalname, "Size:", req.file.size);

    // Extract text from the PDF buffer
    console.log("🔍 Parsing PDF...");
    const data = await pdf(req.file.buffer);
    console.log("✅ PDF Parsed. Text length:", data.text.length);
    
    resumeContext = data.text; // Save the text to our variable
    
    // THE FIX: Clear history, but inject the first question so the AI knows!
    conversationHistory = [
      { 
        role: "assistant", 
        content: "I have your resume. Let's see if your skills match the paper. Introduce yourself." 
      }
    ];

    res.json({ message: "Resume received. The Tech Lead is reading it now..." });
  } catch (error) {
    console.error("🔥 PDF Parsing Error:", error);
    res.status(500).json({ error: "Failed to parse PDF", details: error.message });
  }
});

// 2. NEW: Hint Endpoint
app.post('/hint', async (req, res) => {
  try {
    const hint = await generateHint(conversationHistory);
    console.log("💡 Hint generated:", hint);
    res.json({ hint });
  } catch (error) {
    console.error("Hint Error:", error);
    res.status(500).json({ error: "Could not generate hint" });
  }
});

// 3. NEW: End Interview Endpoint (Save to DB)
app.post('/end-interview', async (req, res) => {
  try {
    const { frontendMessages } = req.body; 
    
    // Run both AI tasks in parallel to save time! (Senior Dev move)
    const [scorecardData, smartTitle] = await Promise.all([
      generateScorecard(conversationHistory),
      generateTitle(conversationHistory)
    ]);
    
    // Save everything to MongoDB
    const newSession = new Session({
      title: smartTitle, 
      messages: frontendMessages,
      scorecard: scorecardData
    });
    
    await newSession.save();
    console.log("� Full Session saved to database!");

    // Clear history for next time
    conversationHistory = []; 
    res.json(scorecardData);
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ error: "Could not save session" });
  }
});

// 4. NEW: Get all sessions for the Sidebar
app.get('/sessions', async (req, res) => {
  try {
    // Fetch just the titles and dates (don't load all messages yet to save bandwidth)
    const sessions = await Session.find().select('title createdAt scorecard').sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// 5. NEW: Get a specific session's chat history
app.get('/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "Failed to load session" });
  }
});

// 6. NEW: Analytics Endpoint (Fetch all history)
app.get('/analytics', async (req, res) => {
  try {
    // Fetch all scorecards, sorted by oldest to newest so the chart flows left to right
    // Note: To keep the chart working, you may need to update it to use the new Session schema instead of Scorecard. I'll read from Sessions now.
    const history = await Session.find().sort({ createdAt: 1 });
    // Transform Session data to match what the old Scorecard endpoint sent
    const formattedHistory = history.map(s => ({
       technical_score: s.scorecard?.technical_score || 0,
       communication_score: s.scorecard?.communication_score || 0,
       feedback: s.scorecard?.feedback || "",
       improvement: s.scorecard?.improvement || "",
       date: s.createdAt
    }));
    res.json(formattedHistory);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// The API Endpoint
app.post('/interview', async (req, res) => {
  try {
    const { message } = req.body;
    
    // 1. Log what the user sent
    console.log("User said:", message);

    // 2. Run the Agent (The Brain) with Resume Context
    const result = await runInterviewAgent(message, conversationHistory, resumeContext);

    // 3. Save to history so the agent remembers context
    // We save the user's message...
    conversationHistory.push({ role: "user", content: message });
    // ...and the agent's response
    conversationHistory.push({ role: "assistant", content: result.response });

    // 4. Send the result back to the frontend
    res.json({
      agent: result.agent,      // "TECH_LEAD" or "HR"
      response: result.response // The actual text
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong with the AI." });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`🚀 AI Server is running on http://localhost:${PORT}`);
});
