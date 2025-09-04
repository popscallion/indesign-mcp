// src/illustrator/workflows/dataVisualization.ts

/**
 * Data Visualization Workflow
 * Demonstrates CSV import, data merge, and creating charts with shapes
 */

import { MockMcpServer, ChartConfig, DataPoint } from "@mcp/shared/types.js.js";

/**
 * Workflow: Create bar chart from CSV data
 */
export async function createBarChart(
  server: MockMcpServer,
  data: DataPoint[] = [
    { label: "Q1", value: 45 },
    { label: "Q2", value: 62 },
    { label: "Q3", value: 38 },
    { label: "Q4", value: 71 }
  ],
  config: ChartConfig = {
    chartType: "bar",
    width: 400,
    height: 300,
    colorScheme: "sequential",
    showLabels: true,
    showLegend: false
  }
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Set up chart artboard
    steps.push("Creating chart artboard");
    await server.callTool("manage_artboards", {
      action: "create",
      name: "Bar Chart",
      width: config.width + 100,
      height: config.height + 100,
      position: { x: 0, y: 0 }
    });
    
    // Step 2: Calculate dimensions
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = config.width / (data.length * 1.5);
    const spacing = barWidth * 0.5;
    const chartBottom = config.height + 50;
    
    // Step 3: Create color palette
    steps.push("Generating chart colors");
    await server.callTool("generate_color_variations", {
      baseColor: { r: 66, g: 165, b: 245 },
      scheme: "monochromatic",
      count: data.length,
      saveAsSwatches: true,
      swatchGroupName: "Chart Colors"
    });
    
    // Step 4: Create bars
    steps.push("Creating bar elements");
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i].value / maxValue) * config.height;
      const xPos = 50 + (i * (barWidth + spacing));
      const yPos = chartBottom - barHeight;
      
      // Create bar rectangle
      await server.callTool("create_shape_primitive", {
        shapeType: "rectangle",
        width: barWidth,
        height: barHeight,
        position: { x: xPos, y: yPos },
        fillColor: { 
          r: 66 + (i * 30), 
          g: 165 - (i * 20), 
          b: 245 - (i * 40) 
        }
      });
      
      // Add value label
      if (config.showLabels) {
        await server.callTool("create_text_on_path", {
          text: data[i].value.toString(),
          pathType: "line",
          position: { x: xPos + barWidth/2, y: yPos - 10 },
          fontSize: 10,
          fontFamily: "Arial",
          textAlign: "center"
        });
        
        // Add category label
        await server.callTool("create_text_on_path", {
          text: data[i].label,
          pathType: "line",
          position: { x: xPos + barWidth/2, y: chartBottom + 15 },
          fontSize: 12,
          fontFamily: "Arial",
          textAlign: "center"
        });
      }
    }
    
    // Step 5: Create axes
    steps.push("Drawing chart axes");
    // Y-axis
    await server.callTool("create_advanced_path", {
      pathType: "line",
      startPoint: { x: 45, y: 50 },
      endPoint: { x: 45, y: chartBottom },
      strokeWeight: 2,
      strokeColor: { r: 0, g: 0, b: 0 }
    });
    
    // X-axis
    await server.callTool("create_advanced_path", {
      pathType: "line",
      startPoint: { x: 45, y: chartBottom },
      endPoint: { x: config.width + 50, y: chartBottom },
      strokeWeight: 2,
      strokeColor: { r: 0, g: 0, b: 0 }
    });
    
    // Step 6: Add chart title
    steps.push("Adding chart title");
    await server.callTool("create_text_on_path", {
      text: "Quarterly Revenue",
      pathType: "line",
      position: { x: config.width/2 + 50, y: 20 },
      fontSize: 18,
      fontFamily: "Arial Bold",
      textAlign: "center"
    });
    
    steps.push("Bar chart complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create pie chart visualization
 */
export async function createPieChart(
  server: MockMcpServer,
  data: DataPoint[] = [
    { label: "Product A", value: 35, category: "Electronics" },
    { label: "Product B", value: 25, category: "Clothing" },
    { label: "Product C", value: 20, category: "Food" },
    { label: "Product D", value: 20, category: "Other" }
  ]
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    const centerX = 200;
    const centerY = 200;
    const radius = 120;
    
    // Step 1: Create artboard
    steps.push("Setting up pie chart artboard");
    await server.callTool("manage_artboards", {
      action: "create",
      name: "Pie Chart",
      width: 500,
      height: 400,
      position: { x: 0, y: 0 }
    });
    
    // Step 2: Calculate angles
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;
    
    // Step 3: Generate colors
    steps.push("Creating categorical colors");
    await server.callTool("generate_color_variations", {
      baseColor: { r: 255, g: 87, b: 34 },
      scheme: "tetradic",
      count: data.length,
      saveAsSwatches: true,
      swatchGroupName: "Pie Colors"
    });
    
    // Step 4: Create pie segments
    steps.push("Creating pie segments");
    const colors = [
      { r: 255, g: 87, b: 34 },
      { r: 33, g: 150, b: 243 },
      { r: 76, g: 175, b: 80 },
      { r: 255, g: 193, b: 7 }
    ];
    
    for (let i = 0; i < data.length; i++) {
      const segmentAngle = (data[i].value / total) * 360;
      
      // Create wedge shape (using advanced path)
      await server.callTool("create_advanced_path", {
        pathType: "arc",
        startPoint: { x: centerX, y: centerY },
        endPoint: { 
          x: centerX + radius * Math.cos((currentAngle + segmentAngle) * Math.PI / 180),
          y: centerY + radius * Math.sin((currentAngle + segmentAngle) * Math.PI / 180)
        },
        startAngle: currentAngle,
        endAngle: currentAngle + segmentAngle,
        radius: radius,
        fillColor: colors[i % colors.length],
        strokeWeight: 2,
        strokeColor: { r: 255, g: 255, b: 255 }
      });
      
      // Add percentage label
      const labelAngle = currentAngle + segmentAngle / 2;
      const labelRadius = radius * 0.7;
      const labelX = centerX + labelRadius * Math.cos(labelAngle * Math.PI / 180);
      const labelY = centerY + labelRadius * Math.sin(labelAngle * Math.PI / 180);
      
      await server.callTool("create_text_on_path", {
        text: `${Math.round(data[i].value / total * 100)}%`,
        pathType: "line",
        position: { x: labelX, y: labelY },
        fontSize: 12,
        fontFamily: "Arial Bold",
        fillColor: { r: 255, g: 255, b: 255 },
        textAlign: "center"
      });
      
      currentAngle += segmentAngle;
    }
    
    // Step 5: Create legend
    steps.push("Adding legend");
    for (let i = 0; i < data.length; i++) {
      // Legend color box
      await server.callTool("create_shape_primitive", {
        shapeType: "rectangle",
        width: 15,
        height: 15,
        position: { x: 350, y: 100 + i * 30 },
        fillColor: colors[i % colors.length]
      });
      
      // Legend text
      await server.callTool("create_text_on_path", {
        text: `${data[i].label} (${data[i].value}%)`,
        pathType: "line",
        position: { x: 375, y: 107 + i * 30 },
        fontSize: 11,
        fontFamily: "Arial"
      });
    }
    
    // Step 6: Add title
    steps.push("Adding chart title");
    await server.callTool("create_text_on_path", {
      text: "Market Share Distribution",
      pathType: "line",
      position: { x: 250, y: 30 },
      fontSize: 20,
      fontFamily: "Arial Bold",
      textAlign: "center"
    });
    
    steps.push("Pie chart complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}

/**
 * Workflow: Create data-driven infographic
 */
export async function createInfographic(
  server: MockMcpServer
): Promise<{ success: boolean; steps: string[] }> {
  const steps: string[] = [];
  
  try {
    // Step 1: Import CSV data
    steps.push("Importing data from CSV");
    await server.callTool("import_csv_data", {
      csvContent: `Year,Users,Revenue,Growth
2020,1000,50000,0
2021,2500,125000,150
2022,5000,300000,100
2023,8500,580000,70
2024,12000,920000,41`,
      hasHeaders: true,
      delimiter: ",",
      encoding: "UTF-8"
    });
    
    // Step 2: Create data merge template
    steps.push("Creating infographic template");
    await server.callTool("create_data_merge_template", {
      templateName: "Growth Infographic",
      variableFields: ["Year", "Users", "Revenue", "Growth"],
      layoutType: "grid",
      itemsPerRow: 5
    });
    
    // Step 3: Execute data merge
    steps.push("Merging data into template");
    await server.callTool("execute_data_merge", {
      templateName: "Growth Infographic",
      outputFormat: "single_document",
      createStyles: true
    });
    
    // Step 4: Create growth visualization icons
    steps.push("Creating growth indicators");
    const growthData = [0, 150, 100, 70, 41];
    
    for (let i = 0; i < growthData.length; i++) {
      const size = 20 + (growthData[i] / 10);
      
      // Create arrow icon for growth
      await server.callTool("create_shape_primitive", {
        shapeType: "polygon",
        width: size,
        height: size * 1.5,
        position: { x: 100 + i * 100, y: 200 },
        sides: 3,
        fillColor: growthData[i] > 100 ? 
          { r: 76, g: 175, b: 80 } : // Green for high growth
          { r: 255, g: 152, b: 0 }   // Orange for moderate growth
      });
      
      // Rotate to point upward
      await server.callTool("apply_transformation", {
        targetElements: "selection",
        transformationType: "rotate",
        angle: growthData[i] > 50 ? 0 : 45,
        center: { x: 100 + i * 100, y: 200 }
      });
    }
    
    // Step 5: Add data labels
    steps.push("Adding data labels");
    await server.callTool("update_variable_text", {
      variables: {
        "{{title}}": "5-Year Growth Analysis",
        "{{subtitle}}": "User Base & Revenue Trends",
        "{{footer}}": "Data Source: Company Analytics 2020-2024"
      },
      scope: "document"
    });
    
    // Step 6: Create connecting lines
    steps.push("Creating trend lines");
    await server.callTool("create_advanced_path", {
      pathType: "bezier",
      controlPoints: [
        { x: 100, y: 250 },
        { x: 200, y: 180 },
        { x: 300, y: 190 },
        { x: 400, y: 210 },
        { x: 500, y: 220 }
      ],
      strokeWeight: 3,
      strokeColor: { r: 33, g: 150, b: 243 },
      fillEnabled: false
    });
    
    // Step 7: Apply visual hierarchy
    steps.push("Applying visual styles");
    await server.callTool("create_graphic_style", {
      styleName: "Infographic Header",
      fillEnabled: false,
      strokeEnabled: false,
      fontSize: 24,
      fontFamily: "Helvetica Neue",
      fontWeight: "bold"
    });
    
    await server.callTool("bulk_style_application", {
      styleSource: "existing",
      styleName: "Infographic Header",
      targetSelection: "text_with_content",
      contentPattern: "Analysis|Growth"
    });
    
    steps.push("Infographic complete");
    return { success: true, steps };
    
  } catch (error) {
    steps.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, steps };
  }
}