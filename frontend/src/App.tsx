import { useState, useEffect } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { ImageUpload } from './components/ImageUpload';
import { AnalysisResults } from './components/AnalysisResults';
import { RecommendedProducts } from './components/RecommendedProducts';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Chatbot } from './components/Chatbot';
import type { AnalysisResponse } from './types';

type ViewState = 'dashboard' | 'upload' | 'results' | 'products' | 'chat' | 'analysis';
type TabState = 'dashboard' | 'analysis' | 'chat';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [activeTab, setActiveTab] = useState<TabState>('dashboard');
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    checkUser();
    
    // Load saved analysis from local storage
    const saved = localStorage.getItem('lesionrec_last_analysis');
    if (saved) {
      try {
        setAnalysisData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved analysis");
        localStorage.removeItem('lesionrec_last_analysis');
      }
    }
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setUser(null);
      setAnalysisData(null);
      localStorage.removeItem('lesionrec_last_analysis');
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  }

  const handleAnalysisComplete = (data: AnalysisResponse) => {
    setAnalysisData(data);
    localStorage.setItem('lesionrec_last_analysis', JSON.stringify(data));
    setCurrentView('results');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with user info and sign out */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Lumina</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setCurrentView('dashboard');
                }}
                className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => {
                  setActiveTab('analysis');
                  setCurrentView('upload');
                }}
                className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'analysis'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                🔍 Analysis
              </button>
              <button
                onClick={() => {
                  setActiveTab('chat');
                  setCurrentView('chat');
                }}
                className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'chat'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                🤖 AI Assistant
              </button>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && currentView === 'dashboard' && (
          <div className="max-w-6xl mx-auto px-6">
            <Dashboard 
              onStartAnalysis={() => {
                setActiveTab('analysis');
                setCurrentView('upload');
              }}
              onViewProducts={() => setCurrentView('products')}
              analysisData={analysisData}
            />
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (currentView === 'upload' || currentView === 'results') && (
          <div className="max-w-md mx-auto px-6">
            {currentView === 'upload' && (
              <>
                <button 
                  onClick={() => {
                    setActiveTab('dashboard');
                    setCurrentView('dashboard');
                  }}
                  className="mb-4 text-gray-500 hover:text-gray-700 flex items-center"
                >
                  ← Back to Dashboard
                </button>
                <ImageUpload 
                  userId={user.userId} 
                  onAnalysisComplete={handleAnalysisComplete} 
                />
              </>
            )}
            {currentView === 'results' && analysisData && (
              <AnalysisResults 
                data={analysisData} 
                onBack={() => {
                  setActiveTab('dashboard');
                  setCurrentView('dashboard');
                }} 
                onViewProducts={() => setCurrentView('products')}
              />
            )}
          </div>
        )}

        {/* Products View */}
        {currentView === 'products' && analysisData && (
          <div className="max-w-6xl mx-auto px-6">
            <RecommendedProducts 
              data={analysisData} 
              onBack={() => setCurrentView('results')} 
            />
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && currentView === 'chat' && (
          <Chatbot userId={user.userId} />
        )}
      </div>
    </div>
  );
}

export default App;
