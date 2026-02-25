import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import useUser from "@/shared/hooks/useUser";
import { ArrowLeft, Clock, HelpCircle, Users, Mic, Keyboard } from "lucide-react";
import { api } from "@/config/api";
import type { DbDeck } from "@/types/api.types";

export default function CreateBlitzChallengePage() {
  const { id } = useParams<{ id: string }>();
  const deckId = id!;
  const { data: user, loading: userLoading } = useUser();

  const [deck, setDeck] = useState<DbDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [numQuestions, setNumQuestions] = useState("10");
  const [timeLimit, setTimeLimit] = useState("5");
  const [isHost, setIsHost] = useState(false);
  const [requireMic, setRequireMic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (deckId && user) {
      fetchDeck();
    }
  }, [deckId, user]);

  const fetchDeck = async () => {
    try {
      const deckData = await api.decks.get(deckId);
      setDeck(deckData);
    } catch (error) {
      console.error("Error fetching deck:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setError(null);
    setChallengeCode(null);
    try {
      setCreating(true);
      const result = await api.playSessions.create({
        deckId,
        questionCount: Number(numQuestions),
        timeLimitMinutes: Number(timeLimit),
        isTeacher: isHost,
        requireMic,
      });
      setChallengeCode(result.code);
    } catch (err) {
      console.error("Error creating challenge", err);
      setError(err instanceof Error ? err.message : "Could not create challenge");
    } finally {
      setCreating(false);
    }
  };

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (!deck) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Set Not Found
          </h1>
          <Link
            to="/blitz-challenge"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
          >
            Back to Blitz Challenge
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back to Blitz Challenge */}
        <Link
          to="/blitz-challenge"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Create Blitz Challenge
          </h1>
          <div
            className="inline-block px-4 py-2 rounded-lg mt-2"
            style={{
              backgroundColor: deck.primary_color_hex + "20" || "#0EA5E920",
              borderLeft: `4px solid ${deck.primary_color_hex || "#0EA5E9"}`,
            }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Selected Set: <strong>{deck.title}</strong>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {deck.card_count || 0} cards available
            </p>
          </div>

          {/* Quick explainer */}
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Roles</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Profesor (espectador) no responde; jugador sí responde. El profesor no bloquea el final.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Puntaje</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Correcto +2 · Incorrecto -1. Todos ven las mismas preguntas, cada uno a su ritmo.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Fin del juego</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Termina cuando todos los jugadores acaban o se acaba el tiempo. Gana quien tenga más puntos.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-transparent dark:border-gray-700">
            <form onSubmit={handleCreateChallenge} className="space-y-6">
              {/* Number of Questions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Number of Questions
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {["10", "15", "20", "30"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumQuestions(num)}
                      className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                        numQuestions === num
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Puedes ajustar la cantidad de preguntas que verán todos los jugadores.</p>
              </div>

              {/* Time Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Time Limit (minutes)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {["3", "5", "7", "10"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setTimeLimit(time)}
                      className={`px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                        timeLimit === time
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      <Clock size={18} />
                      {time}m
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">El juego finaliza al agotar el tiempo o cuando todos los jugadores terminan.</p>
              </div>

              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Host Checkbox */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHost}
                    onChange={(e) => setIsHost(e.target.checked)}
                    className="mt-1 w-5 h-5 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        I'm the teacher (host only — I won't participate)
                      </span>
                      <HelpCircle className="text-blue-600 dark:text-blue-400" size={16} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Host the challenge without answering questions. You'll
                      monitor progress and see results. Si desactivas, juegas como
                      cualquier alumno.
                    </p>
                  </div>
                </label>
              </div>

              {/* Answer Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Answer Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRequireMic(true)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors border-2 ${
                      requireMic
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Mic size={20} />
                    Voice answers
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequireMic(false)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors border-2 ${
                      !requireMic
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Keyboard size={20} />
                    No voice answers
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {requireMic
                    ? "Everyone speaks — students must enable their microphone to join."
                    : "Text & listening only — students can join without a microphone."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Link
                  to="/blitz-challenge"
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold text-center transition-colors"
                >
                  Back
                </Link>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Challenge"}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Challenge Code Placeholder */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow-lg p-6 text-white sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <Users size={24} />
                <h3 className="text-lg font-bold">Challenge Code</h3>
              </div>

              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-6 text-center mb-4">
                <p className="text-sm text-purple-100 mb-2">
                  {challengeCode ? "Share this code with students" : "Code will appear here"}
                </p>
                <div className="text-4xl font-bold font-mono tracking-wider">
                  {challengeCode || "------"}
                </div>
              </div>

              {challengeCode ? (
                <div className="bg-white bg-opacity-10 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-purple-100">
                    Students join at <strong>/blitz-challenge</strong> using this code.
                  </p>
                  <Link
                    to={`/blitz-challenge/session/${challengeCode}`}
                    className="block w-full text-center bg-white text-purple-700 font-semibold py-2 rounded-lg hover:bg-purple-50"
                  >
                    Open Host View
                  </Link>
                </div>
              ) : (
                <div className="bg-white bg-opacity-10 rounded-lg p-4">
                  <p className="text-sm text-purple-100">
                    Create the challenge to generate a join code for your class.
                  </p>
                  <p className="text-xs text-purple-100/80 mt-2">
                    Recuerda: el host en modo profesor no responde; los jugadores sí. Mismo set, preguntas aleatorias.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
