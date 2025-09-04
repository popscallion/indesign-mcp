/**
 * @fileoverview AST-based tool definition parser and modifier
 * Uses ts-morph for robust TypeScript code manipulation
 * 
 * IMPORTANT: This class only modifies content in memory. Callers must:
 * 1. Call applyImprovement() to get modified content
 * 2. Call saveModification() to write changes to disk
 */

import { Project, SourceFile, CallExpression, ObjectLiteralExpression, PropertyAssignment, SyntaxKind } from 'ts-morph';
import { Improvement } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * AST-based parser and modifier for MCP tool definitions
 */
export class ToolModifier {
  private project: Project;
  private toolsDir: string;
  
  constructor(toolsDir: string = 'src/tools') {
    this.toolsDir = toolsDir;
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json'
    });
  }
  
  /**
   * Apply an improvement to a tool definition
   * @returns Modified content in memory - caller must use saveModification() to persist
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
      
      // Load the file into the project
      const sourceFile = this.project.addSourceFileAtPath(toolFile);
      
      // Apply the improvement
      let modified: boolean;
      switch (improvement.type) {
        case 'description':
          modified = await this.modifyDescription(sourceFile, improvement);
          break;
          
        case 'parameter':
          modified = await this.modifyParameter(sourceFile, improvement);
          break;
          
        case 'example':
          modified = await this.addExample(sourceFile, improvement);
          break;
          
        case 'constraint':
          modified = await this.addConstraint(sourceFile, improvement);
          break;
          
        default:
          return {
            success: false,
            error: `Unknown improvement type: ${improvement.type}`
          };
      }
      
      if (!modified) {
        return {
          success: false,
          error: 'Could not apply modification'
        };
      }
      
      // Get the modified content
      const modifiedContent = sourceFile.getFullText();
      
      // Clean up the project
      this.project.removeSourceFile(sourceFile);
      
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
    const categories = ['text', 'styles', 'layout', 'pages', 'special', 'utility', 'export', 'transform', 'analysis'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.toolsDir, category, 'index.ts');
      
      try {
        const content = await fs.readFile(categoryPath, 'utf-8');
        
        // Quick check if this file likely contains the tool
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
   * Find tool registration call in source file
   */
  private findToolRegistration(sourceFile: SourceFile, toolName: string): CallExpression | null {
    const toolCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const expr = call.getExpression();
        return expr.getText() === 'server.tool';
      });
    
    for (const call of toolCalls) {
      const args = call.getArguments();
      if (args.length >= 2) {
        const nameArg = args[0];
        const nameText = nameArg.getText().replace(/['"]/g, '');
        if (nameText === toolName) {
          return call;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Modify tool description
   */
  private async modifyDescription(sourceFile: SourceFile, improvement: Improvement): Promise<boolean> {
    const toolCall = this.findToolRegistration(sourceFile, improvement.tool);
    if (!toolCall) {
      console.error(`Tool registration not found for: ${improvement.tool}`);
      return false;
    }
    
    const args = toolCall.getArguments();
    if (args.length < 2) {
      console.error('Invalid tool registration format');
      return false;
    }
    
    const schemaArg = args[1];
    
    // Handle Zod schema format
    if (schemaArg.getKind() === SyntaxKind.CallExpression) {
      // This is a Zod schema like z.object({...})
      const zodCall = schemaArg as CallExpression;
      const zodArgs = zodCall.getArguments();
      
      if (zodArgs.length > 0 && zodArgs[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objLiteral = zodArgs[0] as ObjectLiteralExpression;
        const descProp = objLiteral.getProperty('description');
        
        if (descProp && descProp.getKind() === SyntaxKind.PropertyAssignment) {
          const propAssignment = descProp as PropertyAssignment;
          const initializer = propAssignment.getInitializer();
          
          if (initializer) {
            // Replace the description
            initializer.replaceWithText(`"${improvement.proposed.replace(/"/g, '\\"')}"`);
            return true;
          }
        } else {
          // Add description property
          objLiteral.addPropertyAssignment({
            name: 'description',
            initializer: `"${improvement.proposed.replace(/"/g, '\\"')}"`
          });
          return true;
        }
      }
    }
    
    console.error('Could not find or modify description in Zod schema');
    return false;
  }
  
  /**
   * Modify parameter description
   */
  private async modifyParameter(sourceFile: SourceFile, improvement: Improvement): Promise<boolean> {
    if (!improvement.field) {
      console.error('Parameter name required for parameter improvements');
      return false;
    }
    
    const toolCall = this.findToolRegistration(sourceFile, improvement.tool);
    if (!toolCall) {
      console.error(`Tool registration not found for: ${improvement.tool}`);
      return false;
    }
    
    const args = toolCall.getArguments();
    if (args.length < 2) {
      console.error('Invalid tool registration format');
      return false;
    }
    
    const schemaArg = args[1];
    
    // Navigate through Zod schema to find the field
    if (schemaArg.getKind() === SyntaxKind.CallExpression) {
      const zodCall = schemaArg as CallExpression;
      
      // Look for z.object({ properties... })
      const objArg = this.findZodObjectArg(zodCall);
      if (!objArg) {
        console.error('Could not find Zod object definition');
        return false;
      }
      
      // Find the specific field property
      const fieldProp = objArg.getProperty(improvement.field);
      if (!fieldProp || fieldProp.getKind() !== SyntaxKind.PropertyAssignment) {
        console.error(`Field ${improvement.field} not found`);
        return false;
      }
      
      const propAssignment = fieldProp as PropertyAssignment;
      const fieldSchema = propAssignment.getInitializer();
      
      if (fieldSchema && fieldSchema.getKind() === SyntaxKind.CallExpression) {
        // This is a Zod field definition like z.string()
        const fieldCall = fieldSchema as CallExpression;
        
        // Look for .describe() method call
        const parent = fieldCall.getParent();
        if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression) {
          const grandParent = parent.getParent();
          if (grandParent && grandParent.getKind() === SyntaxKind.CallExpression) {
            const describeCall = grandParent as CallExpression;
            const methodAccess = describeCall.getExpression();
            
            if (methodAccess.getText().endsWith('.describe')) {
              // Replace existing describe argument
              const descArgs = describeCall.getArguments();
              if (descArgs.length > 0) {
                descArgs[0].replaceWithText(`"${improvement.proposed.replace(/"/g, '\\"')}"`);
                return true;
              }
            }
          }
        }
        
        // No describe() found, need to add one
        fieldCall.replaceWithText(`${fieldCall.getText()}.describe("${improvement.proposed.replace(/"/g, '\\"')}")`);
        return true;
      }
    }
    
    console.error('Could not modify parameter description');
    return false;
  }
  
  /**
   * Add an example to the tool
   */
  private async addExample(sourceFile: SourceFile, improvement: Improvement): Promise<boolean> {
    const toolCall = this.findToolRegistration(sourceFile, improvement.tool);
    if (!toolCall) {
      console.error(`Tool registration not found for: ${improvement.tool}`);
      return false;
    }
    
    // Find the handler function (3rd argument)
    const args = toolCall.getArguments();
    if (args.length < 3) {
      console.error('No handler function found');
      return false;
    }
    
    const handler = args[2];
    
    // Add comment before the handler
    const example = `// Example: ${improvement.proposed}`;
    
    // Get the line before the handler and insert comment
    const indentLevel = handler.getIndentationLevel();
    const indent = '  '.repeat(indentLevel);
    
    sourceFile.insertText(handler.getStart(), `${example}\n${indent}`);
    
    return true;
  }
  
  /**
   * Add a constraint to the tool
   */
  private async addConstraint(sourceFile: SourceFile, improvement: Improvement): Promise<boolean> {
    if (!improvement.field) {
      // Add as a comment in the tool description
      return this.modifyDescription(sourceFile, {
        ...improvement,
        proposed: `${improvement.current}. ${improvement.proposed}`
      });
    }
    
    // For field-specific constraints, we need to modify the Zod schema
    const toolCall = this.findToolRegistration(sourceFile, improvement.tool);
    if (!toolCall) {
      console.error(`Tool registration not found for: ${improvement.tool}`);
      return false;
    }
    
    const args = toolCall.getArguments();
    if (args.length < 2) return false;
    
    const schemaArg = args[1];
    
    if (schemaArg.getKind() === SyntaxKind.CallExpression) {
      const zodCall = schemaArg as CallExpression;
      const objArg = this.findZodObjectArg(zodCall);
      if (!objArg) return false;
      
      const fieldProp = objArg.getProperty(improvement.field);
      if (!fieldProp || fieldProp.getKind() !== SyntaxKind.PropertyAssignment) return false;
      
      const propAssignment = fieldProp as PropertyAssignment;
      const fieldSchema = propAssignment.getInitializer();
      
      if (fieldSchema && fieldSchema.getKind() === SyntaxKind.CallExpression) {
        const fieldCall = fieldSchema as CallExpression;
        const schemaType = fieldCall.getExpression().getText();
        
        // Apply constraint based on type
        if (schemaType.includes('number')) {
          // Add min/max constraints
          const constraintMatch = improvement.proposed.match(/(\d+)-(\d+)/);
          if (constraintMatch) {
            const [_, min, max] = constraintMatch;
            fieldCall.replaceWithText(
              `${fieldCall.getText()}.min(${min}).max(${max})`
            );
            return true;
          }
        } else if (schemaType.includes('string')) {
          // Add enum constraint if applicable
          const enumMatch = improvement.proposed.match(/one of: (.+)/i);
          if (enumMatch) {
            const values = enumMatch[1].split(',').map(v => `"${v.trim()}"`);
            // Replace with z.enum()
            fieldCall.replaceWithText(`z.enum([${values.join(', ')}])`);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Find z.object() argument in a Zod call chain
   */
  private findZodObjectArg(call: CallExpression): ObjectLiteralExpression | null {
    // Handle z.object({...})
    const expr = call.getExpression();
    if (expr.getText() === 'z.object') {
      const args = call.getArguments();
      if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
        return args[0] as ObjectLiteralExpression;
      }
    }
    
    // Handle chained calls like z.object({...}).passthrough()
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const baseExpr = propAccess.getExpression();
      
      if (baseExpr.getKind() === SyntaxKind.CallExpression) {
        return this.findZodObjectArg(baseExpr as CallExpression);
      }
    }
    
    return null;
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
    
    const sourceFile = this.project.addSourceFileAtPath(toolFile);
    const toolCall = this.findToolRegistration(sourceFile, toolName);
    
    if (!toolCall) {
      this.project.removeSourceFile(sourceFile);
      return null;
    }
    
    const args = toolCall.getArguments();
    if (args.length < 2) {
      this.project.removeSourceFile(sourceFile);
      return null;
    }
    
    const result: { description?: string; parameters?: Record<string, any> } = {};
    
    // Extract description from Zod schema
    const schemaArg = args[1];
    if (schemaArg.getKind() === SyntaxKind.CallExpression) {
      const zodCall = schemaArg as CallExpression;
      const zodArgs = zodCall.getArguments();
      
      if (zodArgs.length > 0 && zodArgs[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objLiteral = zodArgs[0] as ObjectLiteralExpression;
        const descProp = objLiteral.getProperty('description');
        
        if (descProp && descProp.getKind() === SyntaxKind.PropertyAssignment) {
          const propAssignment = descProp as PropertyAssignment;
          const initializer = propAssignment.getInitializer();
          
          if (initializer) {
            result.description = initializer.getText().replace(/['"]/g, '');
          }
        }
      }
      
      // Extract parameters
      const objArg = this.findZodObjectArg(zodCall);
      if (objArg) {
        result.parameters = {};
        
        for (const prop of objArg.getProperties()) {
          if (prop.getKind() === SyntaxKind.PropertyAssignment) {
            const propAssignment = prop as PropertyAssignment;
            const name = propAssignment.getName();
            
            // Try to extract description from .describe() calls
            const initializer = propAssignment.getInitializer();
            if (initializer && initializer.getKind() === SyntaxKind.CallExpression) {
              const text = initializer.getText();
              const descMatch = text.match(/\.describe\(["']([^"']+)["']\)/);
              
              if (descMatch) {
                result.parameters[name] = {
                  description: descMatch[1]
                };
              }
            }
          }
        }
      }
    }
    
    this.project.removeSourceFile(sourceFile);
    return result;
  }
}