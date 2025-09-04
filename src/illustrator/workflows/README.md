# Illustrator MCP Workflow Tests

This directory contains comprehensive test workflows demonstrating the capabilities of the Illustrator MCP tools. Each workflow combines multiple tools to create real-world design scenarios.

## 📁 Workflow Categories

### 1. Logo Design (`logoRecreation.ts`)
- **Tech Company Logo**: Geometric hexagon with gradients and professional styling
- **Minimalist Logo**: Circular text path with centered icon
- **Symbol-Based Logo**: Complex design using symbols, instances, and blend modes

### 2. Pattern Design (`patternDesign.ts`)
- **Geometric Pattern**: Grid-based repeating patterns with color harmonies
- **Organic Pattern**: Voronoi and noise-based natural patterns
- **Textile Pattern**: Woven fabric simulation with interlacing threads
- **Abstract Pattern**: Fractal and maze combinations with artistic colors

### 3. Data Visualization (`dataVisualization.ts`)
- **Bar Chart**: Quarterly data visualization with axes and labels
- **Pie Chart**: Market share distribution with legend
- **Infographic**: Data-driven design with CSV import and merge

### 4. Typography Effects (`typographyEffects.ts`)
- **Vintage Typography**: Classic poster design with curved text and ornaments
- **Neon Text**: Glowing text effect with reflections
- **3D Text**: Layered depth effect with perspective
- **Kinetic Typography**: Animation frames with spiral text motion

## 🚀 Running the Workflows

### Prerequisites
1. Ensure the Illustrator MCP server is built:
   ```bash
   npm run build
   ```

2. Adobe Illustrator must be running (for actual execution)

### Test Runner Commands

Run all workflows:
```bash
npx tsx src/illustrator/workflows/runWorkflowTests.ts --all
```

Run workflows by category:
```bash
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Logo Design"
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Pattern Design"
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Data Visualization"
npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Typography Effects"
```

Run a specific workflow:
```bash
npx tsx src/illustrator/workflows/runWorkflowTests.ts --workflow "Tech Company Logo"
npx tsx src/illustrator/workflows/runWorkflowTests.ts --workflow "Geometric Pattern"
```

View statistics:
```bash
npx tsx src/illustrator/workflows/runWorkflowTests.ts --stats
```

Export documentation:
```bash
npx tsx src/illustrator/workflows/runWorkflowTests.ts --docs
```

## 📊 Workflow Coverage

### Tools Used in Workflows (32/44)
The workflows demonstrate usage of 32 unique tools out of the 44 available:

**Foundation Tools:**
- `select_elements`
- `create_shape_primitive`
- `measure_relationships`
- `organize_layers`
- `manage_artboards`
- `read_illustrator_document`

**Transformation & Export:**
- `apply_transformation`
- `extract_layer_assets`
- `batch_export_layouts`
- `configure_export_presets`

**Style & Design:**
- `generate_color_variations`
- `create_graphic_style`
- `create_text_on_path`
- `create_grid_layout`
- `create_pattern_fill`
- `manage_swatches_colors`
- `apply_gradient_mapping`
- `bulk_style_application`

**Advanced Features:**
- `create_advanced_path`
- `create_symbol`
- `place_symbol_instances`
- `apply_blend_modes_batch`
- `create_procedural_patterns`
- `apply_envelope_distortion`

**Data Integration:**
- `import_csv_data`
- `create_data_merge_template`
- `execute_data_merge`
- `update_variable_text`

## 🎯 Difficulty Levels

- **Beginner** (2 workflows): Simple tool combinations, basic shapes and text
- **Intermediate** (6 workflows): Multiple tools, color management, basic effects
- **Advanced** (7 workflows): Complex tool chains, procedural generation, data integration

## 🧪 Testing Strategy

### Unit Testing
Each workflow tests:
1. **Tool Integration**: How well tools work together
2. **Parameter Validation**: Correct parameter passing
3. **Error Handling**: Graceful failure recovery
4. **Performance**: Execution time tracking

### Visual Testing
When connected to actual Illustrator:
1. **Output Verification**: Check if designs match expectations
2. **Peekaboo Integration**: AI-powered visual comparison
3. **Screenshot Capture**: Document test results

### Regression Testing
1. Run workflows after tool updates
2. Compare execution times
3. Validate output consistency

## 📝 Adding New Workflows

To add a new workflow:

1. Choose appropriate category file or create new one
2. Follow the pattern:
```typescript
export async function createYourWorkflow(
  server: McpServer,
  config?: YourConfig
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    steps.push("Step description");
    await server.callTool("tool_name", { /* params */ });
    // ... more steps
    
    steps.push("Workflow complete");
    return { success: true, steps };
  } catch (error) {
    steps.push(`Error: ${error.message}`);
    return { success: false, steps };
  }
}
```

3. Register in `index.ts`:
```typescript
WORKFLOW_CATEGORIES["Your Category"] = [
  {
    name: "Your Workflow",
    function: createYourWorkflow,
    description: "What it does",
    difficulty: "beginner|intermediate|advanced",
    toolsUsed: ["tool1", "tool2"]
  }
];
```

## 🔍 Debugging Workflows

Enable verbose logging:
```bash
DEBUG=illustrator:* npx tsx src/illustrator/workflows/runWorkflowTests.ts --workflow "Your Workflow"
```

Test with actual Illustrator:
```bash
MCP_APP_MODE=illustrator npm start
# Then run workflows through MCP client
```

## 📈 Performance Benchmarks

Average execution times (mock server):
- **Simple workflows**: 50-100ms
- **Intermediate workflows**: 100-300ms  
- **Complex workflows**: 300-500ms

With actual Illustrator (estimated):
- **Simple workflows**: 1-3 seconds
- **Intermediate workflows**: 3-10 seconds
- **Complex workflows**: 10-30 seconds

## 🚧 Known Limitations

1. **Mock Testing**: Test runner uses mock server for rapid testing
2. **Actual Execution**: Real Illustrator execution requires MCP server running
3. **Visual Verification**: Requires Peekaboo or manual inspection
4. **Performance**: ExtendScript execution can be slow for complex operations

## 📚 Resources

- [Illustrator MCP PRD](../../../ILLUSTRATOR-MCP-PRD.md)
- [Tool Documentation](../tools/README.md)
- [ExtendScript Reference](https://www.adobe.com/devnet/illustrator/scripting.html)