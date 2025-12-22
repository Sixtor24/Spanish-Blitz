// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/shared/components/Navigation";
import useUser from "@/shared/hooks/useUser";
import { ArrowLeft, Users, Timer, Trophy, Play } from "lucide-react";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
import { api } from "@/config/api";
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
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);

  useEffect(() => {
    setSelectedOption(null);
    setFeedback(null);
    if (!isSpeechQuestion(questionType) && question && questionType) {
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

  const handleSpeechAnswer = (transcript: string) => {
    const normalized = normalizeSpanish(transcript);
    const correctAnswer = normalizeSpanish(getSpanishAnswer(question));
    const isCorrect = normalized === correctAnswer;
    setSelectedOption(transcript);
    setFeedback(isCorrect ? "correct" : "incorrect");
    onAnswer(isCorrect, transcript);
  };

  const getQuestionPromptText = () => computeQuestionPrompt(question, questionType);

  const getQuestionTypeLabelText = () => computeQuestionTypeLabel(questionType);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between flex-wrap sm:flex-nowrap gap-2">
        <div className="text-center sm:text-left">
          <p className="text-xs text-gray-500">Your score</p>
          <p className="text-xl font-semibold">{score}</p>
        </div>
        <div className="text-center sm:text-right text-sm text-gray-600">
            Progress {answeredCount}/{totalQuestions}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-2 text-center sm:text-left">Question {question.position} of {totalQuestions}</p>
      <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <div className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium mb-3 mx-auto sm:mx-0 block sm:inline-block text-center">
          {getQuestionTypeLabelText()}
        </div>

        {getQuestionPromptText() && (
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 text-center sm:text-left">{getQuestionPromptText()}</h2>
        )}

        {isAudioQuestion(questionType) && (
          <div className="mb-4 flex flex-col items-center">
            <TTSButton text={getSpanishAnswer(question)} locale={userLocale} />
            <p className="text-xs text-gray-500 mt-2">Tap to hear the Spanish phrase and choose the meaning</p>
          </div>
        )}

        {!isSpeechQuestion(questionType) && (
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
                  disabled={!!selectedOption || isTeacher}
                  className={`w-full px-4 py-3 sm:px-5 sm:py-4 border-2 rounded-lg text-left sm:text-left text-center font-medium text-sm sm:text-base ${bgColor} ${hoverEffect} ${
                    selectedOption === null ? "cursor-pointer" : "cursor-not-allowed"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

  {isSpeechQuestion(questionType) && !selectedOption && (
          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <SpeechRecognition
                onTranscript={handleSpeechAnswer}
                locale={userLocale}
                onError={(err) => console.error("Speech error:", err)}
              />
            </div>
            <p className="text-center text-xs text-gray-500">Click the mic and say the Spanish translation</p>
          </div>
        )}

  {isSpeechQuestion(questionType) && selectedOption && (
          <div className="space-y-3 mt-4">
            <div
              className={`p-3 rounded-lg ${
                feedback === "correct"
                  ? "bg-green-100 border-2 border-green-500"
                  : "bg-red-100 border-2 border-red-500"
              }`}
            >
              <p className="text-xs text-gray-600 mb-1">You said:</p>
              <p className="font-medium text-gray-900">{selectedOption}</p>
            </div>

            {feedback === "incorrect" && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Correct answer:</p>
                <p className="font-medium text-gray-900">{getSpanishAnswer(question)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlitzSessionPage({ params }) {
  const code = params.code?.toUpperCase();
  const { data: user, loading: userLoading } = useUser();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);

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
  const deriveQuestionType = (question) => deriveQuestionTypeByPosition(question);

  const currentAnswers = state?.currentPlayerAnswers ?? [];
  const currentQuestion = useMemo(() => {
    if (!state?.questions) return null;
    const answeredIds = new Set(currentAnswers.map((a) => a.question_id));
    return state.questions.find((q) => !answeredIds.has(q.id)) ?? null;
  }, [state, currentAnswers]);

  const timeLeftSeconds = useMemo(() => {
    if (!state?.session?.ends_at || state?.session?.status === 'pending') return null;
    const diff = Math.floor((new Date(state.session.ends_at).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
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

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (user && code) {
      joinSession();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code]);

  useEffect(() => {
    if (sessionId) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(fetchState, 5000);
      fetchState();

      // setup websocket for real-time refresh signals
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const defaultPort = window.location.port || (protocol === 'wss' ? '443' : '4001');
      const wsUrl =
        import.meta.env.VITE_WS_URL || `${protocol}://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || defaultPort}`;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <a href="/blitz-challenge" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft size={18} /> Back
        </a>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Código</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{code}</p>
              <p className="text-sm text-gray-600 mt-1">Conjunto: {state?.session?.deck_title ?? '—'}</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {canSeeRanking && (
              <div className="flex items-center gap-2 text-gray-700">
                  <Users size={18} /> {state?.players?.length ?? 0} jugadores
              </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <Timer size={18} /> {state?.session?.time_limit_seconds ? formatSeconds(timeLeftSeconds ?? state.session.time_limit_seconds) : 'Sin límite'}
              </div>
              <div className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 capitalize">
                {status === 'pending' ? 'Esperando' : status === 'active' ? 'En curso' : 'Finalizado'}
              </div>
            </div>
          </div>

          {canSeeRanking && (
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="font-semibold text-gray-800">Tu rol</p>
                <p className="text-gray-600 mt-1">
                  {isTeacherHost ? 'Profesor - Solo observas el progreso' : 'Organizador - Puedes ver el ranking en vivo'}
                </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="font-semibold text-gray-800">Puntuación</p>
                <p className="text-gray-600 mt-1">Correcta +2 · Incorrecta -1. Preguntas tipo Solo Blitz.</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="font-semibold text-gray-800">Final del juego</p>
                <p className="text-gray-600 mt-1">Termina cuando todos acaben o se agote el tiempo.</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4">{error}</div>
        )}

        {loading || userLoading ? (
          <div className="bg-white rounded-xl shadow p-6">Loading...</div>
        ) : status === 'completed' || allAnswered ? (
          /* Full screen winners view */
          <div className="bg-white rounded-xl shadow p-8">
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
                <h2 className="text-4xl font-bold text-gray-900 mb-3">
                  ¡Actividad Finalizada!
                </h2>
                <p className="text-gray-600 text-xl">
                  Estos son los resultados finales
                </p>
              </div>

              {/* Top 3 Podium - Larger */}
              <div className="mt-12 mb-8">
                <div className="flex items-end justify-center gap-6 max-w-4xl mx-auto">
                  {/* 2nd Place */}
                  {playerProgress[1] && (
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg mb-3">
                        {(playerProgress[1].display_name || playerProgress[1].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-gray-300 rounded-t-lg p-4 text-center w-full">
                        <p className="text-3xl font-bold mb-1">🥈</p>
                        <p className="text-base font-bold text-gray-800 truncate">
                          {playerProgress[1].display_name || playerProgress[1].email.split('@')[0]}
                        </p>
                        <p className="text-sm text-gray-700 font-bold mt-1">{playerProgress[1].score} puntos</p>
                        <div className="h-24 bg-gray-400 mt-3 rounded"></div>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {playerProgress[0] && (
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-3xl border-4 border-white shadow-xl mb-3 animate-pulse">
                        {(playerProgress[0].display_name || playerProgress[0].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-yellow-400 rounded-t-lg p-5 text-center w-full">
                        <p className="text-4xl font-bold mb-1">🏆</p>
                        <p className="text-lg font-bold text-gray-900 truncate">
                          {playerProgress[0].display_name || playerProgress[0].email.split('@')[0]}
                        </p>
                        <p className="text-base text-gray-800 font-bold mt-1">{playerProgress[0].score} puntos</p>
                        <div className="h-36 bg-yellow-500 mt-3 rounded"></div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {playerProgress[2] && (
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg mb-3">
                        {(playerProgress[2].display_name || playerProgress[2].email).charAt(0).toUpperCase()}
                      </div>
                      <div className="bg-orange-400 rounded-t-lg p-4 text-center w-full">
                        <p className="text-3xl font-bold mb-1">🥉</p>
                        <p className="text-base font-bold text-gray-800 truncate">
                          {playerProgress[2].display_name || playerProgress[2].email.split('@')[0]}
                        </p>
                        <p className="text-sm text-gray-700 font-bold mt-1">{playerProgress[2].score} puntos</p>
                        <div className="h-16 bg-orange-500 mt-3 rounded"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Ranking Table */}
              <div className="max-w-3xl mx-auto mt-12">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">📊 Ranking Completo</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Posición</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jugador</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Respondidas</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Puntos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {playerProgress.map((p, idx) => {
                        const isCurrentUser = p.email === user?.email;
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                        
                        return (
                          <tr key={p.id} className={isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{medal || `#${idx + 1}`}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                  <span className="text-gray-600 font-semibold text-sm">
                                    {(p.display_name || p.email).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {p.display_name || p.email}
                                    {isCurrentUser && ' (Tú)'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {p.is_host ? (state?.session?.is_teacher ? '👨‍🏫 Profesor' : '👑 Organizador') : '🎮 Jugador'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-medium text-gray-700">
                                {p.answered}/{totalQuestions}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-xl font-bold ${isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
                                {p.score}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <a
                  href="/blitz-challenge"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 text-lg font-semibold shadow-md transition-all"
                >
                  Nueva Actividad
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 ${canSeeRanking && status === 'active' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {/* Main column: Lobby or Game */}
            <div className={`bg-white rounded-xl shadow p-6 ${canSeeRanking && status === 'active' ? 'lg:col-span-2' : ''}`}>
              {status === 'pending' ? (
                canSeeRanking ? (
                  // Admin/Host view - See all players in lobby
                  <div className="space-y-6">
                    <div className="text-center py-8">
                      <h2 className="text-3xl font-bold text-gray-900 mb-3">
                        Sala de Espera
                      </h2>
                      <p className="text-gray-600 text-lg">
                        {(state?.players?.length ?? 0) < 2 
                          ? "Esperando más jugadores para comenzar..."
                          : "¡Listos para comenzar!"}
                      </p>
                    </div>

                    {/* Session Info */}
                    <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                        <p className="text-xs text-blue-600 font-semibold mb-2">CONJUNTO</p>
                        <p className="font-bold text-gray-800 text-xl">{state?.session?.deck_title ?? '—'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                        <p className="text-xs text-purple-600 font-semibold mb-2">PREGUNTAS · TIEMPO</p>
                        <p className="font-bold text-gray-800 text-xl">
                          {totalQuestions} preguntas · {state?.session?.time_limit_seconds ? formatSeconds(state.session.time_limit_seconds) : 'Sin límite'}
                        </p>
                      </div>
                    </div>

                    {/* Players List */}
                    <div className="max-w-3xl mx-auto">
                      <div className="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Users size={20} className="sm:w-6 sm:h-6" /> 
                            <span className="hidden sm:inline">Participantes en la Sala</span>
                            <span className="sm:hidden">Participantes</span>
                          </h3>
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-base sm:text-lg font-bold">
                            {playerProgress.length}
                          </span>
                        </div>
                        
                        {/* Scrollable list with max height */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2 sm:space-y-3 pr-2">
                          {playerProgress.map((p) => {
                            const canKick = isHost && !p.is_host && p.email !== user?.email;
                            
                            return (
                              <div 
                                key={p.id} 
                                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow gap-2"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                                    <span className="text-gray-600 font-bold text-base sm:text-lg">
                                      {(p.display_name || p.email).charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-bold text-gray-900 text-sm sm:text-lg truncate">
                                      {p.display_name || p.email}
                                    </span>
                                    <span className="text-xs sm:text-sm text-gray-500">
                                      {p.is_host ? (state?.session?.is_teacher ? '👨‍🏫 Profesor' : '👑 Organizador') : '🎮 Jugador'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="bg-green-100 text-green-700 px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold">
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
                          <p className="text-xs text-gray-500 text-center mt-2">
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
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center max-w-md mx-auto mt-4">
                              <p className="text-yellow-800 font-medium">
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
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                          ¡Te damos la bienvenida, {user?.display_name || user?.email?.split('@')[0] || 'Jugador'}!
                        </h2>
                        <p className="text-gray-600 text-xl">
                          Esperando que el organizador inicie la actividad...
                        </p>
                    </div>
                  </div>

                    {/* Session Info */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                        <p className="text-xs text-blue-600 font-semibold mb-2">CONJUNTO</p>
                        <p className="font-bold text-gray-800 text-xl">{state?.session?.deck_title ?? '—'}</p>
                          </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                        <p className="text-xs text-purple-600 font-semibold mb-2">PREGUNTAS · TIEMPO</p>
                        <p className="font-bold text-gray-800 text-xl">
                          {totalQuestions} preguntas · {state?.session?.time_limit_seconds ? formatSeconds(state.session.time_limit_seconds) : 'Sin límite'}
                        </p>
                        </div>
                    </div>
                  </div>
                )
              ) : isTeacherHost ? (
                <div className="space-y-6 py-8">
                  <div className="bg-blue-50 border-2 border-blue-200 text-blue-800 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">👨‍🏫 Modo Profesor</h3>
                    <p>Solo puedes observar el progreso, no las preguntas.</p>
                  </div>
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {playerProgress.map((p) => (
                      <div key={p.id} className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900">{p.display_name || p.email}</span>
                          <span className="text-sm font-bold text-gray-700">{p.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                          <div
                            className="h-3 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{p.answered} / {totalQuestions} preguntas</p>
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
                />
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-lg">Cargando preguntas...</p>
                </div>
              )}
            </div>

            {/* Right sidebar: Ranking (only for host/admin during active game) */}
            {canSeeRanking && status === 'active' && (
            <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    📊 Ranking en Vivo
                  </h3>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {playerProgress.map((p, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                    
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg p-3 bg-gray-50 border border-gray-200"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {/* Position Badge */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                            idx === 1 ? 'bg-gray-300 text-gray-700' :
                            idx === 2 ? 'bg-orange-400 text-orange-900' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {medal || `#${idx + 1}`}
                          </div>

                          {/* Player Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate text-sm">
                              {p.display_name || p.email}
                            </p>
                            
                            {/* Progress Bar */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>{p.answered}/{totalQuestions}</span>
                                <span>{p.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${p.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Score */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-bold text-gray-800">
                              {p.score}
                            </div>
                            <div className="text-xs text-gray-500">pts</div>
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
    </div>
  );
}
