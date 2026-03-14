// models/Scorecard.js
const mongoose = require('mongoose');

const scorecardSchema = new mongoose.Schema({
  technical_score: { type: Number, required: true },
  communication_score: { type: Number, required: true },
  feedback: { type: String },
  improvement: { type: String },
  date: { type: Date, default: Date.now } // Automatically saves when the interview happened
});

module.exports = mongoose.model('Scorecard', scorecardSchema);
