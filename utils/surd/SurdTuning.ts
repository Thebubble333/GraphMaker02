
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
    upstrokeAngle: { start: -64.3, end: -75.0, lockHeight: 65.0, easing: 'quadratic', easingPower: 2 },
    downstrokeAngle: { start: -115.0, end: -112.0, lockHeight: 65.0, easing: 'linear', easingPower: 2 },
    downstrokeHeightRatio: { start: 0.45, end: 0.40, lockHeight: 65.0, easing: 'linear', easingPower: 2 },
    hookRotation: { start: 0.0, end: -5.0, lockHeight: 65.0, easing: 'linear', easingPower: 2 },
    hookLengthScale: { start: 1.00, end: 1.22, lockHeight: 65.0, easing: 'linear', easingPower: 2 }
};

