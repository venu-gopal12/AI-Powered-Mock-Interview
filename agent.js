const { ChatGroq } = require("@langchain/groq");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
require("dotenv").config();

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.6,
});

// ─── Constants ────────────────────────────────────────────────────────────────

// Rough token estimate: 1 token ≈ 4 chars. Keep last N chars of history
// so we never silently blow past the context window.
const MAX_HISTORY_CHARS = 12_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert {sender, text} history to LangChain message objects,
 * then truncate from the FRONT so we keep the most recent context.
 * Filters out any injected hint messages to avoid contaminating history.
 */
function formatHistory(history) {
  // Remove hint-injected fake user messages
  const clean = history.filter((m) => m._isHint !== true);

  const messages = clean.map((m) =>
    m.sender === "user" ? new HumanMessage(m.text) : new AIMessage(m.text)
  );

  // Truncate from the front if total content is too long
  let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  while (totalChars > MAX_HISTORY_CHARS && messages.length > 2) {
    const removed = messages.shift();
    totalChars -= removed.content.length;
  }

  return messages;
}

// ─── Main agent ───────────────────────────────────────────────────────────────

/**
 * Single-agent interview runner. No separate router call.
 *
 * The system prompt handles both technical and supportive tones
 * based on context, cutting latency in half vs. the router approach.
 */
async function runInterviewAgent(userInput, conversationHistory = [], resumeText = "") {
  const resumeSection = resumeText?.trim()
    ? `CANDIDATE RESUME (use this as your question source):\n${resumeText.slice(0, 10000)}`
    : `NO RESUME PROVIDED — ask general junior full-stack questions (CORS, HTTP methods,
React lifecycle, basic SQL indexing, etc.).`;

  const systemPrompt = `You are a Senior Engineer conducting a mock technical interview for a junior/new-grad candidate.

PERSONA
- Direct and no-nonsense, but not cruel. Think "busy engineer who genuinely wants the candidate to succeed."
- If the candidate seems confident and is answering well: stay technical, probe gently.
- If the candidate seems lost, nervous, or gives a very short/confused answer: briefly acknowledge it ("No worries, let's try a different angle.") then ask something simpler or related. You do NOT need to be a separate HR agent for this — just be human.

QUESTION RULES
1. Ask exactly ONE question per turn. Never ask multiple questions.
2. Pick from the resume if provided; otherwise use general junior concepts.
3. Keep difficulty appropriate: core concepts only (no distributed systems, no advanced security). 
4. After a good answer: give one sentence of feedback, then move to a DIFFERENT topic.
5. After a weak answer: give a one-sentence correction with the key term they missed, then ask a simpler follow-up on the same topic.
6. Max 3 sentences total per response.

${resumeSection}`;

  const history = formatHistory(conversationHistory);

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...history,
    new HumanMessage(userInput),
  ]);

  return {
    // No more "agent" field — there is only one agent now.
    // Keeping the key for backwards compatibility with any frontend that reads it.
    agent: "INTERVIEWER",
    response: response.content,
  };
}

// ─── Hint system ──────────────────────────────────────────────────────────────

/**
 * Generates a hint without contaminating the main conversation history.
 * The hint call is fully isolated — it reads history but never writes to it.
 */
async function generateHint(conversationHistory) {
  const systemPrompt = `You are a helpful colleague whispering a hint to an interview candidate.
- Look at the interviewer's last question in the conversation.
- If it's a technical question: give a subtle 1-sentence clue. Do NOT give the answer. Example: "Psst — think about what happens to variables declared inside a closure."
- If it's behavioural or introductory: give a 1-sentence tip on structure. Example: "Psst — mention your stack, a project, and what you're excited to learn."
- One sentence only. No preamble.`;

  // Read-only: we pass history but do NOT add the hint prompt to it
  const history = formatHistory(conversationHistory);

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...history,
    new HumanMessage("[SYSTEM] The candidate pressed the hint button. Give them a hint."),
  ]);

  return response.content;
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

const SCORECARD_SCHEMA = `{
  "technical_score": <integer 0-10>,
  "communication_score": <integer 0-10>,
  "feedback": "<1-2 sentences on what they did well>",
  "improvement": "<1-2 sentences on what to study>"
}`;

const EMPTY_SCORECARD = {
  technical_score: 0,
  communication_score: 0,
  feedback: "Incomplete interview — no substantive answers were provided.",
  improvement: "Attempt at least a few questions before ending the session.",
};

/**
 * Grades the interview. Enforces zero scores structurally:
 * if the candidate never answered anything, we return the empty scorecard
 * directly without even calling the LLM.
 */
async function generateScorecard(conversationHistory) {
  // Count actual user answers (not hint injections, not one-word "ready" messages)
  const userAnswers = conversationHistory.filter(
    (m) => m.sender === "user" && m._isHint !== true && m.text.trim().length > 20
  );

  if (userAnswers.length === 0) {
    return EMPTY_SCORECARD;
  }

  const systemPrompt = `You are a strict Senior Hiring Manager grading an interview transcript.
Output ONLY a raw JSON object. No markdown, no backticks, no preamble.

Scoring rules:
- Base scores strictly on what the candidate actually said. Do not invent performance.
- Technical score: 0 if they answered nothing technical, 10 if they answered everything correctly and confidently.
- Communication score: based on clarity and structure of their answers.

Required format:
${SCORECARD_SCHEMA}`;

  const history = formatHistory(conversationHistory);

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...history,
    new HumanMessage("The interview is over. Output the scorecard JSON now."),
  ]);

  const content = response.content;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(content.substring(start, end + 1));
    } catch (e) {
      console.error("Scorecard JSON parse error:", e);
    }
  }

  return {
    ...EMPTY_SCORECARD,
    feedback: "The model returned a malformed scorecard. Try ending the interview again.",
  };
}

// ─── Title generation ─────────────────────────────────────────────────────────

async function generateTitle(conversationHistory) {
  if (conversationHistory.length < 2) {
    return `Interview ${new Date().toLocaleDateString()}`;
  }

  try {
    const systemPrompt = `Summarize this interview transcript as a short title.
Output ONLY the title. No quotes, no punctuation at the end, no preamble.
Max 4 words. Focus on the main technical topics discussed.
Examples: "React Hooks and Closures", "SQL Indexing Basics", "Java OOP Fundamentals"`;

    const history = formatHistory(conversationHistory);

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...history,
      new HumanMessage("Generate the title."),
    ]);

    return response.content.replace(/["'`]/g, "").trim();
  } catch (error) {
    console.error("Title generation error:", error);
    return `Interview ${new Date().toLocaleDateString()}`;
  }
}

module.exports = { runInterviewAgent, generateHint, generateScorecard, generateTitle };
