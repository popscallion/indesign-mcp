# Evolutionary Testing Checklist

## Pre-Flight Check
- [ ] InDesign is running with a document open
- [ ] MCP server built: `npm run build`
- [ ] MCP server running: `npm start` (in separate terminal, telemetry OFF by default)
- [ ] Reference images exist in `tests/decision-analysis/reference-images/`
- [ ] You are Claude Code (can use Task tool)
- [ ] **CRITICAL**: Timeout configured for 7+ minutes: `timeout 7m node -e "..."`
- [ ] **CRITICAL**: Using single evolution instance (no multiple `node -e` processes)
- [ ] Environment variables clear: no competing EVOLUTION_SESSION_ID

## Telemetry Setup (Critical)
- [ ] Server starts with telemetry OFF (this is correct)
- [ ] Task agents will enable telemetry automatically via `set_environment_variable`
- [ ] All tools are pre-wrapped for runtime telemetry control (fixed architecture)

## Direct Execution Steps

### Initialize Evolution System
- [ ] Import InteractiveEvolution module
- [ ] Create instance: `const evolution = new InteractiveEvolution()`
- [ ] Initialize: `await evolution.initialize('book-page', 3)`
- [ ] Verify pre-flight checks pass

### For Each Generation
- [ ] Start generation: `await evolution.startGeneration()`
- [ ] Check progress: `console.log(await evolution.getProgress())`

### For Each Agent (3 total)
- [ ] Get next prompt: `const { prompt, sessionId, agentId } = await evolution.getNextAgentPrompt()`
- [ ] **VERIFY**: Prompt contains `set_environment_variable` and `telemetry_end_session`
- [ ] **VERIFY**: Session ID is properly set in environment variables
- [ ] Run Task agent: `Task("Recreate InDesign layout", prompt)`
- [ ] Wait for Task completion (3-4 minutes)
- [ ] **CRITICAL**: Process completion: `await evolution.processAgentCompletion(sessionId)`
- [ ] **NEVER SKIP**: processAgentCompletion() - it contains document reset logic
- [ ] Note the score returned
- [ ] Verify document was reset before next agent

### After All Agents
- [ ] Analyze generation: `const { patterns, report, averageScore } = await evolution.analyzeGeneration()`
- [ ] Review patterns in report
- [ ] Get improvement suggestions: `const improvements = await evolution.suggestImprovements()`
- [ ] Select and apply improvement: `await evolution.applyImprovement(selectedImprovement)`
- [ ] Commit changes with git
- [ ] Move to next generation: `await evolution.nextGeneration()`

## State Management
- [ ] Save progress periodically: `await evolution.saveProgress('progress.json')`
- [ ] Can resume if interrupted: `await evolution.loadProgress('progress.json')`

## Example Code Sequence
```typescript
// Complete generation cycle
import { InteractiveEvolution } from './dist/experimental/evolutionary/interactiveEvolution.js';

const evolution = new InteractiveEvolution();
await evolution.initialize('book-page', 3);
await evolution.startGeneration();

// Run 3 agents
for (let i = 0; i < 3; i++) {
  const { prompt, sessionId, agentId } = await evolution.getNextAgentPrompt();
  Task("Recreate InDesign layout", prompt);
  await evolution.processAgentCompletion(sessionId);
}

// Analyze and improve
const { patterns, averageScore } = await evolution.analyzeGeneration();
const improvements = await evolution.suggestImprovements();
await evolution.applyImprovement(improvements[0]);
```

## Common Patterns to Watch For
- [ ] Font sizes too small/large
- [ ] Incorrect margins or spacing
- [ ] Wrong text alignment
- [ ] Missing styles
- [ ] Frame positioning errors

## Key Files
- **Interactive Controller**: `src/experimental/evolutionary/interactiveEvolution.ts`
- **Config**: `src/experimental/evolutionary/config.ts`
- **Telemetry**: `${os.tmpdir()}/evolution_tests/telemetry/*.jsonl` (e.g., `/tmp` on macOS/Linux)
- **Saved Docs**: `${os.tmpdir()}/evolution_tests/documents/*.indd` (e.g., `/tmp` on macOS/Linux)
- **Progress Files**: `${os.tmpdir()}/evolution_tests/*.json` (e.g., `/tmp` on macOS/Linux)

## Troubleshooting
- **"Command timed out after 2m"** → Use `timeout 7m node -e "..."` for proper timeout
- **"Evolution system not initialized"** → Call `initialize()` first
- **"All agents completed"** → Call `analyzeGeneration()` then `nextGeneration()`
- **No telemetry captured?** → 
  - ✅ Check Task agent called `telemetry_end_session`
  - ✅ Verify agent used `set_environment_variable` to enable telemetry 
  - ✅ Still call `processAgentCompletion()` - has fallback telemetry
- **Document contamination?** → NEVER skip `processAgentCompletion()` - contains reset logic
- **Session ID mismatch?** → Kill competing node processes: `pkill -f "node -e"`
- **Lost progress?** → Use `saveProgress()` and `loadProgress()`

## Success Metrics
- Generation 1: ~40-50% (baseline)
- Generation 2-3: ~60-70% (after improvements)
- Target: 85%+ accuracy