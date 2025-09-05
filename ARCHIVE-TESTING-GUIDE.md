# Testing & Debugging Guide

This guide provides a comprehensive overview of the testing and debugging procedures for the Adobe Creative Suite MCP server.

## 🧪 Testing Systems

This project employs a multi-faceted testing strategy to ensure robustness, from unit tests to advanced evolutionary and visual testing.

### 1. Unit & Integration Testing (Jest)
Standard unit and integration tests for individual functions and modules.

```bash
npm test
```

### 2. Workflow Testing (Illustrator)
Mock testing for Illustrator tool integration and workflow scenarios. This system validates the logic and orchestration of complex tool chains without requiring a live connection to Illustrator.

```bash
# Run all 14 workflows
npx tsx src/illustrator/workflows/runWorkflowTests.ts --all

# Run a specific category of workflows
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Logo Design"

# View execution statistics
npx tsx src/illustrator/workflows/runWorkflowTests.ts --stats
```

### 3. Evolutionary Testing
This advanced, task-based system uses AI to automatically improve tool descriptions by observing LLM behavior. It is the primary method for optimizing LLM decision-making.

**Prerequisites**:
- An Adobe application (InDesign or Illustrator) must be running with a document open.
- The MCP server must be running (`npm start`).
- You must be using an appropriate client (e.g. Claude Code) that supports the Task tool.

**Quick Start**:
```javascript
// Always run with a 7-minute timeout to prevent premature termination
timeout 7m node -e "
import('./dist/experimental/evolutionary/interactiveEvolution.js')
  .then(async ({ InteractiveEvolution }) => {
    const evolution = new InteractiveEvolution();
    await evolution.initialize('book-page', 3); // 3 generations for the 'book-page' task
    await evolution.startGeneration();
    // ... manually run Task agents ...
    await evolution.analyzeGeneration();
  });
"
```

### 4. Visual Testing (Peekaboo)
AI-powered visual comparison for validating layout and design fidelity. This is crucial for tasks where the visual output is the primary success metric.

```bash
# 1. Install the Peekaboo CLI
npm install -g @steipete/peekaboo-mcp

# 2. Set environment variables for visual testing
export ENABLE_VISUAL_TESTING=true

# 3. Run a test that incorporates visual analysis
npm run test:visual
```

## ⚙️ Manual Test Protocol

For any new tool or significant change, follow this manual testing protocol:

1.  **Tool Functionality**: Test the tool with valid and expected parameters.
2.  **Error Handling**: Test with invalid parameters, empty documents, and other edge cases.
3.  **Regression Check**: Quickly test 3-4 existing, related tools to ensure no regressions were introduced.
4.  **Cross-Tool Flow**: If the new tool is part of a larger workflow, test it in conjunction with the other tools in that workflow.

### Test Document Setup
To ensure comprehensive testing, always have the following InDesign documents readily available:
-   **Empty Document**: A completely blank, new document.
-   **Simple Document**: 1-2 pages with basic text frames and simple formatting.
-   **Complex Document**: A multi-page document featuring threaded text frames, various paragraph and character styles, layers, and placed images.

## 🐛 Debugging Workflow

Follow this systematic approach to debug issues:

1.  **Compile and Type-Check**: Always run `npm run build` and `npm run typecheck` first to catch any static errors.
2.  **Execute the Tool**: Run the tool from your MCP client and observe the behavior.
3.  **Inspect the Application**: Visually check the result in InDesign or Illustrator. Did it perform the action as expected?
4.  **Check the JavaScript Console**: Open the ExtendScript console in the Adobe application (`Window → Utilities → JavaScript Console`) to look for runtime errors.
5.  **Add Debug Logging**: Instrument your ExtendScript code with logging to trace the execution flow and inspect variable states. This is the most effective way to pinpoint logic errors.

```javascript
// Add debug checkpoints to your ExtendScript to trace execution
var debugSteps = [];
try {
  debugSteps.push("Operation started");
  var doc = app.activeDocument;
  debugSteps.push("Document retrieved: " + doc.name);
  var frames = doc.textFrames;
  debugSteps.push("Found " + frames.length + " text frames");
  // ... your logic ...
} catch (e) {
  // On failure, return the debug trace along with the error message
  var debugString = "Debug Trace: " + debugSteps.join(" -> ") + " | Error: " + e.message;
  return debugString;
}
```

## 🚨 Troubleshooting & Error Thresholds

### Common Issues
-   **Timeout Errors**: Evolutionary testing commands often require more time. Always use `timeout 7m ...` to avoid premature termination.
-   **No Telemetry Data**: If the telemetry system doesn't seem to be capturing data, ensure the Task agent has enabled it via the `set_environment_variable` tool.
-   **Document Contamination**: If the document state becomes corrupted between test runs, it's likely that `processAgentCompletion()` was not called. This function is critical for resetting the document.
-   **TypeScript Compilation Errors**: If you see a flood of TypeScript errors, your first step should always be to run `npm run build`.

### Error Thresholds: When to Ask for Help
-   **Continue Debugging if**: A single tool fails, you have clear ExtendScript syntax errors, or you have TypeScript type errors.
-   **Stop and Ask for Help if**: Multiple tools fail with similar errors, the server fails to start, you have fundamental architectural questions, or ExtendScript consistently times out.

## 📊 Performance Targets

-   **Mock Tests**: 50-500ms
-   **Real Operations**: 1-3 seconds
-   **Complex Workflows**: 10-30 seconds
-   **LLM Accuracy**: Target 85%+