import { useState, useEffect } from "react";
import Navigation from "@/shared/components/Navigation";
import { User, Globe, LogOut } from "lucide-react";
import useAuth from "@/shared/hooks/useAuth";
import { api } from "@/config/api";
import type { DbUser } from "@/types/api.types";

export default function ProfilePage() {
  const [user, setUser] = useState<DbUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [preferredLocale, setPreferredLocale] = useState("es-ES");
  const [stats, setStats] = useState({
    cardsStudied: 0,
    accuracy: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { signOut } = useAuth();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userData, statsData] = await Promise.all([
          api.users.current(),
          api.stats.get(),
        ]);

        setUser(userData);
        setDisplayName(userData.display_name || '');
        setPreferredLocale(userData.preferred_locale || 'es-ES');
        setStats(statsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const updated = await api.users.patch({
        display_name: displayName,
        preferred_locale: preferredLocale,
      });
      setUser(updated);
      setMessage("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

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

  const isDialectSelectionEnabled = user?.plan === "gold";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User size={24} />
              Profile Settings
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
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
                    Spanish dialect selection is coming soon with Gold
                    (recommended for Spanish teachers).
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
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

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">Email: {user?.email}</p>
              <p className="text-sm text-gray-600">
                Plan:{" "}
                {user?.plan === "premium"
                  ? "Premium"
                  : user?.plan === "gold"
                    ? "Gold"
                    : "Free"}
              </p>
            </div>

            {/* Sign out section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Your Stats</h2>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Cards Studied</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.cardsStudied}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Accuracy</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.accuracy}%
                </p>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Day Streak</p>
                <p className="text-3xl font-bold text-orange-600">
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
