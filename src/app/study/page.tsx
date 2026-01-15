import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition, { type SpeechRecognitionHandle } from "@/shared/components/SpeechRecognition";
import { ArrowLeft, Check, X, Zap, Trophy, RefreshCw, RotateCw } from "lucide-react";
import { api } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";
import useUser from "@/shared/hooks/useUser";
import { usePrefetchVocabularyAudio } from "@/shared/hooks/usePrefetchAudio";
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

function StudyPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const userLocale = user?.preferred_locale || 'es-ES';
  
  const [deckId, setDeckId] = useState<string | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
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

  // Track assignment repetitions
  const [requiredRepetitions, setRequiredRepetitions] = useState<number>(1);
  const [completedRepetitions, setCompletedRepetitions] = useState<number>(0);

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
      const classroom = params.get("classroom");
      const assignment = params.get("assignment");
      
      if (!id) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setDeckId(id);
      setClassroomId(classroom);
      setAssignmentId(assignment);
      fetchDeckAndCards(id, classroom, assignment);
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

  const fetchDeckAndCards = async (id: string, classroom?: string | null, assignment?: string | null) => {
    try {
      const promises: Promise<any>[] = [
        api.decks.get(id),
        api.cards.list(id),
      ];

      // If this is an assignment, fetch assignment details to get repetitions
      if (assignment && classroom) {
        promises.push(api.classrooms.assignments(classroom));
      }

      const results = await Promise.all(promises);
      const deckData = results[0];
      const cardsData = results[1];
      const assignmentsData = results[2];

      // If we have assignment data, find this assignment and get repetitions
      if (assignmentsData && assignment) {
        const assignmentData = assignmentsData.find((a: any) => a.id === assignment);
        if (assignmentData) {
          // Get required repetitions from assignment
          setRequiredRepetitions(assignmentData.required_repetitions || 1);
          
          // Get completed repetitions from assignment_submissions
          // The backend calculates this based on assignment_submissions
          setCompletedRepetitions(assignmentData.repetitions_completed || 0);
        }
      }

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

  // Prefetch all audio from cards for instant playback
  usePrefetchVocabularyAudio(
    cards.map(card => ({
      spanish: card.question, // Spanish text
      definition: card.answer, // English translation
      example: undefined // No example sentences in current schema
    })),
    userLocale
  );

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
    // Stop microphone when resetting study
    if (speechRecognitionRef.current?.isListening()) {
      speechRecognitionRef.current.stop();
    }
  };

  const handleStudyAgain = () => {
    initializeStudySession(cards);
  };

  const markAssignmentComplete = async () => {
    if (!classroomId || !assignmentId) return;
    
    try {
      await api.classrooms.completeAssignment(classroomId, assignmentId);
      console.log('Assignment marked as complete');
    } catch (err) {
      console.error('Error marking assignment complete:', err);
    }
  };

  const currentCard = cards[currentCardIndex];
  const currentVariant = cardVariants[currentCardIndex];
  const isLastCard = currentCardIndex === cards.length - 1;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setSpeechFeedback(null);
    // Stop microphone when flipping card
    if (speechRecognitionRef.current?.isListening()) {
      speechRecognitionRef.current.stop();
    }
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
      // Mark assignment as completed if this is from a classroom
      if (classroomId && assignmentId) {
        markAssignmentComplete();
      }
    } else {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSpeechFeedback(null);
      // Stop microphone when moving to next card
      if (speechRecognitionRef.current?.isListening()) {
        speechRecognitionRef.current.stop();
      }
    }
  };

  const speechRecognitionRef = useRef<SpeechRecognitionHandle>(null);

  const handleSpeechResult = async (transcript: string, confidence?: number) => {
    if (!currentCard || !deckId) return;

    const target = currentCard.prompt_es || currentCard.question;

    // Use lenient matching evaluation from backend
    try {
      const result = await api.speech.evaluate(transcript, target, confidence);
      const isCorrect = result.accepted;

      setSpeechFeedback({
        transcript,
        isCorrect,
      });

      // Stop microphone if answer is correct
      if (isCorrect && speechRecognitionRef.current) {
        console.log('✅ [Study] Correct answer detected, stopping microphone');
        speechRecognitionRef.current.stop();
      }

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
    } catch (err) {
      console.error("Error evaluating speech:", err);
      // Fallback to simple comparison if backend fails
      const expected = normalizeForComparison(target);
      const actual = normalizeForComparison(transcript);
      const isCorrect = expected === actual;
      
      setSpeechFeedback({
        transcript,
        isCorrect,
      });
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
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mt-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isCompleted) {
    const isAssignment = assignmentId !== null;
    // After completing this session, the count will be incremented by 1
    const newCompletedCount = completedRepetitions + 1;
    const hasMoreRepetitions = newCompletedCount < requiredRepetitions;
    const showStudyAgain = !isAssignment || hasMoreRepetitions;
    const remainingRepetitions = requiredRepetitions - newCompletedCount;
    
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
            <Link
              to="/dashboard"
              className="absolute top-6 left-6 inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>

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
              
              {isAssignment && (
                <div className="mt-6">
                  {/* Progress Circle and Info */}
                  {requiredRepetitions > 1 && (
                    <div className="flex flex-col items-center gap-3 mb-4">
                      {/* Circular Progress */}
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="transform -rotate-90" width="140" height="140">
                          {/* Background circle */}
                          <circle
                            cx="70"
                            cy="70"
                            r="60"
                            stroke="#E5E7EB"
                            strokeWidth="12"
                            fill="none"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="70"
                            cy="70"
                            r="60"
                            stroke={hasMoreRepetitions ? "#3B82F6" : "#10B981"}
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={`${(newCompletedCount / requiredRepetitions) * 377} 377`}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                        </svg>
                        {/* Center text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-4xl font-bold ${hasMoreRepetitions ? 'text-blue-600' : 'text-green-600'}`}>
                            {newCompletedCount}
                          </span>
                          <span className="text-gray-400 text-sm font-medium">of {requiredRepetitions}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Message */}
                  {hasMoreRepetitions ? (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-2xl">🎯</span>
                        <h3 className="text-xl font-bold text-blue-900">Keep Going!</h3>
                      </div>
                      <p className="text-center text-blue-800 font-medium">
                        Study this set <span className="font-bold text-blue-600">{remainingRepetitions} more {remainingRepetitions === 1 ? 'time' : 'times'}</span> to complete your assignment
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-3xl">🎉</span>
                        <h3 className="text-xl font-bold text-green-900">Assignment Complete!</h3>
                      </div>
                      <p className="text-center text-green-800 font-medium">
                        {requiredRepetitions > 1 ? "You've finished all required repetitions!" : "Great job completing your assignment!"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showStudyAgain && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleStudyAgain}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <RefreshCw size={20} />
                  Study Again
                </button>
                {!isAssignment && (
                  <Link
                    to={`/play/solo?deck=${deckId}`}
                    className="flex items-center justify-center gap-2 bg-gray-200 text-gray-700 font-bold py-4 px-8 rounded-lg hover:bg-gray-300 transition-colors shadow-lg"
                  >
                    <Zap size={20} />
                    Play Solo
                  </Link>
                )}
              </div>
            )}

            {!isAssignment && (
              <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800 text-center">
                  <span className="font-semibold">💡 Tip:</span> "Study Again" will shuffle the cards and give you a fresh mix of listening and speaking practice!
                </p>
              </div>
            )}
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
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-white hover:text-blue-100 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
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
                      ref={speechRecognitionRef}
                      onTranscript={handleSpeechResult}
                      locale={userLocale}
                      autoStop={false} // Keep mic open for practice, but will stop on correct answer
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

        {/* Notes or Help text */}
        {currentCard?.notes && currentCard.notes.trim() ? (
          <div className="mt-6 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 text-blue-100 text-sm">
            <p className="font-medium mb-2">📝 Notes:</p>
            <p className="whitespace-pre-wrap">{currentCard.notes}</p>
          </div>
        ) : (
          <div className="mt-6 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 text-blue-100 text-sm">
            <p className="font-medium mb-2">📚 Study Mode Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Take your time - no timers or scores</li>
              <li>Mark "Hard" for cards you want to review more</li>
              <li>Mark "Easy" for cards you know well</li>
              <li>Your progress is tracked to help you learn more effectively</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(StudyPage);
