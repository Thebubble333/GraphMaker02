
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import HomePage from './pages/Home';
import FunctionGrapher from './pages/FunctionGrapher';
import InequalityGrapher from './pages/InequalityGrapher';
import NumberLine from './pages/NumberLine';
import BoxPlots from './pages/BoxPlots';
import Histograms from './pages/Histograms';
import ScatterPlots from './pages/ScatterPlots';
import StemAndLeaf from './pages/StemAndLeaf';
import VisualQuartiles from './pages/VisualQuartiles';
import PieCharts from './pages/PieCharts';
import SegmentedBarCharts from './pages/SegmentedBarCharts';
import BoxBuilder from './pages/BoxBuilder';
import ShapeBuilder from './pages/ShapeBuilder';
import Calibration from './pages/developer/Calibration';
import TextCalibration from './pages/developer/TextCalibration';
import SurdTuningPage from './pages/developer/SurdTuningPage';
import { Page } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);

  const renderPage = () => {
    switch (currentPage) {
      case Page.Home:
        return <HomePage onNavigate={setCurrentPage} />;
      case Page.FunctionGrapher:
        return <FunctionGrapher />;
      case Page.InequalityGrapher:
        return <InequalityGrapher />;
      case Page.NumberLine:
        return <NumberLine />;
      case Page.BoxPlots:
        return <BoxPlots />;
      case Page.Histograms:
        return <Histograms />;
      case Page.ScatterPlots:
        return <ScatterPlots />;
      case Page.StemAndLeaf:
        return <StemAndLeaf />;
      case Page.VisualQuartiles:
        return <VisualQuartiles />;
      case Page.PieCharts:
        return <PieCharts />;
      case Page.SegmentedBars:
        return <SegmentedBarCharts />;
      case Page.BoxBuilder:
        return <BoxBuilder />;
      case Page.ShapeBuilder:
        return <ShapeBuilder />;
      case Page.DeveloperCalibration:
        return <Calibration />;
      case Page.TextCalibration:
        return <TextCalibration />;
      case Page.SurdTuning:
        return <SurdTuningPage />;
      default:
        return (
          <div className="p-8 text-center text-gray-500">
            <h2 className="text-2xl font-bold mb-4">{currentPage}</h2>
            <p>This tool is under construction in the React migration.</p>
            <button 
              onClick={() => setCurrentPage(Page.Home)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Home
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
