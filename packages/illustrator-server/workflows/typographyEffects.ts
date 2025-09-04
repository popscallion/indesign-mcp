// src/illustrator/workflows/typographyEffects.ts

/**
 * Typography Effects Workflow
 * Demonstrates text on path, envelope distortion, warping, and advanced text effects
 */

import { MockMcpServer, TypographyConfig } from "@mcp/shared/types.js.js";

/**
 * Workflow: Create vintage typography poster
 */
export async function createVintageTypography(
  server: MockMcpServer,
  config: TypographyConfig = {
    effectType: "vintage",
    fontSize: 72,
    fontFamily: "Baskerville",
    primaryColor: { r: 139, g: 69, b: 19 },
    secondaryColor: { r: 245, g: 222, b: 179 }
  }
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Create artboard for poster
    steps.push("Creating poster artboard");
    await server.callTool("manage_artboards", {
      action: "create",
      name: "Vintage Poster",
      width: 600,
      height: 800,
      position: { x: 0, y: 0 }
    });
    
    // Step 2: Create background
    steps.push("Adding vintage background");
    await server.callTool("create_shape_primitive", {
      shapeType: "rectangle",
      width: 600,
      height: 800,
      position: { x: 0, y: 0 },
      fillColor: config.secondaryColor || { r: 245, g: 222, b: 179 }
    });
    
    // Step 3: Create main headline with arc
    steps.push("Creating curved headline");
    await server.callTool("create_text_on_path", {
      text: "VINTAGE",
      pathType: "arc",
      startAngle: -30,
      endAngle: 30,
      radius: 200,
      position: { x: 300, y: 200 },
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fillColor: config.primaryColor,
      letterSpacing: 8
    });
    
    // Step 4: Add subtitle with wave effect
    steps.push("Adding wavy subtitle");
    await server.callTool("create_text_on_path", {
      text: "Typography Design",
      pathType: "wave",
      amplitude: 15,
      frequency: 2,
      position: { x: 300, y: 280 },
      fontSize: 36,
      fontFamily: config.fontFamily,
      fillColor: config.primaryColor
    });
    
    // Step 5: Create decorative banner
    steps.push("Creating ribbon banner");
    await server.callTool("create_advanced_path", {
      pathType: "bezier",
      controlPoints: [
        { x: 100, y: 400 },
        { x: 150, y: 380 },
        { x: 450, y: 380 },
        { x: 500, y: 400 },
        { x: 480, y: 440 },
        { x: 120, y: 440 }
      ],
      fillColor: config.primaryColor,
      strokeWeight: 0
    });
    
    // Step 6: Add text on banner
    steps.push("Adding banner text");
    await server.callTool("create_text_on_path", {
      text: "ESTABLISHED 2024",
      pathType: "line",
      position: { x: 300, y: 410 },
      fontSize: 24,
      fontFamily: config.fontFamily,
      fillColor: config.secondaryColor,
      textAlign: "center"
    });
    
    // Step 7: Apply envelope distortion
    steps.push("Applying vintage distortion");
    await server.callTool("apply_envelope_distortion", {
      distortType: "arch",
      intensity: 20,
      targetElements: "selection",
      bendDirection: "horizontal"
    });
    
    // Step 8: Add ornamental elements
    steps.push("Adding vintage ornaments");
    for (let i = 0; i < 4; i++) {
      await server.callTool("create_shape_primitive", {
        shapeType: "star",
        width: 30,
        height: 30,
        position: { 
          x: 150 + i * 100, 
          y: 500 
        },
        points: 8,
        innerRadius: 10,
        fillColor: config.primaryColor
      });
    }
    
    // Step 9: Create bottom text with custom path
    steps.push("Adding footer text");
    await server.callTool("create_text_on_path", {
      text: "• QUALITY • CRAFTSMANSHIP • TRADITION •",
      pathType: "line",
      position: { x: 300, y: 700 },
      fontSize: 18,
      fontFamily: config.fontFamily,
      fillColor: config.primaryColor,
      letterSpacing: 4,
      textAlign: "center"
    });
    
    steps.push("Vintage typography complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create neon text effect
 */
export async function createNeonText(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Create dark background
    steps.push("Creating night background");
    await server.callTool("create_shape_primitive", {
      shapeType: "rectangle",
      width: 800,
      height: 400,
      position: { x: 0, y: 0 },
      fillColor: { r: 10, g: 10, b: 30 }
    });
    
    // Step 2: Create main neon text
    steps.push("Creating neon text");
    await server.callTool("create_text_on_path", {
      text: "NEON",
      pathType: "line",
      position: { x: 400, y: 200 },
      fontSize: 120,
      fontFamily: "Impact",
      fillColor: { r: 255, g: 20, b: 147 },
      strokeEnabled: true,
      strokeWeight: 3,
      strokeColor: { r: 255, g: 105, b: 180 },
      textAlign: "center"
    });
    
    // Step 3: Duplicate for glow layers
    steps.push("Creating glow effect layers");
    for (let i = 1; i <= 3; i++) {
      await server.callTool("select_elements", {
        selectionType: "text"
      });
      
      await server.callTool("apply_transformation", {
        targetElements: "selection",
        transformationType: "copy",
        copies: 1,
        offset: { x: 0, y: 0 }
      });
      
      // Apply increasing blur/glow
      await server.callTool("create_graphic_style", {
        styleName: `Neon Glow ${i}`,
        strokeEnabled: true,
        strokeWeight: 3 + i * 2,
        strokeColor: { r: 255, g: 20, b: 147 },
        opacity: 100 - i * 20,
        effects: ["gaussian_blur"]
      });
    }
    
    // Step 4: Create flicker variation
    steps.push("Adding flicker effect");
    await server.callTool("create_text_on_path", {
      text: "NIGHTS",
      pathType: "line",
      position: { x: 400, y: 280 },
      fontSize: 60,
      fontFamily: "Arial Black",
      fillColor: { r: 0, g: 255, b: 255 },
      strokeEnabled: true,
      strokeWeight: 2,
      strokeColor: { r: 0, g: 191, b: 255 },
      opacity: 90,
      textAlign: "center"
    });
    
    // Step 5: Add reflection
    steps.push("Creating reflection");
    await server.callTool("select_elements", {
      selectionType: "text"
    });
    
    await server.callTool("apply_transformation", {
      targetElements: "selection",
      transformationType: "reflect",
      axis: "horizontal",
      copyOriginal: true
    });
    
    await server.callTool("apply_transformation", {
      targetElements: "selection",
      transformationType: "move",
      offset: { x: 0, y: 100 }
    });
    
    // Apply fade gradient
    await server.callTool("apply_gradient_mapping", {
      targetElements: "selection",
      gradientType: "linear",
      colors: [
        { r: 255, g: 20, b: 147 },
        { r: 10, g: 10, b: 30 }
      ],
      angle: 90,
      opacity: 30
    });
    
    steps.push("Neon text effect complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create 3D text effect
 */
export async function create3DText(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Create base text
    steps.push("Creating base 3D text");
    await server.callTool("create_text_on_path", {
      text: "3D",
      pathType: "line",
      position: { x: 200, y: 200 },
      fontSize: 150,
      fontFamily: "Arial Black",
      fillColor: { r: 255, g: 193, b: 7 }
    });
    
    // Step 2: Create depth layers
    steps.push("Building 3D depth");
    const depthLayers = 8;
    for (let i = 1; i <= depthLayers; i++) {
      await server.callTool("select_elements", {
        selectionType: "text"
      });
      
      await server.callTool("apply_transformation", {
        targetElements: "selection",
        transformationType: "copy",
        copies: 1,
        offset: { x: i * 2, y: i * 2 }
      });
      
      // Darken each layer
      const darkness = 255 - (i * 25);
      await server.callTool("bulk_style_application", {
        styleSource: "custom",
        customStyle: {
          fillColor: { 
            r: Math.max(darkness, 100), 
            g: Math.max(darkness - 62, 50), 
            b: 7 
          }
        },
        targetSelection: "selection"
      });
    }
    
    // Step 3: Add perspective distortion
    steps.push("Applying 3D perspective");
    await server.callTool("apply_envelope_distortion", {
      distortType: "perspective",
      intensity: 30,
      targetElements: "all",
      perspectivePoint: { x: 300, y: 150 }
    });
    
    // Step 4: Add highlight
    steps.push("Adding 3D highlight");
    await server.callTool("create_text_on_path", {
      text: "3D",
      pathType: "line",
      position: { x: 198, y: 198 },
      fontSize: 150,
      fontFamily: "Arial Black",
      fillEnabled: false,
      strokeEnabled: true,
      strokeWeight: 2,
      strokeColor: { r: 255, g: 255, b: 255 },
      opacity: 60
    });
    
    // Step 5: Create shadow
    steps.push("Creating drop shadow");
    await server.callTool("create_shape_primitive", {
      shapeType: "ellipse",
      width: 200,
      height: 40,
      position: { x: 250, y: 350 },
      fillColor: { r: 0, g: 0, b: 0 },
      opacity: 30
    });
    
    // Apply blur to shadow
    await server.callTool("apply_transformation", {
      targetElements: "selection",
      transformationType: "scale",
      scaleX: 1.5,
      scaleY: 0.8,
      center: { x: 250, y: 350 }
    });
    
    steps.push("3D text effect complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create kinetic typography animation frames
 */
export async function createKineticTypography(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    const words = ["MOTION", "ENERGY", "DYNAMIC", "FLOW"];
    const frameCount = 4;
    
    // Step 1: Create artboards for animation frames
    steps.push("Creating animation frames");
    for (let frame = 0; frame < frameCount; frame++) {
      await server.callTool("manage_artboards", {
        action: "create",
        name: `Frame ${frame + 1}`,
        width: 400,
        height: 400,
        position: { x: frame * 420, y: 0 }
      });
      
      // Step 2: Create spiral text for each frame
      steps.push(`Creating text for frame ${frame + 1}`);
      await server.callTool("create_text_on_path", {
        text: words[frame],
        pathType: "spiral",
        turns: 2 + frame * 0.5,
        radius: 100 - frame * 10,
        position: { x: 200 + frame * 420, y: 200 },
        fontSize: 36 - frame * 4,
        fontFamily: "Helvetica Neue",
        fontWeight: "bold",
        fillColor: { 
          r: 255 - frame * 50, 
          g: 100 + frame * 30, 
          b: 50 + frame * 40 
        }
      });
      
      // Step 3: Add motion blur effect
      steps.push(`Applying motion to frame ${frame + 1}`);
      await server.callTool("apply_transformation", {
        targetElements: "selection",
        transformationType: "rotate",
        angle: frame * 45,
        center: { x: 200 + frame * 420, y: 200 }
      });
      
      // Step 4: Create motion lines
      for (let line = 0; line < 3; line++) {
        await server.callTool("create_advanced_path", {
          pathType: "bezier",
          controlPoints: [
            { x: 100 + frame * 420, y: 150 + line * 50 },
            { x: 200 + frame * 420, y: 160 + line * 50 },
            { x: 300 + frame * 420, y: 140 + line * 50 }
          ],
          strokeWeight: 2 - line * 0.5,
          strokeColor: { r: 200, g: 200, b: 200 },
          opacity: 60 - line * 15
        });
      }
      
      // Step 5: Add frame number
      await server.callTool("create_text_on_path", {
        text: `${frame + 1}/${frameCount}`,
        pathType: "line",
        position: { x: 200 + frame * 420, y: 380 },
        fontSize: 10,
        fontFamily: "Arial",
        fillColor: { r: 150, g: 150, b: 150 },
        textAlign: "center"
      });
    }
    
    steps.push("Kinetic typography frames complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}