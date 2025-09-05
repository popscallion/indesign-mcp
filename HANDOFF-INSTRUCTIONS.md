# LLM Agent Handoff Instructions

## Your Mission
You are taking over development of the Adobe Creative Suite MCP Server, which has just completed a major monorepo migration. Your task is to validate the system, fix any remaining issues, and prepare it for production use.

## Current System State
- **Architecture**: pnpm monorepo with three packages (shared, indesign-server, illustrator-server)
- **Build Status**: ✅ All packages compile successfully
- **Test Status**: ✅ Tests pass (no test files yet implemented)
- **Lint Status**: ⚠️ 5 ESLint errors, 121 warnings across all packages

## Immediate Tasks

### 1. Environment Setup and Validation
```bash
# First, verify your environment
node --version  # Should be 18+
pnpm --version  # Should be installed

# Clone and setup if needed
git status
pnpm install
pnpm run build

# Verify everything builds
echo "✅ Build successful" || echo "❌ Build failed - investigate errors"
```

### 2. Fix Remaining ESLint Errors
The InDesign server has 5 ESLint errors about unnecessary escape characters. You need to:

1. Run `pnpm --filter indesign-server lint` to see the errors
2. Check lines 1175 in `pages/index.ts` and lines 1963, 2196, 2405, 2578 in `styles/index.ts`
3. Fix regex patterns that have unnecessary `\s` escapes
4. Run `pnpm run lint` to verify all errors are resolved

### 3. Test Server Functionality

#### Test Standard Servers:
```bash
# Test InDesign server
pnpm --filter indesign-server start
# Expected: "InDesign MCP Server started successfully"
# Press Ctrl+C to stop

# Test Illustrator server  
pnpm --filter illustrator-server start
# Expected: "Illustrator MCP Server started successfully"
# Press Ctrl+C to stop
```

#### Test HTTP Servers with App Switching:
```bash
# Navigate to shared package
cd packages/shared

# Test InDesign HTTP mode
MCP_APP_MODE=indesign tsx src/http-server.ts
# Expected: "InDesign MCP HTTP Server started on port 3000"
# Test the endpoint: curl http://localhost:3000/health
# Press Ctrl+C to stop

# Test Illustrator HTTP mode
MCP_APP_MODE=illustrator tsx src/http-server.ts  
# Expected: "Illustrator MCP HTTP Server started on port 3000"
# Test the endpoint: curl http://localhost:3000/health
# Press Ctrl+C to stop
```

### 4. Implement Critical Tests
Create test files for the most critical functionality:

```typescript
// packages/shared/src/extendscript.test.ts
describe('ExtendScript Bridge', () => {
  test('should execute basic ExtendScript', async () => {
    // Implement test
  });
});

// packages/indesign-server/src/tools/text/index.test.ts
describe('Text Tools', () => {
  test('should handle add_text_to_document', async () => {
    // Implement test
  });
});
```

Run tests with `pnpm test` after implementation.

### 5. Test with Real Adobe Applications

**Prerequisites Check:**
1. Confirm Adobe InDesign or Illustrator is installed
2. Open the application and create a test document
3. Enable AppleScript/ExtendScript permissions if on macOS

**Tool Testing Protocol:**
```bash
# Start the appropriate server
pnpm --filter indesign-server start

# In another terminal, use an MCP client to test tools
# Test basic tool: get_document_info
# Test text tool: add_text_to_document with content "Test from MCP"
# Test export tool: export_document with format "PDF"
```

Document any errors in `TEST-RESULTS.md` with:
- Tool name
- Input parameters
- Expected result
- Actual result
- Error messages if any

### 6. Performance Profiling
Profile the ExtendScript execution:

```javascript
// Add timing to packages/shared/src/extendscript.ts
const startTime = Date.now();
// ... execution ...
const executionTime = Date.now() - startTime;
console.log(`ExtendScript executed in ${executionTime}ms`);
```

Target metrics:
- Simple operations: < 1 second
- Complex operations: < 3 seconds
- Batch operations: < 10 seconds

## Decision Points

### If ESLint Errors Persist:
1. Check if the regex patterns are in ExtendScript strings (where `\s` might be needed)
2. Determine if they're in TypeScript regex (where `\\s` or raw strings are needed)
3. Use `eslint-disable-next-line` only as last resort with explanation comment

### If Tests Fail with Adobe Apps:
1. Check Console app on macOS for AppleScript errors
2. Verify Adobe app is running and has a document open
3. Test with simpler ExtendScript directly in Adobe's ExtendScript Toolkit
4. Check for version-specific API changes in Adobe documentation

### If Performance is Poor:
1. Profile which ExtendScript operations are slow
2. Consider batching multiple operations into single ExtendScript calls
3. Implement caching for frequently accessed document properties
4. Add progress callbacks for long-running operations

## Success Criteria

Your handoff is complete when:

- [ ] All ESLint errors are resolved (warnings can remain)
- [ ] Both servers start without errors
- [ ] HTTP/HTTPS servers correctly switch between apps
- [ ] At least 5 critical tool tests are implemented and passing
- [ ] At least 10 tools tested with real Adobe applications
- [ ] Performance metrics documented for common operations
- [ ] `HANDOFF-RESULTS.md` created with:
  - Test results summary
  - Performance benchmarks
  - List of working tools
  - Known issues and workarounds
  - Recommendations for production deployment

## Context for Decisions

**Why Monorepo?**
The migration from a single-server architecture to a monorepo provides:
- Better code organization and reusability
- Independent deployment of InDesign and Illustrator servers
- Easier testing and maintenance
- Clear separation of concerns

**Why Dynamic App Loading?**
The HTTP/HTTPS servers use dynamic imports to avoid circular dependencies while supporting both applications from a single entry point.

**Critical Tools to Prioritize:**
1. `add_text_to_document` - Most commonly used
2. `export_document` - Essential for workflows
3. `get_document_info` - Diagnostic tool
4. `place_image` - Media handling
5. `apply_paragraph_style` - Formatting

## Your First Hour Checklist

1. [ ] Run `pnpm install && pnpm run build`
2. [ ] Run `pnpm test` - verify tests pass
3. [ ] Run `pnpm run lint` - note the 5 errors
4. [ ] Start InDesign server - verify it runs
5. [ ] Start Illustrator server - verify it runs
6. [ ] Test HTTP server with both app modes
7. [ ] Create `HANDOFF-RESULTS.md` with initial observations
8. [ ] Plan approach for remaining tasks

## Remember

- The codebase is functional but needs validation with real Adobe applications
- Focus on fixing errors first, then testing, then optimization
- Document everything - future developers depend on your findings
- The evolutionary testing system in `packages/shared/src/experimental/` is partially broken due to the migration - fix only if time permits

Good luck! The system is solid but needs your validation to be production-ready.