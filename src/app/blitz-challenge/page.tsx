import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import useUser from "@/shared/hooks/useUser";
import { Users, Play, Search } from "lucide-react";
import { api } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";
import type { DbDeck } from "@/types/api.types";

function BlitzChallengePage() {
  const { data: user } = useUser();
  const [challengeCode, setChallengeCode] = useState("");
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Auth handled by withAuth HOC

  useEffect(() => {
    if (user) {
      fetchDecks();
    }
  }, [user, searchQuery]);

  const fetchDecks = async () => {
    try {
      const params: { search?: string; filter?: "all" | "owned" | "assigned" | "public" } = { 
        filter: 'owned' as const 
      };
      if (searchQuery) params.search = searchQuery;

      const decksData = await api.decks.list(params);
      setDecks(decksData);
    } catch (error) {
      console.error("Error fetching decks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const code = challengeCode.trim().toUpperCase();
      if (!code) {
        setMessage("Enter a challenge code");
        return;
      }
      await api.playSessions.join(code, user?.display_name || user?.email || 'Guest');
      window.location.href = `/blitz-challenge/session/${code}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error joining challenge");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Blitz Challenge
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Join a challenge or create your own to compete with others
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Section A: Join a Blitz Challenge */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Users className="text-purple-600 dark:text-purple-400" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Join a Blitz Challenge
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Enter the code provided by your teacher or host
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinChallenge} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Challenge Code
              </label>
              <input
                type="text"
                value={challengeCode}
                onChange={(e) =>
                  setChallengeCode(e.target.value.toUpperCase())
                }
                placeholder="ABC123"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl
                  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-mono uppercase"
                maxLength={6}
              />
            </div>

            {message && (
              <div className="text-sm text-red-600 dark:text-red-400">{message}</div>
            )}

            <button
              type="submit"
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 font-semibold transition-colors"
            >
              Join
            </button>
          </form>

          <div className="mt-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>How it works:</strong> Your teacher or challenge host
              will provide you with a 6-character code to join their live
              challenge.
            </p>
          </div>
        </div>

        {/* Section B: Create a Blitz Challenge */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Play className="text-green-600 dark:text-green-400" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Create a Blitz Challenge
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Choose a set to start a challenge
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search your sets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl
                bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Sets List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {decks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No sets found</p>
                <Link
                  to="/admin/create-set"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-medium"
                >
                  Create Your First Set
                </Link>
              </div>
            ) : (
              decks.map((deck) => (
                <div
                  key={deck.id}
                  className="border rounded-xl p-4 hover:shadow-md transition-all bg-white dark:bg-gray-800
                    border-gray-200 dark:border-gray-700"
                  style={{
                    borderLeftWidth: "5px",
                    borderLeftColor: deck.primary_color_hex || "#10A5C3",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {deck.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {deck.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {deck.card_count || 0} cards
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/blitz-challenge/create/${deck.id}`}
                    className="block w-full mt-3 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-center font-medium transition-colors"
                  >
                    Create Challenge
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(BlitzChallengePage);
