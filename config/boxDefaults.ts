
/*
 * -----------------------------------------------------------------------------
 * Box Builder Defaults
 * Centralized configuration for "Fill in the Blank" tools.
 * -----------------------------------------------------------------------------
 */

export const BOX_DEFAULTS = {
    // General Metrics
    xHeightRatio: 0.45, // Approximate height of lowercase 'x' relative to font size in Times New Roman

    equationBox: {
        // Target Width: 66px at Default Font Size (11px)
        // Calculation: 66 / (11 * 0.45) ≈ 13.3333
        widthRatio: 13.3333, 
        
        // Target Height: 22px at Default Font Size (11px)
        // Calculation: 22 / (11 * 0.45) ≈ 4.4444
        heightRatio: 4.4444, 
        
        // Vertical shift to center align with math axis
        yOffsetRatio: 0.1, 
        
        // Extra space around the box (padding) - Deprecated in favor of paddingLeft/Right
        horizontalPadding: 0.4, 
        
        // Absolute thickness in pixels
        strokeWidth: 1.0,
        fill: 'none',
        stroke: 'black',

        // Defaults for Positioning (Pixels)
        paddingLeft: 4,
        paddingRight: 4,
        shiftX: 0,
        shiftY: 0
    },

    matrix: {
        // "Just a thin line that students write on"
        mode: 'underline', 
        
        // Width of the underline relative to font size
        widthRatio: 2.5, 
        
        // Thickness of the line
        strokeWidth: 0.25,
        
        // Vertical position relative to baseline
        // 0.3 aligns with the text render offset used in Matrix cells
        yOffsetRatio: 0.3,

        paddingLeft: 0,
        paddingRight: 0,
        shiftX: 0,
        shiftY: 0
    }
};
