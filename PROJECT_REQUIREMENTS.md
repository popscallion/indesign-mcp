# Project Requirements: Monorepo Refactoring

This document outlines the requirements and plan for refactoring the Adobe Creative Suite MCP server into a monorepo managed by pnpm. This new architecture will provide a more scalable, maintainable, and flexible foundation for the project.

## 1. Guiding Principles

- **Consult Documentation**: When in doubt about any technology or library (e.g., pnpm, TypeScript), consult the official documentation using Context7 MCP to ensure we are following best practices.
- **Iterative Updates**: This document should be treated as a living document. As we make progress, we should pause to update the plan and document any new decisions or changes.

## 2. Rationale

The primary goal of this refactoring is to move from a monolithic single-server architecture to a more modular, package-based monorepo. This will address the limitations of the current system and provide a solid foundation for future growth.

### Key Benefits:
- **Scalability**: The new architecture will easily accommodate the addition of new tools and even new Adobe applications (e.g., Photoshop) in the future.
- **Maintainability**: By separating shared code from application-specific code, we will reduce complexity and make the codebase easier to understand and maintain.
- **Improved Developer Experience**: The new structure will allow for independent development and testing of the InDesign and Illustrator toolsets.
- **Simplified Deployment**: Each application server can be built and run independently, simplifying the deployment process.

## 3. Current Architecture

The current architecture consists of a single Node.js application that uses an `MCP_APP_MODE` environment variable to switch between InDesign and Illustrator modes. This approach, while functional, leads to a monolithic application that is difficult to scale and maintain.

## 4. Proposed Architecture: pnpm Monorepo

The proposed architecture is a monorepo managed by `pnpm` workspaces. This will allow us to maintain a single repository while clearly separating shared code from application-specific code.

### 4.1. Directory Structure

```
/
├── packages/
│   ├── shared/
│   │   ├── src/            # Shared code (utils, telemetry, etc.)
│   │   └── package.json
│   │
│   ├── indesign-server/
│   │   ├── src/            # InDesign-specific tools and server
│   │   └── package.json
│   │
│   └── illustrator-server/
│       ├── src/            # Illustrator-specific tools and server
│       └── package.json
│
├── pnpm-workspace.yaml       # pnpm workspace configuration
└── package.json              # Root package.json
```

### 4.2. Package Descriptions

- **`packages/shared`**: A package containing all the code common to both InDesign and Illustrator.
- **`packages/indesign-server`**: A package for the InDesign-specific tools and server.
- **`packages/illustrator-server`**: A package for the Illustrator-specific tools and server.

## 5. Developer Experience and Usage

The developer experience will be streamlined and simplified:

- **Installation**: A single `pnpm install` command in the root directory will install all dependencies for all packages.
- **Building**: A single `pnpm run build` command in the root will build all the packages. We can also build each package independently (e.g., `pnpm --filter indesign-server build`).
- **Running Servers**: The InDesign and Illustrator servers can be started with simple commands from the root:
  ```bash
  # Start the InDesign server
  pnpm --filter indesign-server start

  # Start the Illustrator server
  pnpm --filter illustrator-server start
  ```

This approach maintains the simplicity of the current setup while providing the benefits of a monorepo.

## 6. Migration Steps

### Completed Steps:
1.  ✅ **Initialize pnpm Workspace**: Created `pnpm-workspace.yaml` file and root `package.json`.
2.  ✅ **Create Packages**: Created directory structure for `shared`, `indesign-server`, and `illustrator-server` packages with their own `package.json` files.
3.  ✅ **Refactor and Relocate Code**: Moved shared code to `packages/shared` and application-specific code to respective packages.
4.  ✅ **Update Dependencies**: Updated `package.json` files with correct dependencies and workspace references.
5.  ✅ **Install Dependencies**: Installed all dependencies using pnpm.

### In Progress:
6.  🔄 **Fix Compilation Issues**: Resolving import path issues and TypeScript compilation errors in the experimental directory.

### Remaining Steps:
7.  **Update Scripts**: Fine-tune the `package.json` scripts for building, running, and testing the new packages.
8.  **Testing**: Test each package independently and verify end-to-end functionality.
9.  **Update Documentation**: Review and update all markdown files to reflect the new architecture.

## 6.1 Current Issues to Resolve

The following compilation errors need to be addressed:

1. **Experimental directory imports**: The files in `packages/shared/src/experimental/` have broken imports that reference the old structure
2. **HTTP/HTTPS servers**: These reference `createInDesignMcpServer` which needs to be made available
3. **Missing telemetry functions**: Some experimental files reference functions that need to be properly exported

### Next Developer Actions:
1. Fix remaining import issues in experimental directory
2. Update HTTP/HTTPS servers to support both InDesign and Illustrator modes
3. Run `pnpm run build` to test compilation
4. Test running the servers with `pnpm --filter indesign-server start`

## 7. Future Considerations

- **Inter-Application Communication**: While not a current requirement, the proposed architecture is well-suited for future inter-application communication. This could be achieved by implementing a message broker or a dedicated API gateway that the servers can communicate with.
- **Support for New Applications**: The monorepo structure makes it easy to add support for new Adobe applications in the future. A new package (e.g., `photoshop-server`) could be added to the `packages` directory with minimal changes to the existing structure.

This document provides a comprehensive overview of the proposed refactoring. With no constraints on time or resources, we can ensure that this refactoring is done thoroughly and correctly, setting the project up for long-term success.