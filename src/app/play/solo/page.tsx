
import { useState, useEffect } from "react";
import Navigation from "@/shared/components/Navigation";
import AdPlaceholder from "@/shared/components/AdPlaceholder";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
import { Trophy, Target, Clock, BookOpen, ArrowRight } from "lucide-react";
import { api } from "@/config/api";
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
  type QuestionType,
} from "../lib/quizUtils";


interface CardQuestion {
  card: DbCard;
  questionType: QuestionType;
}

export default function PlaySoloPage() {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deckId = params.get("deck");

    if (deckId) {
      setShowSetSelection(false);
      fetchDeck(deckId);
      fetchCards(deckId);
      fetchUserLocale();
      setStartTime(Date.now());
    } else {
      fetchAvailableSets();
      setLoading(false);
    }
  }, []);

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

  const fetchCards = async (deckId: string) => {
    try {
      const cardsData = await api.cards.list(deckId);
      // Shuffle cards
      const shuffled = cardsData.sort(() => Math.random() - 0.5);
      setCards(shuffled);

      // Assign random question type to each card
      const questions = shuffled.map((card: DbCard) => ({
        card,
        questionType:
          QUESTION_TYPE_LIST[
            Math.floor(Math.random() * QUESTION_TYPE_LIST.length)
          ],
      }));
      setCardQuestions(questions);
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = cardQuestions[currentIndex];
  const currentCard = currentQuestion?.card;
  const questionType = currentQuestion?.questionType;

  // Generate options when card changes
  useEffect(() => {
    if (currentCard && questionType && !isSpeechQuestion(questionType)) {
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
      moveToNext();
    }, 1500);
  };

  const handleSpeechAnswer = async (transcript: string) => {
    if (!currentCard) return;
    
    const normalized = normalizeSpanish(transcript);
    const correctAnswer = normalizeSpanish(getSpanishAnswer(currentCard));
    const isCorrect = normalized === correctAnswer;

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
      moveToNext();
    }, 2000);
  };

  const moveToNext = () => {
    if (currentIndex + 1 >= cardQuestions.length) {
      endGame();
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

  const endGame = async () => {
    setGameEnded(true);
    const endTime = Date.now();
    const duration = startTime ? Math.round((endTime - startTime) / 1000) : 0;
    const accuracy = Math.round((score / cards.length) * 100);
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setScore(0);
    setAnsweredCards(0);
    setGameEnded(false);
    setSelectedOption(null);
    setFeedback(null);
    setStartTime(Date.now());

    // Re-shuffle and re-assign question types
    const shuffled = cards.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    const questions = shuffled.map((card: DbCard) => ({
      card,
      questionType:
        QUESTION_TYPE_LIST[
          Math.floor(Math.random() * QUESTION_TYPE_LIST.length)
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
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Play Solo</h1>
            <p className="text-xl text-gray-600">
              Choose a set to start practicing
            </p>
          </div>

          {availableSets.length === 0 ? (
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-12 text-center">
              <BookOpen className="mx-auto mb-4 text-gray-400" size={64} />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                No Sets Yet
              </h2>
              <p className="text-gray-600 mb-6">
                Create your first set to start practicing
              </p>
              <a
                href="/admin/create-set"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Create Your First Set
              </a>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {availableSets.map((set) => (
                <a
                  key={set.id}
                  href={`/play/solo?deck=${set.id}`}
                  className="bg-white border-2 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer group"
                  style={{
                    borderLeftWidth: "6px",
                    borderLeftColor: set.primary_color_hex || "#0EA5E9",
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {set.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {set.description}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                      size={24}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      {set.card_count || 0} cards
                    </span>
                    <span className="text-sm font-medium text-blue-600">
                      Start Playing →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="mt-8">
            <AdPlaceholder />
          </div>
        </div>
      </div>
    );
  }

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

  if (!deck || cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Set Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            This set doesn't exist or has no cards.
          </p>
          <a
            href="/play/solo"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Choose Another Set
          </a>
        </div>
      </div>
    );
  }

  if (gameEnded) {
    const accuracy = Math.round((score / cards.length) * 100);

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Trophy className="mx-auto mb-4 text-yellow-500" size={64} />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Game Complete!
            </h1>
            <p className="text-gray-600 mb-8">
              Great job on completing {deck.title}
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-blue-50 rounded-lg">
                <Target className="mx-auto mb-2 text-blue-600" size={32} />
                <p className="text-sm text-gray-600">Score</p>
                <p className="text-3xl font-bold text-blue-600">
                  {score}/{cards.length}
                </p>
              </div>

              <div className="p-6 bg-green-50 rounded-lg">
                <Trophy className="mx-auto mb-2 text-green-600" size={32} />
                <p className="text-sm text-gray-600">Accuracy</p>
                <p className="text-3xl font-bold text-green-600">{accuracy}%</p>
              </div>

              <div className="p-6 bg-orange-50 rounded-lg">
                <Clock className="mx-auto mb-2 text-orange-600" size={32} />
                <p className="text-sm text-gray-600">Cards</p>
                <p className="text-3xl font-bold text-orange-600">
                  {cards.length}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={restartGame}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Play Again
              </button>
              <a
                href="/play/solo"
                className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-300 font-medium"
              >
                Choose Another Set
              </a>
            </div>
          </div>

          <div className="mt-8">
            <AdPlaceholder />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{deck.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Target className="text-blue-600" size={20} />
                <span className="font-semibold text-blue-600">
                  {score}/{cards.length}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {currentIndex + 1} / {cards.length}
              </div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-4">
              {resolvedLabel}
            </div>

            {resolvedPrompt && (
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
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
          {!isSpeechQuestion(questionType) && (
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

                let bgColor = "bg-gray-50 border-gray-200";
                let hoverEffect = showResult ? "" : "hover:bg-gray-100";

                if (showResult && isSelected && isCorrect) {
                  bgColor = "bg-green-100 border-green-500";
                } else if (showResult && isSelected && !isCorrect) {
                  bgColor = "bg-red-100 border-red-500";
                } else if (showResult && isCorrect) {
                  bgColor = "bg-green-50 border-green-300";
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

          {/* Speech Questions */}
          {isSpeechQuestion(questionType) && !selectedOption && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <SpeechRecognition
                  onTranscript={handleSpeechAnswer}
                  locale={userLocale}
                  onError={(error) => console.error("Speech error:", error)}
                  autoStop={true} // Close mic automatically after answer
                />
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Click the microphone and say the Spanish translation</p>
              </div>
            </div>
          )}

          {/* Speech Feedback */}
          {isSpeechQuestion(questionType) && selectedOption && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${
                  feedback === "correct"
                    ? "bg-green-100 border-2 border-green-500"
                    : "bg-red-100 border-2 border-red-500"
                }`}
              >
                <p className="text-sm text-gray-600 mb-1">You said:</p>
                <p className="font-medium text-gray-900">{selectedOption}</p>
              </div>

              {feedback === "incorrect" && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Correct answer:</p>
                  <p className="font-medium text-gray-900">
                    {getSpanishAnswer(currentCard)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ad Placeholder */}
        <AdPlaceholder />
      </div>
    </div>
  );
}
