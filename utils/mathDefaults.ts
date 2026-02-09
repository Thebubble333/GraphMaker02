
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
    DELIMITER_CAP_SCALE: 0.5, 
    
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
    fracNumShift: number;     // Ratio. Shift numerator UP from axis.
    fracDenShift: number;     // Ratio. Shift denominator DOWN from axis.
    fracGap: number;          // Ratio. Minimum vertical gap between content and bar.
    fracRuleThickness: number;// Ratio. Thickness of the fraction bar (defaults to ruleThickness usually).
    fracPadding: number;      // Ratio. Horizontal padding around fraction content (per side).
    
    // E. Radicals (Square Roots)
    sqrtGap: number;          // Ratio. Vertical clearance between content and vinculum (line).
    sqrtRuleThickness: number;// Ratio. Thickness of the root line.
    sqrtExtraHeight: number;  // Ratio. Extra height of the hook relative to content.
    
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
    sqrtVerticalShift: number;    // Ratio. How much the radical symbol itself is lowered.
}

// --- 3. Default Values (Tune these) ---

export const DEFAULT_MATH_METRICS: MathLayoutMetrics = {
    // A. Global
    axisHeight: 0.25,
    ruleThickness: 0.05,
    operatorShift: -0.075, 
    autoCenterOperators: true, // Forces symmetric spacing for + = etc.
    
    // B. Glue
    glueOrdBin: 0.115,
    glueBinOrd: 0.115,
    glueOrdRel: 0.25,
    glueRelOrd: 0.18,
    glueOrdPunct: 0.13, // e.g. after comma
    
    // C. Scripts
    supShift: 0.40,
    subShift: 0.25,
    supMinHeight: 0.35, // Ensure superscripts don't sit too low
    subDrop: 0.05,
    scriptScale: 0.70,
    
    // D. Fractions
    fracNumShift: 0.39,
    fracDenShift: 1.02,
    fracGap: 0.10,
    fracRuleThickness: 0.05, // Can match ruleThickness
    fracPadding: 0.1, // Approx 4px at 40px font
    
    // E. Radicals
    sqrtGap: 0.15, // Increased slightly for breathing room
    sqrtRuleThickness: 0.05,
    sqrtExtraHeight: 0.10,
    
    // F. Delimiters
    delimFactor: 0.90,
    
    // G. Advanced
    scriptScriptScale: 0.6,
    supSubGapMin: 0.2, // Prevents C_n^k collision
    scriptHorizontalGap: 0.05,
    
    // H. Refined Delimiters
    delimMaxShortfall: 0.1, // ~0.1em max gap
    italicCorrectionDefault: 0, // e.g., "f" usually leans
    
    // I. Radical Fine-Tuning
    sqrtVerticalShift: 0.2
};

// --- 4. Vector Paths (Do not edit unless changing font style) ---

export const DELIMITER_PATHS = {
    '(': {
        width: 560,
        top: 'M 560 0 L 530 0 C 370 0 250 350 250 1000 L 370 1000 C 370 420 450 110 560 110 Z',
        ext: 'M 250 0 H 370 V 1000 H 250 Z',
        bot: 'M 560 1000 L 530 1000 C 370 1000 250 650 250 0 L 370 0 C 370 580 450 890 560 890 Z'
    },
    ')': {
        width: 560, 
        top: 'M 0 0 L 30 0 C 190 0 310 350 310 1000 L 190 1000 C 190 420 110 110 0 110 Z',
        ext: 'M 190 0 H 310 V 1000 H 190 Z',
        bot: 'M 0 1000 L 30 1000 C 190 1000 310 650 310 0 L 190 0 C 190 580 110 890 0 890 Z'
    },
    '[': {
        width: 650,
        top: 'M 250 0 H 650 V 120 H 370 V 1000 H 250 Z',
        ext: 'M 250 0 H 370 V 1000 H 250 Z',
        bot: 'M 250 0 H 370 V 880 H 650 V 1000 H 250 Z'
    },
    ']': {
        width: 650,
        top: 'M 0 0 H 400 V 1000 H 280 V 120 H 0 Z',
        ext: 'M 280 0 H 400 V 1000 H 280 Z',
        bot: 'M 0 1000 H 400 V 0 H 280 V 880 H 0 Z'
    }
};

export const DELIMITER_MAP: Record<string, keyof typeof DELIMITER_PATHS> = {
    '(': '(',
    ')': ')',
    '[': '[',
    ']': ']',
    '\\{': '(', // Fallback
    '\\}': ')',
};
