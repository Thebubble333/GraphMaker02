
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * MASTER MATH CONFIGURATION
 * 
 * This file contains ALL tunable parameters for the math layout engine.
 * Edit values here to adjust the global appearance of mathematical formulas.
 * -----------------------------------------------------------------------------
 */

// --- 1. Global Constants (Non-scaling) ---

export const MATH_CONSTANTS = {
    // Threshold (in px) where we switch from a standard text character to an SVG assembly
    DELIMITER_ASSEMBLY_THRESHOLD: 24, 
    
    // Scale factor for the caps relative to font size (e.g. 0.5 means cap is half the font size tall)
    DELIMITER_CAP_SCALE: 0.42, 
    
    // Units of the SVG path definition (Internal normalization)
    PATH_UNIT_HEIGHT: 1000, 
    
    // Visual overlap to prevent anti-aliasing seams (pixels)
    SEAM_OVERLAP: 1
};

// --- 2. Metrics Interface ---

export interface MathLayoutMetrics {
    // A. Global Layout
    axisHeight: number;       // Ratio. Vertical center of math (fraction bars, + signs align here).
    ruleThickness: number;    // Ratio. Default thickness of lines.
    operatorShift: number;    // Ratio. Vertical adjustment for + - = * symbols.
    autoCenterOperators: boolean; // If true, averages L/R glue to force visual centering of BIN/REL.
    
    // B. Horizontal Spacing (The "Glue") - Multiples of fontSize
    glueOrdBin: number;       // Space: a + b (between a and +)
    glueBinOrd: number;       // Space: a + b (between + and b)
    glueOrdRel: number;       // Space: x = y (between x and =)
    glueRelOrd: number;       // Space: x = y (between = and y)
    glueOrdPunct: number;     // Space: f(x, y) (after comma)
    
    // C. Scripts (Superscript/Subscript)
    supShift: number;         // Ratio. Shift superscript UP.
    subShift: number;         // Ratio. Shift subscript DOWN.
    supMinHeight: number;     // Ratio. Minimum height of superscript bottom above baseline.
    subDrop: number;          // Ratio. Maximum distance subscript top can drop below baseline.
    scriptScale: number;      // Scaling factor (e.g. 0.7 for 70% size).
    
    // D. Fractions
    fracNumShift: number;     // Ratio. Shift numerator baseline UP from main baseline.
    fracDenShift: number;     // Ratio. Shift denominator baseline DOWN from main baseline.
    fracGap: number;          // Ratio. Minimum vertical gap between content and bar.
    fracRuleThickness: number;// Ratio. Thickness of the fraction bar (defaults to ruleThickness usually).
    fracPadding: number;      // Ratio. Horizontal padding around fraction content (per side).
    
    // E. Radicals (Square Roots)
    sqrtGap: number;          // Ratio. Vertical clearance between content and vinculum (line).
    sqrtRuleThickness: number;// Ratio. Thickness of the root line.
    sqrtExtraHeight: number;  // Ratio. Extra height/depth of the radical relative to content.
    
    // F. Delimiters (Parentheses)
    delimFactor: number;      // Ratio. Minimum coverage of delimiter height relative to content.
    
    // G. Advanced Scripting
    scriptScriptScale: number;    // Ratio. Scale for scripts-of-scripts (e.g. 0.5).
    supSubGapMin: number;         // Ratio. Min vertical gap between a sup and sub on the same base.
    scriptHorizontalGap: number;  // Ratio. Tiny horizontal padding before a script starts.

    // H. Refined Delimiters
    delimMaxShortfall: number;    // Ratio (relative to FontSize). Absolute max height difference for brackets.
    italicCorrectionDefault: number; // Ratio. Default buffer for italic "lean".
    
    // I. Radical Fine-Tuning
    sqrtVerticalShift: number;    // Ratio. Fine adjustment of radical vinculum vertical position.
}

// --- 3. Default Values (TeX / OpenType MATH Calibrated Standards) ---

export const DEFAULT_MATH_METRICS: MathLayoutMetrics = {
    // A. Global (TeX sigma_22 = 0.25em, xi_8 = 0.045em)
    axisHeight: 0.25,
    ruleThickness: 0.045,
    operatorShift: -0.01, 
    autoCenterOperators: true, // Forces symmetric spacing for + = etc.
    
    // B. Glue
    glueOrdBin: 0.14,
    glueBinOrd: 0.14,
    glueOrdRel: 0.20,
    glueRelOrd: 0.20,
    glueOrdPunct: 0.14, // e.g. after comma
    
    // C. Scripts (TeX Rule 18)
    supShift: 0.36,
    subShift: 0.18,
    supMinHeight: 0.22,
    subDrop: 0.05,
    scriptScale: 0.66,
    
    // D. Fractions (TeX Rule 15b-d)
    fracNumShift: 0.35,
    fracDenShift: 0.30,
    fracGap: 0.09,
    fracRuleThickness: 0.045,
    fracPadding: 0.07,
    
    // E. Radicals (TeX Rule 11)
    sqrtGap: 0.10,
    sqrtRuleThickness: 0.045,
    sqrtExtraHeight: 0.06,
    
    // F. Delimiters (TeX Rule 19: \delimiterfactor = 901)
    delimFactor: 0.90,
    
    // G. Advanced
    scriptScriptScale: 0.50,
    supSubGapMin: 0.15,
    scriptHorizontalGap: 0.015,
    
    // H. Refined Delimiters (\delimitershortfall = 0.1em)
    delimMaxShortfall: 0.10,
    italicCorrectionDefault: 0.02,
    
    // I. Radical Fine-Tuning
    sqrtVerticalShift: 0.0
};

// --- 4. Vector Paths (Computer Modern / KaTeX calibrated extensible glyphs) ---

export const DELIMITER_PATHS = {
    '(': {
        width: 480,
        top: 'M 440 0 L 420 0 C 260 110 150 420 150 1000 L 265 1000 C 265 450 335 140 440 35 Z',
        ext: 'M 150 0 H 265 V 1000 H 150 Z',
        bot: 'M 440 1000 L 420 1000 C 260 890 150 580 150 0 L 265 0 C 265 550 335 860 440 965 Z'
    },
    ')': {
        width: 480, 
        top: 'M 40 0 L 60 0 C 220 110 330 420 330 1000 L 215 1000 C 215 450 145 140 40 35 Z',
        ext: 'M 215 0 H 330 V 1000 H 215 Z',
        bot: 'M 40 1000 L 60 1000 C 220 890 330 580 330 0 L 215 0 C 215 550 145 860 40 965 Z'
    },
    '[': {
        width: 460,
        top: 'M 130 0 H 420 V 95 H 235 V 1000 H 130 Z',
        ext: 'M 130 0 H 235 V 1000 H 130 Z',
        bot: 'M 130 0 H 235 V 905 H 420 V 1000 H 130 Z'
    },
    ']': {
        width: 460,
        top: 'M 40 0 H 330 V 1000 H 225 V 95 H 40 Z',
        ext: 'M 225 0 H 330 V 1000 H 225 Z',
        bot: 'M 40 1000 H 330 V 0 H 225 V 905 H 40 Z'
    },
    '\\{': {
        width: 540,
        top: 'M 460 0 C 310 0 220 90 220 260 V 1000 H 325 V 270 C 325 140 380 80 460 65 Z',
        ext: 'M 220 0 H 325 V 1000 H 220 Z',
        bot: 'M 460 1000 C 310 1000 220 910 220 740 V 0 H 325 V 730 C 325 860 380 920 460 935 Z'
    },
    '\\}': {
        width: 540,
        top: 'M 80 0 C 230 0 320 90 320 260 V 1000 H 215 V 270 C 215 140 160 80 80 65 Z',
        ext: 'M 215 0 H 320 V 1000 H 215 Z',
        bot: 'M 80 1000 C 230 1000 320 910 320 740 V 0 H 215 V 730 C 215 860 160 920 80 935 Z'
    }
};

export const DELIMITER_MAP: Record<string, keyof typeof DELIMITER_PATHS> = {
    '(': '(',
    ')': ')',
    '[': '[',
    ']': ']',
    '\\{': '\\{',
    '\\}': '\\}',
};

