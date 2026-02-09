
export interface InterpolationParam {
    start: number;
    end: number;
    lockHeight: number;
    easing?: 'linear' | 'quadratic'; // 'quadratic' = EaseOut (fast start)
    easingPower?: number; // Exponent for the easing function (default 2)
}

export interface SurdTuning {
    // Right Arm (Upstroke)
    upstrokeAngle: InterpolationParam; 
    
    // Left Arm (Downstroke)
    downstrokeAngle: InterpolationParam;
    downstrokeHeightRatio: InterpolationParam;

    // Hook
    hookRotation: InterpolationParam;
    hookLengthScale: InterpolationParam;
}

export const DEFAULT_TUNING: SurdTuning = {
    upstrokeAngle: { start: -63.0, end: -90.0, lockHeight: 41.0, easing: 'quadratic', easingPower: 3 },
    downstrokeAngle: { start: -116.0, end: -110.0, lockHeight: 41.0, easing: 'linear', easingPower: 2 },
    downstrokeHeightRatio: { start: 0.47, end: 0.43, lockHeight: 41.0, easing: 'linear', easingPower: 2 },
    hookRotation: { start: 0.0, end: -27.0, lockHeight: 41.0, easing: 'linear', easingPower: 2 },
    hookLengthScale: { start: 1.08, end: 1.87, lockHeight: 41.0, easing: 'linear', easingPower: 2 }
};
