#!/bin/bash
# Visual testing script for headless server with Peekaboo integration

set -e  # Exit on error

echo "🧪 InDesign MCP Visual Testing with Peekaboo"
echo "============================================="

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    # Check if on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}❌ This script requires macOS (InDesign requirement)${NC}"
        exit 1
    fi
    
    # Check if InDesign is running
    if pgrep -x "Adobe InDesign" > /dev/null; then
        echo -e "${GREEN}✓ InDesign is running${NC}"
    else
        echo -e "${YELLOW}⚠ InDesign is not running. Starting...${NC}"
        open -a "Adobe InDesign 2025" 2>/dev/null || open -a "Adobe InDesign" 2>/dev/null || {
            echo -e "${RED}❌ Could not start InDesign. Please start it manually.${NC}"
            exit 1
        }
        sleep 5
    fi
    
    # Check if Peekaboo is installed
    if command -v peekaboo &> /dev/null; then
        echo -e "${GREEN}✓ Peekaboo is installed${NC}"
    else
        echo -e "${YELLOW}⚠ Peekaboo not found - visual testing will use fallback mode${NC}"
    fi
    
    # Check if MCP server is built
    if [ -d "dist" ]; then
        echo -e "${GREEN}✓ MCP server is built${NC}"
    else
        echo -e "${YELLOW}Building MCP server...${NC}"
        npm run build
    fi
}

# Set up environment
setup_environment() {
    echo -e "\n${YELLOW}Setting up environment...${NC}"
    
    # Enable visual testing
    export ENABLE_VISUAL_TESTING=true
    echo "  ENABLE_VISUAL_TESTING=true"
    
    # Configure Peekaboo (use defaults if not set)
    export PEEKABOO_AI_PROVIDER=${PEEKABOO_AI_PROVIDER:-anthropic}
    export PEEKABOO_AI_MODEL=${PEEKABOO_AI_MODEL:-claude-3-5-sonnet}
    echo "  PEEKABOO_AI_PROVIDER=$PEEKABOO_AI_PROVIDER"
    echo "  PEEKABOO_AI_MODEL=$PEEKABOO_AI_MODEL"
    
    # Check for API key
    if [ -z "$PEEKABOO_AI_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
        echo -e "${YELLOW}⚠ No API key found. Set PEEKABOO_AI_KEY or ANTHROPIC_API_KEY for visual analysis${NC}"
    fi
}

# Run visual test
run_visual_test() {
    echo -e "\n${YELLOW}Running visual test...${NC}"
    
    # Create test script
    cat > /tmp/test-visual-integration.js << 'EOF'
import { getMcpBridge } from './dist/experimental/evolutionary/mcpBridge.js';
import { loadReferenceMetrics } from './dist/experimental/evolutionary/metricsLoader.js';
import * as path from 'path';

async function runVisualTest() {
    console.log('\n📸 Starting Visual Testing Integration\n');
    
    const bridge = getMcpBridge();
    
    try {
        // Initialize bridge
        console.log('1. Initializing MCP bridge...');
        await bridge.initialize(false);  // No telemetry for this test
        
        // Check InDesign state
        console.log('2. Checking InDesign state...');
        await bridge.checkInDesignState();
        
        // Reset document
        console.log('3. Resetting document...');
        await bridge.resetDocument();
        
        // Enable visual testing
        console.log('4. Enabling visual testing...');
        await bridge.enableVisualTesting();
        
        // Create test layout
        console.log('5. Creating test layout...');
        
        // Add heading
        await bridge.callTool('create_textframe', {
            x: 72,
            y: 72,
            width: 400,
            height: 50
        });
        
        await bridge.callTool('add_text', {
            text: 'Test Heading for Visual Analysis',
            frame_index: 0
        });
        
        await bridge.callTool('create_paragraph_style', {
            style_name: 'TestHeading',
            font_size: 24,
            font_family: 'Helvetica',
            font_style: 'Bold'
        });
        
        await bridge.callTool('apply_paragraph_style', {
            style_name: 'TestHeading',
            paragraph_index: 0
        });
        
        // Add body text
        await bridge.callTool('create_textframe', {
            x: 72,
            y: 150,
            width: 400,
            height: 200
        });
        
        await bridge.callTool('add_text', {
            text: 'This is body text for testing visual analysis with Peekaboo. The text should be analyzed for size, position, and overall layout accuracy.',
            frame_index: 1
        });
        
        console.log('6. Loading reference metrics...');
        const referenceMetrics = await loadReferenceMetrics('book-page');
        const referenceImage = path.join(process.cwd(), 'tests/decision-analysis/reference-images/book-page.jpg');
        
        console.log('7. Running visual comparison...');
        const result = await bridge.compareWithVisualAnalysis(
            referenceMetrics,
            referenceImage
        );
        
        console.log('\n📊 Visual Test Results:');
        console.log('========================');
        console.log(`Overall Score: ${result.score}%`);
        
        if (result.metricsScore !== undefined) {
            console.log(`Metrics Score: ${result.metricsScore}%`);
        }
        
        if (result.visualSimilarity !== undefined) {
            console.log(`Visual Similarity: ${result.visualSimilarity}%`);
        } else {
            console.log('Visual Similarity: Not available (Peekaboo fallback mode)');
        }
        
        console.log(`Match Status: ${result.match ? '✅ PASS' : '❌ FAIL'}`);
        
        if (result.deviations && result.deviations.length > 0) {
            console.log(`\nDeviations Found: ${result.deviations.length}`);
            result.deviations.slice(0, 3).forEach(dev => {
                console.log(`  - ${dev.type}: ${dev.field} (${dev.deviation}% off)`);
            });
        }
        
        if (result.visualFeedback) {
            console.log('\nVisual Feedback:');
            console.log(result.visualFeedback.substring(0, 200) + '...');
        }
        
        console.log('\n✅ Visual test completed successfully');
        
    } catch (error) {
        console.error('❌ Visual test failed:', error);
        process.exit(1);
    }
}

runVisualTest().catch(console.error);
EOF

    # Run the test
    npx tsx /tmp/test-visual-integration.js
    
    # Clean up
    rm /tmp/test-visual-integration.js
}

# Main execution
main() {
    echo "Starting at $(date)"
    
    check_prerequisites
    setup_environment
    run_visual_test
    
    echo -e "\n${GREEN}✅ Visual testing complete${NC}"
    echo "Finished at $(date)"
}

# Run if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi