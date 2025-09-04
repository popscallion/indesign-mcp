# Testing Guide

## Testing Systems

### 1. Workflow Testing
Mock testing for tool integration scenarios.

```bash
# Run all workflows
npx tsx src/illustrator/workflows/runWorkflowTests.ts --all

# Run specific category
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Logo Design"

# View statistics
npx tsx src/illustrator/workflows/runWorkflowTests.ts --stats
```

**14 workflows** across 4 categories:
- Logo Design (3)
- Pattern Design (4)
- Data Visualization (3)
- Typography Effects (4)

### 2. Evolutionary Testing
Automated tool description improvement using Claude Code's Task tool.

**Prerequisites**:
- Adobe app running with document open
- MCP server running: `npm start`
- Must be Claude Code (Task tool required)

**Quick Start**:
```javascript
// Always use 7-minute timeout
timeout 7m node -e "
import('./dist/experimental/evolutionary/interactiveEvolution.js')
  .then(async ({ InteractiveEvolution }) => {
    const evolution = new InteractiveEvolution();
    await evolution.initialize('book-page', 3);
    await evolution.startGeneration();
    // Run Task agents...
    await evolution.analyzeGeneration();
  });
"
```

### 3. Visual Testing (Peekaboo)
AI-powered visual comparison (requires macOS).

```bash
# Install Peekaboo
npm install -g @steipete/peekaboo-mcp

# Enable visual testing
export ENABLE_VISUAL_TESTING=true

# Run tests with visual comparison
npm run test:visual
```

## Test Commands

```bash
# Unit tests
npm test

# Build verification
npm run build && npm start

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck
```

## Troubleshooting

### Common Issues

**Timeout errors**: Use `timeout 7m` for evolution commands

**No telemetry**: Check Task agent enabled telemetry via `set_environment_variable`

**Document contamination**: Always call `processAgentCompletion()`

**TypeScript errors**: Run `npm run build` to verify compilation

## Performance Targets

- **Mock tests**: 50-500ms
- **Real operations**: 1-3 seconds
- **Complex workflows**: 10-30 seconds
- **LLM accuracy**: Target 85%+