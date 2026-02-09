
/*
 * -----------------------------------------------------------------------------
 * Table & Matrix Defaults
 * Configuration for the layout and rendering of \table and \matrix elements.
 * -----------------------------------------------------------------------------
 */

export const TABLE_DEFAULTS = {
    // Spacing (multipliers of fontSize)
    colGapRatio: 1.0,      // Horizontal space between columns
    rowGapRatio: 0.5,      // Vertical space between rows
    
    // Min cell dimensions (multipliers of fontSize)
    minRowAscentRatio: 0.7,
    minRowDescentRatio: 0.3,

    // Rendering
    borderWidth: 1.5,
    gridWidth: 1.0,
    borderColor: 'black',
    
    // Box Builder specifics
    defaultTableRows: 3,
    defaultTableCols: 3,
    defaultMatrixRows: 2,
    defaultMatrixCols: 2
};
