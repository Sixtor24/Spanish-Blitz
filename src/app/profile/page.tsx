import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import { User, Globe, LogOut, Users, Plus } from "lucide-react";
import useAuth from "@/shared/hooks/useAuth";
import { useAuth as useAuthContext } from "@/lib/auth-context";
import { api } from "@/config/api";
import type { DbUser } from "@/types/api.types";
import { withAuth } from "@/shared/hoc/withAuth";
import { JoinClassroomUseCase } from "@/domain/use-cases/classroom/JoinClassroom";
import { ClassroomRepository } from "@/infrastructure/repositories/ClassroomRepository";
import { AuthService } from "@/infrastructure/services/AuthService";

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<DbUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [preferredLocale, setPreferredLocale] = useState("es-ES");
  const [preferredVoiceGender, setPreferredVoiceGender] = useState<'male' | 'female'>('female');
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
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, []);

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      console.log('🔄 [Profile] Updating preferences:', {
        displayName,
        locale: preferredLocale,
        voiceGender: preferredVoiceGender
      });
      
      const updated = await api.users.patch({
        display_name: displayName,
        preferred_locale: preferredLocale,
        preferred_voice_gender: preferredVoiceGender,
      } as any);
      
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
    // Hard navigate after logout to clear all state
    window.location.href = "/";
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
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} />
              Profile Settings
            </h2>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                  <Globe size={16} />
                  Preferred Spanish Locale / Spanish Dialect
                </label>
                <div className="relative">
                  <select
                    value={preferredLocale}
                    onChange={(e) => setPreferredLocale(e.target.value)}
                    disabled={!isDialectSelectionEnabled}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="es-MX">Spanish (Mexico)</option>
                    <option value="es-AR">Spanish (Argentina)</option>
                    <option value="es-CO">Spanish (Colombia)</option>
                    <option value="es-CL">Spanish (Chile)</option>
                  </select>
                </div>
                {!isDialectSelectionEnabled && (
                  <p className="text-sm text-gray-600 mt-2">
                    🔒 Spanish dialect selection is available for Premium users.
                    Upgrade to customize your learning experience with regional accents!
                  </p>
                )}
              </div>

              <div>
                <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                  <User size={16} />
                  Preferred Voice Gender
                </label>
                <select
                  value={preferredVoiceGender}
                  onChange={(e) => setPreferredVoiceGender(e.target.value as 'male' | 'female')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="female">👩 Female Voice</option>
                  <option value="male">👨 Male Voice</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose between male and female voices for text-to-speech
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              {message && (
                <p
                  className={`text-sm text-center ${message.includes("success") ? "text-green-600" : "text-red-600"}`}
                >
                  {message}
                </p>
              )}
            </form>

            <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
              <p className="text-xs text-gray-600">Email: {user?.email}</p>
              <p className="text-xs text-gray-600">
                Plan:{" "}
                {user?.plan === "premium"
                  ? "Premium"
                  : user?.plan === "gold"
                    ? "Gold"
                    : "Free"}
              </p>
              {user && user.role !== 'teacher' && user.role !== 'admin' && classrooms.length > 0 && (
                <div className="pt-3 border-t border-gray-100 mt-2">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Enrolled Classes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {classrooms.map((classroom: any) => (
                      <span
                        key={classroom.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: `${classroom.color || '#8B5CF6'}15`,
                          color: classroom.color || '#8B5CF6',
                          border: `1px solid ${classroom.color || '#8B5CF6'}40`
                        }}
                      >
                        {classroom.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sign out section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>

          {/* Join Class - Only for students */}
          {user && user.role !== 'teacher' && user.role !== 'admin' && (
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                Join a Class
              </h2>
              
              <form onSubmit={handleJoinClassroom} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg text-center uppercase tracking-wider"
                    placeholder="ABCD12"
                    maxLength={6}
                    disabled={joiningClassroom}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Enter the 6-character code from your teacher
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={joiningClassroom || !joinCode.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-sm"
                >
                  {joiningClassroom ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Plus size={18} />
                      Join a Class
                    </>
                  )}
                </button>

                {joinMessage && (
                  <p className={`text-sm text-center ${joinMessage.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                    {joinMessage}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Your Stats</h2>

            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Cards Studied</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.cardsStudied}
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.accuracy}%
                </p>
              </div>

              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Day Streak</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.streak} 🔥
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with authentication protection
export default withAuth(ProfilePage);
