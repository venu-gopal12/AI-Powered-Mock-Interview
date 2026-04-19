const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Handles file uploads
const pdf = require('pdf-parse'); // Reads PDF text
const { runInterviewAgent, generateHint, generateScorecard, generateTitle } = require('./agent'); // Import new functions
require('dotenv').config();

const app = express();
const upload = multer(); // Configure multer to hold files in memory

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows your React app (on port 3000) to talk to this server
app.use(express.json()); // Allows the server to understand JSON data

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
    
    // Return extracted text statelessly
    res.json({ 
      message: "Resume received. The Tech Lead is reading it now...",
      resumeText: data.text
    });
  } catch (error) {
    console.error("🔥 PDF Parsing Error:", error);
    res.status(500).json({ error: "Failed to parse PDF", details: error.message });
  }
});

// 2. NEW: Hint Endpoint
app.post('/hint', async (req, res) => {
  try {
    const { history } = req.body;
    const hint = await generateHint(history || []);
    console.log("💡 Hint generated:", hint);
    res.json({ hint });
  } catch (error) {
    console.error("Hint Error:", error);
    res.status(500).json({ error: "Could not generate hint" });
  }
});

// 3. NEW: End Interview Endpoint (Compute Scorecard Statelessly)
app.post('/end-interview', async (req, res) => {
  try {
    const { history } = req.body; 
    
    // Run both AI tasks in parallel to save time!
    const [scorecardData, smartTitle] = await Promise.all([
      generateScorecard(history || []),
      generateTitle(history || [])
    ]);
    
    console.log("✅ Scorecard generated successfully");

    // Return to frontend to save in localStorage
    res.json({
      scorecard: scorecardData,
      title: smartTitle
    });
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ error: "Could not generate session results" });
  }
});

// 4. The API Endpoint
app.post('/interview', async (req, res) => {
  try {
    const { message, history, resumeContext } = req.body;
    
    // 1. Log what the user sent
    console.log("User said:", message);

    // 2. Run the Agent (The Brain) with Context
    const result = await runInterviewAgent(message, history || [], resumeContext || "");

    // 3. Send the result back to the frontend
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
