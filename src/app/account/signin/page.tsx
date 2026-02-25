import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import useAuth from "@/shared/hooks/useAuth";
import useUser from "@/shared/hooks/useUser";

const DARK_BLUE = "#084178";
const LIGHT_BLUE = "#1CB0F6";

function MainComponent() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { data: user, loading: userLoading } = useUser();

  useEffect(() => {
    if (!userLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, userLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      await signIn(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect email or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-12 px-4 sm:px-6 lg:px-8
      bg-gradient-to-br from-blue-50 via-white to-blue-50/30
      dark:from-gray-950 dark:via-gray-900 dark:to-gray-950
      flex items-center justify-center"
    >
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side — Illustration */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col justify-center"
        >
          <div className="relative">
            {/* Main Icon */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 mb-8"
            >
              <div className="w-48 h-48 mx-auto bg-[#1CB0F6] rounded-3xl flex items-center justify-center shadow-2xl">
                <Lock className="w-24 h-24 text-white" />
              </div>
            </motion.div>

            {/* Decorative circles */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 right-12 w-32 h-32 bg-[#1CB0F6]/20 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-12 left-12 w-40 h-40 bg-[#084178]/15 dark:bg-[#1CB0F6]/10 rounded-full"
            />

            <h2 className="text-4xl font-bold text-[#084178] dark:text-white mb-4 text-center">
              Welcome Back!
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 text-center">
              Continue your Spanish learning journey
            </p>
          </div>
        </motion.div>

        {/* Right Side — Form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full"
        >
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 sm:p-12 border border-gray-100 dark:border-gray-700">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#084178] dark:text-white mb-2">
                Sign In
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#084178] dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-[#1CB0F6] focus:border-[#1CB0F6] transition outline-none"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#084178] dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-[#1CB0F6] focus:border-[#1CB0F6] transition outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-[#1CB0F6] focus:ring-[#1CB0F6] border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
                <Link
                  to="/account/forgot-password"
                  className="text-sm font-medium text-[#1CB0F6] hover:text-[#084178] dark:hover:text-white transition"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-[#1CB0F6] text-white py-3 px-6 rounded-xl font-medium text-lg hover:bg-[#084178] transition flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Sign Up Link */}
            <p className="mt-8 text-center text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <Link to="/account/signup" className="font-medium text-[#1CB0F6] hover:text-[#084178] dark:hover:text-white transition">
                Sign up for free
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default MainComponent;
