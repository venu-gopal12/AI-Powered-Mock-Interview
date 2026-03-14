const { ChatGroq } = require("@langchain/groq");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
require("dotenv").config();

// 1. Initialize the Free Model (Llama 3 8b is very fast)
const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile", // Free and fast
  temperature: 0.6,
});

// 2. Define the Personalities
const hrPrompt = `You are a Supportive HR Manager. 
Focus on the candidate's confidence and communication. 
If they seem stuck or nervous, offer encouragement and a helpful hint.`;

// 3. The Supervisor Function (Decides who speaks)
async function runInterviewAgent(userInput, conversationHistory = [], resumeText = "") {
  
  // 1. DYNAMIC SYSTEM PROMPT: Check if we actually have a resume
  let techLeadPrompt = "";

  if (resumeText && resumeText.trim() !== "") {
    // SCENARIO A: Resume was uploaded
    techLeadPrompt = `
      IDENTITY: You are a grumpy, skeptical Senior Engineer interviewing a NEW GRADUATE / JUNIOR Full-Stack Developer. You have the candidate's resume.
      
      CORE DIRECTIVES:
      1. ONE QUESTION ONLY: Pick ONE specific item from the resume below and drill down.
      2. DIFFICULTY CAP: Keep questions to fundamental concepts related to their experience.
      3. NO SCENARIOS: DO NOT ask complex, multi-part hypothetical scenarios involving Botnets, race conditions, or massive scale. Keep it simple.
      4. MOVE ON: If the candidate gives a good answer, DO NOT drill deeper into edge cases. Accept it, grumble about it, and ask a completely DIFFERENT question on a new topic from their resume.
      5. Be Brief: Max 3 sentences. No lists.
      6. Roast Weaknesses: If they list basic skills, mock them.
      
      RESUME CONTENT:
      ${resumeText.slice(0, 3000)}
    `;
  } else {
    // SCENARIO B: No resume was uploaded
    techLeadPrompt = `
      IDENTITY: You are a grumpy, skeptical Senior Engineer interviewing a NEW GRADUATE Full-Stack Developer. 
      
      CORE DIRECTIVES:
      1. DIFFICULTY CAP: Keep questions to fundamental concepts (CORS, HTTP, React lifecycle, basic DB indexing). No massive system design or security scenarios.
      2. FEEDBACK THEN PIVOT: When the user answers, FIRST evaluate their answer in one sentence. Correct them if they missed a key term (like 'Cache-Control headers'). THEN, ask a new question.
      3. NATURAL FLOW: When you ask a new question, try to make it somewhat related to the previous topic before completely changing subjects.
      4. Be Brief: Max 3 sentences total.
    `;
  }

  // 2. The Supervisor (Router) 
  const supervisorPrompt = `
    Analyze user input: "${userInput}".
    - If they are answering a technical question or saying they are ready -> "TECH_LEAD"
    - If they are nervous, stuck, or greeting generally -> "HR"
  `;

  const routerResponse = await model.invoke([
    new SystemMessage("You are a router. Output only 'TECH_LEAD' or 'HR'."),
    new HumanMessage(supervisorPrompt)
  ]);
  
  const chosenAgent = routerResponse.content.trim();
  console.log(`🤖 Supervisor selected: ${chosenAgent}`);

  // 3. Select the final prompt based on the router
  let finalSystemPrompt = chosenAgent === "TECH_LEAD" ? techLeadPrompt : hrPrompt;
  
  const response = await model.invoke([
    new SystemMessage(finalSystemPrompt),
    ...conversationHistory, // Include past chat context
    new HumanMessage(userInput)
  ]);

  return {
    agent: chosenAgent,
    response: response.content
  };
}

// 4. Panic Button (Hint System)
const hintPrompt = `
You are a helpful colleague whispering a hint to a candidate.
- Look at the interviewer's last question.
- If it is a technical question, give a subtle 1-sentence clue (e.g., "Psst! Try a Hash Map...").
- If it is an introduction or behavioral question (like "Introduce yourself"), give a 1-sentence tip on how to answer (e.g., "Psst! Mention your current degree, your primary tech stack, and your best project.").
- DO NOT give the exact answer. Be brief.
`;

async function generateHint(conversationHistory) {
  const response = await model.invoke([
    new SystemMessage(hintPrompt),
    ...conversationHistory, // context is needed to know the question
    new HumanMessage("I am stuck. Give me a hint.") 
  ]);

  return response.content;
}

// 5. Scorecard (Analytics)
const graderPrompt = `
You are a strict Senior Hiring Manager grading an interview transcript.
Output a JSON object ONLY. Do not write any other text (no markdown formatting).

CRITICAL RULES:
1. Did the user actually answer anything? Look closely. If the user provided NO ANSWERS, or only asked for hints, the scores MUST be 0.
2. Base your scores STRICTLY on what the user said. Do not invent performance.
3. If the user said nothing, the feedback should simply state: "Incomplete interview. No answers provided."

Format:
{
  "technical_score": (0-10),
  "communication_score": (0-10),
  "feedback": "1-2 sentences on what they did well.",
  "improvement": "1-2 sentences on what they need to study."
}
`;

async function generateScorecard(conversationHistory) {
  const response = await model.invoke([
    new SystemMessage(graderPrompt),
    ...conversationHistory,
    new HumanMessage("The interview is over. Generate the scorecard JSON.")
  ]);

  // Clean the output (sometimes LLMs add \`\`\`json ... \`\`\`)
  const cleanJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    return { feedback: "Error parsing scorecard." }; // Fallback
  }
}

// 6. Session Summarization (Titles)
const titlePrompt = `
You are a summarization AI. 
Read the interview transcript and generate a short, catchy title (maximum 4 words).
Focus on the main technical topics discussed.

CRITICAL RULES:
1. Output ONLY the title string. No quotes, no preamble, no markdown.
2. Max 4 words.
3. Example output: "React Hooks & Big O" or "Java Method Overriding".
`;

async function generateTitle(conversationHistory) {
  try {
    const response = await model.invoke([
      new SystemMessage(titlePrompt),
      ...conversationHistory,
      new HumanMessage("Generate the 4-word title for this session.")
    ]);
    
    // Clean up just in case the AI adds quotes
    return response.content.replace(/["']/g, '').trim(); 
  } catch (error) {
    console.error("Title Generation Error", error);
    // Fallback title just in case the AI fails
    return `Interview ${new Date().toLocaleDateString()}`; 
  }
}

module.exports = { runInterviewAgent, generateHint, generateScorecard, generateTitle };
