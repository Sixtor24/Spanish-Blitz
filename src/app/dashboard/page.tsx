import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import WelcomeModal from "@/shared/components/WelcomeModal";
import {
  BookOpen, Zap, Search, Plus, Swords, Gamepad2,
  Clock, CheckCircle, ChevronRight,
} from "lucide-react";
import useUser from "@/shared/hooks/useUser";
import type { DbDeck } from "@/types/api.types";
import { api } from "@/config/api";
import { withAuth } from "@/shared/hoc/withAuth";

/* ─── Brand colors ─── */
const DARK_BLUE = "#084178";
const LIGHT_BLUE = "#10A5C3";
const DARK_BLUE_HOVER = "#063260";

/* ─── Assignment type (matches classrooms page) ─── */
interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deck_id: string | null;
  deck_title: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  classroom_id: string;
  classroom_name: string;
  classroom_color?: string;
  required_repetitions: number;
  repetitions_completed: number;
  xp_goal?: number | null;
  xp_reward?: number | null;
  xp_progress?: number;
}

/* ═══════════════════════════════════════════════════════
   Pending Tasks Panel (right sidebar)
   ═══════════════════════════════════════════════════════ */
function PendingTasksPanel({ assignments, loading }: { assignments: Assignment[]; loading: boolean }) {
  const pending = assignments.filter((a) => !a.completed);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Pending Tasks</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: LIGHT_BLUE }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Pending Tasks</h3>
        {pending.length > 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: LIGHT_BLUE }}>
            {pending.length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle className="mx-auto mb-2 text-green-400" size={32} />
          <p className="text-sm text-gray-500 dark:text-gray-400">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.slice(0, 6).map((task) => {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date();
            const targetUrl = task.deck_id
              ? `/study?deck=${task.deck_id}&classroom=${task.classroom_id}&assignment=${task.id}`
              : "/play/solo";

            return (
              <Link
                key={task.id}
                to={targetUrl}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
              >
                <div
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: task.classroom_color || LIGHT_BLUE }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {task.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {task.classroom_name}
                  </p>
                  {dueDate && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      isOverdue ? "text-red-500 font-semibold" : "text-gray-400 dark:text-gray-500"
                    }`}>
                      <Clock size={12} />
                      {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {isOverdue && <span className="ml-1 text-red-500">Overdue</span>}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="mt-1 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
              </Link>
            );
          })}
          {pending.length > 6 && (
            <Link
              to="/classrooms"
              className="block text-center text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              style={{ color: LIGHT_BLUE }}
            >
              View all {pending.length} tasks
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════ */
function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useUser();
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [stats, setStats] = useState({ cardsStudied: 0, accuracy: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("owned");
  const [showWelcome, setShowWelcome] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  // Auth is handled by withAuth HOC

  useEffect(() => {
    let mounted = true;
    if (!user) return;

    if (!user.has_seen_welcome) setShowWelcome(true);

    if (searchQuery) {
      const timeoutId = setTimeout(() => { if (mounted) fetchData(); }, 300);
      return () => { mounted = false; clearTimeout(timeoutId); };
    } else {
      fetchData();
      return () => { mounted = false; };
    }
  }, [filterMode, searchQuery, user, location.key]);

  // Fetch assignments
  useEffect(() => {
    if (!user) return;
    fetchAssignments();
  }, [user]);

  const handleDismissWelcome = async () => {
    setShowWelcome(false);
    try { await api.users.markWelcomeSeen(); } catch (e) { console.error("Error marking welcome as seen:", e); }
  };

  const handleCreateFirstSet = async () => {
    await handleDismissWelcome();
    navigate("/admin/create-set");
  };

  const fetchData = useCallback(async () => {
    try {
      const params: { search?: string; filter?: "all" | "owned" | "assigned" | "public" } = {
        filter: filterMode as "all" | "owned" | "assigned" | "public",
      };
      if (searchQuery) params.search = searchQuery;

      const [decksData, statsData] = await Promise.all([
        api.decks.list(params),
        api.stats.get(),
      ]);
      setDecks(decksData);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [filterMode, searchQuery]);

  const fetchAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const classrooms = await api.classrooms.list();
      const all = await Promise.all(
        classrooms.map(async (c: any) => {
          const items = await api.classrooms.assignments(c.id);
          return items.map((a: any) => ({ ...a, classroom_id: c.id, classroom_name: c.name, classroom_color: c.color }));
        })
      );
      const flat = all.flat().sort((a: any, b: any) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setAssignments(flat);
    } catch {
      // Student may not be in any classroom
    } finally {
      setAssignmentsLoading(false);
    }
  };

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: LIGHT_BLUE }} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {showWelcome && (
        <WelcomeModal onDismiss={handleDismissWelcome} onCreateSet={handleCreateFirstSet} />
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ═══ CENTER COLUMN ═══ */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Welcome banner */}
          <div
            className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${DARK_BLUE} 0%, ${LIGHT_BLUE} 100%)` }}
          >
            <div className="relative z-10">
              <h2 className="text-xl md:text-2xl font-bold mb-1">
                Welcome back, {user?.display_name || "Learner"}! 👋
              </h2>
              <p className="text-blue-100 text-sm md:text-base">
                You're on a {stats.streak}-day streak! Keep it up and reach your goals.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm">
                  {user?.role === "teacher" ? "Teacher" : user?.role === "admin" ? "Admin" : "Student"}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm">
                  {user?.xp_total || 0} XP
                </span>
              </div>
            </div>
            {/* Streak badge */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-center hidden sm:block">
              <p className="text-4xl font-black">{stats.streak}</p>
              <p className="text-xs font-semibold text-blue-100 uppercase tracking-wider">Day Streak</p>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/5" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cards Studied</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.cardsStudied}</p>
                </div>
                <BookOpen size={28} style={{ color: LIGHT_BLUE }} />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Accuracy</p>
                  <p className="text-2xl font-bold text-green-600">{stats.accuracy}%</p>
                </div>
                <Zap size={28} className="text-green-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Day Streak</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.streak} 🔥</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border-2 p-5" style={{ borderColor: LIGHT_BLUE, background: `${LIGHT_BLUE}08` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: LIGHT_BLUE }}>Total XP</p>
                  <p className="text-2xl font-bold" style={{ color: DARK_BLUE }}>
                    <span className="dark:text-blue-300">{user?.xp_total || 0}</span>
                  </p>
                </div>
                <span className="text-3xl">⚡</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/blitz-challenge"
              className="rounded-2xl p-5 text-white hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)` }}
            >
              <Swords size={24} className="mb-2" />
              <h3 className="text-lg font-bold">Blitz Challenge</h3>
              <p className="text-purple-200 text-sm">Join or create a live challenge</p>
            </Link>
            <Link
              to="/play/solo"
              className="rounded-2xl p-5 text-white hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${DARK_BLUE} 0%, ${LIGHT_BLUE} 100%)` }}
            >
              <Gamepad2 size={24} className="mb-2" />
              <h3 className="text-lg font-bold">Solo Blitz</h3>
              <p className="text-blue-200 text-sm">Test yourself with quizzes and voice</p>
            </Link>
          </div>

          {/* Your Sets */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Your Sets</h2>
              <Link
                to="/admin/create-set"
                className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ backgroundColor: DARK_BLUE }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = DARK_BLUE_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DARK_BLUE)}
              >
                <Plus size={18} />
                Create Set
              </Link>
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl
                  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Hidden filter buttons (kept for future use) */}
            <div className="hidden">
              <button onClick={() => setFilterMode("owned")}>My Sets</button>
              <button onClick={() => setFilterMode("assigned")}>Assigned</button>
            </div>

            {/* Set grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="border rounded-xl p-4 hover:shadow-md transition-all bg-white dark:bg-gray-800
                    border-gray-200 dark:border-gray-700"
                  style={{ borderLeftWidth: "5px", borderLeftColor: deck.primary_color_hex || LIGHT_BLUE }}
                >
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">{deck.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{deck.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{deck.card_count || 0} cards</p>
                  <div className="flex gap-2">
                    <Link
                      to={`/study?deck=${deck.id}`}
                      className="flex-1 text-white px-3 py-2 rounded-lg text-center text-sm font-semibold transition-colors"
                      style={{ backgroundColor: LIGHT_BLUE }}
                    >
                      📚 Study
                    </Link>
                    <Link
                      to={`/admin/create-set?id=${deck.id}`}
                      className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-center text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}

              {decks.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={40} />
                  <p className="text-gray-500 dark:text-gray-400">No sets found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL — Pending Tasks ═══ */}
        <div className="xl:w-80 flex-shrink-0">
          <div className="xl:sticky xl:top-24 space-y-6">
            <PendingTasksPanel assignments={assignments} loading={assignmentsLoading} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Export with authentication protection
export default withAuth(DashboardPage);
