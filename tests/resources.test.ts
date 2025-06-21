/**
 * @fileoverview Unit tests for InDesign MCP resources
 * Tests style_catalog and document_snapshot resources
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTestClient } from "@modelcontextprotocol/sdk/testing";
import { registerResources } from "../src/resources/index.js";
import * as extendscript from "../src/extendscript.js";

// Mock the executeExtendScript function
jest.mock("../src/extendscript.js", () => ({
  executeExtendScript: jest.fn()
}));

describe("InDesign MCP Resources", () => {
  let server: McpServer;
  let client: any;
  const mockExecuteExtendScript = extendscript.executeExtendScript as jest.MockedFunction<typeof extendscript.executeExtendScript>;

  beforeEach(async () => {
    // Create a new server instance for each test
    server = new McpServer(
      { name: "test-server", version: "1.0.0" },
      { capabilities: { resources: {} } }
    );
    
    // Register resources
    await registerResources(server);
    
    // Create test client
    client = createTestClient(server);
    
    // Clear mock calls
    mockExecuteExtendScript.mockClear();
  });

  describe("style_catalog resource", () => {
    it("should return style catalog JSON when document is open", async () => {
      // Mock successful ExtendScript execution
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          paragraphStyles: [
            { name: "Body", fontFamily: "Minion Pro", pointSize: 11, alignment: "justify" },
            { name: "Heading", fontFamily: "Helvetica", pointSize: 18, alignment: "left" }
          ],
          characterStyles: [
            { name: "Emphasis", fontStyle: "Italic" }
          ]
        })
      });

      const result = await client.resources.read("styles://current");
      
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("styles://current");
      
      const styles = JSON.parse(result.contents[0].text);
      expect(styles.paragraphStyles).toHaveLength(2);
      expect(styles.paragraphStyles[0].name).toBe("Body");
      expect(styles.characterStyles).toHaveLength(1);
    });

    it("should handle error when no document is open", async () => {
      // Mock ExtendScript error
      mockExecuteExtendScript.mockResolvedValue({
        success: false,
        error: "No active document"
      });

      await expect(client.resources.read("styles://current")).rejects.toThrow("Failed to fetch styles");
    });
  });

  describe("document_snapshot resource", () => {
    it("should return comprehensive document snapshot", async () => {
      // Mock successful ExtendScript execution with full snapshot
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          schemaVersion: 2,
          document: {
            name: "TestDoc.indd",
            pages: 3,
            units: "Points",
            columns: 1,
            baselineGrid: { increment: 12, start: 0 },
            bleed: { top: 3, inside: 0, bottom: 3, outside: 0 }
          },
          pages: [
            {
              number: 1,
              bounds: [0, 0, 792, 612],
              appliedMaster: "A-Master",
              frames: [
                {
                  id: 0,
                  type: "text",
                  bounds: [72, 72, 540, 720],
                  overflows: false,
                  storyIndex: 0,
                  appliedStyle: "Body",
                  contentSample: "Lorem ipsum dolor sit amet..."
                }
              ]
            }
          ],
          threads: [
            { fromFrame: 0, toFrame: 1 }
          ],
          overset: false,
          warnings: []
        })
      });

      const result = await client.resources.read("snapshot://current");
      
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("snapshot://current");
      
      const snapshot = JSON.parse(result.contents[0].text);
      expect(snapshot.schemaVersion).toBe(2);
      expect(snapshot.document.name).toBe("TestDoc.indd");
      expect(snapshot.pages).toHaveLength(1);
      expect(snapshot.pages[0].frames).toHaveLength(1);
      expect(snapshot.threads).toHaveLength(1);
      expect(snapshot.overset).toBe(false);
    });

    it("should detect overset text and include warnings", async () => {
      // Mock snapshot with overset text
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          schemaVersion: 2,
          document: { name: "Overset.indd", pages: 1, units: "Points" },
          pages: [
            {
              number: 1,
              frames: [
                {
                  id: 0,
                  overflows: true,
                  contentSample: "Too much text for this frame..."
                }
              ]
            }
          ],
          threads: [],
          overset: true,
          warnings: ["Frame #0 on page 1 overflows"]
        })
      });

      const result = await client.resources.read("snapshot://current");
      const snapshot = JSON.parse(result.contents[0].text);
      
      expect(snapshot.overset).toBe(true);
      expect(snapshot.warnings).toContain("Frame #0 on page 1 overflows");
    });
  });

  describe("system_fonts resource", () => {
    it("should return list of available fonts", async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          fonts: [
            { postScriptName: "Helvetica-Bold", family: "Helvetica", style: "Bold" },
            { postScriptName: "ArialMT", family: "Arial", style: "Regular" }
          ]
        })
      });

      const result = await client.resources.read("fonts://system");
      const fonts = JSON.parse(result.contents[0].text);
      
      expect(fonts.fonts).toHaveLength(2);
      expect(fonts.fonts[0].postScriptName).toBe("Helvetica-Bold");
    });
  });

  describe("document_settings resource", () => {
    it("should return document settings", async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          horizontalUnits: "Millimeters",
          verticalUnits: "Millimeters",
          columns: 2,
          columnGutter: 4.233,
          baselineGrid: { increment: 12, start: 0 },
          bleed: { top: 3, inside: 0, bottom: 3, outside: 0 }
        })
      });

      const result = await client.resources.read("settings://current");
      const settings = JSON.parse(result.contents[0].text);
      
      expect(settings.horizontalUnits).toBe("Millimeters");
      expect(settings.columns).toBe(2);
      expect(settings.baselineGrid.increment).toBe(12);
    });
  });

  describe("preview_page resource", () => {
    it("should return base64-encoded PNG for valid page", async () => {
      const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          page: 1,
          data: mockBase64,
          width: 792,
          height: 612
        })
      });

      const result = await client.resources.read("preview://1");
      
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("preview://1");
      expect(result.contents[0].blob).toBe(mockBase64);
      expect(result.contents[0].mimeType).toBe("image/png");
    });

    it("should default to page 1 when no page specified", async () => {
      const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          page: 1,
          data: mockBase64,
          width: 792,
          height: 612
        })
      });

      const result = await client.resources.read("preview://");
      
      expect(result.contents[0].blob).toBe(mockBase64);
    });

    it("should handle invalid page numbers", async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: false,
        error: "Page 99 out of range. Document has 3 pages."
      });

      await expect(client.resources.read("preview://99")).rejects.toThrow("Preview generation failed");
    });
  });
});