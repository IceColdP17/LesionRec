import { useState, useEffect } from 'react';

interface DailyLog {
    date: string;
    completed: boolean;
    notes?: string;
    skinCondition?: string;
    mood?: string;
}

interface DashboardStats {
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    logs: DailyLog[];
}

interface Props {
    onStartAnalysis: () => void;
    onViewProducts: () => void;
    analysisData: any;
}

export const Dashboard: React.FC<Props> = ({ onStartAnalysis, onViewProducts, analysisData }) => {
    const [stats, setStats] = useState<DashboardStats>({
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
        logs: [],
    });
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [diaryNote, setDiaryNote] = useState<string>('');
    const [skinCondition, setSkinCondition] = useState<string>('normal');
    const [mood, setMood] = useState<string>('good');
    const [showDiaryModal, setShowDiaryModal] = useState(false);

    // Load stats from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('lesionrec_dashboard_stats');
        if (saved) {
            try {
                setStats(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse dashboard stats");
            }
        }
    }, []);

    // Save stats to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('lesionrec_dashboard_stats', JSON.stringify(stats));
    }, [stats]);

    const loadDiaryForDate = (date: string) => {
        const log = stats.logs.find(log => log.date === date);
        if (log) {
            setDiaryNote(log.notes || '');
            setSkinCondition(log.skinCondition || 'normal');
            setMood(log.mood || 'good');
        } else {
            setDiaryNote('');
            setSkinCondition('normal');
            setMood('good');
        }
    };

    const saveDiary = () => {
        const newStats = { ...stats };
        let log = newStats.logs.find(l => l.date === selectedDate);
        
        if (!log) {
            log = { date: selectedDate, completed: false };
            newStats.logs.push(log);
        }
        
        log.notes = diaryNote;
        log.skinCondition = skinCondition;
        log.mood = mood;
        
        calculateStreaks(newStats);
        setStats(newStats);
        setShowDiaryModal(false);
    };

    const calculateStreaks = (dashboardStats: DashboardStats) => {
        const sortedLogs = [...dashboardStats.logs]
            .filter(log => log.completed)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (sortedLogs.length === 0) {
            dashboardStats.currentStreak = 0;
            dashboardStats.longestStreak = 0;
            dashboardStats.totalDays = 0;
            return;
        }

        dashboardStats.totalDays = sortedLogs.length;

        let currentStreak = 0;
        const today = new Date();
        let checkDate = new Date(today);

        for (let i = 0; i < 365; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const hasLog = sortedLogs.some(log => log.date === dateStr);

            if (hasLog) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        dashboardStats.currentStreak = currentStreak;

        let longestStreak = 0;
        let tempStreak = 1;
        for (let i = 1; i < sortedLogs.length; i++) {
            const prevDate = new Date(sortedLogs[i - 1].date);
            const currDate = new Date(sortedLogs[i].date);
            const diffTime = Math.abs(prevDate.getTime() - currDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        dashboardStats.longestStreak = longestStreak;
    };

    // Generate week days
    const getWeekDays = () => {
        const today = new Date();
        const currentDay = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const log = stats.logs.find(log => log.date === dateStr);
            const dayName = date.toLocaleString('default', { weekday: 'short' });
            
            days.push({
                date: date.getDate(),
                dateStr,
                dayName,
                completed: log?.completed || false,
                log: log,
                isToday: dateStr === today.toISOString().split('T')[0],
            });
        }
        return days;
    };

    const weekDays = getWeekDays();
    const weekStartDate = weekDays[0].dateStr;
    const weekEndDate = weekDays[6].dateStr;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold text-gray-800">Skin Health Dashboard</h1>
                <p className="text-gray-600">Track your daily skincare routine and monitor your skin</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-sm font-medium opacity-90">🔥 Current Streak</div>
                    <div className="text-4xl font-bold mt-2">{stats.currentStreak}</div>
                    <div className="text-xs opacity-75 mt-2">days in a row</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-sm font-medium opacity-90">🏆 Longest Streak</div>
                    <div className="text-4xl font-bold mt-2">{stats.longestStreak}</div>
                    <div className="text-xs opacity-75 mt-2">personal best</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-sm font-medium opacity-90">📝 Total Days</div>
                    <div className="text-4xl font-bold mt-2">{stats.totalDays}</div>
                    <div className="text-xs opacity-75 mt-2">logged</div>
                </div>

                <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-6 rounded-xl shadow-lg">
                    <div className="text-sm font-medium opacity-90">📈 Completion</div>
                    <div className="text-4xl font-bold mt-2">
                        {stats.totalDays > 0 ? Math.round((stats.currentStreak / Math.max(stats.currentStreak, 30)) * 100) : 0}%
                    </div>
                    <div className="text-xs opacity-75 mt-2">this month</div>
                </div>
            </div>

            {/* Week View */}
            <div className="bg-white p-8 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">This Week</h2>
                    <p className="text-sm text-gray-500">{weekStartDate} to {weekEndDate}</p>
                </div>
                
                <div className="grid grid-cols-7 gap-3 mb-6">
                    {weekDays.map((day) => (
                        <div key={day.dateStr} className="text-center">
                            <div className="text-xs font-semibold text-gray-600 mb-2">{day.dayName}</div>
                            <button
                                onClick={() => {
                                    loadDiaryForDate(day.dateStr);
                                    setSelectedDate(day.dateStr);
                                    setShowDiaryModal(true);
                                }}
                                className={`w-full aspect-square rounded-lg font-bold text-sm transition-all transform hover:scale-110 ${
                                    day.completed
                                        ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                                        : day.isToday
                                        ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900 border-2 border-blue-400'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                title={`${day.date} - Click to add diary entry`}
                            >
                                {day.completed && <span className="text-xl">✓</span>}
                                {!day.completed && day.date}
                                {day.isToday && !day.completed && <span className="text-xs block">Today</span>}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Diary & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Latest Diary Entry */}
                <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">📔 Latest Diary Entry</h2>
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-6 rounded-lg border border-amber-200">
                        {stats.logs.length > 0 ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    <strong>Date:</strong> {stats.logs[stats.logs.length - 1].date}
                                </p>
                                <p className="text-gray-700">
                                    {stats.logs[stats.logs.length - 1].notes || 'No diary entry yet. Click a day to add one!'}
                                </p>
                                {stats.logs[stats.logs.length - 1].skinCondition && (
                                    <div className="flex gap-4 text-sm">
                                        <p><strong>Skin:</strong> {stats.logs[stats.logs.length - 1].skinCondition}</p>
                                        <p><strong>Mood:</strong> {stats.logs[stats.logs.length - 1].mood}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">No diary entries yet. Start by clicking a day above!</p>
                        )}
                    </div>
                </div>

                {/* Insights */}
                <div className="bg-white p-8 rounded-xl shadow-lg space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800">📊 Insights</h2>
                    
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                        <p className="text-sm text-indigo-900 font-semibold">This Week</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">
                            {weekDays.filter(d => d.completed).length} / 7
                        </p>
                        <p className="text-xs text-indigo-800 mt-1">days completed</p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-50 to-pink-100 p-4 rounded-lg border border-rose-200">
                        <p className="text-sm text-rose-900 font-semibold">Monthly Goal</p>
                        <div className="w-full bg-rose-200 rounded-full h-2 mt-2">
                            <div 
                                className="bg-rose-500 h-2 rounded-full" 
                                style={{width: `${Math.min((stats.totalDays / 30) * 100, 100)}%`}}
                            />
                        </div>
                        <p className="text-xs text-rose-800 mt-2">{Math.min((stats.totalDays / 30) * 100, 100).toFixed(0)}% of goal</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                    onClick={onStartAnalysis}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all transform hover:scale-105"
                >
                    🔍 Start New Analysis
                </button>

                {analysisData && (
                    <button
                        onClick={onViewProducts}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg transition-all transform hover:scale-105"
                    >
                        🛍️ View Recommended Products
                    </button>
                )}
            </div>

            {/* Diary Modal */}
            {showDiaryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-2xl font-bold text-gray-800">Add Diary Entry</h3>
                        <p className="text-sm text-gray-600">Date: {selectedDate}</p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-semibold text-gray-700">How's your skin today?</label>
                                <select
                                    value={skinCondition}
                                    onChange={(e) => setSkinCondition(e.target.value)}
                                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="clear">Clear & Healthy ✨</option>
                                    <option value="normal">Normal 👍</option>
                                    <option value="dry">Dry 🏜️</option>
                                    <option value="oily">Oily 💧</option>
                                    <option value="sensitive">Sensitive 😣</option>
                                    <option value="irritated">Irritated 😞</option>
                                    <option value="breakout">Breakout 🚨</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700">Your mood?</label>
                                <select
                                    value={mood}
                                    onChange={(e) => setMood(e.target.value)}
                                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="great">Great 😄</option>
                                    <option value="good">Good 😊</option>
                                    <option value="okay">Okay 😐</option>
                                    <option value="stressed">Stressed 😰</option>
                                    <option value="tired">Tired 😴</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700">Notes</label>
                                <textarea
                                    value={diaryNote}
                                    onChange={(e) => setDiaryNote(e.target.value)}
                                    placeholder="What did you do today? How did your skin react?"
                                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setShowDiaryModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveDiary}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                            >
                                Save Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
