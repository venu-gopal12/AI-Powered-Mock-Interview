const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { generateResumeSummary } = require('../agent.js');

async function test() {
  const data = await pdf(fs.readFileSync(path.join(__dirname, '..', 'test_resume.pdf'))).catch(e => {
    console.log("PDF parse failed", e);
    return {text: ''};
  });
  console.log("Parsed length:", data.text.length);
  const summary = await generateResumeSummary(data.text);
  console.log("Summary:", summary);
}
test();
