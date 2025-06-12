# Phase 1: Strategic Prompt Framework Implementation

## Current Task: Implement intelligent LLM guidance for InDesign MCP

### Objective
Transform InDesign MCP from tool collection to intelligent document automation system by implementing BlenderMCP-inspired strategic prompting patterns.

### What to Read First
1. `CLAUDE.md` - Complete project context and current architecture
2. `blendermcp_analysis_report.md` - Reference patterns to follow
3. Existing code in `src/tools/*/index.ts` - Follow these TypeScript patterns
4. `src/index.ts` - Understand current MCP server structure

### Priority Implementation Tasks (in exact order)

#### Task 1: Create Strategic Prompt System
**File**: `src/prompts/document-strategy.ts`

Implement `document_creation_strategy()` function inspired by BlenderMCP's `asset_creation_strategy()`.

Must include:
- Mandatory document state checking workflow
- Tool usage hierarchy (existing styles → create new → custom operations)  
- Text operations priority (check overset → maintain threading → apply styles)
- Layout operations priority (verify dimensions → check frames → ensure flow)
- Error prevention patterns
- Workflow-specific guidance for document types

#### Task 2: Create Tool Hierarchy System  
**File**: `src/guidance/tool-hierarchy.ts`

Implement intelligent tool selection guidance with:
- Clear tool selection priorities for each operation type
- Context checking requirements before tool usage
- Tool chaining recommendations for common workflows

#### Task 3: Add Document Context Intelligence
**File**: `src/intelligence/document-context.ts`

Create document state awareness with:
- Mandatory document state checking functions
- Intelligent error detection and recovery
- Spatial/layout awareness for text frames
- Document type recognition patterns

#### Task 4: Create Error Recovery System
**File**: `src/guidance/error-recovery.ts`

Implement enhanced error handling beyond current thresholds:
- Specific error pattern recognition
- Automated recovery sequences  
- Prevention guidance for common issues

#### Task 5: Integrate with MCP Server
**File**: `src/index.ts` (modify existing)

Add new prompt registration while maintaining all 34 existing tools.

### Critical Constraints
- **NO BREAKING CHANGES**: All 34 existing tools must continue working exactly as before
- **Follow Existing Patterns**: Use TypeScript patterns from `src/tools/*/index.ts`
- **ExtendScript Compatibility**: Follow string building patterns (`array.join()`, not `+=`)
- **Error Handling**: Wrap all ExtendScript in try/catch blocks
- **Type Safety**: Add new interfaces to `src/types.ts`

### Success Criteria
- ✅ `npm run build` succeeds without errors
- ✅ `npm start` runs and lists new prompts  
- ✅ All existing 34 tools continue working unchanged
- ✅ New `document_creation_strategy` prompt provides comprehensive guidance
- ✅ Validation script passes

### Testing Protocol
After each major component:
1. Run `npm run build` - must succeed
2. Run `npm start` - server must start without errors
3. Test 2-3 existing tools manually - must work unchanged
4. Run `node scripts/validate-phase1.cjs` when complete

### Reference Pattern from BlenderMCP
```typescript
@mcp.prompt()
function asset_creation_strategy(): string {
    return `When creating 3D content in Blender, always start by checking if integrations are available:

0. Before anything, always check the scene from get_scene_info()
1. First use the following tools to verify if the following integrations are enabled:
   // ... comprehensive workflow guidance
   
Only fall back to scripting when:
- PolyHaven and Hyper3D are disabled
- A simple primitive is explicitly requested`;
}