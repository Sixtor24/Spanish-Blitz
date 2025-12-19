
import { useState, useEffect } from "react";
import Navigation from "@/shared/components/Navigation";
import useUser from "@/shared/hooks/useUser";
import { ArrowLeft, Users, Play, Search } from "lucide-react";
import { api } from "@/config/api";
import type { DbDeck } from "@/types/api.types";

export default function BlitzChallengePage() {
  const { data: user, loading: userLoading } = useUser();
  const [challengeCode, setChallengeCode] = useState("");
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (user) {
      fetchDecks();
    }
  }, [user, searchQuery]);

  const fetchDecks = async () => {
    try {
      const params: { search?: string } = {};
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

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back to Dashboard */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </a>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Blitz Challenge
          </h1>
          <p className="text-gray-600">
            Join a challenge or create your own to compete with others
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Section A: Join a Blitz Challenge */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="text-purple-600" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Join a Blitz Challenge
                </h2>
                <p className="text-gray-600 text-sm">
                  Enter the code provided by your teacher or host
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinChallenge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Challenge Code
                </label>
                <input
                  type="text"
                  value={challengeCode}
                  onChange={(e) =>
                    setChallengeCode(e.target.value.toUpperCase())
                  }
                  placeholder="ABC123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-mono uppercase"
                  maxLength={6}
                />
              </div>

              {message && (
                <div className="text-sm text-red-600">{message}</div>
              )}

              <button
                type="submit"
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors"
              >
                Join
              </button>
            </form>

            <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>How it works:</strong> Your teacher or challenge host
                will provide you with a 6-character code to join their live
                challenge.
              </p>
            </div>
          </div>

          {/* Section B: Create a Blitz Challenge */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <Play className="text-green-600" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Create a Blitz Challenge
                </h2>
                <p className="text-gray-600 text-sm">
                  Choose a set to start a challenge
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search your sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Sets List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {decks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No sets found</p>
                  <a
                    href="/admin/create-set"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Create Your First Set
                  </a>
                </div>
              ) : (
                decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="border-2 rounded-lg p-4 hover:shadow-md transition-all"
                    style={{
                      borderLeftWidth: "6px",
                      borderLeftColor: deck.primary_color_hex || "#0EA5E9",
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          {deck.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {deck.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {deck.card_count || 0} cards
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/blitz-challenge/create/${deck.id}`}
                      className="block w-full mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-center font-medium transition-colors"
                    >
                      Create Challenge
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
