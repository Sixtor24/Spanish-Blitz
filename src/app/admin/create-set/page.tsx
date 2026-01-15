// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import Navigation from "@/shared/components/Navigation";
import ColorPicker from "@/shared/components/ColorPicker";
import { BookOpen, Plus, Upload, X, ArrowLeft, Trash2, AlertCircle } from "lucide-react";
import { api } from "@/config/api";

export default function CreateSetPage() {
  const navigate = useNavigate();
  const [setId, setSetId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [setTitle, setSetTitle] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setColor, setSetColor] = useState("#0EA5E9"); // default blue
  const [mode, setMode] = useState("line-by-line");
  const [cards, setCards] = useState([
    { id: null, spanish: "", english: "", notes: "" },
    { id: null, spanish: "", english: "", notes: "" },
    { id: null, spanish: "", english: "", notes: "" },
  ]);
  const [bulkText, setBulkText] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // Detect duplicate cards based on Spanish word (case-insensitive)
  const duplicateIndices = useMemo(() => {
    const seen = new Map();
    const duplicates = new Set();
    
    cards.forEach((card, index) => {
      const spanishKey = card.spanish.trim().toLowerCase();
      if (spanishKey && card.spanish.trim()) {
        if (seen.has(spanishKey)) {
          duplicates.add(seen.get(spanishKey));
          duplicates.add(index);
        } else {
          seen.set(spanishKey, index);
        }
      }
    });
    
    return duplicates;
  }, [cards]);

  const hasDuplicates = duplicateIndices.size > 0;

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
              notes: c.notes || "",
            }))
          : [{ id: null, spanish: "", english: "", notes: "" }],
      );
    } catch (error) {
      console.error("Error fetching set:", error);
      setError("Failed to load set");
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setCards([...cards, { id: null, spanish: "", english: "", notes: "" }]);
  };

  const removeRow = async (index) => {
    const cardToRemove = cards[index];
    
    // If it's an existing card (has an ID), delete it from the backend
    if (cardToRemove.id && isEditMode) {
      try {
        await api.cards.delete(cardToRemove.id);
        // Show success feedback
        setSuccessMessage("Card deleted successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error("Error deleting card:", error);
        setError("Failed to delete card. Please try again.");
        return;
      }
    }
    
    // Remove from local state (always allow removal, even if it's the last one)
    const newCards = cards.filter((_, i) => i !== index);
    if (newCards.length === 0) {
      // If all cards are removed, add one empty card
      setCards([{ id: null, spanish: "", english: "" }]);
    } else {
      setCards(newCards);
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

      // Split by '=' to support format: Spanish = English = Notes
      const parts = trimmed.split("=").map(p => p.trim());
      
      if (parts.length < 2) {
        skipped++;
        return;
      }

      const spanish = parts[0];
      const english = parts[1];
      const notes = parts.length >= 3 ? parts.slice(2).join("=").trim() : "";

      if (!spanish) {
        skipped++;
        return;
      }

      // Truncate notes to 150 characters
      const truncatedNotes = notes.length > 150 ? notes.substring(0, 150) : notes;

      imported.push({ id: null, spanish, english, notes: truncatedNotes });
    });

    // Append imported cards to existing cards instead of replacing
    // Filter out empty cards first
    const existingCards = cards.filter(c => c.spanish.trim() || c.english.trim() || c.id);
    const newCards = [...existingCards, ...imported];
    
    // If no existing cards and no imported cards, keep one empty card
    setCards(
      newCards.length > 0 ? newCards : [{ id: null, spanish: "", english: "", notes: "" }],
    );
    
    // Switch to line-by-line view after import
    setMode("line-by-line");
    
    // Clear bulk text
    setBulkText("");
    
    setImportSummary({
      imported: imported.length,
      skipped,
    });
  };

  const handleRemoveDuplicates = () => {
    const seen = new Map();
    const uniqueCards = [];
    
    cards.forEach((card) => {
      const spanishKey = card.spanish.trim().toLowerCase();
      if (!spanishKey || !seen.has(spanishKey)) {
        seen.set(spanishKey, true);
        uniqueCards.push(card);
      }
    });
    
    if (uniqueCards.length === 0) {
      setCards([{ id: null, spanish: "", english: "", notes: "" }]);
    } else {
      setCards(uniqueCards);
    }
  };

  const handleSaveSet = async () => {
    setError(null);
    setSuccessMessage(null);

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

    // Check card limit for free users BEFORE creating the deck
    if (!isEditMode) {
      try {
        const currentUser = await api.users.current();
        if (currentUser.plan === "free" && validCards.length > 20) {
          setUpgradeMessage(
            `Free accounts are limited to 20 cards per set. You have ${validCards.length} cards. Upgrade to Premium for unlimited cards.`
          );
          setShowUpgradeModal(true);
          return;
        }
      } catch (err) {
        console.error("Error checking user plan:", err);
      }
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

        // Only delete cards that were removed (exist in backend but not in current cards)
        // First, get all existing cards from backend
        const existingBackendCards = await api.cards.list(setId);
        const currentCardIds = cards.filter((c) => c.id).map((c) => c.id);
        
        // Delete cards that exist in backend but not in current cards
        for (const backendCard of existingBackendCards) {
          if (!currentCardIds.includes(backendCard.id)) {
            await api.cards.delete(backendCard.id);
          }
        }
        
        // Update existing cards that have IDs and are valid
        const existingValidCards = cards.filter((c) => c.id && c.spanish.trim() && c.english.trim());
        for (const card of existingValidCards) {
          await api.cards.update(card.id, {
            prompt_es: card.spanish.trim(),
            answer_es: card.spanish.trim(),
            translation_en: card.english.trim(),
            notes: card.notes ? card.notes.trim() : "",
          });
        }
        
        // Only create new cards (those without IDs) that are valid
        const newCards = validCards.filter((c) => !c.id);
        if (newCards.length > 0) {
          const newCardsData = newCards.map((card) => ({
            prompt_es: card.spanish.trim(),
            answer_es: card.spanish.trim(),
            translation_en: card.english.trim(),
            notes: card.notes ? card.notes.trim() : "",
          }));
          await api.cards.bulkCreate(deckId, newCardsData);
        }
        
        // Redirect to dashboard after successful save
        setSaving(false);
        navigate("/dashboard");
        return;
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
        notes: card.notes ? card.notes.trim() : "",
      }));

      console.log('🔍 [DEBUG] Cards data being sent:', JSON.stringify(cardsData, null, 2));

      try {
        await api.cards.bulkCreate(deckId, cardsData);
        
        // Redirect to dashboard after successful save
        setSaving(false);
        navigate("/dashboard");
      } catch (error) {
        // Check if this is a limit error
        if (error instanceof Error && error.message.includes("limit")) {
          setUpgradeMessage(error.message);
          setShowUpgradeModal(true);
          setSaving(false);
          
          // If the deck was deleted by backend (first batch exceeded limit), 
          // reset the form state
          if (error.message.includes("deck") || !isEditMode) {
            setSetId(null);
            setIsEditMode(false);
          }
          return;
        }
        throw error;
      }
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
      navigate("/dashboard");
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
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
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

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{successMessage}</span>
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
                  <span className="text-xs text-gray-500 ml-2">
                    ({setDescription.length}/150)
                  </span>
                </label>
                <textarea
                  value={setDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= 150) {
                      setSetDescription(e.target.value);
                    }
                  }}
                  placeholder="Optional description for this set"
                  rows={4}
                  maxLength={150}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent break-words"
                  style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
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
                  <p className="text-sm text-gray-600 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
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
                {hasDuplicates && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium mb-1">
                        Duplicate words detected
                      </p>
                      <button
                        onClick={handleRemoveDuplicates}
                        className="text-sm text-red-600 hover:text-red-700 underline font-medium"
                      >
                        Delete duplicates
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-y-auto max-h-96">
                  <div className="space-y-2">
                    {cards.map((card, index) => {
                      const isDuplicate = duplicateIndices.has(index);
                      const notesLength = card.notes?.length || 0;
                      return (
                        <div
                          key={index}
                          className={`${isDuplicate ? "bg-red-50 p-2 rounded border border-red-200" : ""}`}
                        >
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start mb-2">
                            <input
                              type="text"
                              value={card.spanish}
                              onChange={(e) =>
                                updateCard(index, "spanish", e.target.value)
                              }
                              placeholder="Spanish"
                              className={`px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                isDuplicate ? "border-red-300 bg-white" : "border-gray-300"
                              }`}
                            />
                            <input
                              type="text"
                              value={card.english}
                              onChange={(e) =>
                                updateCard(index, "english", e.target.value)
                              }
                              placeholder="English"
                              className={`px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                isDuplicate ? "border-red-300 bg-white" : "border-gray-300"
                              }`}
                            />
                            <button
                              onClick={() => removeRow(index)}
                              className="p-2 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title={card.id ? "Delete card permanently" : "Remove card"}
                            >
                              <X size={20} />
                            </button>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                            <textarea
                              value={card.notes || ""}
                              onChange={(e) =>
                                updateCard(index, "notes", e.target.value.substring(0, 150))
                              }
                              placeholder="Optional notes or examples (max 150 characters)"
                              rows={2}
                              maxLength={150}
                              className={`px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none ${
                                isDuplicate ? "border-red-300 bg-white" : "border-gray-300"
                              }`}
                            />
                            <div className="text-xs text-gray-500 pt-2 text-right w-12">
                              {notesLength}/150
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      <br />
                      <span className="text-xs text-green-700 mt-1 block">
                        Cards have been added to your existing list. Switch to "Add line by line" to view them.
                      </span>
                    </p>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 justify-end mt-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
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
