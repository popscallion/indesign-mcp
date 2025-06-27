# Claude Code Workflow for Evolutionary Testing

## Overview

This document clarifies how Claude Code uses the evolutionary testing system with the Task tool. This is a **semi-automated** process where Claude Code orchestrates the testing interactively.

## Key Concepts

### Task Tool vs Simulation
- **Task Tool**: Claude Code's ability to spawn independent Claude instances
- **Task Agents**: Separate Claude instances that attempt layout recreation
- **No Simulation**: All agents are real Claude instances, not simulated

### Telemetry Collection Challenge
Since Task agents run in separate contexts, they cannot directly write to our telemetry system. Instead:
1. Task agents modify the InDesign document
2. We extract metrics from the modified document
3. We compare these metrics to the reference
4. Pattern analysis is based on document results, not tool call logs

## Step-by-Step Workflow

### 1. Initialize System
```typescript
// Claude Code runs this
const runner = createTaskBasedRunner();
await runner.initialize();
```

### 2. Launch Task Agents
For each agent, Claude Code:

```typescript
// Step 1: Create the prompt
const prompt = runner.createTaskPrompt(config, 'agent-1');

// Step 2: Claude Code invokes Task tool
// This is done by Claude Code, not programmatically:
// Task("Recreate InDesign layout", prompt)

// Step 3: Wait for Task to complete
// The Task agent modifies the InDesign document

// Step 4: Collect results
const metrics = await runner.extractLayoutMetrics();
const comparison = await runner.compareToReference(metrics, reference);
```

### 3. Analyze Patterns
After running multiple agents:

```typescript
// Analyze patterns across all runs
const patterns = patternAnalyzer.analyzePatterns(runs);

// Format for Claude Code's analysis
const report = await claudeAnalyzer.formatPatternAnalysis(
  runs, patterns, referenceImage, testCase
);

// Claude Code reads the report and identifies issues
```

### 4. Generate Improvements
Claude Code analyzes the patterns and suggests improvements:

```
Based on the analysis, I see all agents made fonts 20% too small.
I'll update the font_size parameter description to include typical ranges.

Improvement:
- Tool: create_paragraph_style
- Field: font_size  
- Current: "Font size in points"
- Proposed: "Font size in points (headlines 18-30pt, body 9-12pt)"
```

### 5. Apply Improvements
```typescript
// Claude Code applies the improvement
await toolModifier.applyImprovement(improvement);
await gitManager.commitImprovement(improvement, metadata);
```

### 6. Test Again
Repeat the process with new Task agents to measure improvement effectiveness.

## What This System Does NOT Do

1. **No Automated Execution**: Claude Code drives the process interactively
2. **No API Calls**: Uses Task tool, not Claude API
3. **No Tool Call Telemetry**: Cannot capture individual tool calls from Task agents
4. **No Full Automation**: Requires Claude Code to orchestrate

## Practical Usage

When using this system, Claude Code should:

1. Start with the example workflow as a guide
2. Use Task tool to spawn 3-5 agents per generation  
3. Focus on high-impact patterns (affecting multiple agents)
4. Apply one improvement at a time
5. Test improvements before moving to the next

## Example Claude Code Session

```
Human: Let's run evolutionary testing on the book page layout

Claude: I'll start evolutionary testing using the Task-based approach.

First, let me initialize the system:
[Initializes TaskBasedRunner]

Now I'll launch 3 Task agents to attempt the layout:

Agent 1:
[Uses Task tool with layout prompt]
[Waits for completion]
[Extracts metrics]
Score: 45%

Agent 2:
[Uses Task tool with layout prompt]
[Waits for completion]
[Extracts metrics]
Score: 43%

Agent 3:
[Uses Task tool with layout prompt]
[Waits for completion]
[Extracts metrics]
Score: 47%

Let me analyze the patterns...
[Runs pattern analysis]

I notice all agents underestimated font sizes by 20-30%. This suggests the font_size parameter needs clearer guidance about typical ranges.

I'll update the tool description:
[Applies improvement]

Let's test with 3 more agents to see if this helps...
[Continues evolution]
```

## Important Notes

1. **InDesign State**: Must reset/clear document between agents
2. **Sequential Execution**: Agents must run one at a time (InDesign constraint)
3. **Pattern Detection**: Based on document analysis, not tool usage
4. **Human Oversight**: Claude Code presents findings for approval