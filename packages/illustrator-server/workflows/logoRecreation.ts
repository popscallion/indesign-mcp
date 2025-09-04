// src/illustrator/workflows/logoRecreation.ts

/**
 * Logo Recreation Workflow
 * Demonstrates combining shape primitives, transformations, colors, and styles
 * to recreate a professional logo design
 */

import { MockMcpServer, LogoWorkflowConfig } from "./types.js";

/**
 * Workflow: Create a tech company logo with geometric shapes
 */
export async function createTechLogo(
  server: MockMcpServer,
  config: LogoWorkflowConfig = {
    targetWidth: 200,
    targetHeight: 200,
    colorScheme: "complementary",
    style: "gradient"
  }
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Set up artboard
    steps.push("Setting up artboard for logo");
    await server.callTool("manage_artboards", {
      action: "create",
      name: "Logo Artboard",
      width: config.targetWidth * 1.5,
      height: config.targetHeight * 1.5,
      position: { x: 0, y: 0 }
    });
    
    // Step 2: Create base shapes
    steps.push("Creating hexagon base");
    const hexagon = await server.callTool("create_shape_primitive", {
      shapeType: "polygon",
      width: config.targetWidth,
      height: config.targetHeight,
      position: { x: 100, y: 100 },
      sides: 6,
      fillColor: { r: 41, g: 128, b: 185 }
    });
    
    steps.push("Creating inner circle");
    const circle = await server.callTool("create_shape_primitive", {
      shapeType: "ellipse",
      width: config.targetWidth * 0.6,
      height: config.targetHeight * 0.6,
      position: { x: 100, y: 100 },
      fillColor: { r: 255, g: 255, b: 255 }
    });
    
    // Step 3: Generate color variations
    steps.push("Generating color scheme");
    const colors = await server.callTool("generate_color_variations", {
      baseColor: { r: 41, g: 128, b: 185 },
      scheme: config.colorScheme,
      count: 5
    });
    
    // Step 4: Apply gradient if requested
    if (config.style === "gradient") {
      steps.push("Applying gradient");
      await server.callTool("apply_gradient_mapping", {
        targetElements: "selection",
        gradientType: "radial",
        colors: [
          { r: 41, g: 128, b: 185 },
          { r: 52, g: 152, b: 219 }
        ],
        angle: 45
      });
    }
    
    // Step 5: Add text element
    steps.push("Adding company name");
    await server.callTool("create_text_on_path", {
      text: "TECHCORP",
      pathType: "line",
      position: { x: 50, y: 250 },
      fontSize: 24,
      fontFamily: "Helvetica Bold",
      fillColor: { r: 52, g: 73, b: 94 }
    });
    
    // Step 6: Create and apply graphic style
    steps.push("Creating logo style");
    await server.callTool("create_graphic_style", {
      styleName: "Logo Style",
      fillEnabled: true,
      strokeEnabled: true,
      strokeWeight: 2,
      strokeColor: { r: 255, g: 255, b: 255 },
      opacity: 100,
      effects: ["drop_shadow"]
    });
    
    // Step 7: Group and transform
    steps.push("Grouping logo elements");
    await server.callTool("select_elements", {
      selectionType: "all",
      layerName: null
    });
    
    await server.callTool("apply_transformation", {
      transformationType: "scale",
      scaleX: 1,
      scaleY: 1,
      center: { x: 150, y: 150 }
    });
    
    steps.push("Logo creation complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create a minimalist logo with text on path
 */
export async function createMinimalistLogo(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Create circular path
    steps.push("Creating circular text path");
    const circlePath = await server.callTool("create_shape_primitive", {
      shapeType: "ellipse",
      width: 150,
      height: 150,
      position: { x: 200, y: 200 },
      fillEnabled: false,
      strokeEnabled: true,
      strokeWeight: 1,
      strokeColor: { r: 200, g: 200, b: 200 }
    });
    
    // Step 2: Add text on circular path
    steps.push("Adding text on circle");
    await server.callTool("create_text_on_path", {
      text: "• MINIMAL • DESIGN • STUDIO •",
      pathType: "circle",
      radius: 75,
      position: { x: 200, y: 200 },
      fontSize: 14,
      fontFamily: "Futura",
      letterSpacing: 2
    });
    
    // Step 3: Create center icon
    steps.push("Creating center icon");
    const triangle = await server.callTool("create_shape_primitive", {
      shapeType: "polygon",
      width: 40,
      height: 35,
      position: { x: 200, y: 200 },
      sides: 3,
      fillColor: { r: 0, g: 0, b: 0 }
    });
    
    // Step 4: Apply rotation
    steps.push("Rotating center icon");
    await server.callTool("apply_transformation", {
      targetElements: "selection",
      transformationType: "rotate",
      angle: 180,
      center: { x: 200, y: 200 }
    });
    
    steps.push("Minimalist logo complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create a complex logo with symbols
 */
export async function createSymbolBasedLogo(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Create base shape for symbol
    steps.push("Creating symbol base shape");
    await server.callTool("create_advanced_path", {
      pathType: "spiral",
      startPoint: { x: 100, y: 100 },
      endPoint: { x: 150, y: 150 },
      curveComplexity: "high",
      strokeWeight: 3,
      strokeColor: { r: 155, g: 89, b: 182 }
    });
    
    // Step 2: Create symbol from selection
    steps.push("Converting to symbol");
    await server.callTool("create_symbol", {
      symbolName: "Logo Element",
      registrationPoint: "center",
      exportOptions: {
        format: "svg",
        scale: 1
      }
    });
    
    // Step 3: Place symbol instances in pattern
    steps.push("Placing symbol instances");
    await server.callTool("place_symbol_instances", {
      symbolName: "Logo Element",
      pattern: "circle",
      count: 8,
      radius: 80,
      center: { x: 200, y: 200 },
      variations: {
        scale: { min: 0.8, max: 1.2 },
        rotation: { min: 0, max: 360 },
        opacity: { min: 70, max: 100 }
      }
    });
    
    // Step 4: Add center focal point
    steps.push("Adding center element");
    await server.callTool("create_shape_primitive", {
      shapeType: "star",
      width: 30,
      height: 30,
      position: { x: 200, y: 200 },
      points: 8,
      innerRadius: 10,
      fillColor: { r: 241, g: 196, b: 15 }
    });
    
    // Step 5: Apply blend modes
    steps.push("Applying blend modes");
    await server.callTool("apply_blend_modes_batch", {
      targetElements: "all",
      blendMode: "multiply",
      preserveOriginal: false
    });
    
    steps.push("Symbol-based logo complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}