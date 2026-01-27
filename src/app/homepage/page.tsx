import { Link } from 'react-router-dom';
import { BookOpen, Zap, Award, Users, Trophy, Sparkles } from 'lucide-react';
import useUser from '@/shared/hooks/useUser';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

export default function HomePage() {
  const { data: user, loading } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <img
                src="https://ucarecdn.com/df05b2e5-6ee7-4c41-b12b-d556708883a3/-/format/auto/"
                alt="The Spanish Blitz"
                className="h-10 w-auto"
              />
            </Link>
            
            <div className="flex items-center gap-3">
              {!loading && (
                <>
                  {user ? (
                    <>
                      <Link
                        to="/dashboard"
                        className="hidden sm:inline-block px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/dashboard"
                        className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-full transition-colors"
                      >
                        Go to App
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/pricing"
                        className="hidden sm:inline-block px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors"
                      >
                        Pricing
                      </Link>
                      <Link
                        to="/account/signin"
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/account/signup"
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-full transition-colors"
                      >
                        Sign Up
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <img
            src="https://ucarecdn.com/de98c936-2bfa-4258-8713-5057c6621107/-/format/auto/"
            alt="The Spanish Blitz"
            className="mx-auto mb-6 h-32 md:h-40 w-auto"
            loading="lazy"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Master Spanish with <span className="text-orange-500">Voice Power</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Learn Spanish naturally with AI-powered voice recognition, interactive flashcards, and real-time pronunciation feedback.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/account/signup"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Started Free
            </Link>
            <Link
              to="/account/signin"
              className="inline-block bg-white hover:bg-gray-50 text-gray-800 font-semibold text-lg px-8 py-4 rounded-full transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <FeatureCard
            icon={<BookOpen className="text-blue-600" size={48} />}
            title="Study Mode"
            description="Learn at your own pace with interactive flashcards. Listen to authentic Spanish pronunciation and build your vocabulary effortlessly."
          />
          <FeatureCard
            icon={<Zap className="text-orange-500" size={48} />}
            title="Solo Blitz"
            description="Challenge yourself with timed quizzes, multiple choice questions, and voice-powered answers. Track your progress and watch your skills grow."
          />
          <FeatureCard
            icon={<Award className="text-green-600" size={48} />}
            title="Voice Recognition"
            description="Practice speaking Spanish with AI-powered voice recognition. Get instant feedback on your pronunciation and accent."
          />
          <FeatureCard
            icon={<Users className="text-purple-600" size={48} />}
            title="Multiplayer Challenges"
            description="Compete with friends or join live sessions. Make learning fun and social with real-time multiplayer blitz challenges."
          />
          <FeatureCard
            icon={<Trophy className="text-yellow-600" size={48} />}
            title="Track Progress"
            description="Monitor your learning journey with detailed statistics, achievement badges, and personalized insights to stay motivated."
          />
          <FeatureCard
            icon={<Sparkles className="text-pink-600" size={48} />}
            title="Custom Decks"
            description="Create your own flashcard decks or import existing ones. Tailor your learning experience to match your goals."
          />
        </div>

        {/* How It Works Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <div className="bg-orange-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Sign Up Free</h3>
              <p className="text-gray-600">
                Create your account in seconds. No credit card required.
              </p>
            </div>
            <div className="relative">
              <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Choose Your Deck</h3>
              <p className="text-gray-600">
                Select from pre-made decks or create your own custom flashcards.
              </p>
            </div>
            <div className="relative">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Start Learning</h3>
              <p className="text-gray-600">
                Practice speaking, listening, and master Spanish naturally.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing CTA */}
        <div className="mt-20 text-center bg-gradient-to-br from-blue-500 to-teal-500 rounded-2xl p-10 shadow-xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start Learning Today
          </h2>
          <p className="text-blue-100 text-lg mb-6 max-w-2xl mx-auto">
            Free forever with ads. Upgrade to premium anytime to unlock an ad-free experience and exclusive features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/account/signup"
              className="inline-block bg-white text-blue-600 hover:bg-gray-50 font-bold text-lg px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Started Free
            </Link>
            <Link
              to="/pricing"
              className="inline-block text-white border-2 border-white hover:bg-white hover:text-blue-600 font-semibold text-lg px-8 py-4 rounded-full transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-600">
          <p className="text-sm">
            © {new Date().getFullYear()} The Spanish Blitz. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
