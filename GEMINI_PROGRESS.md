 Changes pushed. Now, to begin refactoring, I'll initialize the pnpm workspace by
  creating a pnpm-workspace.yaml file defining the packages' location. Next, I'll create
  the root package.json.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to pnpm-workspace.yaml                                    │
 │                                                                                │
 │    1 packages:                                                                 │
 │    2   - 'packages/*'                                                          │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, pnpm-workspace.yaml is done. Now, I'm creating the root package.json. It'll be
  private, specify pnpm as the package manager, and I'll move the existing dev
  dependencies into it. First, I need to read the current package.json.
 ╭───────────────────────────╮
 │ ✓  ReadFile package.json  │
 ╰───────────────────────────╯
✦ Okay, I'm creating the new root package.json. I'm moving the devDependencies from the
  old file, adding private: true, a pnpm section, and some monorepo management scripts.
  Here's the new file content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to package.json                                           │
 │                                                                                │
 │     1   {                                                                      │
 │     2 -   "name": "indesign-mcp",                                              │
 │     3 -   "version": "1.0.0",                                                  │
 │     4 -   "main": "dist/index.js",                                             │
 │     5 -   "type": "module",                                                    │
 │     2 +   "name": "indesign-mcp-monorepo",                                     │
 │     3 +   "private": true,                                                     │
 │     4     "scripts": {                                                         │
 │     7 -     "build": "tsc",                                                    │
 │     8 -     "start": "tsx src/index.ts",                                       │
 │     9 -     "start:http": "tsx src/http-server.ts",                            │
 │    10 -     "start:https": "tsx src/https-server.ts",                          │
 │    11 -     "dev": "tsx watch src/index.ts",                                   │
 │    12 -     "dev:http": "./scripts/dev-http.sh",                               │
 │    13 -     "dev:https": "./scripts/dev-https.sh",                             │
 │    14 -     "setup:https": "./scripts/setup-https.sh",                         │
 │    15 -     "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest",         │
 │    16 -     "lint": "eslint \"src/**/*.ts\" \"tests/**/*.ts\"                  │
 │       --ignore-pattern \"src/guidance/**\" --ignore-pattern                    │
 │       \"src/intelligence/**\"",                                                │
 │    17 -     "lint:fix": "eslint \"src/**/*.ts\" \"tests/**/*.ts\"              │
 │       --ignore-pattern \"src/guidance/**\" --ignore-pattern                    │
 │       \"src/intelligence/**\" --fix",                                          │
 │    18 -     "build:tests": "tsc -p tsconfig.tests.json --pretty",              │
 │    19 -     "typecheck": "npm run build && npm run build:tests"                │
 │     5 +     "build": "pnpm --filter \"./packages/*\" build",                   │
 │     6 +     "test": "pnpm --filter \"./packages/*\" test",                     │
 │     7 +     "lint": "pnpm --filter \"./packages/*\" lint"                      │
 │     8     },                                                                   │
 │    ══════════════════════════════════════════════════════════════════════════  │
 │    21 -   "keywords": [],                                                      │
 │    22 -   "author": "",                                                        │
 │    23 -   "license": "ISC",                                                    │
 │    24 -   "description": "",                                                   │
 │    25 -   "dependencies": {                                                    │
 │    26 -     "@modelcontextprotocol/sdk": "^1.12.1",                            │
 │    27 -     "@types/node": "^22.15.30",                                        │
 │    28 -     "tsx": "^4.19.4",                                                  │
 │    29 -     "typescript": "^5.8.3",                                            │
 │    30 -     "zod": "^3.25.57"                                                  │
 │    31 -   },                                                                   │
 │     9     "devDependencies": {                                                 │
 │    10       "@types/jest": "^29.5.3",                                          │
 │    11       "@typescript-eslint/eslint-plugin": "^8.34.1",                     │
 │    14       "fast-glob": "^3.3.3",                                             │
 │    15       "jest": "^29.7.0",                                                 │
 │    16       "ts-jest": "^29.1.0",                                              │
 │    ══════════════════════════════════════════════════════════════════════════  │
 │    40 -     "ts-morph": "^26.0.0"                                              │
 │    17 +     "ts-morph": "^26.0.0",                                             │
 │    18 +     "tsx": "^4.19.4",                                                  │
 │    19 +     "typescript": "^5.8.3"                                             │
 │    20     }                                                                    │
 │    21   }                                                                      │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, root package.json is done. Now, I'm creating the package directories: packages,
  packages/shared/src, packages/indesign-server/src, and packages/illustrator-server/src
  using run_shell_command.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mkdir -p packages/shared/src packages/indesign-server/src packages/illustrator… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, directories are made. Time for package.json files. I'll start with
  packages/shared/package.json: just name, version, and main for now, since dependencies
  are hoisted. Here's the content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to packages/shared/package.json                           │
 │                                                                                │
 │    1 {                                                                         │
 │    2   "name": "@mcp/shared",                                                  │
 │    3   "version": "1.0.0",                                                     │
 │    4   "main": "dist/index.js",                                                │
 │    5   "type": "module",                                                       │
 │    6   "scripts": {                                                            │
 │    7     "build": "tsc"                                                        │
 │    8   }                                                                       │
 │    9 }                                                                         │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, shared package.json is done. Next, I'm creating the indesign-server package.json
  with a dependency on shared and a start script. Here's the content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to ...packages/indesign-server/package.json               │
 │                                                                                │
 │     1 {                                                                        │
 │     2   "name": "@mcp/indesign-server",                                        │
 │     3   "version": "1.0.0",                                                    │
 │     4   "main": "dist/index.js",                                               │
 │     5   "type": "module",                                                      │
 │     6   "scripts": {                                                           │
 │     7     "build": "tsc",                                                      │
 │     8     "start": "tsx src/index.ts"                                          │
 │     9   },                                                                     │
 │    10   "dependencies": {                                                      │
 │    11     "@mcp/shared": "workspace:*"                                         │
 │    12   }                                                                      │
 │    13 }                                                                        │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, indesign-server package.json is done. Now, I'm creating the illustrator-server
  package.json, adding a dependency on shared and a start script. Here's the content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to ...ckages/illustrator-server/package.json              │
 │                                                                                │
 │     1 {                                                                        │
 │     2   "name": "@mcp/illustrator-server",                                     │
 │     3   "version": "1.0.0",                                                    │
 │     4   "main": "dist/index.js",                                               │
 │     5   "type": "module",                                                      │
 │     6   "scripts": {                                                           │
 │     7     "build": "tsc",                                                      │
 │     8     "start": "tsx src/index.ts"                                          │
 │     9   },                                                                     │
 │    10   "dependencies": {                                                      │
 │    11     "@mcp/shared": "workspace:*"                                         │
 │    12   }                                                                      │
 │    13 }                                                                        │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, package.json files are done. Time to refactor. I'm moving shared code to
  packages/shared/src, starting with the src/utils directory via run_shell_command. Shared
  code includes extendscript.ts, telemetry files, types.ts, and the utils directory itself.
   I'll begin with moving src/utils.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/utils packages/shared/src/ (Moving the utils directory to the shared pa… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, utils is moved. Now moving extendscript.ts, telemetry.ts, telemetryPersistence.ts,
  telemetryServer.ts, and types.ts to packages/shared/src.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/extendscript.ts src/tools/telemetry.ts src/tools/telemetryPersistence.t… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Shared files moved. Now for app-specific code. I'll move InDesign's code, src/tools and
  src/index.ts, to packages/indesign-server/src/tools and
  packages/indesign-server/src/index.ts respectively, starting with creating the tools
  directory.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mkdir -p packages/indesign-server/src/tools (Creating the tools directory for … │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, tools directory created. Moving src/tools contents to
  packages/indesign-server/src/tools now.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/tools/* packages/indesign-server/src/tools/ (Moving the InDesign tools … │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, I'm moving src/index.ts to packages/indesign-server/src/index.ts, but first I need
  to split its InDesign and Illustrator logic into separate files. I'll start by reading
  the file's content.
 ╭───────────────────────────╮
 │ ✓  ReadFile src/index.ts  │
 ╰───────────────────────────╯
✦ Okay, I've reviewed src/index.ts. Now, I'm creating
  packages/indesign-server/src/index.ts, stripping out Illustrator and APP_MODE logic, and
  updating import paths for the monorepo. Here's the new file content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to ...packages/indesign-server/src/index.ts               │
 │                                                                                │
 │     1 /**                                                                      │
 │     2  * @fileoverview Main entry point for the Adobe InDesign MCP server.     │
 │     3  */                                                                      │
 │     4                                                                          │
 │     5 import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";     │
 │     6 import { StdioServerTransport } from                                     │
 │       "@modelcontextprotocol/sdk/server/stdio.js";                             │
 │     7 import { registerAllInDesignTools } from "./tools/index.js";             │
 │     8 import { createTelemetryServer, setTelemetryEnabled } from               │
 │       "@mcp/shared/telemetryServer.js";                                        │
 │     9 import { TelemetryCapture } from "@mcp/shared/telemetry.js";             │
 │    10                                                                          │
 │    11 /**                                                                      │
 │    12  * Server configuration and identity                                     │
 │    13  */                                                                      │
 │    14 export const SERVER_CONFIG = {                                           │
 │    15   name: "indesign-mcp",                                                  │
 │    16   version: "1.0.0"                                                       │
 │    17 } as const;                                                              │
 │    18                                                                          │
 │    19 /**                                                                      │
 │    20  * Creates and configures the MCP server instance with Adobe InDesign    │
 │       capabilities                                                             │
 │    21  */                                                                      │
 │    22 async function createInDesignMcpServer(enableTelemetry: boolean = false  │
 │       ): Promise<McpServer> {                                                  │
 │    23   const baseServer = new McpServer(                                      │
 │    24     {                                                                    │
 │    25       name: SERVER_CONFIG.name,                                          │
 │    26       version: SERVER_CONFIG.version                                     │
 │    27     },                                                                   │
 │    28     {                                                                    │
 │    29       capabilities: {                                                    │
 │    30         logging: {},                                                     │
 │    31         tools: { listChanged: true },                                    │
 │    32         prompts: { listChanged: true },                                  │
 │    33       },                                                                 │
 │    34     }                                                                    │
 │    35   );                                                                     │
 │    36                                                                          │
 │    37   // Set telemetry state                                                 │
 │    38   setTelemetryEnabled(enableTelemetry);                                  │
 │    39                                                                          │
 │    40   // If telemetry is enabled, initialize and cleanup old files           │
 │    41   if (enableTelemetry) {                                                 │
 │    42     // Initialize telemetry directory                                    │
 │    43     await TelemetryCapture.initializeTelemetryDir();                     │
 │    44     // Clean up old telemetry files (async, don't block startup)         │
 │    45     TelemetryCapture.cleanupOldTelemetry().catch(error => {              │
 │    46       console.error('Failed to cleanup old telemetry files:', error);    │
 │    47     });                                                                  │
 │    48   }                                                                      │
 │    49                                                                          │
 │    50   // Use telemetry-enabled server if requested                           │
 │    51   const server = enableTelemetry ? createTelemetryServer(baseServer) :   │
 │       baseServer;                                                              │
 │    52                                                                          │
 │    53   // Register InDesign tools                                             │
 │    54   await registerAllInDesignTools(server);                                │
 │    55                                                                          │
 │    56   return server;                                                         │
 │    57 }                                                                        │
 │    58                                                                          │
 │    59 /**                                                                      │
 │    60  * Export for test runners to create telemetry-enabled servers           │
 │    61  */                                                                      │
 │    62 export { createInDesignMcpServer };                                      │
 │    63                                                                          │
 │    64 /**                                                                      │
 │    65  * Main server startup function                                          │
 │    66  */                                                                      │
 │    67 async function main(): Promise<void> {                                   │
 │    68   try {                                                                  │
 │    69     // Auto-detect telemetry mode for evolutionary testing               │
 │    70     const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||  │
 │    71                            process.env.EVOLUTION_SESSION_ID !==          │
 │       undefined ||                                                             │
 │    72                            process.env.TELEMETRY_SESSION_ID !==          │
 │       undefined;                                                               │
 │    73                                                                          │
 │    74     const server = await createInDesignMcpServer(enableTelemetry);       │
 │    75                                                                          │
 │    76     if (enableTelemetry) {                                               │
 │    77       console.error("🔬 MCP Server started with telemetry enabled");     │
 │    78     }                                                                    │
 │    79                                                                          │
 │    80     const transport = new StdioServerTransport();                        │
 │    81                                                                          │
 │    82     await server.connect(transport);                                     │
 │    83     console.error(`InDesign MCP Server started successfully`);           │
 │    84   } catch (error) {                                                      │
 │    85     console.error(`Failed to start InDesign MCP Server:`, error);        │
 │    86     process.exit(1);                                                     │
 │    87   }                                                                      │
 │    88 }                                                                        │
 │    89                                                                          │
 │    90 // Start the server                                                      │
 │    91 if (import.meta.url === `file://${process.argv[1]}`) {                   │
 │    92   main().catch((error) => {                                              │
 │    93     console.error("Fatal error:", error);                                │
 │    94     process.exit(1);                                                     │
 │    95   });                                                                    │
 │    96 }                                                                        │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, I'm creating the Illustrator server's index.ts. It will be Illustrator-specific,
  with updated import paths for the monorepo structure. Here's the content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to ...ckages/illustrator-server/src/index.ts              │
 │                                                                                │
 │     1 /**                                                                      │
 │     2  * @fileoverview Main entry point for the Adobe Illustrator MCP server.  │
 │     3  */                                                                      │
 │     4                                                                          │
 │     5 import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";     │
 │     6 import { StdioServerTransport } from                                     │
 │       "@modelcontextprotocol/sdk/server/stdio.js";                             │
 │     7 import { registerAllIllustratorTools } from "./tools/index.js";          │
 │     8 import { createTelemetryServer, setTelemetryEnabled } from               │
 │       "@mcp/shared/telemetryServer.js";                                        │
 │     9 import { TelemetryCapture } from "@mcp/shared/telemetry.js";             │
 │    10                                                                          │
 │    11 /**                                                                      │
 │    12  * Server configuration and identity                                     │
 │    13  */                                                                      │
 │    14 export const SERVER_CONFIG = {                                           │
 │    15   name: "illustrator-mcp",                                               │
 │    16   version: "1.0.0"                                                       │
 │    17 } as const;                                                              │
 │    18                                                                          │
 │    19 /**                                                                      │
 │    20  * Creates and configures the MCP server instance with Adobe             │
 │       Illustrator capabilities                                                 │
 │    21  */                                                                      │
 │    22 async function createIllustratorMcpServer(enableTelemetry: boolean =     │
 │       false): Promise<McpServer> {                                             │
 │    23   const baseServer = new McpServer(                                      │
 │    24     {                                                                    │
 │    25       name: SERVER_CONFIG.name,                                          │
 │    26       version: SERVER_CONFIG.version                                     │
 │    27     },                                                                   │
 │    28     {                                                                    │
 │    29       capabilities: {                                                    │
 │    30         logging: {},                                                     │
 │    31         tools: { listChanged: true },                                    │
 │    32         prompts: { listChanged: true },                                  │
 │    33       },                                                                 │
 │    34     }                                                                    │
 │    35   );                                                                     │
 │    36                                                                          │
 │    37   // Set telemetry state                                                 │
 │    38   setTelemetryEnabled(enableTelemetry);                                  │
 │    39                                                                          │
 │    40   // If telemetry is enabled, initialize and cleanup old files           │
 │    41   if (enableTelemetry) {                                                 │
 │    42     // Initialize telemetry directory                                    │
 │    43     await TelemetryCapture.initializeTelemetryDir();                     │
 │    44     // Clean up old telemetry files (async, don't block startup)         │
 │    45     TelemetryCapture.cleanupOldTelemetry().catch(error => {              │
 │    46       console.error('Failed to cleanup old telemetry files:', error);    │
 │    47     });                                                                  │
 │    48   }                                                                      │
 │    49                                                                          │
 │    50   // Use telemetry-enabled server if requested                           │
 │    51   const server = enableTelemetry ? createTelemetryServer(baseServer) :   │
 │       baseServer;                                                              │
 │    52                                                                          │
 │    53   // Register Illustrator tools                                          │
 │    54   await registerAllIllustratorTools(server);                             │
 │    55                                                                          │
 │    56   return server;                                                         │
 │    57 }                                                                        │
 │    58                                                                          │
 │    59 /**                                                                      │
 │    60  * Export for test runners to create telemetry-enabled servers           │
 │    61  */                                                                      │
 │    62 export { createIllustratorMcpServer };                                   │
 │    63                                                                          │
 │    64 /**                                                                      │
 │    65  * Main server startup function                                          │
 │    66  */                                                                      │
 │    67 async function main(): Promise<void> {                                   │
 │    68   try {                                                                  │
 │    69     // Auto-detect telemetry mode for evolutionary testing               │
 │    70     const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||  │
 │    71                            process.env.EVOLUTION_SESSION_ID !==          │
 │       undefined ||                                                             │
 │    72                            process.env.TELEMETRY_SESSION_ID !==          │
 │       undefined;                                                               │
 │    73                                                                          │
 │    74     const server = await createIllustratorMcpServer(enableTelemetry);    │
 │    75                                                                          │
 │    76     if (enableTelemetry) {                                               │
 │    77       console.error("🔬 MCP Server started with telemetry enabled");     │
 │    78     }                                                                    │
 │    79                                                                          │
 │    80     const transport = new StdioServerTransport();                        │
 │    81                                                                          │
 │    82     await server.connect(transport);                                     │
 │    83     console.error(`Illustrator MCP Server started successfully`);        │
 │    84   } catch (error) {                                                      │
 │    85     console.error(`Failed to start Illustrator MCP Server:`, error);     │
 │    86     process.exit(1);                                                     │
 │    87   }                                                                      │
 │    88 }                                                                        │
 │    89                                                                          │
 │    90 // Start the server                                                      │
 │    91 if (import.meta.url === `file://${process.argv[1]}`) {                   │
 │    92   main().catch((error) => {                                              │
 │    93     console.error("Fatal error:", error);                                │
 │    94     process.exit(1);                                                     │
 │    95   });                                                                    │
 │    96 }                                                                        │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, index.ts files are done. Now to move Illustrator tools. I'll move
  src/illustrator/tools to packages/illustrator-server/src/tools, then merge
  src/illustrator/index.ts into the new index.ts. First, I'll create the tools directory.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mkdir -p packages/illustrator-server/src/tools (Creating the tools directory f… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, tools directory created. Moving src/illustrator/tools contents to
  packages/illustrator-server/src/tools now.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/illustrator/tools/* packages/illustrator-server/src/tools/ (Moving the … │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, I'm merging src/illustrator/index.ts into
  packages/illustrator-server/src/index.ts. I need the registerAllIllustratorTools
  function from the former. Reading src/illustrator/index.ts now.
 ╭───────────────────────────────────────╮
 │ ✓  ReadFile src/illustrator/index.ts  │
 ╰───────────────────────────────────────╯
✦ Okay, I've got src/illustrator/index.ts and its registerAllIllustratorTools function.
  I'll update packages/illustrator-server/src/index.ts to use it, adjusting import paths
  for the monorepo. Rereading the target file, then writing the new content.
 ╭────────────────────────────────────────────────────────╮
 │ ✓  ReadFile ...ckages/illustrator-server/src/index.ts  │
 ╰────────────────────────────────────────────────────────╯
✦ Okay, I'm updating packages/illustrator-server/src/index.ts. I'll merge in
  registerAllIllustratorTools from the old src/illustrator/index.ts and fix the import
  paths for the monorepo structure. Here's the new file content.
 ╭────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  WriteFile Writing to ...ckages/illustrator-server/src/index.ts              │
 │                                                                                │
 │     4                                                                          │
 │     5   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";   │
 │     6   import { StdioServerTransport } from                                   │
 │         "@modelcontextprotocol/sdk/server/stdio.js";                           │
 │     7 - import { registerAllIllustratorTools } from "./tools/index.js";        │
 │     7   import { createTelemetryServer, setTelemetryEnabled } from             │
 │         "@mcp/shared/telemetryServer.js";                                      │
 │     8   import { TelemetryCapture } from "@mcp/shared/telemetry.js";           │
 │     9 + import { registerGeometryTools } from "./tools/geometry/index.js";     │
 │    10 + import { registerTransformTools } from "./tools/transform/index.js";   │
 │    11 + import { registerExportTools } from "./tools/export/index.js";         │
 │    12 + import { registerStyleTools } from "./tools/style/index.js";           │
 │    13 + import { registerGenerativeTools } from "./tools/generative/index.js"  │
 │       ;                                                                        │
 │    14 + import { registerSymbolTools } from "./tools/symbol/index.js";         │
 │    15 + import { registerDataTools } from "./tools/data/index.js";             │
 │    16 + import { registerAnalysisTools } from "./tools/analysis/index.js";     │
 │    17 + import { registerIntegrationTools } from                               │
 │       "./tools/integration/index.js";                                          │
 │    18                                                                          │
 │    19   /**                                                                    │
 │    20 +  * Registers all Illustrator tools with the MCP server                 │
 │    21 +  */                                                                    │
 │    22 + export async function registerAllIllustratorTools(server: McpServer):  │
 │       Promise<void> {                                                          │
 │    23 +   try {                                                                │
 │    24 +     await registerGeometryTools(server);                               │
 │    25 +     await registerTransformTools(server);                              │
 │    26 +     await registerExportTools(server);                                 │
 │    27 +     await registerStyleTools(server);                                  │
 │    28 +     await registerGenerativeTools(server);                             │
 │    29 +     await registerSymbolTools(server);                                 │
 │    30 +     await registerDataTools(server);                                   │
 │    31 +     await registerAnalysisTools(server);                               │
 │    32 +     await registerIntegrationTools(server);                            │
 │    33 +                                                                        │
 │    34 +     console.error("Illustrator MCP Tools registered successfully");    │
 │    35 +   } catch (error) {                                                    │
 │    36 +     console.error("Failed to register Illustrator tools:", error);     │
 │    37 +     throw error;                                                       │
 │    38 +   }                                                                    │
 │    39 + }                                                                      │
 │    40 +                                                                        │
 │    41 + /**                                                                    │
 │    42    * Server configuration and identity                                   │
 │    43    */                                                                    │
 │    44   export const SERVER_CONFIG = {                                         │
 ╰────────────────────────────────────────────────────────────────────────────────╯
✦ Okay, index.ts updated. Moving src/illustrator/workflows to
  packages/illustrator-server/. Done.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/illustrator/workflows packages/illustrator-server/ (Moving the Illustra… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Workflows moved. Now, from src/illustrator, I'll delete the merged index.ts and move
  types.ts to packages/illustrator-server/src/. Starting with the move.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell mv src/illustrator/types.ts packages/illustrator-server/src/ (Moving the Illus… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
✦ Moved types.ts. Now deleting src/illustrator with rm -rf.
 ╭────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell rm -rf src/illustrator (Removing the old illustrator directory.)  │
 ╰────────────────────────────────────────────────────────────────────────────╯
✦ src/illustrator is gone. Now to clean src. It should only have http-server.ts,
  https-server.ts, and the experimental, guidance, prompts, resources directories. tools,
  utils, index.ts, extendscript.ts, and types.ts are gone. I'll list src to verify.
 ╭────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  ReadFolder src                                                                      │
 │                                                                                        │
 │    Listed 9 item(s).                                                                   │
 ╰────────────────────────────────────────────────────────────────────────────────────────╯
✦ I see I messed up the file move. src/tools and src/index.ts still exist. I moved their
  contents, but not the originals. Deleting them now.
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Shell rm -rf src/tools src/index.ts (Removing the old tools directory and index.ts f… │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯