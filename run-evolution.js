import { InteractiveEvolution } from './dist/experimental/evolutionary/interactiveEvolution.js';

// Global evolution instance
let evolution = null;

async function initEvolution() {
  evolution = new InteractiveEvolution();
  await evolution.initialize('book-page', 3);
  console.log('Evolution system initialized');
  return evolution;
}

async function startGeneration() {
  await evolution.startGeneration();
  console.log('Generation started');
  return evolution;
}

async function processAgent(sessionId) {
  const result = await evolution.processAgentCompletion(sessionId);
  console.log(`Agent Score: ${result.score}%`);
  console.log('Agent Status:', result.status);
  return result;
}

async function getNextAgent() {
  const { prompt, sessionId, agentId, isLastAgent } = await evolution.getNextAgentPrompt();
  console.log('=== NEXT AGENT PROMPT ===');
  console.log(`Agent ID: ${agentId}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Is Last Agent: ${isLastAgent}`);
  console.log('PROMPT:');
  console.log(prompt);
  console.log('=== END AGENT PROMPT ===');
  return { prompt, sessionId, agentId, isLastAgent };
}

async function analyzeGeneration() {
  const { patterns, report, averageScore } = await evolution.analyzeGeneration();
  console.log(`Average score: ${averageScore}%`);
  console.log(`Patterns found: ${patterns.length}`);
  console.log('Report:', report);
  return { patterns, report, averageScore };
}

// Export functions for command line use
global.initEvolution = initEvolution;
global.startGeneration = startGeneration;
global.processAgent = processAgent;
global.getNextAgent = getNextAgent;
global.analyzeGeneration = analyzeGeneration;

console.log('Evolution control functions loaded. Use:');
console.log('- await initEvolution()');
console.log('- await startGeneration()');
console.log('- await processAgent(sessionId)');
console.log('- await getNextAgent()');
console.log('- await analyzeGeneration()');