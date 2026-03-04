import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/shared/components/DashboardLayout";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
import MicPermissionModal from "@/shared/components/MicPermissionModal";
import WrittenAnswer, { type WrittenResult } from "@/shared/components/WrittenAnswer";
import { Trophy, Target, Clock, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { api } from "@/config/api";
import useUser from "@/shared/hooks/useUser";
import { useMicrophone } from "@/lib/microphone-context";
import { useNavigationGuard } from "@/lib/navigation-guard-context";
import type { DbDeck, DbCard } from "@/types/api.types";

import {
  QUESTION_TYPES,
  QUESTION_TYPE_LIST,
  getSpanishPrompt,
  getSpanishAnswer,
  getEnglishAnswer,
  normalizeSpanish,
  buildOptions,
  getQuestionPrompt,
  getQuestionTypeLabel,
  isSpeechQuestion,
  isAudioQuestion,
  isWrittenQuestion,
  type QuestionType,
} from "../lib/quizUtils";


interface CardQuestion {
  card: DbCard;
  questionType: QuestionType;
}

export default function PlaySoloPage() {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("deck");
  const { user, refetch: refetchUser } = useUser();
  const { micEnabled, resetMic } = useMicrophone();
  const [showVoicePrompt, setShowVoicePrompt] = useState(true);
  
  const [showSetSelection, setShowSetSelection] = useState(true);
  const [availableSets, setAvailableSets] = useState<DbDeck[]>([]);
  const [deck, setDeck] = useState<DbDeck | null>(null);
  const [cards, setCards] = useState<DbCard[]>([]);
  const [cardQuestions, setCardQuestions] = useState<CardQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredCards, setAnsweredCards] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [userLocale, setUserLocale] = useState("es-ES");
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [xpTotal, setXpTotal] = useState<number>(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();
  const { setGuard } = useNavigationGuard();
  const pendingBackRef = useRef(false);

  // Reset mic state on mount so the prompt always shows when entering solo mode
  useEffect(() => {
    resetMic();
    setShowVoicePrompt(true);
  }, []);

  // ─── Navigation Guard (sidebar / in-app links) ────────────────
  useEffect(() => {
    if (gameEnded || showSetSelection) return;
    const unregister = setGuard(() => setShowExitModal(true));
    return unregister;
  }, [gameEnded, showSetSelection, setGuard]);

  // ─── Navigation Protection (reload, tab close, browser back) ──
  useEffect(() => {
    if (gameEnded || showSetSelection) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.history.pushState({ soloGuard: true }, '');

    const handlePopState = () => {
      window.history.pushState({ soloGuard: true }, '');
      pendingBackRef.current = true;
      setShowExitModal(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [gameEnded, showSetSelection]);

  const handleConfirmExit = useCallback(() => {
    if (pendingBackRef.current) {
      pendingBackRef.current = false;
      window.history.go(-2);
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    // Reset game state when deck changes
    setCurrentIndex(0);
    setScore(0);
    setAnsweredCards(0);
    setSelectedOption(null);
    setFeedback(null);
    setGameEnded(false);
    setLoading(true);

    if (deckId) {
      setShowSetSelection(false);
      fetchDeck(deckId);
      fetchCards(deckId);
      fetchUserLocale();
      setStartTime(Date.now());
    } else {
      setShowSetSelection(true);
      fetchAvailableSets();
      setLoading(false);
    }
  }, [deckId]);

  const fetchAvailableSets = async () => {
    try {
      // Only show user's own decks
      const decksData = await api.decks.list({ filter: 'owned' });
      setAvailableSets(decksData);
    } catch (error) {
      console.error("Error fetching sets:", error);
    }
  };

  const fetchUserLocale = async () => {
    try {
      const user = await api.users.current();
      setUserLocale(user.preferred_locale || "es-ES");
    } catch (error) {
      console.error("Error fetching user locale:", error);
    }
  };

  const fetchDeck = async (deckId: string) => {
    try {
      const deckData = await api.decks.get(deckId);
      setDeck(deckData);
    } catch (error) {
      console.error("Error fetching deck:", error);
    }
  };

  // Filter question types based on mic availability
  const availableQuestionTypes = micEnabled
    ? QUESTION_TYPE_LIST
    : QUESTION_TYPE_LIST.filter((qt) => !isSpeechQuestion(qt));

  const fetchCards = async (deckId: string) => {
    try {
      const cardsData = await api.cards.list(deckId);
      // Shuffle cards
      const shuffled = cardsData.sort(() => Math.random() - 0.5);
      setCards(shuffled);

      // Assign random question type to each card (filter speech types if no mic)
      const typesToUse = micEnabled
        ? QUESTION_TYPE_LIST
        : QUESTION_TYPE_LIST.filter((qt) => !isSpeechQuestion(qt));
      const questions = shuffled.map((card: DbCard) => ({
        card,
        questionType:
          typesToUse[
            Math.floor(Math.random() * typesToUse.length)
          ],
      }));
      setCardQuestions(questions);
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  // Re-assign question types after voice prompt is dismissed (mic choice is now final)
  useEffect(() => {
    if (!showVoicePrompt && cards.length > 0) {
      const typesToUse = micEnabled
        ? QUESTION_TYPE_LIST
        : QUESTION_TYPE_LIST.filter((qt) => !isSpeechQuestion(qt));
      const questions = cards.map((card: DbCard) => ({
        card,
        questionType:
          typesToUse[Math.floor(Math.random() * typesToUse.length)],
      }));
      setCardQuestions(questions);
      setCurrentIndex(0);
      setScore(0);
      setAnsweredCards(0);
      setSelectedOption(null);
      setFeedback(null);
      setStartTime(Date.now());
    }
  }, [showVoicePrompt]);

  const currentQuestion = cardQuestions[currentIndex];
  const currentCard = currentQuestion?.card;
  const questionType = currentQuestion?.questionType;

  // Generate options when card changes (skip speech and written questions)
  useEffect(() => {
    if (currentCard && questionType && !isSpeechQuestion(questionType) && !isWrittenQuestion(questionType)) {
      const newOptions = buildOptions({
        question: currentCard,
        questions: cards,
        questionType,
      });
      setCurrentOptions(newOptions);
    } else {
      setCurrentOptions([]);
    }
  }, [currentIndex, currentCard?.id, questionType]);

  // Options now generated via shared helper above

  const handleSelectOption = async (option: string) => {
    if (selectedOption || !currentCard) return; // Already answered

    setSelectedOption(option);

    let correctAnswer: string = '';
    switch (questionType) {
      case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
      case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
        correctAnswer = getEnglishAnswer(currentCard);
        break;
      case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
      case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH:
        correctAnswer = getSpanishAnswer(currentCard);
        break;
    }

    const isCorrect = option === correctAnswer;
    setFeedback(isCorrect ? "correct" : "incorrect");

    if (isCorrect) {
      setScore(score + 1);
    }

    // Save study event
    await saveStudyEvent(isCorrect ? "correct" : "incorrect", "tap", null);

    setAnsweredCards(answeredCards + 1);

    // Move to next card after 1.5 seconds
    setTimeout(() => {
      moveToNext(isCorrect);
    }, 1500);
  };

  const handleWrittenAnswer = async (result: WrittenResult) => {
    if (!currentCard || !deck) return;

    const isCorrect = result.isCorrect;
    setFeedback(isCorrect ? "correct" : "incorrect");
    setSelectedOption(result.userAnswer);

    if (isCorrect) {
      setScore(score + 1);
    }

    await saveStudyEvent(
      isCorrect ? "correct" : "incorrect",
      "written",
      result.userAnswer,
    );

    setAnsweredCards(answeredCards + 1);

    setTimeout(() => {
      moveToNext(isCorrect);
    }, isCorrect ? 1500 : 2500);
  };

  const handleSpeechAnswer = async (transcript: string, confidence?: number) => {
    if (!currentCard) return;
    
    const target = getSpanishAnswer(currentCard);

    try {
      // Use lenient matching evaluation from backend
      const result = await api.speech.evaluate(transcript, target, confidence);
      const isCorrect = result.accepted;

      setFeedback(isCorrect ? "correct" : "incorrect");
      setSelectedOption(transcript);

      if (isCorrect) {
        setScore(score + 1);
      }

      // Save study event
      await saveStudyEvent(
        isCorrect ? "correct" : "incorrect",
        "speech",
        transcript,
      );

      setAnsweredCards(answeredCards + 1);

      // Move to next card after 2 seconds
      setTimeout(() => {
        moveToNext(isCorrect);
      }, 2000);
    } catch (err) {
      console.error("Error evaluating speech:", err);
      // Fallback to simple comparison
      const normalized = normalizeSpanish(transcript);
      const correctAnswer = normalizeSpanish(target);
      const isCorrect = normalized === correctAnswer;

      setFeedback(isCorrect ? "correct" : "incorrect");
      setSelectedOption(transcript);

      if (isCorrect) {
        setScore(score + 1);
      }

      await saveStudyEvent(
        isCorrect ? "correct" : "incorrect",
        "speech",
        transcript,
      );

      setAnsweredCards(answeredCards + 1);

      setTimeout(() => {
        moveToNext(isCorrect);
      }, 2000);
    }
  };

  const moveToNext = (wasCorrect?: boolean) => {
    if (currentIndex + 1 >= cardQuestions.length) {
      // Calculate final score including this last answer
      const finalScore = wasCorrect ? score + 1 : score;
      endGame(finalScore);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setFeedback(null);
    }
  };

  const saveStudyEvent = async (result: 'correct' | 'incorrect', responseType: string, transcript: string | null) => {
    if (!deck || !currentCard) return;
    
    try {
      await api.studyEvents.create({
        deck_id: deck.id,
        card_id: currentCard.id,
        result,
        mode: "play_solo",
        response_type: responseType,
        transcript_es: transcript || undefined,
      });
    } catch (error) {
      console.error("Error saving study event:", error);
    }
  };

  const endGame = async (finalScore?: number) => {
    setGameEnded(true);
    const endTime = Date.now();
    const duration = startTime ? Math.round((endTime - startTime) / 1000) : 0;
    const scoreToUse = finalScore !== undefined ? finalScore : score;
    const accuracy = Math.round((scoreToUse / cards.length) * 100);
    
    // Award XP for Solo Blitz (1 XP per correct answer)
    try {
      const xpResponse = await api.xp.awardSoloBlitz({
        setId: deckId || undefined,
        sessionId: `solo-${Date.now()}`,
        correctAnswers: scoreToUse,
      });
      setXpEarned(xpResponse.xpEarned || scoreToUse);
      setXpTotal(xpResponse.xpTotal || 0);
      
      // Refresh user data to update XP in dashboard
      await refetchUser();
    } catch (error) {
      console.error('Error awarding XP:', error);
      // Still set xpEarned to show at least what they earned
      setXpEarned(scoreToUse);
    }
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setScore(0);
    setAnsweredCards(0);
    setGameEnded(false);
    setSelectedOption(null);
    setFeedback(null);
    setStartTime(Date.now());
    setXpEarned(0);
    setXpTotal(0);

    // Re-shuffle and re-assign question types (filter speech types if no mic)
    const typesToUse = micEnabled
      ? QUESTION_TYPE_LIST
      : QUESTION_TYPE_LIST.filter((qt) => !isSpeechQuestion(qt));
    const shuffled = cards.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    const questions = shuffled.map((card: DbCard) => ({
      card,
      questionType:
        typesToUse[
          Math.floor(Math.random() * typesToUse.length)
        ],
    }));
    setCardQuestions(questions);
  };

  // Get question prompt based on type
  const resolvedPrompt = getQuestionPrompt(currentCard, questionType);
  const resolvedLabel = getQuestionTypeLabel(questionType);

  // Set Selection Screen
  if (showSetSelection) {
    return (
      <DashboardLayout>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Play Solo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a set to start practicing
          </p>
        </div>

        {availableSets.length === 0 ? (
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <BookOpen className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No Sets Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first set to start practicing
            </p>
            <Link
              to="/admin/create-set"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-medium"
            >
              Create Your First Set
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {availableSets.map((set) => (
              <Link
                key={set.id}
                to={`/play/solo?deck=${set.id}`}
                className="bg-white dark:bg-gray-800 border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group
                  border-gray-200 dark:border-gray-700"
                style={{
                  borderLeftWidth: "5px",
                  borderLeftColor: set.primary_color_hex || "#10A5C3",
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 transition-colors">
                      {set.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {set.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                    size={24}
                  />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {set.card_count || 0} cards
                  </span>
                  <span className="text-sm font-medium text-blue-600">
                    Start Playing →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

      </DashboardLayout>
    );
  }

  // Show voice mode prompt before game (always on mode entry when a deck is selected)
  if (deckId && showVoicePrompt && !loading) {
    return (
      <DashboardLayout>
        <MicPermissionModal onComplete={() => setShowVoicePrompt(false)} />
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

  if (!deck || cards.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Set Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This set doesn't exist or has no cards.
          </p>
          <Link
            to="/play/solo"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
          >
            Choose Another Set
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (gameEnded) {
    const accuracy = Math.round((score / cards.length) * 100);

    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Trophy className="mx-auto mb-4 text-yellow-500" size={64} />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Game Complete!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Great job on completing {deck.title}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Target className="mx-auto mb-2 text-blue-600" size={32} />
                <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
                <p className="text-3xl font-bold text-blue-600">
                  {score}/{cards.length}
                </p>
              </div>

              <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <Trophy className="mx-auto mb-2 text-green-600" size={32} />
                <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
                <p className="text-3xl font-bold text-green-600">{accuracy}%</p>
              </div>

              <div className="p-5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <Clock className="mx-auto mb-2 text-orange-600" size={32} />
                <p className="text-sm text-gray-600 dark:text-gray-400">Cards</p>
                <p className="text-3xl font-bold text-orange-600">
                  {cards.length}
                </p>
              </div>

              <div className="p-5 bg-purple-50 dark:bg-purple-900/20 rounded-xl border-2 border-purple-300 dark:border-purple-700">
                <div className="text-3xl mb-2 mx-auto text-center">⚡</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">XPs Earned</p>
                <p className="text-3xl font-bold text-purple-600">
                  +{xpEarned}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={restartGame}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 font-medium"
              >
                Play Again
              </button>
              <Link
                to="/classrooms"
                className="bg-purple-600 text-white px-8 py-3 rounded-xl hover:bg-purple-700 font-medium flex items-center justify-center gap-2"
              >
                <Trophy size={20} />
                View Assignments
              </Link>
              <Link
                to="/play/solo"
                className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-8 py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Choose Another Set
              </Link>
            </div>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back to Dashboard */}
        <button
          onClick={() => setShowExitModal(true)}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deck.title}</h1>
            <div className="flex items-center gap-3">
              {/* XP Badge */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">XPs</span>
                <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {score}/{cards.length}
                </span>
              </div>
              {/* Progress */}
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                {currentIndex + 1} / {cards.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-500 to-purple-600"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 mb-6">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium mb-4">
              {resolvedLabel}
            </div>

            {resolvedPrompt && (
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {resolvedPrompt}
              </h2>
            )}

            {/* Audio button for audio questions */}
            {isAudioQuestion(questionType) && (
              <div className="mb-4 flex flex-col items-center">
                <TTSButton
                  text={getSpanishAnswer(currentCard)}
                  locale={userLocale}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Click to hear the Spanish phrase and select the right meaning
                  below
                </p>
              </div>
            )}
          </div>

          {/* Multiple Choice Questions */}
          {!isSpeechQuestion(questionType) && !isWrittenQuestion(questionType) && (
            <div className="space-y-3 min-h-[300px]">
              {currentOptions.map((option, index) => {
                const isSelected = selectedOption === option;
                let correctAnswer;

                switch (questionType) {
                  case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
                  case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
                    correctAnswer = getEnglishAnswer(currentCard);
                    break;
                  case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
                    correctAnswer = getSpanishAnswer(currentCard);
                    break;
                }

                const isCorrect = option === correctAnswer;
                const showResult = selectedOption !== null;

                let bgColor = "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100";
                let hoverEffect = showResult ? "" : "hover:bg-gray-100 dark:hover:bg-gray-600";

                if (showResult && isSelected && isCorrect) {
                  bgColor = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-900 dark:text-green-200";
                } else if (showResult && isSelected && !isCorrect) {
                  bgColor = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-900 dark:text-red-200";
                } else if (showResult && isCorrect) {
                  bgColor = "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-900 dark:text-green-200";
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectOption(option)}
                    disabled={selectedOption !== null}
                    className={`w-full px-6 py-4 border-2 rounded-lg font-medium text-left ${bgColor} ${hoverEffect} ${
                      selectedOption === null
                        ? "cursor-pointer"
                        : "cursor-not-allowed"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {/* Speech Questions (only when mic is enabled) */}
          {micEnabled && isSpeechQuestion(questionType) && !selectedOption && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <SpeechRecognition
                  onTranscript={handleSpeechAnswer}
                  locale={userLocale}
                  onError={(error) => console.error("Speech error:", error)}
                  autoStop={true}
                  userId={user?.id}
                />
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Click the microphone and say the Spanish translation</p>
              </div>
            </div>
          )}

          {/* Written Answer Questions */}
          {isWrittenQuestion(questionType) && !selectedOption && (
            <div className="space-y-4">
              <WrittenAnswer
                correctAnswer={getSpanishAnswer(currentCard)}
                onResult={handleWrittenAnswer}
              />
            </div>
          )}

          {/* Written Answer Feedback */}
          {isWrittenQuestion(questionType) && selectedOption && feedback && (
            <div className="space-y-4">
              {feedback === "correct" ? (
                <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-500">
                  <p className="font-medium text-green-800 dark:text-green-300">✓ Correct!</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/40 border-2 border-red-500">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">You typed:</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{selectedOption}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Correct answer:</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {getSpanishAnswer(currentCard)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Speech Feedback (only when mic is enabled) */}
          {micEnabled && isSpeechQuestion(questionType) && selectedOption && (
            <div className="space-y-4">
              {feedback === "correct" ? (
                <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-500">
                  <p className="font-medium text-green-800 dark:text-green-300">✓ Correct!</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/40 border-2 border-red-500">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">You said:</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{selectedOption}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Correct answer:</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {getSpanishAnswer(currentCard)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
        </AnimatePresence>

      </div>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowExitModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Are you sure you want to exit this set?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                You will lose all your progress.
              </p>
              <div className="flex gap-3">
                <button
                  autoFocus
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
