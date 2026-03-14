const { runInterviewAgent } = require("./agent");

async function test() {
  console.log("Testing Tech Lead trigger...");
  const res1 = await runInterviewAgent("I will use a nested loop to sort this array.");
  console.log("Result:", res1);

  console.log("\nTesting HR trigger...");
  const res2 = await runInterviewAgent("I am feeling really nervous about this interview.");
  console.log("Result:", res2);
}

test();
