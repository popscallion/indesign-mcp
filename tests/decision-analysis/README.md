# Decision Analysis Testing Harness

This directory contains the automated testing framework for analyzing LLM decision-making patterns in the InDesign MCP.

## Structure

```
decision-analysis/
├── test-runner.js      # Main test execution engine
├── test-cases/         # JSON test case definitions
├── reference-images/   # Reference layout images
├── results/           # Test execution results
└── package.json       # Dependencies
```

## Running Tests

### Prerequisites
1. Ensure InDesign is running with a document open
2. Build the MCP server: `npm run build` (in project root)
3. Install test dependencies: `npm install` (in this directory)

### Test Commands

```bash
# Run default test (dutch-academic)
npm test

# Run specific test case
npm run test:case dutch-academic

# Run all test cases
npm run test:all
```

## Test Case Format

Test cases are JSON files in `test-cases/` with the following structure:

```json
{
  "name": "test-name",
  "description": "Test description",
  "referenceImage": "path/to/reference.png",
  "tolerance": 0.05,  // 5% deviation allowed
  "expectedMetrics": {
    // Layout metrics to compare against
  },
  "layoutOperations": [
    // Sequence of MCP tool calls to execute
  ]
}
```

## Understanding Results

Test results are saved to `results/` with timestamps. Each result includes:

- **Summary**: Pass/fail status and score
- **Analysis**: Decision patterns and deviations
- **Recommendations**: Suggested improvements
- **Full Results**: Complete tool call log

## Adding New Test Cases

1. Create a new JSON file in `test-cases/`
2. Define expected metrics based on your reference layout
3. Specify the tool operation sequence
4. Add reasoning and alternatives for each decision
5. Place reference image in `reference-images/`

## Interpreting Patterns

The test runner identifies common failure patterns:

- **frame-positioning**: Incorrect frame coordinates or dimensions
- **style-mismatch**: Wrong styles applied or missing
- **threading-errors**: Text flow problems
- **overflow-issues**: Text doesn't fit in frames

These patterns help identify which tool descriptions or prompts need improvement.