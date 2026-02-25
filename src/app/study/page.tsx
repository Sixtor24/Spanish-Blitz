import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition, { type SpeechRecognitionHandle } from "@/shared/components/SpeechRecognition";
import MicPermissionModal from "@/shared/components/MicPermissionModal";
import WrittenAnswer, { type WrittenResult } from "@/shared/components/WrittenAnswer";
import { ArrowLeft, Check, X, Zap, Trophy, RefreshCw, RotateCw } from "lucide-react";
import { api } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";
import useUser from "@/shared/hooks/useUser";
import { useMicrophone } from "@/lib/microphone-context";
import { usePrefetchVocabularyAudio } from "@/shared/hooks/usePrefetchAudio";
import type { DbDeck, DbCard } from "@/types/api.types";

// Variant types
const VARIANT_A = "spanish_to_english"; // Listening + Meaning
const VARIANT_B = "english_to_spanish"; // Recall + Pronunciation
const VARIANT_C = "english_to_spanish_written"; // Written Recall

type Variant = "spanish_to_english" | "english_to_spanish" | "english_to_spanish_written";

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
  const { micEnabled, resetMic } = useMicrophone();
  const [showMicPrompt, setShowMicPrompt] = useState(true);
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
  const [writtenFeedback, setWrittenFeedback] = useState<WrittenResult | null>(null);
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

  // Reset mic state on mount so the prompt always shows when entering study mode
  useEffect(() => {
    resetMic();
  }, []);

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

  // ⚠️ PREFETCH DESHABILITADO: Causaba rate limiting de Microsoft Edge TTS
  // El audio ahora se carga on-demand cuando el usuario presiona el botón
  // Mantiene caché local para reproducción instantánea en segunda vez
  // usePrefetchVocabularyAudio(
  //   cards.map(card => ({
  //     spanish: card.question,
  //     definition: card.answer,
  //     example: undefined
  //   })),
  //   userLocale
  // );

  // Re-assign variants after mic prompt is dismissed (mic choice is now final)
  useEffect(() => {
    if (!showMicPrompt && cards.length > 0) {
      const variants: Variant[] = cards.map(() => {
        const rand = Math.random();
        if (micEnabled) {
          return rand < 0.33 ? VARIANT_A : rand < 0.66 ? VARIANT_B : VARIANT_C;
        }
        return rand < 0.5 ? VARIANT_A : VARIANT_C;
      });
      setCardVariants(variants);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setSpeechFeedback(null);
      setWrittenFeedback(null);
    }
  }, [showMicPrompt]);

  const initializeStudySession = (cardsData: DbCard[]) => {
    // Shuffle cards and assign random variants
    // When mic is disabled, force only Variant A (Listening) — Variant B requires speaking
    const shuffled = shuffleArray(cardsData);
    const variants: Variant[] = shuffled.map(() => {
      const rand = Math.random();
      if (micEnabled) {
        return rand < 0.33 ? VARIANT_A : rand < 0.66 ? VARIANT_B : VARIANT_C;
      }
      return rand < 0.5 ? VARIANT_A : VARIANT_C;
    });

    setCards(shuffled);
    setCardVariants(variants);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
    setSpeechFeedback(null);
    setWrittenFeedback(null);
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
    setWrittenFeedback(null);
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

        // Insert this card with a minimum gap of 3 positions to avoid consecutive repeats
        const remainingCards = cards.length - currentCardIndex - 1;
        const minGap = Math.min(3, remainingCards); // at least 3 cards apart
        if (remainingCards > 0 && minGap > 0) {
          const rangeStart = currentCardIndex + 1 + minGap;
          const rangeEnd = currentCardIndex + 1 + Math.min(remainingCards, 10);
          const insertPosition = rangeStart >= rangeEnd
            ? rangeEnd
            : rangeStart + Math.floor(Math.random() * (rangeEnd - rangeStart));

          const newCards = [...cards];
          newCards.splice(insertPosition, 0, currentCard);

          // Verify no card appears more than 2 times consecutively at insertion point
          let finalPos = insertPosition;
          const checkConsecutive = (arr: DbCard[], pos: number) => {
            let count = 1;
            for (let k = pos - 1; k >= 0 && arr[k]?.id === arr[pos]?.id; k--) count++;
            for (let k = pos + 1; k < arr.length && arr[k]?.id === arr[pos]?.id; k++) count++;
            return count;
          };
          if (checkConsecutive(newCards, finalPos) > 2) {
            // Move it further down to break the consecutive run
            newCards.splice(finalPos, 1);
            finalPos = Math.min(finalPos + 3, newCards.length);
            newCards.splice(finalPos, 0, currentCard);
          }

          const newVariants = [...cardVariants];
          const newVariant: Variant = Math.random() < 0.5 ? VARIANT_A : VARIANT_B;
          newVariants.splice(finalPos, 0, newVariant);

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
      setWrittenFeedback(null);
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

  const handleWrittenResult = async (result: WrittenResult) => {
    if (!currentCard || !deckId) return;

    setWrittenFeedback(result);

    // Record study event with written answer
    if (userId) {
      try {
        await api.studyEvents.create({
          deck_id: deckId,
          card_id: currentCard.id,
          result: result.isCorrect ? "correct" : "incorrect",
          mode: "study",
          response_type: "written",
          transcript_es: result.userAnswer,
        });
      } catch (err) {
        console.error("Error recording written event:", err);
      }
    }

    // Auto-flip to answer side after a short delay if correct
    if (result.isCorrect) {
      setTimeout(() => {
        setIsFlipped(true);
      }, 1200);
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

  // Show mic permission modal before loading content (always on mode entry)
  if (showMicPrompt) {
    return (
      <DashboardLayout>
        <MicPermissionModal onComplete={() => setShowMicPrompt(false)} />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl p-4">
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
      </DashboardLayout>
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
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 text-center relative border border-gray-200 dark:border-gray-700">
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
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
                  : currentVariant === VARIANT_C
                    ? "✏️ Written Recall"
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
              ) : currentVariant === VARIANT_C ? (
                // Variant C: English → Spanish (Written)
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Write the Spanish translation
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.translation_en || currentCard.prompt_es}
                  </p>
                  <div className="mt-6 max-w-md mx-auto">
                    <WrittenAnswer
                      correctAnswer={currentCard.prompt_es || currentCard.question}
                      onResult={handleWrittenResult}
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
              ) : currentVariant === VARIANT_C ? (
                // Variant C Answer: Show the Spanish answer
                <>
                  <p className="text-sm text-gray-500 mb-4">Spanish answer</p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.prompt_es}
                  </p>
                  {writtenFeedback && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      writtenFeedback.isCorrect
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <p className={`font-medium ${
                        writtenFeedback.isCorrect ? 'text-green-800' : 'text-yellow-800'
                      }`}>
                        {writtenFeedback.isCorrect
                          ? writtenFeedback.isAlmostCorrect
                            ? '👍 Almost correct! Check the spelling above.'
                            : '✓ Correct!'
                          : '💡 Review the correct answer above'}
                      </p>
                      {!writtenFeedback.isCorrect && (
                        <p className="text-sm text-gray-600 mt-1">
                          You wrote: "{writtenFeedback.userAnswer}"
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // Variant B Answer: Spanish text + mic
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    {micEnabled ? 'Spanish answer - Try saying it!' : 'Spanish answer'}
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mb-6">
                    {currentCard.prompt_es}
                  </p>

                  {micEnabled && (
                    <div className="flex justify-center mt-6">
                      <SpeechRecognition
                        ref={speechRecognitionRef}
                        onTranscript={handleSpeechResult}
                        locale={userLocale}
                        autoStop={false}
                        showTranscript={false}
                      />
                    </div>
                  )}

                  {micEnabled && speechFeedback && (
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
                      {!speechFeedback.isCorrect && (
                        <p className="text-sm text-gray-600 mt-1">
                          You said: "{speechFeedback.transcript}"
                        </p>
                      )}
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

        {/* Study Mode Tips or Notes */}
        <div className="mt-6">
          {!isFlipped ? (
            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-md rounded-xl p-5 border border-white/30 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">📚</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white mb-3 text-base uppercase tracking-wide">Study Mode Tips:</p>
                  <ul className="space-y-2 text-white/90 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Take your time - no timers or scores</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Mark "Hard" for cards you want to review more</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Mark "Easy" for cards you know well</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Your progress is tracked to help you learn more effectively</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : currentCard?.notes && currentCard.notes.trim() ? (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 shadow-md border-2 border-amber-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-white text-xl">📝</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 mb-2 uppercase tracking-wide">Notes:</p>
                  <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {currentCard.notes}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-md rounded-xl p-5 border border-white/30 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">📚</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white mb-3 text-base uppercase tracking-wide">Study Mode Tips:</p>
                  <ul className="space-y-2 text-white/90 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Take your time - no timers or scores</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Mark "Hard" for cards you want to review more</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Mark "Easy" for cards you know well</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-white/60 mt-0.5">•</span>
                      <span>Your progress is tracked to help you learn more effectively</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(StudyPage);
