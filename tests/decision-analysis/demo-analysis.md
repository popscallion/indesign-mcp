# Decision Analysis Testing Loop - Demo

## Overview
The Decision Analysis Testing Loop (DATL) is now ready to help identify why LLMs make poor strategic decisions when using the InDesign MCP tools.

## Key Improvements

### 1. Visual Attribute Comparison
Instead of comparing style names (which LLMs can't guess), we now compare:
- **Font sizes and leading** - Can the LLM recognize a 26pt headline vs 10pt body text?
- **Font families** - Does it choose appropriate fonts (with fallbacks)?
- **Alignment** - Does it recognize centered headlines vs left-aligned body?
- **Indentation** - Can it see and recreate paragraph indents?

### 2. Enhanced Pattern Detection
The test runner now identifies specific failure patterns:
- **font-selection**: Wrong font choices
- **text-sizing**: Incorrect font sizes
- **text-alignment**: Wrong alignment choices
- **frame-positioning**: Layout positioning errors

### 3. Actionable Recommendations
Based on detected patterns, the system suggests:
- Tool description improvements
- Prompt enhancements
- Workflow adjustments
- Validation rules

## Running the Test

### Prerequisites
1. InDesign must be running with a document open
2. The MCP server must be built: `npm run build`
3. The test runner must have the book-page test case

### Basic Test Run
```bash
node tests/decision-analysis/test-runner.js
```

### Test Specific Case
```bash
node tests/decision-analysis/test-runner.js --case book-page
```

### Run All Tests
```bash
node tests/decision-analysis/test-runner.js --all
```

## What Happens During Testing

1. **Setup**: MCP server starts and connects
2. **Decision Recording**: Each tool choice is logged with reasoning
3. **Layout Creation**: Tools are executed based on test operations
4. **Metric Extraction**: Visual attributes are captured from the result
5. **Comparison**: Actual vs expected metrics are compared
6. **Analysis**: Patterns and deviations are identified
7. **Recommendations**: Specific improvements are suggested

## Example Output

```
🧪 Running test: book-page
  Description: Recreate book page layout with complex typography hierarchy
  Starting MCP server...
  ✓ Connected to MCP server
  Executing test scenario...
    Executing: create_textframe
    Executing: apply_paragraph_style
  Extracting layout metrics...
  Comparing to reference metrics...
  Results saved to: book-page_2024-01-20T10-30-45.json

📊 Test Summary:
  Overall Match: ✗ FAIL
  Score: 75%
  Decisions Made: 6
  Tool Calls: 8
  Deviations: 4
    - textRegion.frame[1].region[0].fontSize: 20% off
    - textRegion.frame[1].region[0].alignment: 100% off
    - textRegion.frame[1].region[2].fontFamily: 100% off

  Patterns Detected:
    - font-selection: 1 occurrences
    - text-sizing: 1 occurrences
    - text-alignment: 1 occurrences
```

## Next Steps

1. **Run with Real LLM**: Connect an actual LLM to the MCP and have it attempt the book-page recreation
2. **Analyze Results**: Review which decisions led to failures
3. **Improve Tools**: Update tool descriptions and prompts based on recommendations
4. **Iterate**: Re-run tests to measure improvements

## Key Insights

The visual attribute approach tests what LLMs can actually observe:
- Visual hierarchy (big vs small text)
- Formatting patterns (indented quotes vs body text)
- Layout structure (header, body, footer positioning)

This is more realistic than expecting LLMs to guess style names like "Body Text (10/12)".