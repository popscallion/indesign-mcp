/**
 * @fileoverview Strategic prompt system for InDesign document creation and management
 * Inspired by BlenderMCP's asset_creation_strategy pattern to provide hierarchical workflow guidance
 */

/**
 * Core strategic prompt for InDesign document creation and automation
 * Provides comprehensive workflow guidance similar to BlenderMCP's asset_creation_strategy
 */
export function document_creation_strategy(): string {
  return `When working with InDesign documents, always follow this hierarchical workflow:

0. MANDATORY FIRST STEP: Check document status before any operation
   - Use get_document_text() to understand current content and structure
   - Use get_page_info() to verify page count, layout, and text frame structure
   - Use indesign_status() to confirm InDesign is running with active document
   - Use get_textframe_info() to understand text frame threading and bounds

1. DOCUMENT STATE VERIFICATION (Required before any major operation):
   - Page structure: Verify page count and master page setup
   - Text frames: Check existing frames, threading relationships, and overset status
   - Styles: List available paragraph and character styles with list_paragraph_styles() and list_character_styles()
   - Content flow: Verify text threading and check for overset text issues

2. TEXT OPERATIONS PRIORITY HIERARCHY:
   First Priority: Use existing document structure
   - Apply existing styles when possible (use list_paragraph_styles() first)
   - Respect current text threading relationships
   - Check for overset text with get_textframe_info() before adding content
   
   Second Priority: Create new structure intelligently
   - Create missing paragraph styles with create_paragraph_style()
   - Create missing character styles with create_character_style()
   - Add new text frames with create_textframe() only when needed
   
   Third Priority: Custom operations
   - Use update_text() for find/replace operations
   - Use remove_text() only when content deletion is explicitly requested
   - Thread new text frames using thread_text_frames() when expanding content

3. LAYOUT OPERATIONS PRIORITY HIERARCHY:
   First Priority: Check spatial context
   - Use get_page_dimensions() to understand available space
   - Use get_textframe_info() to check frame bounds and positioning
   - Verify text flow across pages before making changes
   
   Second Priority: Maintain document integrity
   - Use position_textframe() to adjust frame positions
   - Use manage_text_flow() to maintain threading relationships
   - Use resolve_overset_text() to handle text overflow issues
   
   Third Priority: Advanced layout operations
   - Use transform_objects() for precise positioning
   - Use align_distribute_objects() for consistent spacing
   - Use duplicate_objects() for repeating elements

4. STYLE MANAGEMENT WORKFLOW:
   Always check existing styles first:
   - Use list_paragraph_styles() and list_character_styles() to see available options
   - Apply existing styles with apply_paragraph_style() or apply_character_style()
   - Only create new styles when existing ones don't meet requirements
   - Maintain style consistency across the document

5. PAGE AND STRUCTURE MANAGEMENT:
   For multi-page documents:
   - Use add_pages() to expand document when needed
   - Use get_page_info() to understand current page structure
   - Maintain consistent text flow across pages using threading tools
   - Check page dimensions with get_page_dimensions() before adding content

6. ERROR PREVENTION AND RECOVERY:
   Before any operation that modifies text or layout:
   - Check for overset text and resolve with resolve_overset_text()
   - Verify text frame threading integrity with manage_text_flow()
   - Ensure adequate space exists before adding new content
   - Back up critical document state information

7. WORKFLOW-SPECIFIC GUIDANCE:

   For Magazine/Newsletter Layouts:
   1. Establish master page structure first
   2. Create paragraph style hierarchy (headlines, body, captions)
   3. Set up text frame threading for body text flow
   4. Apply character styles for emphasis and special formatting
   5. Use page management tools for consistent pagination

   For Report Documents:
   1. Set up document structure with proper page count
   2. Create heading hierarchy with paragraph styles
   3. Establish body text formatting and threading
   4. Add special characters for page numbers and section breaks
   5. Use export tools for final document delivery

   For Marketing Materials:
   1. Focus on precise positioning with transform tools
   2. Use character styles for brand-consistent formatting
   3. Leverage duplicate tools for repeated elements
   4. Apply alignment tools for professional layout
   5. Export to appropriate formats for distribution

8. ADVANCED OPERATIONS (Use only when simpler tools are insufficient):
   - Use place_file() for importing external content
   - Use import_content() for structured data integration
   - Use special character insertion for typographic elements
   - Use layer management for complex document organization

9. FINAL VALIDATION STEPS:
   Before completing any document workflow:
   - Verify all text is properly threaded and no overset exists
   - Check that all styles are applied consistently
   - Confirm proper text flow across all pages
   - Validate document structure matches intended design
   - Export or save using appropriate tools

CRITICAL CONSTRAINTS:
- Never skip document state checking - it prevents 90% of common errors
- Always prioritize existing document structure over creating new elements
- Respect text threading relationships - breaking these causes major issues
- Check spatial constraints before adding content
- Use the simplest tool that accomplishes the task effectively

ERROR RECOVERY PRINCIPLES:
- If text doesn't fit: Use resolve_overset_text() or adjust frame dimensions
- If styling fails: Check if styles exist first, create if needed
- If positioning is wrong: Use position_textframe() or transform tools
- If threading breaks: Use manage_text_flow() to repair connections
- If operations fail: Return to document state checking and try again

This workflow ensures reliable, predictable InDesign automation while maintaining document integrity and professional layout standards.`;
}

/**
 * Scenario-specific strategic prompts for MVP workflows
 */
export function copy_design_strategy(): string {
  return `COPY-DESIGN WORKFLOW (v1)\n\n0. ALWAYS: indesign_status → document_snapshot → style_catalog\n1. Study the user reference image (built-in vision). Infer:\n   • page ratio and rough margins\n   • number of text frames (body, footnote, folio, etc.)\n   • alignment and hierarchy (heading/body/footnote)\n2. create_page_from_reference(fromPage:1) if a similar template page exists OR duplicate_layout if appropriate.\n3. For each inferred frame:\n   – create_textframe with percentage coords (converted automatically)\n   – apply_style_batch or ensure_styles_exist for font mapping (Arial if unsure)\n4. validate_layout — loop until passed==true\n5. preview_document (quality:"preview", page:<n>) to show result\n6. Present summary + next steps.`;
}

export function add_content_strategy(): string {
  return `ADD-CONTENT WORKFLOW (v1)\n\n0. ALWAYS: indesign_status → document_snapshot → style_catalog\n1. Analyze existing document style & threading. Identify last page with content.\n2. auto_flow_text(text:<user-content>, startPage:lastPage, style:"Body", addPages:true)\n3. validate_layout → if overset, auto_flow_text(addPages:true) again or resolve_overset_text\n4. preview_document(page:lastPage+*) to confirm flow\n5. save_document (optional).`;
}