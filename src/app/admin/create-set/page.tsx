// @ts-nocheck
import { useState, useEffect } from "react";
import Navigation from "@/shared/components/Navigation";
import ColorPicker from "@/shared/components/ColorPicker";
import { BookOpen, Plus, Upload, X, ArrowLeft, Trash2 } from "lucide-react";
import { api } from "@/config/api";

export default function CreateSetPage() {
  const [setId, setSetId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [setTitle, setSetTitle] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setColor, setSetColor] = useState("#0EA5E9"); // default blue
  const [mode, setMode] = useState("line-by-line");
  const [cards, setCards] = useState([
    { id: null, spanish: "", english: "" },
    { id: null, spanish: "", english: "" },
    { id: null, spanish: "", english: "" },
  ]);
  const [bulkText, setBulkText] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        setSetId(id);
        setIsEditMode(true);
        fetchSet(id);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const fetchSet = async (id) => {
    try {
      const [setData, cardsData] = await Promise.all([
        api.decks.get(id),
        api.cards.list(id),
      ]);

      setSetTitle(setData.title);
      setSetDescription(setData.description || "");
      setSetColor(setData.primary_color_hex || "#0EA5E9");

      setCards(
        cardsData.length > 0
          ? cardsData.map((c) => ({
              id: c.id,
              spanish: c.prompt_es || c.question || "",
              english: c.translation_en || c.answer || "",
            }))
          : [{ id: null, spanish: "", english: "" }],
      );
    } catch (error) {
      console.error("Error fetching set:", error);
      setError("Failed to load set");
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setCards([...cards, { id: null, spanish: "", english: "" }]);
  };

  const removeRow = (index) => {
    if (cards.length > 1) {
      setCards(cards.filter((_, i) => i !== index));
    }
  };

  const updateCard = (index, field, value) => {
    const updated = [...cards];
    updated[index][field] = value;
    setCards(updated);
  };

  const handleBulkImport = () => {
    const lines = bulkText.split("\n");
    const imported = [];
    let skipped = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) {
        skipped++;
        return;
      }

      const spanish = trimmed.substring(0, equalsIndex).trim();
      const english = trimmed.substring(equalsIndex + 1).trim();

      if (!spanish) {
        skipped++;
        return;
      }

      imported.push({ id: null, spanish, english });
    });

    setCards(
      imported.length > 0 ? imported : [{ id: null, spanish: "", english: "" }],
    );
    setImportSummary({
      imported: imported.length,
      skipped,
    });
  };

  const handleSaveSet = async () => {
    setError(null);

    if (!setTitle.trim()) {
      setError("Set title is required");
      return;
    }

    const validCards = cards.filter(
      (card) => card.spanish.trim() && card.english.trim(),
    );

    if (validCards.length < 4) {
      setError(
        "Please add at least 4 cards with both Spanish and English translations",
      );
      return;
    }

    setSaving(true);

    try {
      let deckId = setId;

      if (isEditMode) {
        await api.decks.patch(setId, {
          title: setTitle,
          description: setDescription,
          primary_color_hex: setColor,
        });

        const existingCards = cards.filter((c) => c.id);
        for (const card of existingCards) {
          await api.cards.delete(card.id);
        }
      } else {
        try {
          const deck = await api.decks.create({
            title: setTitle,
            description: setDescription,
            is_public: false,
            primary_color_hex: setColor,
          });
          deckId = deck.id;
        } catch (error) {
          // Check if this is a limit error (backend returns limit_exceeded)
          if (error instanceof Error && error.message.includes("limit")) {
            setUpgradeMessage(error.message);
            setShowUpgradeModal(true);
            setSaving(false);
            return;
          }
          throw error;
        }
      }

      const cardsData = validCards.map((card) => ({
        prompt_es: card.spanish.trim(),
        answer_es: card.spanish.trim(),
        translation_en: card.english.trim(),
      }));

      try {
        await api.cards.bulkCreate(deckId, cardsData);
      } catch (error) {
        // Check if this is a limit error
        if (error instanceof Error && error.message.includes("limit")) {
          setUpgradeMessage(error.message);
          setShowUpgradeModal(true);
          setSaving(false);
          return;
        }
        throw error;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Error saving set:", err);
      setError(err.message || "Failed to save set");
      setSaving(false);
    }
  };

  const handleDeleteSet = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this set? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await api.decks.delete(setId);
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Error deleting set:", err);
      setError(err instanceof Error ? err.message : "Failed to delete set");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Set" : "Create New Set"}
              </h1>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update your set and manage cards"
                  : "Define your set and add cards all at once"}
              </p>
            </div>
            {isEditMode && (
              <button
                onClick={handleDeleteSet}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={20} />
                Delete Set
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Set Info</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Set Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={setTitle}
                  onChange={(e) => setSetTitle(e.target.value)}
                  placeholder="e.g., Spanish Greetings"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <textarea
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  placeholder="Optional description for this set"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <ColorPicker value={setColor} onChange={setSetColor} />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong>{" "}
                  {isEditMode
                    ? "Changes are saved when you click 'Save Set' below."
                    : "After creating the set, you can edit it anytime from the Dashboard."}
                </p>
              </div>

              {/* Preview Card */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div
                  className="border-2 rounded-lg p-4"
                  style={{
                    borderLeftWidth: "6px",
                    borderLeftColor: setColor,
                  }}
                >
                  <h3 className="font-bold text-gray-900 mb-2">
                    {setTitle || "Your Set Title"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {setDescription || "Your set description will appear here"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Cards for this Set
              </h2>

              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setMode("line-by-line")}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    mode === "line-by-line"
                      ? "bg-white text-blue-600 shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Add line by line
                </button>
                <button
                  onClick={() => setMode("bulk")}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    mode === "bulk"
                      ? "bg-white text-blue-600 shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Bulk import
                </button>
              </div>
            </div>

            {mode === "line-by-line" && (
              <div className="space-y-4">
                <div className="overflow-y-auto max-h-96">
                  <div className="space-y-2">
                    {cards.map((card, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start"
                      >
                        <input
                          type="text"
                          value={card.spanish}
                          onChange={(e) =>
                            updateCard(index, "spanish", e.target.value)
                          }
                          placeholder="Spanish"
                          className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          value={card.english}
                          onChange={(e) =>
                            updateCard(index, "english", e.target.value)
                          }
                          placeholder="English"
                          className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => removeRow(index)}
                          disabled={cards.length === 1}
                          className={`p-2 rounded ${
                            cards.length === 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={addRow}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={20} />
                  Add another row
                </button>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    <strong>
                      {
                        cards.filter(
                          (c) => (c.spanish || "").trim() && (c.english || "").trim(),
                        ).length
                      }
                    </strong>{" "}
                    cards ready to save (minimum 4 required)
                  </p>
                </div>
              </div>
            )}

            {mode === "bulk" && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Format:</strong> One entry per line as{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      Spanish = English
                    </code>
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Example:</strong>
                    <br />
                    <code className="bg-blue-100 px-1 rounded">
                      hola = hello
                      <br />
                      adiós = goodbye
                      <br />
                      gracias = thank you
                    </code>
                  </p>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="hola = hello&#10;adiós = goodbye&#10;gracias = thank you"
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />

                <button
                  onClick={handleBulkImport}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Upload size={20} />
                  Import
                </button>

                {importSummary && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>✓ Imported {importSummary.imported} cards</strong>
                      {importSummary.skipped > 0 &&
                        `, skipped ${importSummary.skipped} invalid lines`}
                    </p>
                  </div>
                )}

                {cards.length > 0 && cards[0].spanish && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Preview ({cards.length} cards):
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {cards.slice(0, 10).map((card, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          {card.spanish}{" "}
                          {card.english && (
                            <span className="text-blue-600">
                              → {card.english}
                            </span>
                          )}
                        </p>
                      ))}
                      {cards.length > 10 && (
                        <p className="text-sm text-gray-500 italic">
                          ... and {cards.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 justify-end mt-8">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </a>
          <button
            onClick={handleSaveSet}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {saving
              ? isEditMode
                ? "Saving..."
                : "Creating Set..."
              : isEditMode
                ? "Save Set"
                : "Create Set"}
          </button>
        </div>
      </div>

      {/* Upgrade Modal */}
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
              <a
                href="/pricing"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
              >
                View Pricing
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
