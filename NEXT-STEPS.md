# Next Development Steps

## Current State
✅ **Monorepo refactoring complete** - Project successfully migrated to pnpm workspace structure with separate packages for shared code, InDesign server, and Illustrator server.

## Immediate Priorities

### 1. Production Testing & Validation
- [ ] Test with real Adobe InDesign/Illustrator documents
- [ ] Validate all 52+ InDesign tools work correctly
- [ ] Complete testing of 44 Illustrator tools
- [ ] Document any breaking changes from refactoring

### 2. HTTP/HTTPS Server Migration
- [ ] Move HTTP/HTTPS servers from `packages/shared/src/` to proper location
- [ ] Implement app mode switching for HTTP servers
- [ ] Test remote access via ngrok tunneling

### 3. Evolutionary Testing System
- [ ] Fix experimental/evolutionary imports to work with new structure
- [ ] Decide if evolutionary should be InDesign-specific or abstracted
- [ ] Re-enable task-based testing workflows

### 4. CI/CD Pipeline
- [ ] Set up GitHub Actions for automated testing
- [ ] Add build verification on pull requests
- [ ] Configure automatic releases

### 5. Documentation Updates
- [ ] Update API documentation for each tool
- [ ] Create migration guide for users upgrading
- [ ] Add examples for using with Claude Desktop

## Quick Commands
```bash
# Development
pnpm install                          # Install dependencies
pnpm run build                        # Build all packages
pnpm --filter indesign-server start   # Run InDesign server
pnpm --filter illustrator-server start # Run Illustrator server

# Testing
pnpm test                             # Run all tests
pnpm run lint                         # Lint all packages
```

## Entry Points for Development
- **Main servers**: `packages/*/src/index.ts`
- **Shared utilities**: `packages/shared/src/`
- **Tool implementations**: `packages/*/src/tools/`