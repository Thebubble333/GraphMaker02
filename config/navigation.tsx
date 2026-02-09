
import React from 'react';
import { Page } from '../types';
import { 
    Activity, PenTool, Hash, BarChart2, GitMerge, Shapes, Home, LayoutTemplate, ScatterChart, CircleDot, PieChart, Layers, Wrench, Type, Radical, Square, FileCode
} from 'lucide-react';

export interface NavItem {
    page: Page;
    label: string;
    icon: React.ReactNode;
    description: string;
    colorClass: string; // e.g. "bg-blue-50 text-blue-600"
}

export const NAV_GROUPS = [
    {
        title: "Main",
        items: [
            { 
                page: Page.Home, 
                label: "Home", 
                icon: <Home size={18} />, 
                description: "Dashboard",
                colorClass: "bg-gray-100 text-gray-700"
            }
        ]
    },
    {
        title: "Functions & Geometry",
        items: [
            { 
                page: Page.FunctionGrapher, 
                label: "Function Grapher", 
                icon: <Activity size={18} />, 
                description: "Plot y=f(x) functions with intercepts, stationary points, and custom domains.",
                colorClass: "bg-blue-50 text-blue-600"
            },
            { 
                page: Page.InequalityGrapher, 
                label: "Inequality Grapher", 
                icon: <PenTool size={18} />, 
                description: "Shade regions for inequalities like y < 2x + 1 or linear programming.",
                colorClass: "bg-purple-50 text-purple-600"
            },
            { 
                page: Page.NumberLine, 
                label: "Number Line", 
                icon: <Hash size={18} />, 
                description: "Visualize intervals, inequalities, and sets on a single axis.",
                colorClass: "bg-green-50 text-green-600"
            },
            { 
                page: Page.ShapeBuilder, 
                label: "Shape Builder", 
                icon: <Shapes size={18} />, 
                description: "Construct 2D geometric shapes and polygons.",
                colorClass: "bg-pink-50 text-pink-600"
            }
        ]
    },
    {
        title: "Statistics",
        items: [
            { 
                page: Page.SegmentedBars, 
                label: "Segmented Bars", 
                icon: <Layers size={18} />, 
                description: "Create stacked bar charts with patterns and comparison features.",
                colorClass: "bg-cyan-50 text-cyan-600"
            },
            { 
                page: Page.PieCharts, 
                label: "Pie Charts", 
                icon: <PieChart size={18} />, 
                description: "Create standard or donut charts with exploded slices and smart labeling.",
                colorClass: "bg-amber-50 text-amber-600"
            },
            { 
                page: Page.BoxPlots, 
                label: "Box Plots", 
                icon: <BarChart2 size={18} className="rotate-90" />, 
                description: "Compare data distributions with standard box-and-whisker plots.",
                colorClass: "bg-orange-50 text-orange-600"
            },
            { 
                page: Page.Histograms, 
                label: "Histograms", 
                icon: <BarChart2 size={18} />, 
                description: "Visualize frequency distributions with customizable bins.",
                colorClass: "bg-red-50 text-red-600"
            },
            { 
                page: Page.ScatterPlots, 
                label: "Scatter Plots", 
                icon: <ScatterChart size={18} />, 
                description: "Plot data points, regression lines, and residuals.",
                colorClass: "bg-teal-50 text-teal-600"
            },
            { 
                page: Page.StemAndLeaf, 
                label: "Stem & Leaf", 
                icon: <GitMerge size={18} className="rotate-90" />, 
                description: "Organize data into stems and leaves, including back-to-back plots.",
                colorClass: "bg-indigo-50 text-indigo-600"
            },
            { 
                page: Page.VisualQuartiles, 
                label: "Visual Quartiles", 
                icon: <CircleDot size={18} />, 
                description: "Visualize Q1, Median, and Q3 location with circles and lines.",
                colorClass: "bg-rose-50 text-rose-600"
            }
        ]
    },
    {
        title: "Exams & Layout",
        items: [
            {
                page: Page.BoxBuilder,
                label: "Box Builder",
                icon: <Square size={18} />,
                description: "Create fill-in-the-blank equations, matrices, and amortization tables.",
                colorClass: "bg-slate-50 text-slate-600"
            }
        ]
    },
    {
        title: "Developer",
        items: [
            {
                page: Page.DeveloperCalibration,
                label: "Global Calibration",
                icon: <Wrench size={18} />,
                description: "Fine-tune global defaults, margins, and rendering constants.",
                colorClass: "bg-gray-800 text-white"
            },
            {
                page: Page.TextCalibration,
                label: "Text Rendering Tuning",
                icon: <Type size={18} />,
                description: "Pixel-perfect calibration for mathematical typesetting.",
                colorClass: "bg-gray-800 text-white"
            },
            {
                page: Page.SurdTuning,
                label: "Surd Generator",
                icon: <Radical size={18} />,
                description: "Fine-tune Bézier curves for the square root symbol.",
                colorClass: "bg-gray-800 text-white"
            }
        ]
    }
];

export const getPageMetadata = (page: Page): NavItem | undefined => {
    for (const group of NAV_GROUPS) {
        const item = group.items.find(i => i.page === page);
        if (item) return item;
    }
    return undefined;
};
