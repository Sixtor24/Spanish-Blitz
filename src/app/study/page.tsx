import { useState, useEffect } from "react";
import { ArrowLeft, RotateCw, RefreshCw } from "lucide-react";
import Navigation from "@/shared/components/Navigation";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
import useUser from "@/shared/hooks/useUser";
import { api } from "@/config/api";
import type { DbDeck, DbCard } from "@/types/api.types";

// Variant types
const VARIANT_A = "spanish_to_english"; // Listening + Meaning
const VARIANT_B = "english_to_spanish"; // Recall + Pronunciation

type Variant = "spanish_to_english" | "english_to_spanish";

// Completion phrases
const COMPLETION_PHRASES = [
  "👍 Muy bien!",
  "🤓 Buen trabajo!",
  "✅ Excellente!",
];

// Normalize text for comparison
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[¿?¡!.,;:\"']/g, "") // remove punctuation
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ü/g, "u");
  // Note: ñ is kept as is (not normalized)
}

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function StudyPage() {
  const { user } = useUser();
  const userLocale = user?.preferred_locale || 'es-ES';
  
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DbDeck | null>(null);
  const [cards, setCards] = useState<DbCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [speechFeedback, setSpeechFeedback] = useState<{
    transcript: string;
    isCorrect: boolean;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Variant assignment for each card
  const [cardVariants, setCardVariants] = useState<Variant[]>([]);

  // Track hard cards and their repetition count
  const [hardCardRepetitions, setHardCardRepetitions] = useState<Record<string, number>>({});

  // Track unique hard cards for stats
  const [hardCardsCount, setHardCardsCount] = useState(0);

  // Random completion phrase (set once on mount)
  const [completionPhrase, setCompletionPhrase] = useState("");

  useEffect(() => {
    // Set random completion phrase on mount
    const randomPhrase =
      COMPLETION_PHRASES[Math.floor(Math.random() * COMPLETION_PHRASES.length)];
    setCompletionPhrase(randomPhrase);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("deck");
      if (!id) {
        window.location.href = "/dashboard";
        return;
      }
      setDeckId(id);
      fetchDeckAndCards(id);
      fetchUser();
    }
  }, []);

  const fetchUser = async () => {
    try {
      const data = await api.users.current();
      setUserId(data.id);
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  const fetchDeckAndCards = async (id: string) => {
    try {
      const [deckData, cardsData] = await Promise.all([
        api.decks.get(id),
        api.cards.list(id),
      ]);

      if (cardsData.length === 0) {
        setError("This set has no cards yet");
        setLoading(false);
        return;
      }

      setDeck(deckData);
      initializeStudySession(cardsData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching deck:", err);
      setError(err instanceof Error ? err.message : "Failed to load deck");
      setLoading(false);
    }
  };

  const initializeStudySession = (cardsData: DbCard[]) => {
    // Shuffle cards and assign random variants
    const shuffled = shuffleArray(cardsData);
    const variants: Variant[] = shuffled.map(() =>
      Math.random() < 0.5 ? VARIANT_A : VARIANT_B,
    );

    setCards(shuffled);
    setCardVariants(variants);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setSpeechFeedback(null);
    setHardCardRepetitions({});
    setHardCardsCount(0); // Reset hard cards count
  };

  const handleStudyAgain = () => {
    initializeStudySession(cards);
  };

  const currentCard = cards[currentCardIndex];
  const currentVariant = cardVariants[currentCardIndex];
  const isLastCard = currentCardIndex === cards.length - 1;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setSpeechFeedback(null);
  };

  const handleMarkCard = async (difficulty: 'correct' | 'hard') => {
    if (!userId || !currentCard || !deckId) return;

    try {
      await api.studyEvents.create({
        deck_id: deckId,
        card_id: currentCard.id,
        result: difficulty === 'correct' ? 'correct' : 'incorrect',
        mode: "study",
        response_type: "tap",
      });
    } catch (err) {
      console.error("Error recording study event:", err);
    }

    // Handle "hard" cards - schedule for repetition
    if (difficulty === "hard") {
      const cardId = currentCard.id;
      const currentReps = hardCardRepetitions[cardId] || 0;

      // If this is the first time marking this card as hard, increment the count
      if (currentReps === 0) {
        setHardCardsCount(hardCardsCount + 1);
      }

      if (currentReps < 3) {
        // Schedule this card to appear again randomly in the remaining cards
        const newRepCount = currentReps + 1;
        setHardCardRepetitions({
          ...hardCardRepetitions,
          [cardId]: newRepCount,
        });

        // Insert this card randomly in the next 3-10 positions (if possible)
        const remainingCards = cards.length - currentCardIndex - 1;
        if (remainingCards > 0) {
          const insertPosition =
            currentCardIndex +
            1 +
            Math.floor(Math.random() * Math.min(remainingCards, 10));
          const newCards = [...cards];
          newCards.splice(insertPosition, 0, currentCard);

          const newVariants = [...cardVariants];
          const newVariant: Variant = Math.random() < 0.5 ? VARIANT_A : VARIANT_B;
          newVariants.splice(insertPosition, 0, newVariant);

          setCards(newCards);
          setCardVariants(newVariants);
        }
      }
    }

    // Move to next card or show completion
    if (currentCardIndex >= cards.length - 1) {
      setIsCompleted(true);
    } else {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSpeechFeedback(null);
    }
  };

  const handleSpeechResult = async (transcript: string) => {
    if (!currentCard || !deckId) return;

    const expected = normalizeForComparison(currentCard.prompt_es || currentCard.question);
    const actual = normalizeForComparison(transcript);

    const isCorrect = expected === actual;

    setSpeechFeedback({
      transcript,
      isCorrect,
    });

    // Record study event with speech
    if (userId) {
      try {
        await api.studyEvents.create({
          deck_id: deckId,
          card_id: currentCard.id,
          result: isCorrect ? "correct" : "incorrect",
          mode: "study",
          response_type: "speech",
          transcript_es: transcript,
        });
      } catch (err) {
        console.error("Error recording speech event:", err);
      }
    }
  };

  // Helper function to get gradient from deck color
  const getGradientStyle = () => {
    if (!deck?.primary_color_hex) {
      return "bg-gradient-to-br from-blue-500 via-blue-600 to-teal-500";
    }

    // Use the deck's color for a gradient
    const color = deck.primary_color_hex;
    return "";
  };

  const dynamicGradient = deck?.primary_color_hex
    ? {
        background: `linear-gradient(to bottom right, ${deck.primary_color_hex}, ${deck.primary_color_hex}dd, ${deck.primary_color_hex}bb)`,
      }
    : {};

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
            {error}
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isCompleted) {
    return (
      <div
        className="min-h-screen"
        style={
          dynamicGradient.background
            ? dynamicGradient
            : {
                background:
                  "linear-gradient(to bottom right, #3B82F6, #2563EB, #14B8A6)",
              }
        }
      >
        <Navigation />

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-2xl p-12 text-center relative">
            {/* Back link in top left */}
            <a
              href="/dashboard"
              className="absolute top-6 left-6 inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </a>

            <div className="mb-8">
              <div className="text-6xl mb-4">
                {completionPhrase.split(" ")[0]}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {completionPhrase.substring(completionPhrase.indexOf(" ") + 1)}
              </h1>
              <p className="text-xl text-gray-600">
                You studied <strong>{cards.length} cards</strong> ·{" "}
                <strong>{hardCardsCount} marked Hard</strong>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStudyAgain}
                className="flex items-center justify-center gap-2 bg-gray-200 text-gray-700 font-bold py-4 px-8 rounded-lg hover:bg-gray-300 transition-colors shadow-lg"
              >
                <RefreshCw size={20} />
                Study Again
              </button>
              <a
                href={`/play/solo?deck=${deckId}`}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                Play Solo
              </a>
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Ready for another round? "Study Again" will shuffle the cards
                and give you a fresh mix of listening and speaking practice!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={
        dynamicGradient.background
          ? dynamicGradient
          : {
              background:
                "linear-gradient(to bottom right, #3B82F6, #2563EB, #14B8A6)",
            }
      }
    >
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white hover:text-blue-100 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </a>
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
            <h1 className="text-2xl font-bold text-white mb-2">
              Study Mode: {deck?.title}
            </h1>
            <div className="flex items-center justify-between text-blue-100">
              <span>
                Card {currentCardIndex + 1} of {cards.length}
              </span>
              <span className="text-sm">
                {currentVariant === VARIANT_A
                  ? "🎧 Listening + Meaning"
                  : "💬 Recall + Pronunciation"}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-8">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{
              width: `${((currentCardIndex + 1) / cards.length) * 100}%`,
            }}
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-2xl p-8 mb-6 min-h-[400px] flex flex-col justify-center items-center">
          {!isFlipped ? (
            // QUESTION SIDE
            <div className="text-center w-full">
              {currentVariant === VARIANT_A ? (
                // Variant A: Spanish → English (Listening)
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Listen and understand
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.prompt_es}
                  </p>
                  <div className="flex justify-center">
                    <TTSButton
                      text={currentCard.prompt_es || currentCard.question}
                      locale={userLocale}
                      size="large"
                    />
                  </div>
                </>
              ) : (
                // Variant B: English → Spanish (Recall)
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Recall the Spanish
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.translation_en || currentCard.prompt_es}
                  </p>
                  <p className="text-gray-500 italic">
                    (Think of the Spanish word/phrase)
                  </p>
                </>
              )}
            </div>
          ) : (
            // ANSWER SIDE
            <div className="text-center w-full">
              {currentVariant === VARIANT_A ? (
                // Variant A Answer: English meaning
                <>
                  <p className="text-sm text-gray-500 mb-4">English meaning</p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.translation_en || currentCard.prompt_es}
                  </p>
                </>
              ) : (
                // Variant B Answer: Spanish text + mic
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Spanish answer - Try saying it!
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.prompt_es}
                  </p>

                  <div className="flex justify-center mt-6">
                    <SpeechRecognition
                      onTranscript={handleSpeechResult}
                      locale={userLocale}
                    />
                  </div>

                  {speechFeedback && (
                    <div
                      className={`mt-4 p-4 rounded-lg ${
                        speechFeedback.isCorrect
                          ? "bg-green-50 border border-green-200"
                          : "bg-yellow-50 border border-yellow-200"
                      }`}
                    >
                      <p
                        className={`font-medium ${
                          speechFeedback.isCorrect
                            ? "text-green-800"
                            : "text-yellow-800"
                        }`}
                      >
                        {speechFeedback.isCorrect
                          ? "✓ Correct!"
                          : "Try again - keep practicing!"}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        You said: "{speechFeedback.transcript}"
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          {!isFlipped ? (
            <button
              onClick={handleFlip}
              className="flex-1 bg-white text-blue-600 font-bold py-4 rounded-lg hover:bg-blue-50 transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <RotateCw size={20} />
              Show Answer
            </button>
          ) : (
            <>
              <button
                onClick={() => handleMarkCard("hard")}
                className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-lg hover:bg-orange-600 transition-colors shadow-lg"
              >
                Hard
              </button>
              <button
                onClick={() => handleMarkCard("correct")}
                className="flex-1 bg-green-500 text-white font-bold py-4 rounded-lg hover:bg-green-600 transition-colors shadow-lg"
              >
                Easy
              </button>
            </>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 text-blue-100 text-sm">
          <p className="font-medium mb-2">📚 Study Mode Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Take your time - no timers or scores</li>
            <li>Mark "Hard" for cards you want to review more</li>
            <li>Mark "Easy" for cards you know well</li>
            <li>Your progress is tracked to help you learn more effectively</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
