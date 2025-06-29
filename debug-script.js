
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    var metrics = {
      frames: [],
      margins: null,
      columns: 1,
      styles: [],
      textRegions: []
    };
    
    // Determine page to analyze
    var page;
    if (-1 === -1) {
      // Use current page
      if (app.activeWindow && app.activeWindow.activePage) {
        page = app.activeWindow.activePage;
      } else {
        page = doc.pages[0];
      }
    } else {
      if (doc.pages.length < -1) {
        throw new Error("Page " + -1 + " does not exist.");
      }
      page = doc.pages[-1 - 1];
    }
    
    // Extract page margins
    try {
      var pageBounds = page.bounds; // [y1, x1, y2, x2]
      var marginPref = page.marginPreferences;
      metrics.margins = {
        top: marginPref.top,
        left: marginPref.left,
        bottom: marginPref.bottom,
        right: marginPref.right
      };
      
      // Calculate columns
      metrics.columns = marginPref.columnCount || 1;
    } catch (e) {
      metrics.margins = { top: 72, left: 72, bottom: 72, right: 72 };
    }
    
    // Extract text frame information with visual attributes
    for (var i = 0; i < page.textFrames.length; i++) {
      var frame = page.textFrames[i];
      var bounds = frame.geometricBounds;
      
      var frameData = {
        x: Math.round(bounds[1]),
        y: Math.round(bounds[0]),
        width: Math.round(bounds[3] - bounds[1]),
        height: Math.round(bounds[2] - bounds[0]),
        hasText: frame.contents.length > 0,
        contentLength: frame.contents.length,
        overflows: frame.overflows
      };
      
      metrics.frames.push(frameData);
      
      // Extract visual attributes for each frame
      if (true && frame.contents.length > 0) {
        var textRegion = {
          frameIndex: i,
          regions: []
        };
        
        // Analyze paragraphs in this frame
        var story = frame.parentStory;
        var lastStyle = null;
        var currentRegion = null;
        
        for (var p = 0; p < story.paragraphs.length; p++) {
          var para = story.paragraphs[p];
          
          // Skip if paragraph is not in this frame
          if (para.parentTextFrames.length === 0 || para.parentTextFrames[0] !== frame) {
            continue;
          }
          
          try {
            var style = para.appliedParagraphStyle;
            var font = para.appliedFont;
            var fontSize = para.pointSize;
            var leading = para.leading;
            // Handle leading as it can be a number or AUTO enum value
            if (typeof leading !== "number") {
              leading = fontSize * 1.2; // Default to 120% of font size
            }
            var alignment = para.justification.toString();
            var firstLineIndent = para.firstLineIndent;
            var leftIndent = para.leftIndent;
            
            // Create a style key to detect changes
            var styleKey = fontSize + "_" + leading + "_" + alignment + "_" + firstLineIndent + "_" + leftIndent;
            
            if (styleKey !== lastStyle) {
              // New style region
              if (currentRegion) {
                textRegion.regions.push(currentRegion);
              }
              
              // Map InDesign alignment to our format
              var alignmentMap = {
                "Justification.LEFT_ALIGN": "left",
                "Justification.CENTER_ALIGN": "center",
                "Justification.RIGHT_ALIGN": "right",
                "Justification.LEFT_JUSTIFIED": "justify",
                "Justification.RIGHT_JUSTIFIED": "justify",
                "Justification.CENTER_JUSTIFIED": "justify",
                "Justification.FULLY_JUSTIFIED": "justify"
              };
              
              var alignValue = alignmentMap[alignment] || "left";
              
              // Escape text for JSON
              var snippet = para.contents.substring(0, 30) + (para.contents.length > 30 ? "..." : "");
              snippet = snippet.replace(/\\/g, "\\\\")
                              .replace(/"/g, '\\"')
                              .replace(/\n/g, "\\n")
                              .replace(/\r/g, "\\r")
                              .replace(/\t/g, "\\t");
              
              currentRegion = {
                textSnippet: snippet,
                visualAttributes: {
                  fontSize: Math.round(fontSize),
                  leading: Math.round(leading),
                  fontFamily: font ? font.fontFamily : "Unknown",
                  fontStyle: font ? font.fontStyleName : "Regular",
                  alignment: alignValue,
                  firstLineIndent: Math.round(firstLineIndent),
                  leftIndent: Math.round(leftIndent)
                },
                description: style.name.replace(/ /g, "_").toLowerCase()
              };
              
              lastStyle = styleKey;
            }
          } catch (e) {
            // Skip paragraphs with errors
          }
        }
        
        // Add last region
        if (currentRegion) {
          textRegion.regions.push(currentRegion);
        }
        
        if (textRegion.regions.length > 0) {
          metrics.textRegions.push(textRegion);
        }
      }
    }
    
    // Extract style information if requested (for backward compatibility)
    if (true) {
      // Get paragraph styles used in the document
      var usedStyles = {};
      
      for (var s = 0; s < doc.stories.length; s++) {
        var story = doc.stories[s];
        for (var p = 0; p < story.paragraphs.length; p++) {
          var para = story.paragraphs[p];
          try {
            var styleName = para.appliedParagraphStyle.name;
            if (!usedStyles[styleName]) {
              var style = para.appliedParagraphStyle;
              usedStyles[styleName] = {
                name: styleName,
                fontSize: style.pointSize,
                fontFamily: style.appliedFont ? style.appliedFont.fontFamily : "Unknown"
              };
            }
          } catch (e) {
            // Skip if can't get style
          }
        }
      }
      
      // Convert to array
      for (var key in usedStyles) {
        if (usedStyles.hasOwnProperty(key)) {
          metrics.styles.push(usedStyles[key]);
        }
      }
    }
    
    // Convert to JSON string using proper JSON construction
    
    // Build JSON using arrays for safer string construction
    var jsonParts = [];
    jsonParts.push('{');
    
    // Frames array
    jsonParts.push('"frames":[');
    var frameParts = [];
    for (var f = 0; f < metrics.frames.length; f++) {
      var fr = metrics.frames[f];
      frameParts.push(
        '{"x":' + fr.x + 
        ',"y":' + fr.y + 
        ',"width":' + fr.width + 
        ',"height":' + fr.height +
        ',"hasText":' + fr.hasText + 
        ',"contentLength":' + fr.contentLength +
        ',"overflows":' + fr.overflows + '}'
      );
    }
    jsonParts.push(frameParts.join(','));
    jsonParts.push(']');
    
    // Margins
    jsonParts.push(',"margins":{');
    jsonParts.push('"top":' + metrics.margins.top);
    jsonParts.push(',"left":' + metrics.margins.left);
    jsonParts.push(',"bottom":' + metrics.margins.bottom);
    jsonParts.push(',"right":' + metrics.margins.right);
    jsonParts.push('}');
    
    // Columns
    jsonParts.push(',"columns":' + metrics.columns);
    
    // Styles (if included)
    if (metrics.styles.length > 0) {
      jsonParts.push(',"styles":[');
      var styleParts = [];
      for (var st = 0; st < metrics.styles.length; st++) {
        var style = metrics.styles[st];
        styleParts.push(
          '{"name":"' + style.name.replace(/"/g, '\\"') + '"' + 
          ',"fontSize":' + style.fontSize + 
          ',"fontFamily":"' + style.fontFamily.replace(/"/g, '\\"') + '"}'
        );
      }
      jsonParts.push(styleParts.join(','));
      jsonParts.push(']');
    } else if (true) {
      jsonParts.push(',"styles":[]');
    }
    
    // Text regions (if included)
    if (metrics.textRegions.length > 0) {
      jsonParts.push(',"textRegions":[');
      var regionParts = [];
      
      for (var tr = 0; tr < metrics.textRegions.length; tr++) {
        var textRegion = metrics.textRegions[tr];
        var regionJson = '{"frameIndex":' + textRegion.frameIndex + ',"regions":[';
        
        var segmentParts = [];
        for (var r = 0; r < textRegion.regions.length; r++) {
          var region = textRegion.regions[r];
          var va = region.visualAttributes;
          
          segmentParts.push(
            '{' +
            '"textSnippet":"' + region.textSnippet.replace(/"/g, '\\"') + '",' +
            '"visualAttributes":{' +
              '"fontSize":' + va.fontSize + ',' +
              '"leading":' + va.leading + ',' +
              '"fontFamily":"' + va.fontFamily.replace(/"/g, '\\"') + '",' +
              '"fontStyle":"' + va.fontStyle.replace(/"/g, '\\"') + '",' +
              '"alignment":"' + va.alignment + '",' +
              '"firstLineIndent":' + va.firstLineIndent + ',' +
              '"leftIndent":' + va.leftIndent +
            '},' +
            '"description":"' + region.description.replace(/"/g, '\\"') + '"' +
            '}'
          );
        }
        
        regionJson += segmentParts.join(',') + ']}';
        regionParts.push(regionJson);
      }
      
      jsonParts.push(regionParts.join(','));
      jsonParts.push(']');
    } else if (true) {
      jsonParts.push(',"textRegions":[]');
    }
    
    jsonParts.push('}');
    
    var result = jsonParts.join('');
    result;
  
  