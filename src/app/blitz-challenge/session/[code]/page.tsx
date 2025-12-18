// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/shared/components/Navigation";
import useUser from "@/shared/hooks/useUser";
import { ArrowLeft, Users, Timer, Trophy, Play } from "lucide-react";
import TTSButton from "@/shared/components/TTSButton";
import SpeechRecognition from "@/shared/components/SpeechRecognition";
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Your score</p>
          <p className="text-xl font-semibold">{score}</p>
        </div>
        <div className="text-right text-sm text-gray-600">
            Progress {answeredCount}/{totalQuestions}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-2">Question {question.position} of {totalQuestions}</p>
      <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <div className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium mb-3">
          {getQuestionTypeLabelText()}
        </div>

        {getQuestionPromptText() && (
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{getQuestionPromptText()}</h2>
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
                  className={`w-full px-5 py-4 border-2 rounded-lg text-left font-medium ${bgColor} ${hoverEffect} ${
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
  const isTeacherHost = state?.session?.is_teacher && state?.players?.some((p) => p.is_host && p.email === user?.email);
  const roleLabel = isTeacherHost ? "Teacher (spectator)" : "Player";
  const totalQuestions = state?.totalQuestions ?? state?.questions?.length ?? 0;
  const me = (state?.players ?? []).find((p) => p.email === user?.email);
  const isHost = !!me?.is_host;

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
      const res = await fetch("/api/play-sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to join session");
      }
      const data = await res.json();
      setState(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchState() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/play-sessions/${sessionId}/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
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
      const res = await fetch(`/api/play-sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, isCorrect, answerText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to answer");
      fetchState();
    } catch (e) {
      setError(e.message);
    }
  };

  const allAnswered = !currentQuestion && currentAnswers.length > 0;
  const status = state?.session?.status;

  const playerProgress = (state?.players ?? []).map((p) => {
    const answered = p.answered_count ?? 0;
    const progress = totalQuestions ? Math.min(100, Math.round((answered / totalQuestions) * 100)) : 0;
    return { ...p, answered, progress };
  }).sort((a, b) => b.score - a.score);

  const startSession = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/play-sessions/${sessionId}/start`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo iniciar la sesión');
      fetchState();
    } catch (e) {
      setError(e.message);
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
              <p className="text-sm text-gray-500">Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{code}</p>
              <p className="text-sm text-gray-600 mt-1">Set: {state?.session?.deck_title ?? '—'}</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-gray-700">
                <Users size={18} /> {state?.players?.length ?? 0} players
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Timer size={18} /> {state?.session?.time_limit_seconds ? formatSeconds(timeLeftSeconds ?? state.session.time_limit_seconds) : 'No limit'}
              </div>
              <div className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 capitalize">
                {status ?? 'pending'}
              </div>
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Your role</p>
              <p className="text-gray-600 mt-1">{roleLabel}. Teachers don't see questions or answer—only observe progress.</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Scoring</p>
              <p className="text-gray-600 mt-1">Correct +2 · Incorrect -1. Questions mirror Solo Blitz (multiple choice & voice).</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Game end</p>
              <p className="text-gray-600 mt-1">Ends when all finish or time is up. Ranking by points.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4">{error}</div>
        )}

        {loading || userLoading ? (
          <div className="bg-white rounded-xl shadow p-6">Loading...</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column: Lobby/Game */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
              {status === 'pending' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Lobby</p>
                      <p className="text-xl font-semibold">Waiting for host to start</p>
                    </div>
                    {isHost ? (
                      <button
                        onClick={startSession}
                        disabled={(state?.players?.length ?? 0) < 2}
                        className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Play size={16} /> Start
                      </button>
                    ) : (
                      <div className="text-sm text-gray-600">Waiting for host…</div>
                    )}
                  </div>
                  {(state?.players?.length ?? 0) < 2 && (
                    <p className="text-sm text-red-600">Need at least 2 players to start.</p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Set</p>
                      <p className="font-semibold text-gray-800">{state?.session?.deck_title ?? '—'}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Questions · Time</p>
                      <p className="font-semibold text-gray-800">{totalQuestions} · {state?.session?.time_limit_seconds ? formatSeconds(state.session.time_limit_seconds) : 'No limit'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold mb-3">Players</p>
                    <div className="space-y-2">
                      {playerProgress.map((p) => (
                        <div key={p.id} className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium">{p.display_name || p.email}</span>
                            <span className="text-xs text-gray-500">{p.is_host ? (state?.session?.is_teacher ? 'Teacher' : 'Host') : 'Player'}</span>
                          </div>
                          <span className="text-sm text-gray-600">Ready</span>
                        </div>
                      ))}
                      {playerProgress.length === 0 && <p className="text-sm text-gray-500">No players yet.</p>}
                    </div>
                  </div>
                </div>
              ) : status === 'completed' || allAnswered ? (
                <div className="text-center py-12">
                  <Trophy className="mx-auto text-yellow-500" size={48} />
                  <p className="mt-3 text-xl font-semibold">Session finished</p>
                  <p className="text-gray-600">Check the ranking on the right.</p>
                </div>
              ) : isTeacherHost ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4">
                    Teacher mode: you only see live progress, not the questions.
                  </div>
                  <div className="space-y-3">
                    {playerProgress.map((p) => (
                      <div key={p.id} className="border rounded-lg p-3">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>{p.display_name || p.email}</span>
                          <span>{p.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{p.answered} / {totalQuestions} questions</p>
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
                <div className="text-center py-12 text-gray-600">Waiting for questions...</div>
              )}
            </div>

            {/* Right: Ranking / Progress */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Ranking</h3>
              <div className="space-y-3">
                {playerProgress.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="font-semibold">{p.display_name || p.email}</p>
                      <p className="text-xs text-gray-500">
                        {p.is_host ? (state?.session?.is_teacher ? 'Teacher' : 'Host') : 'Player'} · {p.state}
                      </p>
                      <p className="text-xs text-gray-500">Progress {p.answered}/{totalQuestions} · {p.progress}%</p>
                    </div>
                    <div className="text-right">
                      {status === 'completed' ? (
                        <>
                          <div className="text-lg font-bold">{p.score}</div>
                          <div className="text-xs text-gray-400">#{idx + 1}</div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">In play</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
