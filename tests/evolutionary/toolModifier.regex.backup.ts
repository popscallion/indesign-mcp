/**
 * @fileoverview Tool definition parser and modifier
 * Parses TypeScript tool definitions and applies improvements
 */

import { Improvement } from '../../src/experimental/evolutionary/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Parses and modifies MCP tool definitions
 */
export class ToolModifier {
  private toolsDir: string;
  
  constructor(toolsDir: string = 'src/tools') {
    this.toolsDir = toolsDir;
  }
  
  /**
   * Apply an improvement to a tool definition
   */
  async applyImprovement(improvement: Improvement): Promise<{
    success: boolean;
    modifiedContent?: string;
    error?: string;
  }> {
    try {
      // Find the tool file
      const toolFile = await this.findToolFile(improvement.tool);
      if (!toolFile) {
        return {
          success: false,
          error: `Tool file not found for: ${improvement.tool}`
        };
      }
      
      // Read current content
      const content = await fs.readFile(toolFile, 'utf-8');
      
      // Apply the improvement
      let modifiedContent: string;
      switch (improvement.type) {
        case 'description':
          modifiedContent = await this.modifyDescription(content, improvement);
          break;
          
        case 'parameter':
          modifiedContent = await this.modifyParameter(content, improvement);
          break;
          
        case 'example':
          modifiedContent = await this.addExample(content, improvement);
          break;
          
        case 'constraint':
          modifiedContent = await this.addConstraint(content, improvement);
          break;
          
        default:
          return {
            success: false,
            error: `Unknown improvement type: ${improvement.type}`
          };
      }
      
      // Validate the modified content
      const validation = await this.validateModifiedContent(modifiedContent);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid modification: ${validation.error}`
        };
      }
      
      return {
        success: true,
        modifiedContent
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Find the file containing a tool definition
   */
  private async findToolFile(toolName: string): Promise<string | null> {
    // Tool files are organized by category
    const categories = ['text', 'styles', 'layout', 'pages', 'special', 'utility', 'export', 'transform', 'analysis'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.toolsDir, category, 'index.ts');
      
      try {
        const content = await fs.readFile(categoryPath, 'utf-8');
        
        // Check if this file contains the tool
        if (content.includes(`'${toolName}'`) || content.includes(`"${toolName}"`)) {
          return categoryPath;
        }
      } catch (error) {
        // Category might not exist
        continue;
      }
    }
    
    return null;
  }
  
  /**
   * Modify tool description
   */
  private async modifyDescription(content: string, improvement: Improvement): Promise<string> {
    // Find the tool registration
    const toolPattern = new RegExp(
      `server\\.tool\\(\\s*['"\`]${improvement.tool}['"\`]\\s*,\\s*{([^}]+)}`,
      'gs'
    );
    
    const match = toolPattern.exec(content);
    if (!match) {
      throw new Error(`Tool registration not found for: ${improvement.tool}`);
    }
    
    // Extract the description
    const descPattern = /description:\s*['"`]([^'"`]+)['"`]/;
    const descMatch = descPattern.exec(match[1]);
    
    if (!descMatch) {
      throw new Error(`Description not found for tool: ${improvement.tool}`);
    }
    
    // Replace with new description
    const newDescription = improvement.proposed;
    const updatedToolDef = match[0].replace(descMatch[0], `description: "${newDescription}"`);
    
    return content.replace(match[0], updatedToolDef);
  }
  
  /**
   * Modify parameter description
   */
  private async modifyParameter(content: string, improvement: Improvement): Promise<string> {
    if (!improvement.field) {
      throw new Error('Parameter name required for parameter improvements');
    }
    
    // Find the tool registration
    const toolPattern = new RegExp(
      `server\\.tool\\(\\s*['"\`]${improvement.tool}['"\`][^{]*{[^}]*properties:\\s*{([^}]+(?:{[^}]*}[^}]*)*)}`
      , 'gs'
    );
    
    const match = toolPattern.exec(content);
    if (!match) {
      throw new Error(`Tool properties not found for: ${improvement.tool}`);
    }
    
    // Find the specific parameter
    const paramPattern = new RegExp(
      `${improvement.field}:\\s*{([^}]+)}`,
      's'
    );
    
    const paramMatch = paramPattern.exec(match[1]);
    if (!paramMatch) {
      throw new Error(`Parameter ${improvement.field} not found in tool ${improvement.tool}`);
    }
    
    // Find and replace the description
    const paramDescPattern = /description:\s*['"`]([^'"`]+)['"`]/;
    const descMatch = paramDescPattern.exec(paramMatch[1]);
    
    if (!descMatch) {
      // Add description if it doesn't exist
      const updatedParam = paramMatch[0].replace(
        paramMatch[1],
        `${paramMatch[1]}, description: "${improvement.proposed}"`
      );
      return content.replace(paramMatch[0], updatedParam);
    } else {
      // Replace existing description
      const updatedParam = paramMatch[0].replace(
        descMatch[0],
        `description: "${improvement.proposed}"`
      );
      return content.replace(paramMatch[0], updatedParam);
    }
  }
  
  /**
   * Add an example to the tool
   */
  private async addExample(content: string, improvement: Improvement): Promise<string> {
    // Find the tool handler
    const handlerPattern = new RegExp(
      `async\\s*\\(\\s*{([^}]*)}\\s*\\)\\s*=>\\s*{`,
      'g'
    );
    
    // Find the specific tool handler by looking for the tool name nearby
    const toolMatches = content.matchAll(new RegExp(
      `server\\.tool\\(\\s*['"\`]${improvement.tool}['"\`][^\\)]+\\)`,
      'g'
    ));
    
    for (const toolMatch of toolMatches) {
      const startPos = toolMatch.index! + toolMatch[0].length;
      const handlerMatch = handlerPattern.exec(content.substring(startPos));
      
      if (handlerMatch) {
        // Add example as a comment before the handler
        const example = `
  // Example: ${improvement.proposed}
  `;
        
        const insertPos = startPos + handlerMatch.index!;
        return content.substring(0, insertPos) + example + content.substring(insertPos);
      }
    }
    
    throw new Error(`Handler not found for tool: ${improvement.tool}`);
  }
  
  /**
   * Add a constraint to the tool
   */
  private async addConstraint(content: string, improvement: Improvement): Promise<string> {
    // Constraints are typically added to parameter validation
    if (!improvement.field) {
      // Add as a comment in the tool description
      return this.modifyDescription(content, {
        ...improvement,
        proposed: `${improvement.current}. ${improvement.proposed}`
      });
    }
    
    // Add constraint to specific parameter
    const paramPattern = new RegExp(
      `${improvement.field}:\\s*{([^}]+)}`,
      's'
    );
    
    const match = paramPattern.exec(content);
    if (!match) {
      throw new Error(`Parameter ${improvement.field} not found`);
    }
    
    // Add constraint based on type
    let updatedParam = match[0];
    
    // Check if it's a number parameter
    if (match[1].includes('type: "number"')) {
      // Add min/max constraints
      const constraintMatch = improvement.proposed.match(/(\d+)-(\d+)/);
      if (constraintMatch) {
        const [_, min, max] = constraintMatch;
        updatedParam = match[0].replace(
          match[1],
          `${match[1]}, minimum: ${min}, maximum: ${max}`
        );
      }
    } else if (match[1].includes('type: "string"')) {
      // Add enum constraint if applicable
      const enumMatch = improvement.proposed.match(/one of: (.+)/i);
      if (enumMatch) {
        const values = enumMatch[1].split(',').map(v => `"${v.trim()}"`);
        updatedParam = match[0].replace(
          match[1],
          `${match[1]}, enum: [${values.join(', ')}]`
        );
      }
    }
    
    return content.replace(match[0], updatedParam);
  }
  
  /**
   * Validate modified content
   */
  private async validateModifiedContent(content: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    // Basic syntax validation
    try {
      // Check for balanced braces
      let braceCount = 0;
      for (const char of content) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (braceCount < 0) {
          return { valid: false, error: 'Unbalanced braces' };
        }
      }
      
      if (braceCount !== 0) {
        return { valid: false, error: 'Unclosed braces' };
      }
      
      // Check for balanced quotes
      const quotes = ['"', "'", '`'];
      for (const quote of quotes) {
        const count = (content.match(new RegExp(quote, 'g')) || []).length;
        if (count % 2 !== 0) {
          return { valid: false, error: `Unbalanced ${quote} quotes` };
        }
      }
      
      // Check that server.tool calls are intact
      const toolCalls = content.match(/server\.tool\(/g) || [];
      const toolEnds = content.match(/\}\s*\)/g) || [];
      
      if (toolCalls.length !== toolEnds.length) {
        return { valid: false, error: 'Malformed tool registration' };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }
  
  /**
   * Save modified content to file
   */
  async saveModification(filepath: string, content: string): Promise<void> {
    await fs.writeFile(filepath, content, 'utf-8');
  }
  
  /**
   * Extract current tool definition for comparison
   */
  async extractToolDefinition(toolName: string): Promise<{
    description?: string;
    parameters?: Record<string, any>;
  } | null> {
    const toolFile = await this.findToolFile(toolName);
    if (!toolFile) {
      return null;
    }
    
    const content = await fs.readFile(toolFile, 'utf-8');
    
    // Extract description
    const descPattern = new RegExp(
      `server\\.tool\\(\\s*['"\`]${toolName}['"\`]\\s*,\\s*{[^}]*description:\\s*['"\`]([^'"\`]+)['"\`]`,
      's'
    );
    
    const descMatch = descPattern.exec(content);
    const description = descMatch ? descMatch[1] : undefined;
    
    // Extract parameters (simplified)
    const paramsPattern = new RegExp(
      `server\\.tool\\(\\s*['"\`]${toolName}['"\`][^{]*{[^}]*properties:\\s*{([^}]+(?:{[^}]*}[^}]*)*)}`,
      's'
    );
    
    const paramsMatch = paramsPattern.exec(content);
    const parameters = paramsMatch ? this.parseParameters(paramsMatch[1]) : undefined;
    
    return { description, parameters };
  }
  
  /**
   * Parse parameter definitions (simplified)
   */
  private parseParameters(paramString: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Simple regex to extract parameter names and descriptions
    const paramPattern = /(\w+):\s*{[^}]*description:\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = paramPattern.exec(paramString)) !== null) {
      params[match[1]] = {
        description: match[2]
      };
    }
    
    return params;
  }
}