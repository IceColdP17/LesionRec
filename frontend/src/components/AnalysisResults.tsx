import { useMemo } from 'react';
import type { AnalysisResponse } from '../types';

interface Props {
    data: AnalysisResponse;
    onBack: () => void;
    onViewProducts: () => void;
}

interface DiagnosisData {
    characterization: string;
    severity: string;
    location: string;
    recommendation: string;
    treatments: string[];
    blemish_regions: Array<{
        type: string;
        x_min: number;
        y_min: number;
        x_max: number;
        y_max: number;
        confidence: number;
    }>;
}

export const AnalysisResults = ({ data, onBack, onViewProducts }: Props) => {
    // Parse the JSON string from the AI analysis
    const diagnosis = useMemo(() => {
        try {
            // The backend returns a JSON string inside the 'analysis' field
            return JSON.parse(data.ai_analysis.analysis) as DiagnosisData;
        } catch (e) {
            console.error("Failed to parse AI analysis JSON:", e);
            return null;
        }
    }, [data.ai_analysis.analysis]);

    if (!diagnosis) {
        return (
            <div className="p-8 text-center text-red-600">
                Error parsing analysis results. Please try again.
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-lg">
            <button onClick={onBack} className="mb-6 text-blue-600 hover:underline flex items-center font-medium">
                <span className="mr-2">←</span> Back to Dashboard
            </button>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left Column: Image & Visuals */}
                <div className="space-y-6">
                    <div className="flex justify-center">
                        <div className="relative inline-block rounded-xl overflow-hidden border-2 border-gray-100 shadow-md bg-gray-50">
                            <img 
                                src={data.s3_path} 
                                alt="Analyzed Skin" 
                                className="block max-w-full max-h-[600px] w-auto h-auto"
                                onError={(e) => {
                                    // Fallback if S3 link is broken (e.g. private bucket)
                                    e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Protected';
                                    e.currentTarget.alt = 'Image not accessible (Private Bucket)';
                                }}
                            />
                            
                            {/* Overlay Bounding Boxes */}
                            {diagnosis.blemish_regions.map((region, idx) => (
                                <div
                                    key={idx}
                                    className="absolute border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-help"
                                    style={{
                                        left: `${region.x_min * 100}%`,
                                        top: `${region.y_min * 100}%`,
                                        width: `${(region.x_max - region.x_min) * 100}%`,
                                        height: `${(region.y_max - region.y_min) * 100}%`,
                                    }}
                                    title={`${region.type} (${Math.round(region.confidence * 100)}%)`}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 flex items-start">
                        <span className="text-xl mr-3">🛡️</span>
                        <p>
                            Your privacy is protected. This image has been scrubbed of metadata. 
                            The red boxes indicate areas identified by our AI for analysis.
                        </p>
                    </div>
                </div>

                {/* Right Column: Structured Analysis */}
                <div className="space-y-8">
                    {/* Header Section */}
                    <div className="border-b pb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-3xl font-bold text-gray-900">Skin Analysis</h2>
                            <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${
                                diagnosis.severity.toLowerCase() === 'mild' ? 'bg-green-100 text-green-800' : 
                                diagnosis.severity.toLowerCase() === 'severe' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {diagnosis.severity} Severity
                            </span>
                        </div>
                        <p className="text-gray-500">AI-Powered Dermatological Assessment</p>
                    </div>

                    {/* Characterization */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-1 h-6 bg-blue-600 rounded-full mr-3"></span>
                            Observation
                        </h3>
                        <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                            {diagnosis.characterization}
                        </p>
                    </div>

                    {/* Location */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-1 h-6 bg-purple-600 rounded-full mr-3"></span>
                            Affected Areas
                        </h3>
                        <p className="text-gray-700">{diagnosis.location}</p>
                    </div>

                    {/* Treatments */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="w-1 h-6 bg-teal-600 rounded-full mr-3"></span>
                            Suggested Active Ingredients
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {diagnosis.treatments.map((t, i) => (
                                <span key={i} className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-md text-sm font-medium border border-teal-100 shadow-sm">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
                        <h3 className="text-lg font-semibold text-amber-900 mb-2">💡 Recommendation</h3>
                        <p className="text-amber-800 text-sm leading-relaxed">
                            {diagnosis.recommendation}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Call to Action */}
            <div className="mt-12 pt-8 border-t border-gray-200 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to treat your skin?</h3>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                    We've generated a personalized skincare routine based on this analysis. 
                    View your recommended products and customize your bundle based on your budget.
                </p>
                <button
                    onClick={onViewProducts}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105"
                >
                    View Recommended Products →
                </button>
            </div>
        </div>
    );
};

