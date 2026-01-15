import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import AdPlaceholder from "@/shared/components/AdPlaceholder";
import WelcomeModal from "@/shared/components/WelcomeModal";
import { BookOpen, Zap, Search, Plus } from "lucide-react";
import useUser from "@/shared/hooks/useUser";
import type { DbDeck } from "@/types/api.types";
import { api } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";

function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useUser();
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [stats, setStats] = useState({
    cardsStudied: 0,
    accuracy: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("owned");
  const [showWelcome, setShowWelcome] = useState(false);

  // Auth is handled by withAuth HOC

  useEffect(() => {
    let mounted = true;
    
    if (!user) return;

    // Show welcome modal if user hasn't seen it yet
    if (!user.has_seen_welcome) {
      setShowWelcome(true);
    }

    // Debounce only for search queries, load immediately otherwise
    if (searchQuery) {
      const timeoutId = setTimeout(() => {
        if (mounted) {
          fetchData();
        }
      }, 300);
      
      return () => {
        mounted = false;
        clearTimeout(timeoutId);
      };
    } else {
      // Immediate load for initial render and filter changes
      fetchData();
      
      return () => {
        mounted = false;
      };
    }
  }, [filterMode, searchQuery, user]);

  const handleDismissWelcome = async () => {
    setShowWelcome(false);

    // Mark welcome as seen in the database
    try {
      await api.users.markWelcomeSeen();
    } catch (error) {
      console.error("Error marking welcome as seen:", error);
    }
  };

  const handleCreateFirstSet = async () => {
    await handleDismissWelcome();
    navigate("/admin/create-set");
  };

  const fetchData = useCallback(async () => {
    try {
      const params: { search?: string; filter?: "all" | "owned" | "assigned" | "public" } = {
        filter: filterMode as "all" | "owned" | "assigned" | "public"
      };
      if (searchQuery) params.search = searchQuery;

      const [decksData, statsData] = await Promise.all([
        api.decks.list(params),
        api.stats.get(),
      ]);

      setDecks(decksData);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [filterMode, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {showWelcome && (
        <WelcomeModal
          onDismiss={handleDismissWelcome}
          onCreateSet={handleCreateFirstSet}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Track your progress and continue learning
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cards Studied</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.cardsStudied}
                </p>
              </div>
              <BookOpen className="text-blue-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Accuracy</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.accuracy}%
                </p>
              </div>
              <Zap className="text-green-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Day Streak</p>
                <p className="text-3xl font-bold text-orange-600">
                  {stats.streak} 🔥
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <a
            href="/blitz-challenge"
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg shadow p-6 hover:from-purple-700 hover:to-purple-800 transition-all"
          >
            <h3 className="text-xl font-bold mb-2">Blitz Challenge</h3>
            <p className="text-purple-100">Join or create a live challenge</p>
          </a>

          <a
            href="/play/solo"
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow p-6 hover:from-green-700 hover:to-green-800 transition-all"
          >
            <h3 className="text-xl font-bold mb-2">Solo Blitz</h3>
            <p className="text-green-100">
              Test yourself with quizzes and voice
            </p>
          </a>
        </div>

        {/* Ad Placeholder */}
        <div className="mb-8">
          <AdPlaceholder />
        </div>

        {/* Set Browser */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Sets</h2>
            <a
              href="/admin/create-set"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <Plus size={20} />
              Create Set
            </a>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Botones My Sets y Assigned ocultos temporalmente */}
            <div className="hidden">
              <button
                onClick={() => setFilterMode("owned")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterMode === "owned"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                My Sets
              </button>
              <button
                onClick={() => setFilterMode("assigned")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterMode === "assigned"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Assigned
              </button>
            </div>
          </div>

          {/* Set List */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className="border-2 rounded-lg p-4 hover:shadow-md transition-all"
                style={{
                  borderLeftWidth: "6px",
                  borderLeftColor: deck.primary_color_hex || "#0EA5E9",
                }}
              >
                <h3 className="font-bold text-gray-900 mb-2">{deck.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{deck.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">
                    {deck.card_count || 0} cards
                  </span>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`/study?deck=${deck.id}`}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-center text-sm font-medium"
                  >
                    📚 Study
                  </a>
                  <a
                    href={`/admin/create-set?id=${deck.id}`}
                    className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 text-center text-sm font-medium"
                  >
                    Edit
                  </a>
                </div>
              </div>
            ))}

            {decks.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No sets found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with authentication protection
export default withAuth(DashboardPage);
