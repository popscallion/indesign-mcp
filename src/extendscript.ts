/**
 * @fileoverview ExtendScript execution utilities for InDesign automation
 * Handles communication with Adobe InDesign via AppleScript and temporary JSX files
 */

import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { ExtendScriptResult } from "./types.js";

/**
 * List of InDesign application names to try in order of preference
 */
const INDESIGN_APP_NAMES = [
  "Adobe InDesign 2025",
  "Adobe InDesign 2024", 
  "Adobe InDesign 2023",
  "Adobe InDesign CC 2024",
  "Adobe InDesign CC 2023",
  "Adobe InDesign"
] as const;

/**
 * Default timeout for ExtendScript execution (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Executes ExtendScript code in Adobe InDesign via AppleScript
 * 
 * @param script - The ExtendScript code to execute
 * @param timeout - Execution timeout in milliseconds (default: 30000)
 * @returns Promise resolving to execution result
 */
export async function executeExtendScript(
  script: string, 
  timeout: number = DEFAULT_TIMEOUT
): Promise<ExtendScriptResult> {
  let scriptPath: string | null = null;
  
  try {
    // Create temporary script file
    scriptPath = join(tmpdir(), `indesign_script_${Date.now()}.jsx`);
    writeFileSync(scriptPath, script, "utf8");
    
    // Try each InDesign application name
    let lastError: string | undefined;
    
    for (const appName of INDESIGN_APP_NAMES) {
      try {
        const result = await executeAppleScript(appName, scriptPath, timeout);
        
        if (result.success) {
          return result;
        }
        
        // If we got a real ExtendScript error, return it immediately
        if (result.error?.startsWith("ExtendScript error")) {
          return result;
        }
        
        // Could be "application not running" → try next name
        lastError = result.error;
      } catch (error) {
        // Continue to next app name
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
    }
    
    return {
      success: false,
      error: lastError ?? "Could not find or connect to any InDesign application. Please ensure InDesign is running."
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Clean up temporary file
    if (scriptPath) {
      try {
        unlinkSync(scriptPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Executes AppleScript to run ExtendScript in specific InDesign app
 * 
 * @param appName - InDesign application name
 * @param scriptPath - Path to temporary JSX file
 * @param timeout - Execution timeout
 * @returns Promise resolving to execution result
 */
function executeAppleScript(
  appName: string, 
  scriptPath: string, 
  timeout: number
): Promise<ExtendScriptResult> {
  return new Promise((resolve, reject) => {
    const appleScript = `try\n  tell application "${appName}"\n    set _r to do script alias POSIX file "${scriptPath}" language javascript\n  end tell\n  return _r\non error errText number errNum\n  return "ERROR|" & errNum & "|" & errText\nend try`;
    
    const process = spawn("osascript", ["-e", appleScript], {
      timeout,
      stdio: ["pipe", "pipe", "pipe"]
    });
    
    let stdout = "";
    let stderr = "";
    
    process.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    
    process.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    
    process.on("close", (code) => {
      const combined = (stdout + stderr).trim();           // ❶ merge streams
      
      // Parse ExtendScript errors from AppleScript (more robust detection)
      const m = combined.match(/^ERROR\|(-?\d+)\|(.*)$/s); // �② detect real error
      if (m) {
        resolve({
          success: false,
          error: `ExtendScript error ${m[1]}: ${m[2]}`
        });
        return;                                            // ❸ stop here
      }
      
      if (code === 0) {
        resolve({ success: true, result: combined });
      } else {
        // Expose raw osascript error per O3's suggestion
        resolve({
          success: false,
          error: combined || `osascript exit ${code}`
        });
      }
    });
    
    process.on("error", (error) => {
      reject(error);
    });
    
    // Handle timeout
    setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error("ExtendScript execution timed out"));
    }, timeout);
  });
}

/**
 * Validates and escapes string content for use in ExtendScript
 * Prevents script injection and handles special characters
 * 
 * @param input - String to escape
 * @returns Escaped string safe for ExtendScript
 */
export function escapeExtendScriptString(input: string): string {
  return input
    .replace(/\\/g, "\\\\")    // Escape backslashes
    .replace(/"/g, '\\"')      // Escape double quotes
    .replace(/'/g, "\\'")      // Escape single quotes
    .replace(/\n/g, "\\n")     // Escape newlines
    .replace(/\r/g, "\\r")     // Escape carriage returns
    .replace(/\t/g, "\\t");    // Escape tabs
}

/**
 * Wraps ExtendScript code in a try-catch block for better error handling
 * 
 * @param script - ExtendScript code to wrap
 * @returns Wrapped script with error handling
 */
export function wrapExtendScriptWithErrorHandling(script: string): string {
  return `
try {
  ${script}
} catch (e) {
  "Error: " + e.message;
}`;
}