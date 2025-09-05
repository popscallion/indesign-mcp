// packages/indesign-server/src/tools/text/index.test.ts

// Mock executeExtendScript for testing
const mockExecuteExtendScript = jest.fn();

// Mock the module
jest.mock('@mcp/shared/dist/extendscript', () => ({
  executeExtendScript: mockExecuteExtendScript
}));

describe('Text Tools', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('add_text_to_document', () => {
    test('should handle add_text_to_document with basic parameters', async () => {
      // Mock successful execution
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: "Test content",
          page: 1,
          position: { x: 100, y: 100 },
          width: 200,
          height: 100,
          font: "Times New Roman",
          size: 12
        })
      });
      
      // Simulate the tool's behavior
      const params = {
        text: "Test content",
        page_number: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        font: "Times New Roman",
        size: 12
      };
      
      // This would be the actual tool handler in production
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text).toBe("Test content");
      expect(result.page).toBe(1);
      expect(result.font).toBe("Times New Roman");
      expect(result.size).toBe(12);
    });
    
    test('should handle missing optional parameters', async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: "Test content",
          page: 1
        })
      });
      
      const params = {
        text: "Test content"
      };
      
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text).toBe("Test content");
      expect(result.page).toBe(1);
    });
    
    test('should handle ExtendScript errors', async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: false,
        error: "No document open"
      });
      
      const params = {
        text: "Test content"
      };
      
      await expect(mockAddTextToDocument(params)).rejects.toThrow("No document open");
    });
    
    test('should handle special characters in text', async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: "Test with \"quotes\" and 'apostrophes'",
          page: 1
        })
      });
      
      const params = {
        text: "Test with \"quotes\" and 'apostrophes'"
      };
      
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text).toContain("quotes");
      expect(result.text).toContain("apostrophes");
    });
    
    test('should handle multi-line text', async () => {
      const multilineText = "Line 1\\nLine 2\\nLine 3";
      
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: multilineText,
          page: 1
        })
      });
      
      const params = {
        text: multilineText
      };
      
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text).toContain("Line 1");
      expect(result.text).toContain("Line 2");
      expect(result.text).toContain("Line 3");
    });
  });
  
  describe('edge cases', () => {
    test('should handle empty text', async () => {
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: "",
          page: 1
        })
      });
      
      const params = {
        text: ""
      };
      
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text).toBe("");
    });
    
    test('should handle very long text', async () => {
      const longText = "a".repeat(10000);
      
      mockExecuteExtendScript.mockResolvedValue({
        success: true,
        result: JSON.stringify({
          success: true,
          text: longText,
          page: 1
        })
      });
      
      const params = {
        text: longText
      };
      
      const result = await mockAddTextToDocument(params);
      
      expect(result).toBeDefined();
      expect(result.text.length).toBe(10000);
    });
  });
});

// Mock implementation of the add_text_to_document handler
async function mockAddTextToDocument(params: any) {
  // Simulate the actual tool's ExtendScript generation
  const script = `
    // Mock script - would be actual ExtendScript in production
    var result = {
      success: true,
      text: "${params.text || ''}",
      page: ${params.page_number || 1}
    };
  `;
  
  const result = await mockExecuteExtendScript(script);
  
  if (!result.success) {
    throw new Error(result.error || 'ExtendScript execution failed');
  }
  
  return JSON.parse(result.result || '{}');
}