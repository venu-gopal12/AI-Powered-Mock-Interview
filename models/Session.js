const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  title: { type: String, default: "Mock Interview" },
  messages: [{
    sender: String, 
    text: String
  }],
  scorecard: {
    technical_score: Number,
    communication_score: Number,
    feedback: String,
    improvement: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
