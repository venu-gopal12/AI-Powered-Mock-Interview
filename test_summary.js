const { generateResumeSummary } = require('./agent.js');

const dummyResume = `
Jane Doe
Software Engineer
Experience:
- Frontend Dev at TechCorp (2 years)
- Built a react application for tracking expenses
Projects:
- E-commerce Store: Built with Next.js, Redux, and TailwindCSS. Integrated Stripe for payments.
- Personal Blog: Built with Gatsby and GraphQL.
Skills: React, Node.js, JavaScript, Python
`;

async function test() {
  const summary = await generateResumeSummary(dummyResume);
  console.log("Summary Output:\n", summary);
}
test();
