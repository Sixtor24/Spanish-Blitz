import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import { User, Globe, LogOut, Users, Plus, BookOpen, Target, Flame, Zap, Settings, Mic, Camera, Clock, CheckCircle, ChevronRight } from "lucide-react";
import useAuth from "@/shared/hooks/useAuth";
import { useAuth as useAuthContext } from "@/lib/auth-context";
import { api } from "@/config/api";
import type { DbUser } from "@/types/api.types";
import { withAuth } from "@/shared/hoc/withAuth";
import { JoinClassroomUseCase } from "@/domain/use-cases/classroom/JoinClassroom";
import { ClassroomRepository } from "@/infrastructure/repositories/ClassroomRepository";
import { AuthService } from "@/infrastructure/services/AuthService";

const DARK_BLUE = "#084178";
const LIGHT_BLUE = "#10A5C3";

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<DbUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [preferredLocale, setPreferredLocale] = useState("es-ES");
  const [preferredVoiceGender, setPreferredVoiceGender] = useState<'male' | 'female'>('female');
  const [ttsConfigured, setTtsConfigured] = useState(false);
  const [stats, setStats] = useState({
    cardsStudied: 0,
    accuracy: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joiningClassroom, setJoiningClassroom] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { signOut } = useAuth();
  const { refetch: refetchAuthUser } = useAuthContext();

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [userData, statsData, classroomsData] = await Promise.all([
          api.users.current(),
          api.stats.get(),
          api.classrooms.list().catch(() => []),
        ]);

        if (!mounted) return;
        
        setUser(userData);
        setDisplayName(userData.display_name || '');
        setPreferredLocale(userData.preferred_locale || 'es-ES');
        setPreferredVoiceGender((userData as any).preferred_voice_gender || 'female');
        setStats(statsData);
        setClassrooms(classroomsData);
        
        // Check if Google Cloud TTS is configured
        try {
          const config = await api.tts.checkConfig();
          setTtsConfigured(config.configured);
        } catch (error) {
          console.error('Failed to load TTS config:', error);
          setTtsConfigured(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, []);

  // Fetch assignments for students
  useEffect(() => {
    if (!user || user.role === 'teacher' || user.role === 'admin') {
      setAssignmentsLoading(false);
      return;
    }
    async function fetchAssignments() {
      try {
        setAssignmentsLoading(true);
        const cls = await api.classrooms.list().catch(() => []);
        const all = await Promise.all(
          cls.map(async (c: any) => {
            const items = await api.classrooms.assignments(c.id).catch(() => []);
            return items.map((a: any) => ({ ...a, classroom_id: c.id, classroom_name: c.name, classroom_color: c.color }));
          })
        );
        const flat = all.flat().sort((a: any, b: any) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        });
        setAssignments(flat);
      } catch {
        // Student may not be in any classroom
      } finally {
        setAssignmentsLoading(false);
      }
    }
    fetchAssignments();
  }, [user]);

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      console.log('🔄 [Profile] Updating preferences:', {
        displayName,
        locale: preferredLocale,
        voiceGender: preferredVoiceGender,
      });
      
      const updated = await api.users.patch({
        display_name: displayName,
        preferred_locale: preferredLocale,
        preferred_voice_gender: preferredVoiceGender,
      });
      
      console.log('✅ [Profile] Preferences updated in backend:', {
        locale: updated.preferred_locale,
        voiceGender: updated.preferred_voice_gender,
        plan: updated.plan,
        isPremium: updated.is_premium
      });
      
      setUser(updated);
      
      // Refetch user from AuthContext to update globally
      console.log('🔄 [Profile] Refetching user from AuthContext...');
      await refetchAuthUser();
      console.log('✅ [Profile] User refetched successfully');
      
      setMessage("Profile updated successfully! Changes will take effect immediately.");
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("❌ [Profile] Error updating profile:", error);
      setMessage("Error updating profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [displayName, preferredLocale, preferredVoiceGender, refetchAuthUser]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 2MB)
    if (!file.type.startsWith('image/')) {
      setMessage("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Image must be smaller than 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Resize to max 256px to keep payload small
      const img = new Image();
      const resized = await new Promise<string>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 256;
          let w = img.width, h = img.height;
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUrl;
      });

      const updated = await api.users.patch({ avatar_url: resized });
      setUser(updated);
      await refetchAuthUser();
      setMessage("Profile photo updated!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setMessage("Error uploading photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinMessage("");

    setJoiningClassroom(true);
    try {
      // Use Case pattern - business logic is now in the use case
      const repository = new ClassroomRepository();
      const authService = new AuthService();
      const joinClassroom = new JoinClassroomUseCase(repository, authService);
      
      await joinClassroom.execute({
        code: joinCode.trim().toUpperCase(),
      });
      
      setJoinMessage("✅ Successfully joined class! Check your Assignments.");
      setJoinCode("");
      
      // Refresh classrooms list
      const classroomsData = await api.classrooms.list();
      setClassrooms(classroomsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to join class";
      // Make error messages more user-friendly
      if (errorMessage.includes("Invalid classroom code") || errorMessage.includes("not found")) {
        setJoinMessage("Classroom not found. Please check the code and try again.");
      } else {
        setJoinMessage(errorMessage);
      }
    } finally {
      setJoiningClassroom(false);
    }
  };

  // Habilitar selección de dialecto para usuarios Premium y Gold (MUST be before early returns)
  const isDialectSelectionEnabled = useMemo(
    () => user?.plan === "premium" || user?.plan === "gold" || user?.is_premium,
    [user?.plan, user?.is_premium]
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const planLabel = user?.plan === "premium" ? "Premium" : user?.plan === "gold" ? "Gold" : "Free";
  const planColor = user?.plan === "premium" ? "from-yellow-400 to-orange-500" : user?.plan === "gold" ? "from-yellow-300 to-yellow-500" : "from-gray-400 to-gray-500";

  return (
    <DashboardLayout>
      {/* ─── Profile Hero ─── */}
      <div className="rounded-2xl overflow-hidden mb-8"
        style={{ background: `linear-gradient(135deg, ${DARK_BLUE} 0%, ${LIGHT_BLUE} 100%)` }}
      >
        <div className="px-6 py-8 md:px-10 md:py-10 flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with upload */}
          <div className="relative flex-shrink-0 group">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white/30"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center text-white text-3xl md:text-4xl font-bold">
                {(user?.display_name || user?.email)?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {user?.display_name || "Student"}
            </h1>
            <p className="text-white/70 text-sm mb-3">{user?.email}</p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-white/90 bg-white/15 backdrop-blur-sm capitalize">
                {user?.role || "Student"}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${planColor}`}>
                {planLabel}
              </span>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

      {/* ─── Main Content Grid ─── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Settings Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Settings</h2>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-5">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl
                  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
              />
            </div>

            {/* Spanish Dialect */}
            <div>
              <label className="flex text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 items-center gap-2">
                <Globe size={15} className="text-gray-400" />
                Spanish Dialect
              </label>
              <select
                value={preferredLocale}
                onChange={(e) => setPreferredLocale(e.target.value)}
                disabled={!isDialectSelectionEnabled}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl
                  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <option value="es-ES">🇪🇸 Spanish (Spain)</option>
                <option value="es-US">🌎 Spanish (Latin America)</option>
              </select>
              {!isDialectSelectionEnabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  🔒 Premium feature — upgrade to unlock regional dialects
                </p>
              )}
            </div>

            {/* Voice Gender */}
            <div>
              <label className="flex text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 items-center gap-2">
                <Mic size={15} className="text-gray-400" />
                Voice Gender
              </label>
              <select
                value={preferredVoiceGender}
                onChange={(e) => setPreferredVoiceGender(e.target.value as 'male' | 'female')}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl
                  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="female">Female Voice (Voz Femenina)</option>
                <option value="male">Male Voice (Voz Masculina)</option>
              </select>
              {!ttsConfigured && (
                <p className="text-xs text-orange-600 mt-1.5">⚠️ TTS not configured — contact support</p>
              )}
            </div>

            {/* Save */}
            <button
              type="submit"
              disabled={saving}
              className="w-full text-white px-4 py-2.5 rounded-xl disabled:opacity-50 transition-all font-semibold text-sm"
              style={{ backgroundColor: DARK_BLUE }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            {message && (
              <p className={`text-sm text-center font-medium ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {message}
              </p>
            )}
          </form>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Pending Tasks — students only */}
          {user && user.role !== 'teacher' && user.role !== 'admin' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Clock size={18} className="text-gray-500" />
                <h2 className="font-bold text-gray-900 dark:text-gray-100">Pending Tasks</h2>
                {(() => {
                  const now = new Date();
                  const pending = assignments
                    .filter((a: any) => !a.completed)
                    .filter((a: any) => !a.due_date || new Date(a.due_date) >= now);
                  return pending.length > 0 ? (
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: LIGHT_BLUE }}>
                      {pending.length}
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="p-4">
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: LIGHT_BLUE }} />
                  </div>
                ) : (() => {
                  const now = new Date();
                  const pending = assignments
                    .filter((a: any) => !a.completed)
                    .filter((a: any) => !a.due_date || new Date(a.due_date) >= now)
                    .sort((a: any, b: any) => {
                      if (!a.due_date && !b.due_date) return 0;
                      if (!a.due_date) return 1;
                      if (!b.due_date) return -1;
                      return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
                    });
                  if (pending.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <CheckCircle className="mx-auto mb-2 text-green-400" size={32} />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All caught up!</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No pending assignments right now. Enjoy your free time!</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {pending.slice(0, 5).map((task: any) => {
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
                      {pending.length > 5 && (
                        <Link
                          to="/classrooms"
                          className="block text-center text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          style={{ color: LIGHT_BLUE }}
                        >
                          View all {pending.length} tasks
                        </Link>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Enrolled Classes */}
          {user && user.role !== 'teacher' && user.role !== 'admin' && classrooms.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Users size={18} className="text-purple-500" />
                <h2 className="font-bold text-gray-900 dark:text-gray-100">Enrolled Classes</h2>
                <span className="ml-auto text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                  {classrooms.length}
                </span>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {classrooms.map((classroom: any) => (
                  <span
                    key={classroom.id}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: `${classroom.color || '#8B5CF6'}12`,
                      color: classroom.color || '#8B5CF6',
                      border: `1px solid ${classroom.color || '#8B5CF6'}30`
                    }}
                  >
                    {classroom.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Join Class - Only for students */}
          {user && user.role !== 'teacher' && user.role !== 'admin' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Plus size={18} className="text-blue-500" />
                <h2 className="font-bold text-gray-900 dark:text-gray-100">Join a Class</h2>
              </div>
              <form onSubmit={handleJoinClassroom} className="p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl
                      bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center uppercase tracking-widest text-lg"
                    placeholder="ABC123"
                    maxLength={6}
                    disabled={joiningClassroom}
                  />
                  <button
                    type="submit"
                    disabled={joiningClassroom || !joinCode.trim()}
                    className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all flex-shrink-0"
                    style={{ backgroundColor: DARK_BLUE }}
                  >
                    {joiningClassroom ? "..." : "Join"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Enter the 6-character code from your teacher</p>
                {joinMessage && (
                  <p className={`text-sm mt-2 font-medium ${joinMessage.includes("✅") ? "text-green-600" : "text-red-500"}`}>
                    {joinMessage}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Export with authentication protection
export default withAuth(ProfilePage);
