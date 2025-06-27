# DEPRECATED: Old Test Files

## Status: DEPRECATED

These test files are from the original implementation that used simulated agents and the Claude API. They have been superseded by the Task-based approach.

## New Location

The updated evolutionary testing system is now located at:
- `src/experimental/evolutionary/` - Main implementation
- `src/experimental/evolutionary/test-task-based-workflow.ts` - Test setup

## Why These Files Are Kept

These files are preserved for reference to show the evolution of the system:
1. Original design used simulated agents
2. Pattern analysis expected detailed telemetry
3. Fully automated execution was attempted

## Current Approach

The new Task-based approach:
- Uses Claude Code's Task tool for real agents
- Semi-automated with Claude Code orchestration  
- No API costs
- Simpler architecture

## Do Not Use

Do not run these test files as they:
- Use deprecated EvolutionOrchestrator
- Expect simulated agent execution
- Assume automated workflow
- Will not work with current architecture

See `src/experimental/evolutionary/README-CLAUDE-CODE-WORKFLOW.md` for current usage.