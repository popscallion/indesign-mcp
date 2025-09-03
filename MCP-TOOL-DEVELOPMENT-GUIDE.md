# InDesign MCP Tool Development Guide

A comprehensive guide for developing Model Context Protocol (MCP) tools for Adobe InDesign automation, based on real-world implementation experience.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Core Development Patterns](#core-development-patterns)
- [ExtendScript Best Practices](#extendscript-best-practices)
- [Common Pitfalls & Solutions](#common-pitfalls--solutions)
- [Tool Implementation Workflow](#tool-implementation-workflow)
- [Testing & Debugging](#testing--debugging)
- [Type Safety Requirements](#type-safety-requirements)
- [Performance Considerations](#performance-considerations)

## Architecture Overview

### MCP → InDesign Flow
```
MCP Tool Call → TypeScript Handler → ExtendScript Generation → AppleScript Bridge → InDesign Execution → JSON Response
```

### Key Components
- **MCP Server** (`src/index.ts`): Tool registration and JSON-RPC handling
- **Tool Categories** (`src/tools/*/index.ts`): Organized functionality groups
- **ExtendScript Bridge** (`src/extendscript.ts`): AppleScript execution layer
- **Type System** (`src/types.ts`): Parameter validation and type safety
- **Telemetry Wrapper**: Automatic change tracking for all tools

## Core Development Patterns

### 1. Tool Registration Pattern
```typescript
export async function registerYourTools(server: Server) {
  server.tool("tool_name", "Tool description", {
    type: "object",
    properties: {
      parameter: { type: "string", description: "Parameter description" }
    },
    required: ["parameter"]
  }, async (args) => {
    const { parameter } = args as { parameter: string };
    
    const result = await executeExtendScript(`
      // ExtendScript code here
      var result = "success";
      result; // Return value
    `);
    
    return {
      content: [{
        type: "text" as const,
        text: result.success ? "Success message" : result.error || "Error occurred"
      }]
    };
  });
}
```

### 2. ExtendScript Template Pattern
```typescript
const extendScript = `
  try {
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var result = {
      success: true,
      data: "your_data_here"
    };
    
    // Manual JSON building (avoid JSON.stringify)
    var resultStr = "{\\"success\\":true,\\"data\\":\\"" + result.data + "\\"}";
    resultStr;
    
  } catch (e) {
    var errorStr = "{\\"success\\":false,\\"error\\":\\"" + e.message.replace(/"/g, '\\\\\\"') + "\\"}";
    errorStr;
  }
`;
```

### 3. Progress Logger Pattern
```typescript
// Always provide fallback for progressLogger
const logger = progressLogger || { 
  log: async (message: string, progress?: { current: number; total: number }) => {
    // No-op fallback logger
  } 
};

await logger.log("Starting operation...", { current: 1, total: 5 });
```

## ExtendScript Best Practices

### ⚠️ Critical Rules

#### 1. String Building (NEVER use +=)
```javascript
// ❌ WRONG - Causes memory issues
var result = "";
for (var i = 0; i < items.length; i++) {
  result += items[i] + ",";
}

// ✅ CORRECT - Use array.join()
var parts = [];
for (var i = 0; i < items.length; i++) {
  parts.push(items[i]);
}
var result = parts.join(",");
```

#### 2. Boolean Conversion
```javascript
// ❌ WRONG - ExtendScript doesn't handle TypeScript booleans
var isVisible = true;

// ✅ CORRECT - Use string representations
var isVisible = "true";
if (isVisible === "true") {
  // handle true case
}
```

#### 3. JSON Handling
```javascript
// ❌ WRONG - JSON.stringify not available in ExtendScript
var json = JSON.stringify({key: value});

// ✅ CORRECT - Manual string building
var json = "{\\"key\\":\\"" + value.replace(/"/g, '\\\\\\"') + "\\"}";
```

#### 4. Newline Escaping
```javascript
// ✅ CORRECT - Double-escaped newlines in template literals
var text = "Line 1\\\\nLine 2";
```

### Selection State Management
```javascript
// Smart selection fallback pattern
function getWorkingTextFrame() {
  try {
    // Try current selection first
    if (app.selection.length > 0 && app.selection[0].hasOwnProperty('contents')) {
      return app.selection[0];
    }
    
    // Fallback to first text frame on page
    if (app.activeDocument.pages.length > 0) {
      var page = app.activeDocument.pages[0];
      for (var i = 0; i < page.textFrames.length; i++) {
        return page.textFrames[i];
      }
    }
    
    throw new Error("No text frame available");
  } catch (e) {
    throw new Error("Selection error: " + e.message);
  }
}
```

### Object Style Management
```javascript
// Object style property checking pattern
function getObjectStyleProperties(objectStyle) {
  var properties = [];
  
  try {
    if (objectStyle.fillColor && objectStyle.fillColor.name !== "[None]") {
      properties.push("Fill: " + objectStyle.fillColor.name);
    }
    
    if (objectStyle.strokeColor && objectStyle.strokeColor.name !== "[None]") {
      properties.push("Stroke: " + objectStyle.strokeColor.name);
    }
    
    if (objectStyle.strokeWeight !== undefined && objectStyle.strokeWeight > 0) {
      properties.push("Weight: " + objectStyle.strokeWeight + "pt");
    }
  } catch (e) {
    // Skip property if not accessible
  }
  
  return properties;
}

// Safe object style application
function applyObjectStyleSafely(item, objectStyle) {
  try {
    if (item.hasOwnProperty('appliedObjectStyle')) {
      item.appliedObjectStyle = objectStyle;
      return true;
    }
  } catch (e) {
    // Object doesn't support styling
  }
  return false;
}

// Bulk object processing with layer filtering
function processObjectsByLayer(doc, targetLayer, callback) {
  var processed = 0;
  for (var p = 0; p < doc.pages.length; p++) {
    var page = doc.pages[p];
    var allItems = page.allPageItems;
    
    for (var i = 0; i < allItems.length; i++) {
      try {
        var item = allItems[i];
        if (item.itemLayer === targetLayer) {
          if (callback(item)) {
            processed++;
          }
        }
      } catch (e) {
        // Skip items that can't be processed
      }
    }
  }
  return processed;
}
```

## Common Pitfalls & Solutions

### 1. JSON is undefined Error
**Problem**: ExtendScript doesn't have native JSON support
```javascript
// ❌ WRONG
var result = JSON.stringify(data);

// ✅ SOLUTION
var resultParts = [];
resultParts.push('{"created":[');
for (var i = 0; i < created.length; i++) {
  if (i > 0) resultParts.push(',');
  resultParts.push('"' + created[i] + '"');
}
resultParts.push(']}');
var result = resultParts.join('');
```

### 2. progressLogger.log is not a function
**Problem**: progressLogger parameter can be undefined
```typescript
// ✅ SOLUTION - Always provide fallback
const logger = progressLogger || { 
  log: async (message: string, progress?: { current: number; total: number }) => {
    // No-op fallback
  } 
};
```

### 3. Type 'string' not assignable Error
**Problem**: MCP SDK requires strict type annotations
```typescript
// ❌ WRONG
return {
  content: [{
    type: "text",
    text: result
  }]
};

// ✅ SOLUTION
return {
  content: [{
    type: "text" as const,
    text: result
  }]
};
```

### 4. Selection State Issues
**Problem**: InDesign selection can be empty or invalid
```javascript
// ✅ SOLUTION - Multi-level fallback
function findTargetText(targetText, storyIndex) {
  var doc = app.activeDocument;
  
  // Try selection first
  if (app.selection.length > 0 && app.selection[0].hasOwnProperty('contents')) {
    var frame = app.selection[0];
    if (frame.contents.search(targetText) !== -1) {
      return frame.texts.itemByRange(0, -1);
    }
  }
  
  // Try specific story
  if (storyIndex >= 0 && storyIndex < doc.stories.length) {
    var story = doc.stories[storyIndex];
    if (story.contents.search(targetText) !== -1) {
      return story.texts.itemByRange(0, -1);
    }
  }
  
  // Search all stories
  for (var i = 0; i < doc.stories.length; i++) {
    if (doc.stories[i].contents.search(targetText) !== -1) {
      return doc.stories[i].texts.itemByRange(0, -1);
    }
  }
  
  throw new Error("Text not found: " + targetText);
}
```

### 5. Frame Iteration Problems
**Problem**: Only processing single frames instead of all
```javascript
// ✅ SOLUTION - Handle multiple frames
var frames = [];
if (copyAllFrames) {
  // Copy all frames from source page
  for (var i = 0; i < sourcePage.textFrames.length; i++) {
    frames.push(sourcePage.textFrames[i]);
  }
} else {
  // Copy specific frame
  if (sourceFrameIndex < sourcePage.textFrames.length) {
    frames.push(sourcePage.textFrames[sourceFrameIndex]);
  }
}
```

## Tool Implementation Workflow

### Phase 1: Planning
1. **Define Tool Purpose**: Single, clear responsibility
2. **Design Parameters**: Use Zod schema for validation
3. **Map InDesign APIs**: Reference `docs/InDesign ExtendScript_API_*`
4. **Consider Edge Cases**: Empty documents, missing objects, etc.

### Phase 2: Implementation
1. **Create Tool Handler**: Follow registration pattern
2. **Write ExtendScript**: Use template pattern with error handling
3. **Add Type Safety**: Proper TypeScript annotations
4. **Test Basic Function**: Empty document, simple case

### Phase 3: Robustness
1. **Add Fallback Logic**: Handle missing selections, objects
2. **Implement Progress Logging**: For long operations
3. **Error Message Clarity**: User-friendly error descriptions
4. **Edge Case Testing**: Complex documents, error conditions

### Phase 4: Integration
1. **Register Tool**: Add to appropriate category
2. **Update Types**: Export new parameter interfaces
3. **Test Cross-Tool**: Verify no regressions
4. **Documentation**: Add to tool descriptions

## Testing & Debugging

### Test Document Setup
Keep these ready:
- **Empty Document**: `File → New → Document`
- **Simple Content**: 1-2 pages, basic text/formatting
- **Complex Document**: Multi-page, threading, styles, images

### Debugging Workflow
```bash
# 1. Compile and check for TypeScript errors
npm run build

# 2. Start server and test tool
npm start

# 3. Check InDesign for actual results
# 4. Review ExtendScript errors in InDesign console (Window → Utilities → JavaScript Console)

# 5. Add debug logging to ExtendScript
var debugInfo = "Step 1 completed, frames found: " + frames.length;
// Return debug info in error case for troubleshooting
```

### Common Debug Patterns
```javascript
// Add debug checkpoints
var debugSteps = [];
debugSteps.push("Started operation");

try {
  var doc = app.activeDocument;
  debugSteps.push("Got document: " + doc.name);
  
  var frames = doc.textFrames;
  debugSteps.push("Found frames: " + frames.length);
  
  // ... operation logic
  
} catch (e) {
  var debugStr = "Debug steps: " + debugSteps.join(" | ") + " | Error: " + e.message;
  debugStr; // Return for troubleshooting
}
```

## Type Safety Requirements

### Parameter Interfaces
```typescript
// src/types.ts
export interface YourToolParams {
  requiredParam: string;
  optionalParam?: number;
  enumParam: 'option1' | 'option2' | 'option3';
}

// Tool handler
const { requiredParam, optionalParam = 0, enumParam } = args as YourToolParams;
```

### Zod Schema Validation
```typescript
server.tool("your_tool", "Description", {
  type: "object",
  properties: {
    requiredParam: { 
      type: "string", 
      description: "Clear parameter description" 
    },
    optionalParam: { 
      type: "number", 
      description: "Optional with default behavior",
      default: 0 
    },
    enumParam: {
      type: "string",
      enum: ["option1", "option2", "option3"],
      description: "Must be one of the enum values"
    }
  },
  required: ["requiredParam", "enumParam"]
}, handler);
```

### Return Type Consistency
```typescript
// Always use 'as const' for type literals
return {
  content: [{
    type: "text" as const,
    text: successMessage
  }]
};
```

## Performance Considerations

### 1. Batch Operations
```javascript
// ✅ GOOD - Process multiple items in single ExtendScript call
function processMultipleFrames(frameData) {
  var results = [];
  for (var i = 0; i < frameData.length; i++) {
    // Process each frame
    results.push(processFrame(frameData[i]));
  }
  return results;
}

// ❌ AVOID - Multiple separate ExtendScript calls
// (requires multiple MCP tool calls)
```

### 2. Memory Management
```javascript
// ✅ Use arrays for string building
var parts = [];
for (var i = 0; i < items.length; i++) {
  parts.push(processItem(items[i]));
}
var result = parts.join("");

// ✅ Clean up references
parts = null;
items = null;
```

### 3. Error Isolation
```javascript
// ✅ Isolate risky operations
function safeOperation(data) {
  try {
    return riskyOperation(data);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Process array with error isolation
var results = [];
for (var i = 0; i < items.length; i++) {
  results.push(safeOperation(items[i]));
}
```

## Advanced Patterns

### 1. Change Tracking Integration
All tools are automatically wrapped with telemetry. No additional code needed - the wrapper handles:
- Pre/post execution state capture
- Parameter logging
- Performance metrics
- Error tracking

### 2. Smart Parameter Defaults
```typescript
// Handle undefined/null gracefully
const pageNumber = args.pageNumber || 1;
const frameIndex = args.frameIndex ?? -1; // Use -1 as "all frames" indicator
const createIfMissing = args.createIfMissing !== false; // Default true
```

### 3. Cross-Tool Communication
```typescript
// Return structured data for other tools to consume
return {
  content: [{
    type: "text" as const,
    text: `Operation completed successfully`
  }],
  // Hidden structured data for other tools
  _internalData: {
    framesCreated: frameIds,
    stylesApplied: styleNames
  }
};
```

### Object Style Management Patterns

```javascript
// Safe object style property inspection
function getObjectStyleProperties(objectStyle) {
  var properties = [];
  
  try {
    // Check fill properties
    if (objectStyle.fillColor && objectStyle.fillColor.name !== "[None]") {
      properties.push("Fill: " + objectStyle.fillColor.name);
    }
    
    // Check stroke properties  
    if (objectStyle.strokeColor && objectStyle.strokeColor.name !== "[None]") {
      properties.push("Stroke: " + objectStyle.strokeColor.name);
    }
    
    if (objectStyle.strokeWeight !== undefined && objectStyle.strokeWeight > 0) {
      properties.push("Weight: " + objectStyle.strokeWeight + "pt");
    }
    
    // Check transparency
    if (objectStyle.transparencySettings && objectStyle.transparencySettings.blendingSettings) {
      var opacity = objectStyle.transparencySettings.blendingSettings.opacity;
      if (opacity !== undefined && opacity < 100) {
        properties.push("Opacity: " + opacity + "%");
      }
    }
    
    // Check effects
    if (objectStyle.transparencySettings && objectStyle.transparencySettings.dropShadowSettings) {
      var shadow = objectStyle.transparencySettings.dropShadowSettings;
      if (shadow.mode !== ShadowMode.NONE) {
        properties.push("Drop Shadow: " + shadow.mode);
      }
    }
    
  } catch (e) {
    properties.push("Error reading properties: " + e.message);
  }
  
  return properties;
}

// Safe object style application with type checking
function applyObjectStyleSafely(item, objectStyleName, doc) {
  try {
    // Verify item can accept object styles
    if (!item.hasOwnProperty('appliedObjectStyle')) {
      return {
        success: false,
        error: "Item does not support object styles"
      };
    }
    
    // Find the object style
    var targetStyle = null;
    for (var i = 0; i < doc.objectStyles.length; i++) {
      if (doc.objectStyles[i].name === objectStyleName) {
        targetStyle = doc.objectStyles[i];
        break;
      }
    }
    
    if (!targetStyle) {
      return {
        success: false,
        error: "Object style '" + objectStyleName + "' not found"
      };
    }
    
    // Store original style for rollback
    var originalStyle = item.appliedObjectStyle;
    
    try {
      item.appliedObjectStyle = targetStyle;
      
      return {
        success: true,
        styleName: targetStyle.name,
        originalStyle: originalStyle.name
      };
      
    } catch (applyError) {
      return {
        success: false,
        error: "Failed to apply style: " + applyError.message
      };
    }
    
  } catch (e) {
    return {
      success: false,
      error: "Object style application error: " + e.message
    };
  }
}

// Object style property updates with validation
function updateObjectStyleProperties(objectStyle, updates) {
  var changes = [];
  var errors = [];
  
  try {
    // Update fill color
    if (updates.fillColor !== undefined) {
      try {
        if (updates.fillColor === "[None]") {
          objectStyle.fillColor = objectStyle.parent.swatches.itemByName("[None]");
        } else {
          objectStyle.fillColor = objectStyle.parent.swatches.itemByName(updates.fillColor);
        }
        changes.push("Fill color: " + updates.fillColor);
      } catch (fillError) {
        errors.push("Fill color update failed: " + fillError.message);
      }
    }
    
    // Update stroke properties
    if (updates.strokeColor !== undefined) {
      try {
        if (updates.strokeColor === "[None]") {
          objectStyle.strokeColor = objectStyle.parent.swatches.itemByName("[None]");
        } else {
          objectStyle.strokeColor = objectStyle.parent.swatches.itemByName(updates.strokeColor);
        }
        changes.push("Stroke color: " + updates.strokeColor);
      } catch (strokeError) {
        errors.push("Stroke color update failed: " + strokeError.message);
      }
    }
    
    if (updates.strokeWeight !== undefined) {
      try {
        objectStyle.strokeWeight = updates.strokeWeight;
        changes.push("Stroke weight: " + updates.strokeWeight + "pt");
      } catch (weightError) {
        errors.push("Stroke weight update failed: " + weightError.message);
      }
    }
    
    // Update transparency
    if (updates.opacity !== undefined) {
      try {
        if (!objectStyle.transparencySettings) {
          objectStyle.transparencySettings = objectStyle.parent.transparencyPreferences;
        }
        objectStyle.transparencySettings.blendingSettings.opacity = updates.opacity;
        changes.push("Opacity: " + updates.opacity + "%");
      } catch (opacityError) {
        errors.push("Opacity update failed: " + opacityError.message);
      }
    }
    
    return {
      success: errors.length === 0,
      changes: changes,
      errors: errors,
      totalChanges: changes.length
    };
    
  } catch (e) {
    return {
      success: false,
      changes: changes,
      errors: ["Update failed: " + e.message],
      totalChanges: changes.length
    };
  }
}

// Bulk object style processing with error isolation
function processObjectsWithStyle(doc, styleMapping, pageRange) {
  var results = [];
  var processed = 0;
  var errors = 0;
  
  try {
    // Parse page range
    var pages = parsePageRange(pageRange, doc.pages.length);
    
    for (var p = 0; p < pages.length; p++) {
      var page = doc.pages[pages[p]];
      var allItems = page.allPageItems;
      
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        
        try {
          // Check if item matches criteria
          if (matchesObjectStyleCriteria(item, styleMapping.criteria)) {
            var applyResult = applyObjectStyleSafely(item, styleMapping.targetStyle, doc);
            
            if (applyResult.success) {
              processed++;
            } else {
              errors++;
              results.push("Error on page " + (pages[p] + 1) + ": " + applyResult.error);
            }
          }
        } catch (itemError) {
          errors++;
          results.push("Item processing error on page " + (pages[p] + 1) + ": " + itemError.message);
        }
      }
    }
    
    return {
      success: true,
      processed: processed,
      errors: errors,
      details: results
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message,
      processed: processed,
      errors: errors
    };
  }
}

// Object style criteria matching
function matchesObjectStyleCriteria(item, criteria) {
  try {
    // Type filtering
    if (criteria.objectType) {
      var itemType = getItemType(item);
      if (itemType !== criteria.objectType) {
        return false;
      }
    }
    
    // Current style filtering
    if (criteria.currentStyle) {
      if (!item.appliedObjectStyle || item.appliedObjectStyle.name !== criteria.currentStyle) {
        return false;
      }
    }
    
    // Layer filtering
    if (criteria.layerName) {
      if (!item.itemLayer || item.itemLayer.name !== criteria.layerName) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    return false;
  }
}
```

### Asset Management Patterns

```javascript
// Safe link status checking
function getLinkStatus(link) {
  try {
    // Check if link has status property
    if (link.hasOwnProperty('status')) {
      var status = link.status;
      // Convert status enum to string
      if (status == LinkStatus.LINK_MISSING) return "Missing";
      if (status == LinkStatus.LINK_OUT_OF_DATE) return "Out of Date";
      if (status == LinkStatus.NORMAL) return "OK";
    }
    return "Unknown";
  } catch (e) {
    return "Error: " + e.message;
  }
}

// Batch link processing with error isolation
function processLinks(doc, operation) {
  var results = [];
  var processed = 0;
  var errors = 0;
  
  for (var i = 0; i < doc.links.length; i++) {
    try {
      var link = doc.links[i];
      var result = operation(link);
      if (result.success) {
        processed++;
      } else {
        errors++;
      }
      results.push(result);
    } catch (e) {
      errors++;
      results.push({
        success: false,
        name: "Unknown",
        error: e.message
      });
    }
  }
  
  return {
    processed: processed,
    errors: errors,
    results: results
  };
}

// Safe link relinking with path validation
function relinkAsset(link, newPath) {
  try {
    // Validate the link object
    if (!link || !link.hasOwnProperty('filePath')) {
      return { success: false, error: "Invalid link object" };
    }
    
    var oldPath = link.filePath;
    
    // Check if file exists (basic validation)
    var file = new File(newPath);
    if (!file.exists) {
      return { 
        success: false, 
        name: oldPath,
        error: "Target file does not exist: " + newPath 
      };
    }
    
    // Attempt to relink
    link.relink(file);
    
    return {
      success: true,
      name: oldPath,
      newPath: newPath,
      status: getLinkStatus(link)
    };
    
  } catch (e) {
    return {
      success: false,
      name: link ? link.filePath : "Unknown",
      error: "Relink failed: " + e.message
    };
  }
}

// Cross-page object copying with comprehensive filtering
function copyObjectsAcrossPages(sourcePageItems, targetPage, filters) {
  var copied = [];
  var skipped = 0;
  
  for (var i = 0; i < sourcePageItems.length; i++) {
    try {
      var item = sourcePageItems[i];
      
      // Apply filters
      if (!passesFilters(item, filters)) {
        skipped++;
        continue;
      }
      
      // Duplicate to target page
      var duplicate = item.duplicate(targetPage);
      copied.push({
        type: getItemType(item),
        bounds: getBounds(duplicate)
      });
      
    } catch (e) {
      // Skip items that can't be processed
      skipped++;
    }
  }
  
  return {
    copied: copied.length,
    skipped: skipped,
    details: copied
  };
}

// Smart object filtering system
function passesFilters(item, filters) {
  try {
    // Type filtering
    if (filters.objectType && filters.objectType !== "all") {
      if (getItemType(item) !== filters.objectType) {
        return false;
      }
    }
    
    // Layer filtering
    if (filters.layerName && filters.layerName !== "") {
      if (!item.itemLayer || item.itemLayer.name !== filters.layerName) {
        return false;
      }
    }
    
    // Position filtering (within bounding box)
    if (filters.withinBounds) {
      var bounds = getBounds(item);
      if (!isWithinBounds(bounds, filters.withinBounds)) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    // If filtering fails, exclude the item
    return false;
  }
}

// Robust item type detection
function getItemType(item) {
  try {
    if (item.hasOwnProperty('contents')) return "TextFrame";
    if (item.hasOwnProperty('images') && item.images.length > 0) return "ImageFrame";
    if (item.hasOwnProperty('contents') && item.contents === "") return "Rectangle";
    if (item.constructor.name) return item.constructor.name;
    return "Unknown";
  } catch (e) {
    return "Unknown";
  }
}
```

### Master Page Management Patterns

```javascript
// Safe master page creation with error handling
function createMasterPage(doc, masterName, baseMaster, pageOptions) {
  try {
    // Check for name conflicts
    for (var i = 0; i < doc.masterSpreads.length; i++) {
      if (doc.masterSpreads[i].namePrefix === masterName) {
        throw new Error("Master page name '" + masterName + "' already exists");
      }
    }
    
    var newMaster;
    
    if (baseMaster && baseMaster !== "") {
      // Find base master
      var foundBase = null;
      for (var j = 0; j < doc.masterSpreads.length; j++) {
        if (doc.masterSpreads[j].namePrefix === baseMaster) {
          foundBase = doc.masterSpreads[j];
          break;
        }
      }
      
      if (foundBase) {
        // Create based on existing master
        newMaster = doc.masterSpreads.add(1, foundBase);
      } else {
        throw new Error("Base master '" + baseMaster + "' not found");
      }
    } else {
      // Create from scratch
      newMaster = doc.masterSpreads.add();
    }
    
    // Set the name
    newMaster.namePrefix = masterName;
    
    return {
      success: true,
      master: newMaster,
      pages: newMaster.pages.length
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Page range parser for master application
function parsePageRange(rangeStr, maxPages) {
  var pages = [];
  
  if (rangeStr === "all") {
    for (var i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  var ranges = rangeStr.split(",");
  for (var r = 0; r < ranges.length; r++) {
    var range = ranges[r].replace(/\s/g, "");
    
    if (range.indexOf("-") !== -1) {
      // Handle ranges like "1-5"
      var parts = range.split("-");
      var start = parseInt(parts[0]);
      var end = parseInt(parts[1]);
      
      if (!isNaN(start) && !isNaN(end)) {
        for (var p = start; p <= end && p <= maxPages; p++) {
          if (p > 0) {
            pages.push(p);
          }
        }
      }
    } else {
      // Handle single pages like "3"
      var pageNum = parseInt(range);
      if (!isNaN(pageNum) && pageNum > 0 && pageNum <= maxPages) {
        pages.push(pageNum);
      }
    }
  }
  
  return pages;
}

// Safe master page application with conflict handling
function applyMasterToPages(doc, masterName, pageRange, overrideExisting) {
  var results = [];
  var applied = 0;
  var skipped = 0;
  
  try {
    // Find target master
    var targetMaster = null;
    for (var i = 0; i < doc.masterSpreads.length; i++) {
      if (doc.masterSpreads[i].namePrefix === masterName) {
        targetMaster = doc.masterSpreads[i];
        break;
      }
    }
    
    if (!targetMaster) {
      return {
        success: false,
        error: "Master page '" + masterName + "' not found"
      };
    }
    
    var pagesToProcess = parsePageRange(pageRange, doc.pages.length);
    
    for (var j = 0; j < pagesToProcess.length; j++) {
      var pageNum = pagesToProcess[j];
      var page = doc.pages[pageNum - 1];
      
      try {
        // Check for existing master
        if (!overrideExisting && page.appliedMaster !== doc.masterSpreads[0]) {
          results.push("Page " + pageNum + ": skipped (has master '" + page.appliedMaster.namePrefix + "')");
          skipped++;
          continue;
        }
        
        page.appliedMaster = targetMaster;
        results.push("Page " + pageNum + ": applied master '" + masterName + "'");
        applied++;
        
      } catch (pageError) {
        results.push("Page " + pageNum + ": failed (" + pageError.message + ")");
      }
    }
    
    return {
      success: true,
      applied: applied,
      skipped: skipped,
      details: results
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Master page element manipulation with type safety
function addElementToMaster(masterPage, elementType, bounds, properties) {
  try {
    var element = null;
    
    switch (elementType) {
      case "text":
        element = masterPage.textFrames.add();
        element.geometricBounds = bounds;
        
        if (properties.content) {
          element.contents = properties.content;
        }
        
        // Apply paragraph style if specified
        if (properties.styleName) {
          var doc = masterPage.parent.parent; // Get document
          for (var i = 0; i < doc.paragraphStyles.length; i++) {
            if (doc.paragraphStyles[i].name === properties.styleName) {
              if (element.paragraphs.length > 0) {
                element.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles[i];
              }
              break;
            }
          }
        }
        break;
        
      case "rectangle":
        element = masterPage.rectangles.add();
        element.geometricBounds = bounds;
        
        // Apply fill/stroke properties
        if (properties.fillColor) {
          var doc = masterPage.parent.parent;
          element.fillColor = doc.swatches.itemByName(properties.fillColor);
        }
        if (properties.strokeColor) {
          var doc = masterPage.parent.parent;
          element.strokeColor = doc.swatches.itemByName(properties.strokeColor);
        }
        break;
        
      case "image_placeholder":
        element = masterPage.rectangles.add();
        element.geometricBounds = bounds;
        
        // Style as image placeholder
        var doc = masterPage.parent.parent;
        element.fillColor = doc.swatches.itemByName("[None]");
        element.strokeColor = doc.swatches.itemByName("[Black]");
        element.strokeWeight = 1;
        break;
        
      default:
        throw new Error("Unsupported element type: " + elementType);
    }
    
    return {
      success: true,
      element: element,
      type: elementType
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Safe element removal with bounds checking
function removeElementFromMaster(masterPage, elementIndex) {
  try {
    var allItems = masterPage.allPageItems;
    
    if (elementIndex < 0 || elementIndex >= allItems.length) {
      return {
        success: false,
        error: "Element index " + elementIndex + " out of range (0-" + (allItems.length - 1) + ")"
      };
    }
    
    var element = allItems[elementIndex];
    var elementType = "unknown";
    
    // Determine element type for feedback
    if (element.hasOwnProperty('contents')) {
      elementType = "text frame";
    } else if (element.constructor && element.constructor.name) {
      elementType = element.constructor.name.toLowerCase();
    }
    
    element.remove();
    
    return {
      success: true,
      removedType: elementType,
      index: elementIndex
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}
```

### Bulk Operations Patterns

```javascript
// Page range parsing for bulk operations
function parsePageRange(rangeStr, maxPages) {
  var pages = [];
  
  if (rangeStr === "all") {
    for (var i = 0; i < maxPages; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  var ranges = rangeStr.split(",");
  for (var r = 0; r < ranges.length; r++) {
    var range = ranges[r].replace(/\s/g, "");
    
    if (range.indexOf("-") !== -1) {
      var parts = range.split("-");
      var start = parseInt(parts[0]) - 1;
      var end = parseInt(parts[1]) - 1;
      
      if (!isNaN(start) && !isNaN(end)) {
        for (var p = start; p <= end && p < maxPages; p++) {
          if (p >= 0) {
            pages.push(p);
          }
        }
      }
    } else {
      var pageNum = parseInt(range) - 1;
      if (!isNaN(pageNum) && pageNum >= 0 && pageNum < maxPages) {
        pages.push(pageNum);
      }
    }
  }
  
  return pages;
}

// Multi-criteria object matching system
function matchesComplexCriteria(item, criteria) {
  try {
    // Object type filtering
    if (criteria.object_type && criteria.object_type !== "all") {
      var itemType = getItemType(item);
      
      // Map criteria types to actual InDesign types
      var typeMap = {
        "text_frames": "TextFrame",
        "rectangles": "Rectangle", 
        "images": "ImageFrame",
        "groups": "Group",
        "lines": "GraphicLine"
      };
      
      if (typeMap[criteria.object_type] !== itemType) {
        return false;
      }
    }
    
    // Layer filtering
    if (criteria.layer_name && criteria.layer_name !== "") {
      if (!item.itemLayer || item.itemLayer.name !== criteria.layer_name) {
        return false;
      }
    }
    
    // Content existence filtering
    if (criteria.has_content !== undefined) {
      var hasContent = false;
      if (item.hasOwnProperty('contents')) {
        hasContent = item.contents !== "";
      }
      if (criteria.has_content !== hasContent) {
        return false;
      }
    }
    
    // Style filtering
    if (criteria.style_name) {
      if (item.hasOwnProperty('appliedParagraphStyle')) {
        if (!item.appliedParagraphStyle || 
            item.appliedParagraphStyle.name !== criteria.style_name) {
          return false;
        }
      }
    }
    
    if (criteria.object_style_name) {
      if (item.hasOwnProperty('appliedObjectStyle')) {
        if (!item.appliedObjectStyle || 
            item.appliedObjectStyle.name !== criteria.object_style_name) {
          return false;
        }
      }
    }
    
    // Size constraints
    if (criteria.size_range) {
      var bounds = item.geometricBounds;
      var width = bounds[3] - bounds[1];
      var height = bounds[2] - bounds[0];
      
      if (criteria.size_range.min_width && width < criteria.size_range.min_width) return false;
      if (criteria.size_range.max_width && width > criteria.size_range.max_width) return false;
      if (criteria.size_range.min_height && height < criteria.size_range.min_height) return false;
      if (criteria.size_range.max_height && height > criteria.size_range.max_height) return false;
    }
    
    // Position constraints
    if (criteria.position_range) {
      var bounds = item.geometricBounds;
      var x = bounds[1]; // Left edge
      var y = bounds[0]; // Top edge
      
      if (criteria.position_range.min_x && x < criteria.position_range.min_x) return false;
      if (criteria.position_range.max_x && x > criteria.position_range.max_x) return false;
      if (criteria.position_range.min_y && y < criteria.position_range.min_y) return false;
      if (criteria.position_range.max_y && y > criteria.position_range.max_y) return false;
    }
    
    return true;
  } catch (e) {
    // If evaluation fails, exclude the item
    return false;
  }
}

// Bulk operation dispatcher with error isolation
function applyBulkOperation(item, operation, data, doc) {
  try {
    switch (operation) {
      case "apply_style":
        if (data.style_to_apply && item.hasOwnProperty('contents')) {
          return applyParagraphStyle(item, data.style_to_apply, doc);
        }
        break;
        
      case "apply_object_style":
        if (data.object_style_to_apply && item.hasOwnProperty('appliedObjectStyle')) {
          return applyObjectStyle(item, data.object_style_to_apply, doc);
        }
        break;
        
      case "resize_objects":
        if (data.resize_factor) {
          return resizeObject(item, data.resize_factor);
        }
        break;
        
      case "reposition_objects":
        if (data.position_offset) {
          return repositionObject(item, data.position_offset);
        }
        break;
        
      case "change_layer":
        if (data.target_layer) {
          return changeObjectLayer(item, data.target_layer, doc);
        }
        break;
        
      default:
        return { success: false, error: "Unknown operation: " + operation };
    }
    
    return { success: false, error: "Invalid operation parameters" };
    
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Specialized operation functions
function applyParagraphStyle(item, styleName, doc) {
  for (var i = 0; i < doc.paragraphStyles.length; i++) {
    if (doc.paragraphStyles[i].name === styleName) {
      if (item.paragraphs && item.paragraphs.length > 0) {
        item.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles[i];
        return { success: true };
      }
    }
  }
  return { success: false, error: "Style not found: " + styleName };
}

function applyObjectStyle(item, styleName, doc) {
  for (var i = 0; i < doc.objectStyles.length; i++) {
    if (doc.objectStyles[i].name === styleName) {
      item.appliedObjectStyle = doc.objectStyles[i];
      return { success: true };
    }
  }
  return { success: false, error: "Object style not found: " + styleName };
}

function resizeObject(item, factor) {
  var bounds = item.geometricBounds;
  var centerX = (bounds[1] + bounds[3]) / 2;
  var centerY = (bounds[0] + bounds[2]) / 2;
  var newWidth = (bounds[3] - bounds[1]) * factor;
  var newHeight = (bounds[2] - bounds[0]) * factor;
  
  item.geometricBounds = [
    centerY - newHeight / 2,
    centerX - newWidth / 2, 
    centerY + newHeight / 2,
    centerX + newWidth / 2
  ];
  
  return { success: true };
}

function repositionObject(item, offset) {
  var bounds = item.geometricBounds;
  item.geometricBounds = [
    bounds[0] + offset.y,
    bounds[1] + offset.x,
    bounds[2] + offset.y,
    bounds[3] + offset.x
  ];
  
  return { success: true };
}

function changeObjectLayer(item, layerName, doc) {
  for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name === layerName) {
      item.itemLayer = doc.layers[i];
      return { success: true };
    }
  }
  return { success: false, error: "Layer not found: " + layerName };
}

// Batch style application with mapping rules
function processBatchStyleMappings(page, mappings, doc, previewMode) {
  var totalChanges = 0;
  
  for (var m = 0; m < mappings.length; m++) {
    var mapping = mappings[m];
    var mappingChanges = 0;
    
    // Process based on target object type
    switch (mapping.target_criteria.object_type) {
      case "text_frames":
        mappingChanges += processTextFrames(page, mapping, doc, previewMode);
        break;
      case "paragraphs":
        mappingChanges += processParagraphs(page, mapping, doc, previewMode);
        break;
      case "characters":
        mappingChanges += processCharacters(page, mapping, doc, previewMode);
        break;
      case "objects":
        mappingChanges += processObjects(page, mapping, doc, previewMode);
        break;
    }
    
    totalChanges += mappingChanges;
  }
  
  return totalChanges;
}

// Safe selection management for bulk operations
function selectObjectsSafely(objects, maxSelection) {
  try {
    // InDesign has limits on selection size
    var selectionLimit = maxSelection || 100;
    
    if (objects.length > selectionLimit) {
      // Select in batches for large selections
      var batches = Math.ceil(objects.length / selectionLimit);
      var currentBatch = objects.slice(0, selectionLimit);
      app.selection = currentBatch;
      
      return {
        success: true,
        selected: currentBatch.length,
        total: objects.length,
        batched: batches > 1
      };
    } else {
      app.selection = objects;
      return {
        success: true,
        selected: objects.length,
        total: objects.length,
        batched: false
      };
    }
  } catch (e) {
    return {
      success: false,
      error: e.message,
      selected: 0
    };
  }
}
```

### Color Group Management Patterns

```javascript
// Safe color group creation with version compatibility
function createColorGroup(doc, groupName, swatchNames, description) {
  var result = [];
  var validSwatches = [];
  var invalidSwatches = [];
  
  try {
    // Validate swatch names first
    for (var i = 0; i < swatchNames.length; i++) {
      var swatchName = swatchNames[i];
      var found = false;
      
      for (var j = 0; j < doc.swatches.length; j++) {
        if (doc.swatches[j].name === swatchName) {
          validSwatches.push(doc.swatches[j]);
          found = true;
          break;
        }
      }
      
      if (!found) {
        invalidSwatches.push(swatchName);
      }
    }
    
    if (validSwatches.length === 0) {
      return {
        success: false,
        error: "No valid swatches found",
        invalidSwatches: invalidSwatches
      };
    }
    
    // Try native color groups first (InDesign CC 2018+)
    try {
      var colorGroup = doc.colorGroups.add();
      colorGroup.name = groupName;
      
      for (var k = 0; k < validSwatches.length; k++) {
        try {
          colorGroup.colorGroupSwatches.add(validSwatches[k]);
        } catch (swatchError) {
          result.push("Warning: Could not add " + validSwatches[k].name);
        }
      }
      
      if (description && description !== "") {
        try {
          colorGroup.label = description;
        } catch (labelError) {
          // Label not supported, store in metadata
        }
      }
      
      return {
        success: true,
        method: "native",
        groupName: groupName,
        validSwatches: validSwatches.length,
        invalidSwatches: invalidSwatches.length,
        warnings: result
      };
      
    } catch (nativeError) {
      // Fall back to manual organization
      return createManualColorGroup(doc, groupName, validSwatches, description);
    }
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Fallback manual color group organization
function createManualColorGroup(doc, groupName, validSwatches, description) {
  try {
    // Create header swatch for visual organization
    var headerSwatch = doc.swatches.add();
    headerSwatch.name = "--- " + groupName + " ---";
    
    // Set distinctive color (gray) for group headers
    try {
      var grayColor = doc.colors.add();
      grayColor.model = ColorModel.SPOT;
      grayColor.space = ColorSpace.RGB;
      grayColor.colorValue = [128, 128, 128];
      headerSwatch.color = grayColor;
    } catch (colorError) {
      // Color assignment failed, header will use default
    }
    
    // Store group metadata in document preferences if possible
    try {
      var groupInfo = {
        name: groupName,
        swatches: validSwatches.map(function(s) { return s.name; }),
        description: description || "",
        created: new Date().toString(),
        headerSwatch: headerSwatch.name
      };
      
      // Attempt to store in document metadata
      var metadataKey = "ColorGroup_" + groupName.replace(/\s/g, "_");
      // Storage depends on InDesign version capabilities
      
    } catch (metaError) {
      // Metadata storage not critical
    }
    
    return {
      success: true,
      method: "manual",
      groupName: groupName,
      headerSwatch: headerSwatch.name,
      validSwatches: validSwatches.length,
      description: description || "No description"
    };
    
  } catch (e) {
    return {
      success: false,
      error: "Manual group creation failed: " + e.message
    };
  }
}

// Color group validation and cleanup
function validateColorGroup(doc, groupName) {
  var validation = {
    exists: false,
    method: "unknown",
    swatchCount: 0,
    issues: []
  };
  
  try {
    // Check for native color groups
    for (var i = 0; i < doc.colorGroups.length; i++) {
      if (doc.colorGroups[i].name === groupName) {
        validation.exists = true;
        validation.method = "native";
        validation.swatchCount = doc.colorGroups[i].colorGroupSwatches.length;
        return validation;
      }
    }
    
    // Check for manual group headers
    for (var j = 0; j < doc.swatches.length; j++) {
      var swatchName = doc.swatches[j].name;
      if (swatchName === "--- " + groupName + " ---") {
        validation.exists = true;
        validation.method = "manual";
        
        // Count associated swatches (those appearing after header)
        var swatchIndex = j;
        var count = 0;
        for (var k = swatchIndex + 1; k < doc.swatches.length; k++) {
          var nextSwatch = doc.swatches[k];
          // Stop at next group header or end
          if (nextSwatch.name.indexOf("--- ") === 0 && 
              nextSwatch.name.indexOf(" ---") === nextSwatch.name.length - 4) {
            break;
          }
          count++;
        }
        validation.swatchCount = count;
        return validation;
      }
    }
    
    return validation;
    
  } catch (e) {
    validation.issues.push("Validation error: " + e.message);
    return validation;
  }
}

// Color group swatch management
function addSwatchesToGroup(doc, groupName, newSwatchNames) {
  try {
    var groupInfo = validateColorGroup(doc, groupName);
    
    if (!groupInfo.exists) {
      return {
        success: false,
        error: "Color group '" + groupName + "' not found"
      };
    }
    
    var validSwatches = [];
    var invalidSwatches = [];
    
    // Validate new swatches
    for (var i = 0; i < newSwatchNames.length; i++) {
      var found = false;
      for (var j = 0; j < doc.swatches.length; j++) {
        if (doc.swatches[j].name === newSwatchNames[i]) {
          validSwatches.push(doc.swatches[j]);
          found = true;
          break;
        }
      }
      if (!found) {
        invalidSwatches.push(newSwatchNames[i]);
      }
    }
    
    var added = 0;
    
    if (groupInfo.method === "native") {
      // Add to native color group
      for (var n = 0; n < doc.colorGroups.length; n++) {
        if (doc.colorGroups[n].name === groupName) {
          var colorGroup = doc.colorGroups[n];
          
          for (var v = 0; v < validSwatches.length; v++) {
            try {
              // Check if swatch is already in group
              var alreadyExists = false;
              for (var e = 0; e < colorGroup.colorGroupSwatches.length; e++) {
                if (colorGroup.colorGroupSwatches[e].name === validSwatches[v].name) {
                  alreadyExists = true;
                  break;
                }
              }
              
              if (!alreadyExists) {
                colorGroup.colorGroupSwatches.add(validSwatches[v]);
                added++;
              }
            } catch (addError) {
              // Skip swatches that can't be added
            }
          }
          break;
        }
      }
    } else if (groupInfo.method === "manual") {
      // For manual groups, swatches are organized by position
      // This would require manual reordering in the swatches panel
      added = validSwatches.length;
    }
    
    return {
      success: true,
      added: added,
      invalid: invalidSwatches.length,
      method: groupInfo.method,
      invalidSwatches: invalidSwatches
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Color group listing with metadata
function listColorGroups(doc) {
  var groups = [];
  
  try {
    // List native color groups
    for (var i = 0; i < doc.colorGroups.length; i++) {
      var group = doc.colorGroups[i];
      var swatches = [];
      
      for (var j = 0; j < group.colorGroupSwatches.length; j++) {
        swatches.push(group.colorGroupSwatches[j].name);
      }
      
      groups.push({
        name: group.name,
        method: "native",
        swatchCount: swatches.length,
        swatches: swatches,
        label: group.label || ""
      });
    }
    
    // List manual color groups (header swatches)
    for (var k = 0; k < doc.swatches.length; k++) {
      var swatch = doc.swatches[k];
      var swatchName = swatch.name;
      
      if (swatchName.indexOf("--- ") === 0 && 
          swatchName.indexOf(" ---") === swatchName.length - 4) {
        
        var groupName = swatchName.substring(4, swatchName.length - 4);
        var associatedSwatches = [];
        
        // Find swatches following this header
        for (var m = k + 1; m < doc.swatches.length; m++) {
          var nextSwatch = doc.swatches[m];
          if (nextSwatch.name.indexOf("--- ") === 0 && 
              nextSwatch.name.indexOf(" ---") === nextSwatch.name.length - 4) {
            break; // Next group header
          }
          associatedSwatches.push(nextSwatch.name);
        }
        
        groups.push({
          name: groupName,
          method: "manual",
          swatchCount: associatedSwatches.length,
          swatches: associatedSwatches,
          headerSwatch: swatchName
        });
      }
    }
    
    return {
      success: true,
      groups: groups,
      totalGroups: groups.length
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}
```

## Tool Categories & Organization

### Current Categories
- **Text** (`src/tools/text/`): Core text manipulation (4 tools)
- **Styles** (`src/tools/styles/`): Character/paragraph/object style management (10 tools)
- **Layout** (`src/tools/layout/`): Frame positioning and creation (3 tools)
- **Pages** (`src/tools/pages/`): Page management (4 tools)
- **Special** (`src/tools/special/`): Layers, tables, special characters (4 tools)
- **Utility** (`src/tools/utility/`): Threading, flow management, asset management, master pages, bulk operations (16 tools)
- **Export** (`src/tools/export/`): Document import/export (6 tools)
- **Transform** (`src/tools/transform/`): Object manipulation (3 tools)
- **Composite** (`src/tools/composite/`): High-level workflows (7 tools)
- **Analysis** (`src/tools/analysis/`): Metrics and decision tracking (7 tools)
- **Color** (`src/tools/color/`): Color management, swatches, themes, and color groups (6 tools)

### Adding New Categories
1. Create directory: `src/tools/yourcategory/`
2. Implement: `src/tools/yourcategory/index.ts`
3. Register: Add to `src/tools/index.ts`
4. Export types: Update `src/types.ts` if needed

## Critical Gotchas & Debugging Guide

### ExtendScript Color/Swatch Management

#### ❌ **WRONG: Manual Swatch Creation**
```javascript
// This DOES NOT WORK - swatches collection has no add() method
var swatch = doc.swatches.add();  // ERROR: doc.swatches.add is not a function
swatch.name = "MyColor";
swatch.color = colorObj;
```

#### ✅ **CORRECT: Colors ARE Swatches**
```javascript
// Colors automatically appear in swatches panel
var color = doc.colors.add();
color.name = "MyColor";
color.model = ColorModel.PROCESS;
color.space = ColorSpace.RGB;
color.colorValue = [255, 0, 0];
// No separate swatch creation needed!
```

#### ❌ **WRONG: Transparency Property**
```javascript
objectStyle.transparency = 50;  // ERROR: Object doesn't support property 'transparency'
```

#### ✅ **CORRECT: Nested Transparency Settings**
```javascript
objectStyle.transparencySettings.blendingSettings.opacity = 50; // 0-100 scale
```

### JSON Support Issues

#### **Problem**: ExtendScript lacks native JSON
```javascript
JSON.stringify(data);  // ERROR: JSON is undefined
```

#### **Solutions**:

**Option 1: Use JSON2 Polyfill (Recommended)**
```javascript
import { JSON2_POLYFILL } from "../../utils/json2-polyfill.js";

const script = `
  ${JSON2_POLYFILL}
  
  // Now JSON.stringify() works
  var result = JSON.stringify({ success: true });
`;
```

**Option 2: Manual String Building**
```javascript
// Build JSON-like strings manually
var results = [];
results.push('{');
results.push('"success": true,');
results.push('"count": ' + processed);
results.push('}');
var jsonString = results.join('');
```

### Error Handling Patterns

#### **False Negatives**: Tools Report Errors But Work
```javascript
// Common pattern causing confusion
try {
  var color = doc.colors.add();  // This works fine
  // ... set color properties ...
  
  var swatch = doc.swatches.add();  // This line fails
  // But color was already created and IS a swatch!
} catch (e) {
  return { error: e.message };  // Reports failure despite success
}
```

**Solution**: Remove redundant swatch creation, test in InDesign UI.

#### **Silent Failures**: Operations Run But Don't Apply
```javascript
// Add debugging to bulk operations
results.push("Debug: Page " + pageNum + " has " + objects.length + " objects");

for (var i = 0; i < objects.length; i++) {
  try {
    obj.fillColor = swatch;
    results.push("✓ Applied to " + obj.constructor.name);
  } catch (colorError) {
    results.push("✗ Failed on " + obj.constructor.name + ": " + colorError.message);
  }
}
```

### Logger Dependencies

#### **Problem**: Undefined Logger in Composite Tools
```javascript
await logger.log("Starting operation");  // ERROR: logger.log is not a function
```

#### **Solution**: Mock Logger
```javascript
const logger = {
  log: async (message: string, progress?: any) => {
    // No-op or console.log if debugging needed
  }
};
```

### API Version Compatibility

#### **InDesign Version Differences**
- **Tested**: InDesign 2025 v20.5.0.48
- **Older Versions**: May have different property names or missing features
- **Solution**: Add version detection and fallbacks:

```javascript
try {
  // Try newer API
  doc.colorGroups.add();
} catch (e) {
  // Fall back to older approach
  createManualColorGroup();
}
```

### Debugging Best Practices

#### **Add Comprehensive Logging**
```javascript
// Object selection debugging
results.push("Debug: Found " + page.textFrames.length + " text frames");
results.push("Debug: Found " + page.rectangles.length + " rectangles");

// Filter debugging  
if (shouldApply) {
  results.push("  ✓ Processing " + obj.constructor.name);
} else {
  results.push("  - Skipped " + obj.constructor.name + " (filter mismatch)");
}

// Error context
catch (e) {
  results.push("Error in " + toolName + " at step " + currentStep + ": " + e.message);
}
```

#### **Test with Multiple Document States**
1. **Empty Document**: New document with no content
2. **Simple Content**: Text frames, rectangles, basic shapes
3. **Complex Document**: Multiple pages, threading, styles, groups
4. **Edge Cases**: Locked objects, hidden layers, master pages

### Common ExtendScript Gotchas

#### **String Building**
```javascript
// ❌ WRONG: Can cause crashes
var result = "";
for (var i = 0; i < 1000; i++) {
  result += "text" + i;  // Avoid += with strings
}

// ✅ CORRECT: Use array join
var parts = [];
for (var i = 0; i < 1000; i++) {
  parts.push("text" + i);
}
var result = parts.join("");
```

#### **Boolean Values**
```javascript
// In TypeScript/JavaScript
const enabled = true;

// In ExtendScript template
const script = `
  var enabled = "${enabled}";  // "true" as string
  if (enabled === "true") {    // String comparison
    // Do something
  }
`;
```

#### **Error Object Access**
```javascript
// ❌ Might not work in all cases
catch (error) {
  console.log(error.message);
}

// ✅ Safe approach
catch (error) {
  var errorMsg = error instanceof Error ? error.message : String(error);
  console.log(errorMsg);
}
```

## Recent Development Learnings (v69 Tools)

### Advanced Selection Criteria Implementation
When implementing enhanced selection tools like `apply_object_style` v2:
- **Object Type Detection**: Use `constructor.name` for reliable object type identification
- **Criteria Matching**: Build helper functions for complex filtering logic
- **Dry Run Mode**: Essential for testing selection logic without making changes
- **Verbose Logging**: Track what was selected/skipped on each page for debugging

### CSV Data Integration Challenges
From implementing `data_merge_setup`:
- **CSV Parsing in ExtendScript**: No native CSV support - implement custom parser with quote handling
- **JSON2 Polyfill**: Always include for JSON operations in ExtendScript
- **File API**: Use `File()` constructor with proper error handling for file operations
- **Text Frame Placeholders**: Use `<<column_name>>` format for data merge fields

### Alternate Layout Limitations
From `create_alternate_layouts` implementation:
- **API Gap**: InDesign's Alternate Layout feature not fully exposed in ExtendScript
- **Workaround**: Create separate pages with different dimensions as proxy layouts
- **Liquid Rules**: Implement manual scaling calculations for responsive behavior
- **Manual Steps**: Provide clear instructions for features requiring UI interaction

### Batch Export Considerations
From `batch_export_by_layout`:
- **Export Format Enums**: Use correct ExtendScript constants (e.g., `ExportFormat.PDF_TYPE`)
- **Directory Creation**: Always ensure output directories exist before export
- **Variable Substitution**: Implement template variable replacement for dynamic filenames
- **File Size Reporting**: Use `File.length` property for post-export validation

### Tool Registration Best Practices
- **Zod Schema Evolution**: Use `.optional()` and `.default()` for backward compatibility
- **Import Management**: Always check imports - `TextContent` from SDK types, not local
- **Helper Functions**: Extract complex ExtendScript logic into reusable functions
- **Error Context**: Include tool parameters in error messages for debugging

## Conclusion

This guide captures hard-won lessons from implementing 69+ InDesign MCP tools across 11 categories. The key to success is:

1. **Understand ExtendScript Limitations**: Work within its constraints, not against them
2. **Test False Negatives**: Verify actual results in InDesign UI, don't trust error messages alone
3. **Add Comprehensive Debugging**: Log object counts, filter matches, and detailed error context
4. **Use Proper API Patterns**: Colors ARE swatches, transparency has nested structure
5. **Handle JSON Limitations**: Use polyfills or manual string building
6. **Provide Robust Fallbacks**: Handle edge cases and version differences gracefully
7. **Document Workarounds**: When APIs are missing, provide clear manual instructions

**Remember**: ExtendScript is NOT JavaScript. Success comes from respecting its unique characteristics and building tools that work with the platform, not against it.