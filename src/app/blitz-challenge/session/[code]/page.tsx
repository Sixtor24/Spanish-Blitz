// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import DashboardLayout from "@/shared/components/DashboardLayout";
import useUser from "@/shared/hooks/useUser";
import { Trophy, Crown, Medal, Zap, Users, Clock, ArrowLeft, Timer, Play, Mic } from "lucide-react";
import { api, API_BASE_URL } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
import BlitzMicModal from "@/shared/components/BlitzMicModal";
import WrittenAnswer, { type WrittenResult, evaluateWrittenAnswer } from "@/shared/components/WrittenAnswer";
import { useMicrophone } from "@/lib/microphone-context";
import { useNavigationGuard } from "@/lib/navigation-guard-context";
import {
  QUESTION_TYPES,
  getSpanishPrompt,
  getSpanishAnswer,
  getEnglishAnswer,
  buildOptions,
  getQuestionPrompt as computeQuestionPrompt,
  getQuestionTypeLabel as computeQuestionTypeLabel,
  normalizeSpanish,
  isSpeechQuestion,
  isAudioQuestion,
  isWrittenQuestion,
  deriveQuestionTypeByPosition,
} from "../../../play/lib/quizUtils";

function GameView({
  question,
  questions,
  questionType,
  totalQuestions,
  score,
  answeredCount,
  onAnswer,
  isTeacher,
  userLocale,
  userId,
  micEnabled,
}: {
  question: any;
  questions: any[];
  questionType: string | null;
  totalQuestions: number;
  score: number;
  answeredCount: number;
  onAnswer: (isCorrect: boolean, answerText?: string | null) => void;
  isTeacher: boolean;
  userLocale: string;
  userId?: string;
  micEnabled: boolean;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);

  useEffect(() => {
    setSelectedOption(null);
    setFeedback(null);
    if (!isSpeechQuestion(questionType) && !isWrittenQuestion(questionType) && question && questionType) {
      setCurrentOptions(
        buildOptions({
          question,
          questions,
          questionType,
        }),
      );
    } else {
      setCurrentOptions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, questionType]);

  const handleSelectOption = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);

    let correctAnswer;
    switch (questionType) {
      case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
      case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
        correctAnswer = getEnglishAnswer(question);
        break;
      case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
      case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH:
        correctAnswer = getSpanishAnswer(question);
        break;
    }

    const isCorrect = option === correctAnswer;
    setFeedback(isCorrect ? "correct" : "incorrect");
    onAnswer(isCorrect, option);
  };

  const handleSpeechAnswer = async (transcript: string, confidence?: number) => {
    const target = getSpanishAnswer(question);

    try {
      // Use lenient matching evaluation from backend
      const result = await api.speech.evaluate(transcript, target, confidence);
      const isCorrect = result.accepted;
      setSelectedOption(transcript);
      setFeedback(isCorrect ? "correct" : "incorrect");
      onAnswer(isCorrect, transcript);
    } catch (err) {
      console.error("Error evaluating speech:", err);
      // Fallback to simple comparison
      const normalized = normalizeSpanish(transcript);
      const correctAnswer = normalizeSpanish(target);
      const isCorrect = normalized === correctAnswer;
      setSelectedOption(transcript);
      setFeedback(isCorrect ? "correct" : "incorrect");
      onAnswer(isCorrect, transcript);
    }
  };

  const handleWrittenAnswer = (result: WrittenResult) => {
    setSelectedOption(result.userAnswer);
    setFeedback(result.isCorrect ? "correct" : "incorrect");
    onAnswer(result.isCorrect, result.userAnswer);
  };

  const getQuestionPromptText = () => computeQuestionPrompt(question, questionType);

  const getQuestionTypeLabelText = () => computeQuestionTypeLabel(questionType);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex items-center justify-between flex-wrap sm:flex-nowrap gap-2">
        <div className="text-center sm:text-left">
          <p className="text-xs text-gray-500 dark:text-gray-400">Your score</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{score}</p>
        </div>
        <div className="text-center sm:text-right text-sm text-gray-600 dark:text-gray-300">
          Progress {answeredCount}/{totalQuestions}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">Question {question.position} of {totalQuestions}</p>
      <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 shadow-sm">
        <div className="block px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium mb-3 mx-auto text-center">
          {getQuestionTypeLabelText()}
        </div>

        {getQuestionPromptText() && (
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center">{getQuestionPromptText()}</h2>
        )}

        {isAudioQuestion(questionType) && (
          <div className="mb-4 flex flex-col items-center">
            <TTSButton text={getSpanishAnswer(question)} locale={userLocale} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Tap to hear the Spanish phrase and choose the meaning</p>
          </div>
        )}

        {!isSpeechQuestion(questionType) && !isWrittenQuestion(questionType) && (
          <div className="space-y-3">
            {currentOptions.map((option, index) => {
              const isSelected = selectedOption === option;
              let correctAnswer;
              switch (questionType) {
                case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
                case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
                  correctAnswer = getEnglishAnswer(question);
                  break;
                case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
                  correctAnswer = getSpanishAnswer(question);
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
                  disabled={!!selectedOption || isTeacher}
                  className={`w-full px-4 py-3 sm:px-5 sm:py-4 border-2 rounded-lg sm:text-left text-center font-medium text-sm sm:text-base ${bgColor} ${hoverEffect} ${selectedOption === null ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {micEnabled && isSpeechQuestion(questionType) && !selectedOption && (
          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <SpeechRecognition
                onTranscript={handleSpeechAnswer}
                locale={userLocale}
                onError={(err) => console.error("Speech error:", err)}
                autoStop={true}
                userId={userId}
              />
            </div>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">Click the mic and say the Spanish translation</p>
          </div>
        )}

        {isWrittenQuestion(questionType) && !selectedOption && (
          <div className="space-y-4 mt-4">
            <WrittenAnswer
              correctAnswer={getSpanishAnswer(question)}
              onResult={handleWrittenAnswer}
            />
          </div>
        )}

        {isWrittenQuestion(questionType) && selectedOption && (
          <div className="space-y-3 mt-4">
            {feedback === "correct" ? (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-500">
                <p className="font-medium text-green-800 dark:text-green-300">✓ Correct!</p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/40 border-2 border-red-500">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">You typed:</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedOption}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Correct answer:</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{getSpanishAnswer(question)}</p>
                </div>
              </>
            )}
          </div>
        )}

        {micEnabled && isSpeechQuestion(questionType) && selectedOption && (
          <div className="space-y-3 mt-4">
            {feedback === "correct" ? (
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-500">
                <p className="font-medium text-green-800 dark:text-green-300">✓ Correct!</p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/40 border-2 border-red-500">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">You said:</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedOption}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Correct answer:</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{getSpanishAnswer(question)}</p>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BlitzSessionPage() {
  const { code: codeParam } = useParams<{ code: string }>();
  const code = codeParam?.toUpperCase();
  const { data: user, refetch: refetchUser } = useUser();
  const { micEnabled, resetMic } = useMicrophone();
  const [showMicGate, setShowMicGate] = useState(true);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const [xpFinalized, setXpFinalized] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();
  const { setGuard } = useNavigationGuard();
  const pendingBackRef = useRef(false);

  const sessionId = state?.session?.id;
  const me = (state?.players ?? []).find((p) => p.email === user?.email);
  const isHost = !!me?.is_host;
  const isAdmin = user?.role === 'admin';
  const isTeacherHost = state?.session?.is_teacher && isHost;
  const roleLabel = isTeacherHost ? "Teacher (spectator)" : "Player";
  const totalQuestions = state?.totalQuestions ?? state?.questions?.length ?? 0;
  // Admin can always see ranking, or if you're the host
  const canSeeRanking = isAdmin || isHost;

  // Derive question types consistently by position to ensure same experience for all players
  // When mic is not enabled, fallback speech questions to a text-based type
  const deriveQuestionType = (question) => {
    const qt = deriveQuestionTypeByPosition(question);
    if (!micEnabled && isSpeechQuestion(qt)) {
      return QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT;
    }
    return qt;
  };

  const currentAnswers = state?.currentPlayerAnswers ?? [];
  const currentQuestion = useMemo(() => {
    if (!state?.questions) return null;
    const answeredIds = new Set(currentAnswers.map((a) => a.question_id));
    return state.questions.find((q) => !answeredIds.has(q.id)) ?? null;
  }, [state, currentAnswers]);

  // Reset mic state on mount so the prompt always shows when entering a blitz session
  useEffect(() => {
    resetMic();
  }, []);

  // Calculate initial time left
  useEffect(() => {
    if (!state?.session?.ends_at || state?.session?.status === 'pending') {
      setTimeLeft(null);
      return;
    }
    const diff = Math.floor((new Date(state.session.ends_at).getTime() - Date.now()) / 1000);
    setTimeLeft(Math.max(0, diff));
  }, [state?.session?.ends_at, state?.session?.status]);

  const formatSeconds = (secs: number | null) => {
    if (secs == null) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function joinSession() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.playSessions.join(code, user?.display_name || user?.email || "Guest");
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join session");
    } finally {
      setLoading(false);
    }
  }

  async function fetchState() {
    if (!sessionId) return;
    try {
      const data = await api.playSessions.getState(sessionId);
      setState(data);
    } catch (e) {
      /* ignore polling error */
    }
  }

  // Auth handled by withAuth HOC

  useEffect(() => {
    if (user && code) {
      joinSession();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code]);

  // Timer countdown effect - updates every second and ends game when time runs out
  useEffect(() => {
    if (!state?.session || state.session.status !== 'active' || !state.session.ends_at) return;
    
    const timerInterval = setInterval(() => {
      const now = Date.now();
      const endsAt = new Date(state.session.ends_at).getTime();
      const newTimeLeft = Math.floor((endsAt - now) / 1000);
      
      if (newTimeLeft <= 0) {
        clearInterval(timerInterval);
        setTimeLeft(0);
        // Force refresh to get final state
        fetchState();
      } else {
        setTimeLeft(newTimeLeft);
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [state?.session?.status, state?.session?.ends_at]);

  useEffect(() => {
    if (sessionId) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(fetchState, 5000);
      fetchState();

      // setup websocket for real-time refresh signals
      // Use API_BASE_URL to connect to the backend WebSocket server
      const wsUrl = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^https?/, (match) => match === 'https' ? 'wss' : 'ws');

      const connect = () => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectRef.current = 0;
          ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg?.type === 'session:refresh' && msg.sessionId === sessionId) {
              fetchState();
            }
          } catch (e) {
            /* ignore */
          }
        };

        ws.onclose = () => {
          const timeout = Math.min(8000, 1000 * 2 ** reconnectRef.current);
          reconnectRef.current += 1;
          setTimeout(connect, timeout);
        };

        ws.onerror = () => {
          ws.close();
        };
      };

      connect();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleAnswer = async (isCorrect: boolean, answerText: string | null = null) => {
    if (!sessionId || !currentQuestion) return;
    try {
      await api.playSessions.answer(sessionId, currentQuestion.id, isCorrect, answerText);
      fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to answer");
    }
  };

  const allAnswered = !currentQuestion && currentAnswers.length > 0;
  const status = state?.session?.status;

  const isSessionActive = status === 'active' && !allAnswered;

  // ─── Navigation Guard (sidebar / in-app links) ────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const unregister = setGuard(() => setShowExitModal(true));
    return unregister;
  }, [isSessionActive, setGuard]);

  // ─── Navigation Protection (reload, tab close, browser back) ──
  useEffect(() => {
    if (!isSessionActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.history.pushState({ blitzGuard: true }, '');

    const handlePopState = () => {
      window.history.pushState({ blitzGuard: true }, '');
      pendingBackRef.current = true;
      setShowExitModal(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSessionActive]);

  const handleConfirmExit = useCallback(() => {
    if (pendingBackRef.current) {
      pendingBackRef.current = false;
      window.history.go(-2);
    } else {
      navigate('/blitz-challenge');
    }
  }, [navigate]);

  // Auto-finalize XP when game completes
  useEffect(() => {
    if ((status === 'completed' || allAnswered) && isHost && !xpFinalized) {
      finalizeXP();
    }
  }, [status, allAnswered, isHost, xpFinalized]);

  const playerProgress = (state?.players ?? [])
    .filter((p) => {
      // Filter out teacher in spectator mode from rankings
      const isThisPlayerTeacherHost = state?.session?.is_teacher && p.is_host;
      return !isThisPlayerTeacherHost;
    })
    .map((p) => {
      const answered = p.answered_count ?? 0;
      const progress = totalQuestions ? Math.min(100, Math.round((answered / totalQuestions) * 100)) : 0;
      return { ...p, answered, progress };
    })
    .sort((a, b) => b.score - a.score);

  const startSession = async () => {
    if (!sessionId) return;
    try {
      await api.playSessions.start(sessionId);
      fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la sesión');
    }
  };

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (!sessionId) return;
    if (!confirm(`¿Expulsar a ${playerName} de la sesión?`)) return;

    try {
      await api.playSessions.kickPlayer(sessionId, playerId);
      fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo expulsar al jugador');
    }
  };

  // Finalize and award XP when game completes
  const finalizeXP = async () => {
    if (!sessionId || !isHost || xpFinalized) return;
    
    try {
      // Prepare results for XP calculation
      const results = playerProgress.map((p, idx) => ({
        userId: p.user_id,
        rank: idx + 1,
        participated: p.answered > 0,
      }));

      await api.xp.finalizeBlitzChallenge(sessionId, results);
      
      setXpFinalized(true);
      console.log('✅ XP finalized for Blitz Challenge');
      
      // Refresh user data to update XP in dashboard
      await refetchUser();
      
      // Fetch state again to get updated XP values
      await fetchState();
    } catch (e) {
      console.error('Error finalizing XP:', e);
      // Don't show error to user, XP is not critical for game completion
    }
  };

  // Show mandatory mic popup only when teacher enabled require_mic
  // Teacher-spectators (isTeacherHost) skip it since they don't play
  // When require_mic is false: no popup, text-only cards (no speech questions)
  if (!loading && state?.session && showMicGate && !isTeacherHost && state.session.require_mic) {
    return (
      <DashboardLayout>
        <BlitzMicModal onComplete={() => setShowMicGate(false)} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <Link to="/blitz-challenge" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4">
          <ArrowLeft size={18} /> Back
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6 border border-transparent dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Código</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-gray-900 dark:text-gray-100">{code}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Conjunto: {state?.session?.deck_title ?? '—'}</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {canSeeRanking && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Users size={18} /> {playerProgress.length} jugadores
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Timer size={18} /> {state?.session?.time_limit_seconds ? formatSeconds(timeLeft ?? state.session.time_limit_seconds) : 'Sin límite'}
              </div>
              <div className="px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                {status === 'pending' ? 'Esperando' : status === 'active' ? 'En curso' : 'Finalizado'}
              </div>
            </div>
          </div>

          {canSeeRanking && (
            <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200">Tu rol</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {isTeacherHost ? 'Profesor - Solo observas el progreso' : 'Organizador - Puedes ver el ranking en vivo'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200">Puntuación</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Correcta +2 · Incorrecta -1. Preguntas tipo Solo Blitz.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <p className="font-semibold text-gray-800 dark:text-gray-200">Final del juego</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Termina cuando todos acaben o se agote el tiempo.</p>
              </div>
            </div>
          )}
        </div>

        {error && !(status === 'completed' && error.toLowerCase().includes('not active')) && (
          <div className={`rounded-lg p-3 mb-4 ${
            error.includes('finalizado') || error.includes('resultados') 
              ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>{error}</div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-gray-600 dark:text-gray-300 border border-transparent dark:border-gray-700">Loading...</div>
        ) : status === 'completed' ? (
          /* Full screen winners view */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 border border-transparent dark:border-gray-700">
            {/* Winners Screen - Full Width */}
            <div className="text-center py-8 space-y-8">
              {/* Trophy Animation */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <Trophy className="relative text-yellow-500" size={80} />
                </div>
              </div>

              {/* Completion Message */}
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  ¡Actividad Finalizada!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-xl">
                  Estos son los resultados finales
                </p>
              </div>

              {/* Top 3 Podium - Responsive */}
              <div className="mt-8 md:mt-12 mb-6 md:mb-8 px-2">
                <div className="flex items-end justify-center gap-2 sm:gap-4 md:gap-6 max-w-4xl mx-auto">
                  {/* 2nd Place */}
                  {playerProgress[1] && (
                    <div className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-none">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-lg sm:text-xl md:text-2xl border-2 sm:border-4 border-white shadow-lg mb-2 sm:mb-3">
                        {(playerProgress[1].display_name || playerProgress[1].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-gray-300 rounded-t-lg p-2 sm:p-3 md:p-4 text-center w-full">
                        <p className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">🥈</p>
                        <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 truncate">
                          {playerProgress[1].display_name || playerProgress[1].email.split('@')[0]}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-700 font-bold mt-0.5 sm:mt-1">{playerProgress[1].score} pts</p>
                        <div className="h-16 sm:h-20 md:h-24 bg-gray-400 mt-2 sm:mt-3 rounded"></div>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {playerProgress[0] && (
                    <div className="flex flex-col items-center flex-1 max-w-[140px] sm:max-w-none">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-xl sm:text-2xl md:text-3xl border-2 sm:border-4 border-white shadow-xl mb-2 sm:mb-3 animate-pulse">
                        {(playerProgress[0].display_name || playerProgress[0].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-yellow-400 rounded-t-lg p-3 sm:p-4 md:p-5 text-center w-full">
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold mb-0.5 sm:mb-1">🏆</p>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-gray-900 truncate">
                          {playerProgress[0].display_name || playerProgress[0].email.split('@')[0]}
                        </p>
                        <p className="text-xs sm:text-sm md:text-base text-gray-800 font-bold mt-0.5 sm:mt-1">{playerProgress[0].score} pts</p>
                        <div className="h-24 sm:h-28 md:h-36 bg-yellow-500 mt-2 sm:mt-3 rounded"></div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {playerProgress[2] && (
                    <div className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-none">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl md:text-2xl border-2 sm:border-4 border-white shadow-lg mb-2 sm:mb-3">
                        {(playerProgress[2].display_name || playerProgress[2].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-orange-400 rounded-t-lg p-2 sm:p-3 md:p-4 text-center w-full">
                        <p className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">🥉</p>
                        <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 truncate">
                          {playerProgress[2].display_name || playerProgress[2].email.split('@')[0]}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-700 font-bold mt-0.5 sm:mt-1">{playerProgress[2].score} pts</p>
                        <div className="h-12 sm:h-14 md:h-16 bg-orange-500 mt-2 sm:mt-3 rounded"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* XP Earned for Current User */}
              {me && (() => {
                const mePlayer = playerProgress.find(p => p.user_id === me.user_id);
                const myXp = mePlayer?.xp_earned || 0;
                return myXp > 0 && (
                  <div className="max-w-md mx-auto mb-8">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-6 text-center">
                      <div className="text-4xl mb-2">⚡</div>
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-1">HAS GANADO</p>
                      <p className="text-5xl font-bold text-purple-600 dark:text-purple-400 mb-1">+{myXp}</p>
                      <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Puntos de Experiencia</p>
                    </div>
                  </div>
                );
              })()}

              {/* Full Ranking Table - Responsive */}
              <div className="w-full max-w-5xl mx-auto mt-12 px-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📊 Ranking Completo</h3>
                
                {/* Desktop Table */}
                <div className="hidden md:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto shadow-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Posición</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Jugador</th>
                        <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Respondidas</th>
                        <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Puntos</th>
                        <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">XP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {playerProgress.map((p, idx) => {
                        const isCurrentUser = p.email === user?.email;
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                        const xpEarned = p.xp_earned || 0;

                        return (
                          <tr key={p.id} className={isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}>
                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{medal || `#${idx + 1}`}</span>
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                                  <span className="text-gray-600 dark:text-gray-300 font-semibold text-sm">
                                    {(p.display_name || p.email).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {p.display_name || p.email}
                                    {isCurrentUser && ' (Tú)'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {p.is_host ? (state?.session?.is_teacher ? '👨‍🏫 Profesor' : '👑 Organizador') : '🎮 Jugador'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {p.answered}/{totalQuestions}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <span className={`text-xl font-bold ${isCurrentUser ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                {p.score}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                                <span className="text-lg">⚡</span>
                                <span>+{xpEarned}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {playerProgress.map((p, idx) => {
                    const isCurrentUser = p.email === user?.email;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                    const xpEarned = p.xp_earned || 0;

                    return (
                      <div key={p.id} className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-4 shadow ${isCurrentUser ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl flex-shrink-0">{medal || `#${idx + 1}`}</span>
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-600 dark:text-gray-300 font-semibold">
                              {(p.display_name || p.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">
                              {p.display_name || p.email}
                              {isCurrentUser && ' (Tú)'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {p.is_host ? (state?.session?.is_teacher ? '👨‍🏫 Profesor' : '👑 Organizador') : '🎮 Jugador'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Respondidas</p>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{p.answered}/{totalQuestions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Puntos</p>
                            <p className={`text-xl font-bold ${isCurrentUser ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>{p.score}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">XP</p>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-sm">
                              <span>⚡</span>
                              <span>+{xpEarned}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <Link
                  to="/blitz-challenge"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 text-lg font-semibold shadow-md transition-all"
                >
                  Nueva Actividad
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 ${canSeeRanking && status === 'active' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {/* Main column: Lobby or Game */}
            <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-transparent dark:border-gray-700 ${canSeeRanking && status === 'active' ? 'lg:col-span-2' : ''}`}>
              {status === 'pending' ? (
                canSeeRanking ? (
                  // Admin/Host view - See all players in lobby
                  <div className="space-y-6">
                    <div className="text-center py-8">
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                        Sala de Espera
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 text-lg">
                        {(state?.players?.length ?? 0) < 2
                          ? "Esperando más jugadores para comenzar..."
                          : "¡Listos para comenzar!"}
                      </p>
                    </div>

                    {/* Session Info */}
                    <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">CONJUNTO</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-xl">{state?.session?.deck_title ?? '—'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-2">PREGUNTAS · TIEMPO</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-xl">
                          {totalQuestions} preguntas · {state?.session?.time_limit_seconds ? formatSeconds(state.session.time_limit_seconds) : 'Sin límite'}
                        </p>
                      </div>
                    </div>

                    {/* Players List */}
                    <div className="max-w-3xl mx-auto">
                      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Users size={20} className="sm:w-6 sm:h-6" />
                            <span className="hidden sm:inline">Participantes en la Sala</span>
                            <span className="sm:hidden">Participantes</span>
                          </h3>
                          <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-base sm:text-lg font-bold">
                            {playerProgress.filter(p => !p.is_host).length}
                          </span>
                        </div>

                        {/* Scrollable list with max height */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2 sm:space-y-3 pr-2">
                          {playerProgress.map((p) => {
                            const canKick = isHost && !p.is_host && p.email !== user?.email;

                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow gap-2"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                                    <span className="text-gray-600 dark:text-gray-300 font-bold text-base sm:text-lg">
                                      {(p.display_name || p.email).charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-lg truncate">
                                      {p.display_name || p.email}
                                    </span>
                                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                      {p.is_host ? (state?.session?.is_teacher ? '👨‍🏫 Profesor' : '👑 Organizador') : '🎮 Jugador'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold">
                                    ✓ Listo
                                  </span>

                                  {canKick && (
                                    <button
                                      onClick={() => kickPlayer(p.id, p.display_name || p.email)}
                                      className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
                                      title="Expulsar jugador"
                                    >
                                      <span className="hidden sm:inline">Expulsar</span>
                                      <span className="sm:hidden">✕</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {playerProgress.length > 5 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                            Desliza para ver más jugadores
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Start Button */}
                    <div className="text-center pt-4">
                      {isHost && (
                        <>
                          <button
                            onClick={startSession}
                            disabled={(state?.players?.length ?? 0) < 2}
                            className="inline-flex items-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold shadow-lg transition-all"
                          >
                            <Play size={24} /> Iniciar Actividad
                          </button>

                          {(state?.players?.length ?? 0) < 2 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center max-w-md mx-auto mt-4">
                              <p className="text-yellow-800 dark:text-yellow-300 font-medium">
                                Se necesitan al menos 2 jugadores para comenzar
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // Regular player view - Simple welcome screen
                  <div className="space-y-6 max-w-2xl mx-auto">
                    {/* Welcome Card */}
                    <div className="flex flex-col items-center justify-center py-12 space-y-6">
                      {/* User Avatar */}
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center border-4 border-white shadow-lg">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-300 to-gray-400"></div>
                      </div>

                      {/* Welcome Message */}
                      <div className="text-center">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                          ¡Te damos la bienvenida, {user?.display_name || user?.email?.split('@')[0] || 'Jugador'}!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 text-xl">
                          Esperando que el organizador inicie la actividad...
                        </p>
                      </div>
                    </div>

                    {/* Session Info */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">CONJUNTO</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-xl">{state?.session?.deck_title ?? '—'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-2">PREGUNTAS · TIEMPO</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-xl">
                          {totalQuestions} preguntas · {state?.session?.time_limit_seconds ? formatSeconds(state.session.time_limit_seconds) : 'Sin límite'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              ) : allAnswered && status === 'active' ? (
                /* Waiting screen - Player finished but others haven't */
                <div className="space-y-8 py-8 max-w-4xl mx-auto">
                  {/* Completion celebration */}
                  <div className="text-center space-y-6">
                    {/* Animated Trophy */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-200 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-green-400 to-green-600 rounded-full p-8 shadow-2xl animate-bounce">
                          <Trophy className="text-white" size={64} />
                        </div>
                      </div>
                    </div>

                    {/* Success Message */}
                    <div>
                      <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 animate-fade-in">
                        ¡Felicidades, {user?.display_name || 'Jugador'}!
                      </h2>
                      <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                        Has completado todas las preguntas
                      </p>
                      <p className="text-lg text-purple-600 font-semibold">
                        Esperando a que los demás terminen...
                      </p>
                    </div>

                    {/* Animated dots loader */}
                    <div className="flex justify-center gap-2 py-4">
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>

                  {/* Progress of other players */}
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Users size={24} />
                      Progreso de los Participantes
                    </h3>
                    <div className="space-y-4">
                      {playerProgress.map((p) => {
                        const progress = p.progress || 0;
                        const isMe = p.email === user?.email;
                        const isFinished = p.answered >= totalQuestions;

                        return (
                          <div key={p.id} className={`border-2 rounded-lg p-4 transition-all ${isMe ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMe ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`}>
                                  <span className={`font-bold ${isMe ? 'text-white' : 'text-gray-600'}`}>
                                    {(p.display_name || p.email).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 dark:text-gray-100">
                                    {p.display_name || p.email}
                                    {isMe && ' (Tú)'}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {p.answered}/{totalQuestions} preguntas
                                  </p>
                                </div>
                              </div>
                              {isFinished && (
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                  <Trophy size={16} />
                                  Terminó
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${isMe ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fun fact or motivational message */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6 text-center">
                    <p className="text-lg text-purple-800 dark:text-purple-300 font-medium">
                      💡 <strong>¿Sabías que?</strong> Mientras esperas, tu cerebro está consolidando lo que aprendiste. ¡Gran trabajo!
                    </p>
                  </div>
                </div>
              ) : isTeacherHost ? (
                <div className="space-y-6 py-8">
                  <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">👨‍🏫 Modo Profesor</h3>
                    <p>Solo puedes observar el progreso, no las preguntas.</p>
                  </div>
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {playerProgress.map((p) => (
                      <div key={p.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{p.display_name || p.email}</span>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{p.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-2">
                          <div
                            className="h-3 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{p.answered} / {totalQuestions} preguntas</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : currentQuestion ? (
                <GameView
                  question={currentQuestion}
                  questions={state?.questions || []}
                  questionType={deriveQuestionType(currentQuestion)}
                  totalQuestions={totalQuestions}
                  score={me?.score ?? 0}
                  answeredCount={me?.answered_count ?? 0}
                  onAnswer={handleAnswer}
                  isTeacher={isTeacherHost}
                  userLocale={user?.preferred_locale || "es-ES"}
                  userId={user?.id}
                  micEnabled={micEnabled}
                />
              ) : (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  <p className="text-lg">Cargando preguntas...</p>
                </div>
              )}
            </div>

            {/* Right sidebar: Ranking (only for host/admin during active game) */}
            {canSeeRanking && status === 'active' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-transparent dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    📊 Ranking en Vivo
                  </h3>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {playerProgress.map((p, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {/* Position Badge */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                              idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-orange-400 text-orange-900' :
                                  'bg-gray-200 text-gray-600'
                            }`}>
                            {medal || `#${idx + 1}`}
                          </div>

                          {/* Player Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                              {p.display_name || p.email}
                            </p>

                            {/* Progress Bar */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span>{p.answered}/{totalQuestions}</span>
                                <span>{p.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${p.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Score */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                              {p.score}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">pts</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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

export default withAuth(BlitzSessionPage);
