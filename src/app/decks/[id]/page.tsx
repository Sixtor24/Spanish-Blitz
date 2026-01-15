import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import { Plus, X, BookOpen } from "lucide-react";
import { api } from "@/config/api";
import type { DbDeck, DbCard } from "@/types/api.types";

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deckId = id!;

  const [deck, setDeck] = useState<DbDeck | null>(null);
  const [cards, setCards] = useState<DbCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [activeTab, setActiveTab] = useState("add-one");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [formError, setFormError] = useState("");

  const [cardForm, setCardForm] = useState({
    prompt_es: "",
    answer_es: "",
    translation_en: "",
  });

  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    if (deckId) {
      fetchDeck();
      fetchCards();
    }
  }, [deckId]);

  const fetchDeck = async () => {
    try {
      const deckData = await api.decks.get(deckId);
      setDeck(deckData);
    } catch (error) {
      console.error("Error fetching deck:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const cardsData = await api.cards.list(deckId);
      setCards(cardsData);
    } catch (error) {
      console.error("Error fetching cards:", error);
    }
  };

  const handleAddOne = async (e: React.FormEvent, closeAfter = true) => {
    e.preventDefault();

    try {
      const trimmedPrompt = (cardForm.prompt_es || "").trim();
      const trimmedTranslation = (cardForm.translation_en || "").trim();
      const trimmedAnswerEs = (cardForm.answer_es || "").trim();

      if (!trimmedPrompt || !trimmedTranslation) {
        setFormError("Both Spanish and English meaning are required.");
        return;
      }

      setFormError("");

      try {
        await api.cards.create(deckId, {
          prompt_es: trimmedPrompt,
          translation_en: trimmedTranslation,
        });
      } catch (error: any) {
        if (error.message?.includes('limit')) {
          setUpgradeMessage(error.message);
          setShowUpgradeModal(true);
          return;
        }
        throw error;
      }

      await fetchCards();
      await fetchDeck();
      setCardForm({ prompt_es: "", answer_es: "", translation_en: "" });

      if (closeAfter) {
        setShowCreateSet(false);
      }
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  const handleBulkAdd = async () => {
    try {
      // Parse bulk text
      const lines = bulkText.split('\n').filter(line => line.trim());
      const parsedCards = lines.map(line => {
        const [spanish, english] = line.split('=').map(s => s.trim());
        if (!spanish || !english) return null;
        return {
          prompt_es: spanish,
          translation_en: english,
        };
      }).filter((card): card is { prompt_es: string; translation_en: string } => card !== null);

      try {
        await api.cards.bulkCreate(deckId, parsedCards);
        setBulkResult({ created: parsedCards.length, skipped: lines.length - parsedCards.length });
      } catch (error: any) {
        if (error.message?.includes('limit')) {
          setUpgradeMessage(error.message);
          setShowUpgradeModal(true);
          return;
        }
        throw error;
      }

      await fetchCards();
      await fetchDeck();
      setBulkText("");
    } catch (error) {
      console.error("Error bulk creating cards:", error);
    }
  };

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

  if (!deck) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Deck Not Found
          </h1>
          <Link
            to="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className="rounded-lg shadow p-6 mb-6"
          style={{
            backgroundColor: deck.primary_color_hex || "#0EA5E9",
            backgroundImage: `linear-gradient(135deg, ${deck.primary_color_hex || "#0EA5E9"} 0%, ${deck.primary_color_hex || "#0EA5E9"}dd 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {deck.title}
              </h1>
              <p className="text-white text-opacity-90">{deck.description}</p>
              <p className="text-white text-opacity-75 mt-2">
                {deck.card_count || 0} cards
              </p>
            </div>
            <button
              onClick={() => setShowCreateSet(true)}
              className="flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium shadow"
            >
              <Plus size={20} />
              Create Set
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Link
            to={`/study?deck=${deck.id}`}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-gray-600">Practice with flashcards</p>
              <p className="font-semibold text-blue-600">Study Mode</p>
            </div>
            <BookOpen className="text-blue-600" size={24} />
          </Link>

          <Link
            to={`/play/solo?deck=${deck.id}`}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div>
              <h3 className="font-semibold text-gray-900">Solo Blitz</h3>
              <p className="text-sm text-gray-600">Test yourself</p>
            </div>
            <BookOpen className="text-green-600" size={32} />
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cards</h2>

          {cards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No cards yet</p>
              <button
                onClick={() => setShowCreateSet(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                Create Your First Set
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow transition-all"
                >
                  <p className="font-medium text-gray-900 mb-1">
                    {card.prompt_es}
                  </p>
                  {card.translation_en && (
                    <p className="text-sm text-blue-600">
                      → {card.translation_en}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateSet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Create Set</h2>
              <button
                onClick={() => {
                  setShowCreateSet(false);
                  setBulkResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("add-one")}
                  className={`pb-3 px-4 font-medium transition-colors ${
                    activeTab === "add-one"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Add One
                </button>
                <button
                  onClick={() => setActiveTab("bulk-add")}
                  className={`pb-3 px-4 font-medium transition-colors ${
                    activeTab === "bulk-add"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Bulk Add
                </button>
              </div>

              {activeTab === "add-one" && (
                <form
                  onSubmit={(e) => handleAddOne(e, true)}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spanish word/phrase *
                    </label>
                    <input
                      type="text"
                      value={cardForm.prompt_es}
                      onChange={(e) =>
                        setCardForm({ ...cardForm, prompt_es: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      placeholder="e.g., hola"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spanish answer/phrase (optional)
                    </label>
                    <input
                      type="text"
                      value={cardForm.answer_es}
                      onChange={(e) =>
                        setCardForm({ ...cardForm, answer_es: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Leave blank to use Spanish word as answer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      English meaning *
                    </label>
                    <input
                      type="text"
                      value={cardForm.translation_en}
                      onChange={(e) =>
                        setCardForm({
                          ...cardForm,
                          translation_en: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., hello"
                      required
                    />
                  </div>

                  {formError && (
                    <p className="text-sm text-red-600">{formError}</p>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={(e) => handleAddOne(e, false)}
                      className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
                    >
                      Save & add another
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Save & close
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "bulk-add" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Instructions:</strong>
                    </p>
                    <p className="text-sm text-blue-700">
                      Add one entry per line using the format:{" "}
                      <code className="bg-blue-100 px-1 py-0.5 rounded">
                        Spanish = English
                      </code>
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Example:{" "}
                      <code className="bg-blue-100 px-1 py-0.5 rounded">
                        hola = hello
                      </code>
                    </p>
                  </div>

                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    rows={12}
                    placeholder="hola = hello&#10;adiós = goodbye&#10;gracias = thank you"
                  />

                  {bulkResult && (
                    <div
                      className={`p-4 rounded-lg ${
                        bulkResult.created > 0
                          ? "bg-green-50 border border-green-200"
                          : "bg-yellow-50 border border-yellow-200"
                      }`}
                    >
                      <p
                        className={`font-medium ${
                          bulkResult.created > 0
                            ? "text-green-800"
                            : "text-yellow-800"
                        }`}
                      >
                        Created {bulkResult.created} cards.{" "}
                        {bulkResult.skipped > 0
                          ? `Skipped ${bulkResult.skipped} invalid lines.`
                          : ""}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleBulkAdd}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Create cards
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Upgrade to Premium
            </h2>
            <p className="text-gray-700 mb-6">{upgradeMessage}</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Premium benefits:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Unlimited sets</li>
                <li>✓ Unlimited cards per set</li>
                <li>✓ No ads</li>
                <li>✓ Create Blitz Challenge games</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Maybe Later
              </button>
              <Link
                to="/pricing"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
