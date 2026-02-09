
import { SurdTuning, DEFAULT_TUNING, InterpolationParam } from './SurdTuning';

export interface SurdMetrics {
    bearingX: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    advanceWidth: number;
    ascent: number;
    descent: number;
    hookMinX: number;
    slantWidth: number; // Horizontal distance of the upstroke (P11.x - P10.x)
}

export interface SurdResult {
    pathData: string;
    vinculum: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    metrics: SurdMetrics;
    // The full array of transformed points: [InX, InY, AncX, AncY, OutX, OutY, ...] per node
    // This is exposed specifically for the Diagnostics module.
    rawPoints: Float32Array; 
}

export class SurdGenerator {
    // =========================================================================
    // 1. CONSTANTS & CALIBRATION
    // =========================================================================
    private readonly BASE_HEIGHT: number;
    
    // Pre-calculated geometric constants
    private readonly rightLenBase: number;
    private readonly leftLenBase: number;
    private readonly angleRightBase: number;
    private readonly angleLeftBase: number;
  
    // The flat data array: [ h_in_x, h_in_y, anchor_x, anchor_y, h_out_x, h_out_y, ... ]
    private readonly basePoints: Float32Array;
  
    // Groups indices for transforms
    private readonly c1Indices: number[]; // Left Arm
    private readonly c2Indices: number[]; // Right Arm
    private readonly hookIndices: number[];
  
    constructor() {
      // -----------------------------------------------------------------------
      // 2. DATA INITIALIZATION
      // -----------------------------------------------------------------------
      const rawNodes = [
          // Node 0
          0.17, 0.00,   0.00, 0.00,   -0.10, 0.00,
          // Node 1
          -0.15, 0.00,  -0.23, -0.18, -0.23, -0.18,
          // Node 2
          -2.38, -4.90, -2.38, -4.90, -2.51, -4.82,
          // Node 3
          -2.66, -4.70, -2.73, -4.64, -2.85, -4.55,
          // Node 4
          -3.03, -4.40, -3.10, -4.40, -3.17, -4.40,
          // Node 5
          -3.21, -4.52, -3.21, -4.52, -3.21, -4.55,
          // Node 6
          -3.21, -4.58, -3.07, -4.70, -3.07, -4.70,
          // Node 7
          -2.03, -5.48, -2.03, -5.48, -1.91, -5.57,
          // Node 8
          -1.86, -5.57, -1.85, -5.57, -1.82, -5.57,
          // Node 9 (Pivot)
          -1.76, -5.57, -1.69, -5.39, -1.69, -5.39,
          // Node 10 (Elbow)
          0.24, -1.15,  0.24, -1.15,  0.24, -1.15,
          // Node 11 (Peak)
          4.83, -10.69, 4.83, -10.69, 4.92, -10.86,
          // Node 12
          4.99, -10.91, 5.09, -10.91, 5.22, -10.91,
          // Node 13
          5.22, -10.91, 5.30, -10.70, 5.30, -10.68,
          // Node 14
          5.30, -10.63, 5.23, -10.48, 5.23, -10.48,
          // Node 15
          0.27, -0.22,  0.27, -0.22,  0.19, -0.07,
      ];
      this.basePoints = new Float32Array(rawNodes);
  
      // Initialize Indices Groups
      // C1: Nodes 1-9
      this.c1Indices = [];
      for(let n=1; n<=9; n++) {
          const start = n * 3;
          this.c1Indices.push(start, start+1, start+2);
      }
  
      // C2: Nodes 11-15
      this.c2Indices = [];
      for(let n=11; n<=15; n++) {
          const start = n * 3;
          this.c2Indices.push(start, start+1, start+2);
      }
  
      // Hook: Nodes 2-8
      this.hookIndices = [];
      for(let n=2; n<=8; n++) {
          const start = n * 3;
          this.hookIndices.push(start, start+1, start+2);
      }
  
      // -----------------------------------------------------------------------
      // 3. PRE-CALCULATE GEOMETRY CONSTANTS
      // -----------------------------------------------------------------------
      const getP = (node: number, type: 0|1|2) => { // 0=in, 1=anchor, 2=out
          const idx = (node * 3 + type) * 2;
          return { x: this.basePoints[idx], y: this.basePoints[idx+1] };
      }
  
      const p8 = getP(8, 1);
      const p10 = getP(10, 1);
      const p11 = getP(11, 1);
  
      // Right Vector (P11 - P10)
      const dxR = p11.x - p10.x;
      const dyR = p11.y - p10.y;
      this.rightLenBase = Math.sqrt(dxR*dxR + dyR*dyR);
      this.angleRightBase = Math.atan2(dyR, dxR);
  
      // Left Tip Vector (P8 - P10) - *Note: P8 relative to P10*
      const dxL = p8.x - p10.x;
      const dyL = p8.y - p10.y;
      this.leftLenBase = Math.sqrt(dxL*dxL + dyL*dyL);
      this.angleLeftBase = Math.atan2(dyL, dxL);
  
      // Base Height
      this.BASE_HEIGHT = Math.abs(p11.y - p10.y);
    }
  
    // =========================================================================
    // 4. MAIN GENERATOR FUNCTION
    // =========================================================================
    public generatePath(
        targetWidth: number, 
        targetHeight: number, 
        paddingLeft = 0.0, 
        paddingRight = 0.0, 
        paddingTop = 0.0, 
        paddingBottom = 0.0,
        tuning: SurdTuning = DEFAULT_TUNING
    ): SurdResult {
  
      // --- A. SOLVER LOGIC ---
      const finalVWidth = targetWidth + paddingLeft + paddingRight;
      let desiredTotalRise = targetHeight + paddingTop + paddingBottom;
  
      // 1. Clamp Minimum Height
      if (desiredTotalRise < this.BASE_HEIGHT) {
          desiredTotalRise = this.BASE_HEIGHT;
      }

      // Helper for interpolation based on height
      const getParamValue = (param: InterpolationParam) => {
          let deltaH = desiredTotalRise - this.BASE_HEIGHT;
          let lockDelta = param.lockHeight - this.BASE_HEIGHT;
          if (lockDelta < 0.1) lockDelta = 0.1; // prevent div/0
          
          let t = deltaH / lockDelta;
          if (t < 0) t = 0;
          if (t > 1) t = 1;
          
          // Easing logic
          if (param.easing === 'quadratic') {
              // Generalized EaseOut: 1 - (1-t)^p
              const p = param.easingPower || 2;
              t = 1 - Math.pow(1 - t, p);
          }
          
          return param.start + (param.end - param.start) * t;
      };

      // 2. Calculate Current Values from Tuning
      const currentUpstrokeAngleDeg = getParamValue(tuning.upstrokeAngle);
      const currentDownstrokeAngleDeg = getParamValue(tuning.downstrokeAngle);
      const currentHeightRatio = getParamValue(tuning.downstrokeHeightRatio);
      const currentHookRotDeg = getParamValue(tuning.hookRotation);
      const currentHookScale = getParamValue(tuning.hookLengthScale);

      // 3. Solve Right Arm (Upstroke)
      const startAngleR = this.angleRightBase;
      const targetAngleR = currentUpstrokeAngleDeg * (Math.PI / 180.0);
      
      const currentRotR = targetAngleR - startAngleR;
  
      let ascentRatioR = Math.abs(Math.sin(targetAngleR));
      if (ascentRatioR < 0.1) ascentRatioR = 0.1;
  
      const reqLenR = desiredTotalRise / ascentRatioR;
      const sC2 = reqLenR - this.rightLenBase; 
  
      // 4. Solve Left Arm (Downstroke)
      const hRatioParams = tuning.downstrokeHeightRatio;
      let targetLeftRise: number;

      if (desiredTotalRise >= hRatioParams.lockHeight) {
          targetLeftRise = hRatioParams.lockHeight * hRatioParams.end;
      } else {
          targetLeftRise = desiredTotalRise * currentHeightRatio;
      }

      const startAngleL = this.angleLeftBase;
      const targetAngleL = currentDownstrokeAngleDeg * (Math.PI / 180.0);
      
      let ascentRatioL = Math.abs(Math.sin(targetAngleL));
      if (ascentRatioL < 0.1) ascentRatioL = 0.1;

      const reqLenL = targetLeftRise / ascentRatioL;
      const sC1 = reqLenL - this.leftLenBase;
      const rotL = targetAngleL - startAngleL;
  
      // 5. Solve Hook
      const targetHookRotRad = currentHookRotDeg * (Math.PI / 180.0);
      const compensationAngle = targetHookRotRad - rotL;
  
      // --- B. GEOMETRY TRANSFORMATION (Unrolled for speed) ---
      const points = new Float32Array(this.basePoints);
      
      const idxP9 = 9*3+1;
      const idxP10 = 10*3+1;
      const idxP11 = 11*3+1;

      // Pivot Point (P9)
      const p9BaseX = points[idxP9*2];
      const p9BaseY = points[idxP9*2+1];

      // 0. Apply Hook Scale (Directional Stretch)
      if (Math.abs(currentHookScale - 1.0) > 0.001) {
          const idxP5_anc = 5*3+1;
          const p5BaseX = points[idxP5_anc*2];
          const p5BaseY = points[idxP5_anc*2+1];

          let axisX = p5BaseX - p9BaseX;
          let axisY = p5BaseY - p9BaseY;
          const len = Math.sqrt(axisX*axisX + axisY*axisY);

          if (len > 0.0001) {
              axisX /= len;
              axisY /= len;

              for(let i=0; i<this.hookIndices.length; i++) {
                  const idx = this.hookIndices[i];
                  const px = points[idx*2];
                  const py = points[idx*2+1];
                  
                  const vX = px - p9BaseX;
                  const vY = py - p9BaseY;
                  
                  const dot = vX * axisX + vY * axisY;
                  const perpX = vX - dot * axisX;
                  const perpY = vY - dot * axisY;
                  
                  const scaledDot = dot * currentHookScale;
                  
                  points[idx*2] = p9BaseX + (scaledDot * axisX) + perpX;
                  points[idx*2+1] = p9BaseY + (scaledDot * axisY) + perpY;
              }
          }
      }
  
      const rotate = (idx: number, pivotX: number, pivotY: number, angle: number) => {
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const px = points[idx*2];
          const py = points[idx*2+1];
          points[idx*2] = pivotX + (px - pivotX)*c - (py - pivotY)*s;
          points[idx*2+1] = pivotY + (px - pivotX)*s + (py - pivotY)*c;
      };
  
      let vLx = points[idxP9*2] - points[idxP10*2];
      let vLy = points[idxP9*2+1] - points[idxP10*2+1];
      const lenL = Math.sqrt(vLx*vLx + vLy*vLy);
      vLx /= lenL; vLy /= lenL;
  
      let vRx = points[idxP11*2] - points[idxP10*2];
      let vRy = points[idxP11*2+1] - points[idxP10*2+1];
      const lenR = Math.sqrt(vRx*vRx + vRy*vRy);
      vRx /= lenR; vRy /= lenR;
  
      // 1. Stretch
      for(let n=2; n<=9; n++) {
          for(let k=0; k<3; k++) {
              const idx = n*3 + k;
              points[idx*2] += vLx * sC1;
              points[idx*2+1] += vLy * sC1;
          }
      }
  
      for(let n=11; n<=15; n++) {
          for(let k=0; k<3; k++) {
              const idx = n*3 + k;
              points[idx*2] += vRx * sC2;
              points[idx*2+1] += vRy * sC2;
          }
      }
  
      // 2. Rotate
      const pivot0X = points[(1*3+1)*2];
      const pivot0Y = points[(1*3+1)*2+1];
  
      for(let i=0; i<this.c1Indices.length; i++) {
          rotate(this.c1Indices[i], pivot0X, pivot0Y, rotL);
      }
      for(let i=0; i<this.c2Indices.length; i++) {
          rotate(this.c2Indices[i], pivot0X, pivot0Y, currentRotR);
      }
  
      // 3. Recalculate Vectors
      const cL = Math.cos(rotL), sL = Math.sin(rotL);
      const currVLx = vLx*cL - vLy*sL;
      const currVLy = vLx*sL + vLy*cL;
  
      const cR = Math.cos(currentRotR), sR = Math.sin(currentRotR);
      const currVRx = vRx*cR - vRy*sR;
      const currVRy = vRx*sR + vRy*cR;
  
      const p9x = points[idxP9*2], p9y = points[idxP9*2+1];
      const p11x = points[idxP11*2], p11y = points[idxP11*2+1];
  
      // 4. Elbow Fix
      const det = currVLx * (-currVRy) - currVLy * (-currVRx);
      let elbowX = points[idxP10*2], elbowY = points[idxP10*2+1];
  
      if (Math.abs(det) > 1e-6) {
          const dx = p11x - p9x;
          const dy = p11y - p9y;
          const t = (dx * (-currVRy) - dy * (-currVRx)) / det;
          elbowX = p9x + t * currVLx;
          elbowY = p9y + t * currVLy;
      }
  
      const delta10x = elbowX - points[idxP10*2];
      const delta10y = elbowY - points[idxP10*2+1];
  
      for(let k=0; k<3; k++) {
          const idx = 10*3 + k;
          points[idx*2] += delta10x;
          points[idx*2+1] += delta10y;
      }
  
      // 5. Hook Update
      const idxP1_anc = 1*3+1;
      const idxP2_anc = 2*3+1;
  
      const p1ax = points[idxP1_anc*2], p1ay = points[idxP1_anc*2+1];
      const p2ax = points[idxP2_anc*2], p2ay = points[idxP2_anc*2+1];
  
      const vecHookBaseX = p2ax - p9x;
      const vecHookBaseY = p2ay - p9y;
  
      const cComp = Math.cos(compensationAngle);
      const sComp = Math.sin(compensationAngle);
  
      const vecHookRotX = vecHookBaseX*cComp - vecHookBaseY*sComp;
      const vecHookRotY = vecHookBaseX*sComp + vecHookBaseY*cComp;
  
      const detH = currVLx * (-vecHookRotY) - currVLy * (-vecHookRotX);
      let targetP2x = p2ax, targetP2y = p2ay;
  
      if (Math.abs(detH) > 1e-6) {
          const dx = p9x - p1ax;
          const dy = p9y - p1ay;
          const t = (dx * (-vecHookRotY) - dy * (-vecHookRotX)) / detH;
          targetP2x = p1ax + t * currVLx;
          targetP2y = p1ay + t * currVLy;
      }
  
      for(let i=0; i<this.hookIndices.length; i++) {
          rotate(this.hookIndices[i], p9x, p9y, compensationAngle);
      }
  
      const p2RotX = points[idxP2_anc*2];
      const p2RotY = points[idxP2_anc*2+1];
      const deltaHx = targetP2x - p2RotX;
      const deltaHy = targetP2y - p2RotY;
  
      for(let k=0; k<3; k++) {
          const idx = 2*3 + k;
          points[idx*2] += deltaHx;
          points[idx*2+1] += deltaHy;
      }
  
      // 7. Bottom Polish
      const idxP15_anc = 15*3+1;
      const p15y = points[idxP15_anc*2+1];
      if (Math.abs(currVRy) > 1e-6) {
          const t = -p15y / currVRy;
          const idx47 = 47;
          points[idx47*2] = points[idxP15_anc*2] + t * currVRx;
          points[idx47*2+1] = 0.0;
      }
  
      const idx3 = 3;
      const idxP1 = 1*3+1;
      const p1y = points[idxP1*2+1];
      if (Math.abs(currVLy) > 1e-6) {
          const t = -p1y / currVLy;
          points[idx3*2] = points[idxP1*2] + t * currVLx;
          points[idx3*2+1] = 0.0;
      }

      // --- C. ALIGNMENT TO CONTENT BOX & METRICS ---
      
      const getPt = (idx: number) => ({ x: points[idx*2], y: points[idx*2+1] });
      const p11Anc = getPt(11*3+1);
      const p11Out = getPt(11*3+2);
      const p12In  = getPt(12*3+0);
      const p12Anc = getPt(12*3+1);

      const peakPt = this.getCubicBezierMinY(p11Anc, p11Out, p12In, p12Anc);

      const p14Anc = getPt(14*3+1);
      const dxThick = p11Anc.x - p14Anc.x;
      const dyThick = p11Anc.y - p14Anc.y;
      const thickness = Math.sqrt(dxThick*dxThick + dyThick*dyThick);

      const vinculumBottomY = peakPt.y + thickness;
      const targetVinculumBottomY = paddingBottom - desiredTotalRise;
      const shiftY = targetVinculumBottomY - vinculumBottomY;

      const vinculumStartX = peakPt.x;
      const targetVinculumStartX = -paddingLeft;
      const shiftX = targetVinculumStartX - vinculumStartX;

      // Apply Shifts
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let hookMinX = Infinity;

      for(let i=0; i<points.length; i+=2) {
          points[i] += shiftX;
          points[i+1] += shiftY;
          
          const x = points[i];
          const y = points[i+1];
          
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
      }
      
      for (let i = 0; i < this.hookIndices.length; i++) {
        const ptIdx = this.hookIndices[i];
        const x = points[ptIdx * 2];
        if (x < hookMinX) hookMinX = x;
      }
      
      // Calculate Slant Width (P11.x - P10.x)
      // Note: P10 and P11 are transformed. We access them via indices.
      const idx10 = 10 * 3 + 1; // P10 Anchor
      const idx11 = 11 * 3 + 1; // P11 Anchor
      const slantWidth = points[idx11 * 2] - points[idx10 * 2];

      // Generate SVG String
      let d = "";
      const numNodes = 16;
      for(let i=0; i<numNodes; i++) {
          const ancX = points[((i*3)+1)*2];
          const ancY = points[((i*3)+1)*2+1];
  
          if (i === 0) {
              d += `M ${ancX.toFixed(2)} ${ancY.toFixed(2)} `;
          } else {
              const prevOutIdx = ((i-1)*3 + 2);
              const currInIdx = (i*3);
  
              const cp1x = points[prevOutIdx*2], cp1y = points[prevOutIdx*2+1];
              const cp2x = points[currInIdx*2], cp2y = points[currInIdx*2+1];
  
              d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${ancX.toFixed(2)} ${ancY.toFixed(2)} `;
          }
      }
      
      // Close loop
      const lastOutIdx = (15*3 + 2);
      const firstInIdx = 0;
      const cp1x = points[lastOutIdx*2], cp1y = points[lastOutIdx*2+1];
      const cp2x = points[firstInIdx*2], cp2y = points[firstInIdx*2+1];
      const ancX = points[1*2], ancY = points[1*2+1];
  
      d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${ancX.toFixed(2)} ${ancY.toFixed(2)} Z`;
  
      return {
          pathData: d,
          rawPoints: points, // Exporting for Diagnostics
          vinculum: {
              x: peakPt.x + shiftX,
              y: peakPt.y + shiftY,
              width: finalVWidth,
              height: thickness
          },
          metrics: {
              hookMinX,
              bearingX: minX,
              minX,
              maxX,
              minY,
              maxY,
              advanceWidth: maxX - minX,
              ascent: -minY,
              descent: maxY,
              slantWidth
          }
      };
    }

    private getCubicBezierMinY(p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}): {x: number, y: number} {
        const y0 = p0.y, y1 = p1.y, y2 = p2.y, y3 = p3.y;
        const A = 3 * (-y0 + 3 * y1 - 3 * y2 + y3);
        const B = 6 * (y0 - 2 * y1 + y2);
        const C = 3 * (y1 - y0);
        
        const tValues = [0, 1];
        if (Math.abs(A) < 1e-9) {
            if (Math.abs(B) > 1e-9) {
                const t = -C / B;
                if (t > 0 && t < 1) tValues.push(t);
            }
        } else {
            const delta = B * B - 4 * A * C;
            if (delta >= 0) {
                const sqrtDelta = Math.sqrt(delta);
                const t1 = (-B + sqrtDelta) / (2 * A);
                const t2 = (-B - sqrtDelta) / (2 * A);
                if (t1 > 0 && t1 < 1) tValues.push(t1);
                if (t2 > 0 && t2 < 1) tValues.push(t2);
            }
        }
        
        let minY = Infinity;
        let bestPoint = p0;
        
        for (const t of tValues) {
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = t * t;
            const t3 = t2 * t;
            const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
            const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
            if (y < minY) {
                minY = y;
                bestPoint = {x, y};
            }
        }
        return bestPoint;
    }
}
