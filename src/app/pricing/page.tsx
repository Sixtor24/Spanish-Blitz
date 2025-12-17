
import Navigation from "@/shared/components/Navigation";
import { Check, X } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Choose the plan that works for you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
            <p className="text-4xl font-bold text-gray-900 mb-6">
              $0<span className="text-lg text-gray-600">/month</span>
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Up to 3 sets</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Up to 20 cards per set</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Study Mode</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Play Solo Mode</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Voice recognition</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Join Multiplayer games</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-gray-500">Ads included</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full bg-gray-300 text-gray-600 px-6 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              Current Plan
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg shadow-lg p-8 text-white relative">
            <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              Popular
            </div>

            <h3 className="text-2xl font-bold mb-2">Premium</h3>
            <p className="text-4xl font-bold mb-6">
              $4.99<span className="text-lg opacity-90">/month</span>
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>Unlimited sets</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>Unlimited cards per set</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>
                  <strong>No ads</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>Create Multiplayer games</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>Priority support</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="flex-shrink-0 mt-1" size={20} />
                <span>Early access to new features</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upgrade to Premium
            </button>

            <p className="text-sm text-center mt-4 opacity-90">
              Premium features are available. Billing will be added in Phase 2.
            </p>
          </div>

          {/* Gold Plan */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-yellow-500 relative">
            <div className="absolute top-4 right-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              Coming Soon
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-1">Gold</h3>
            <p className="text-sm text-gray-600 mb-4">
              Recommended for Spanish Teachers
            </p>
            <p className="text-4xl font-bold text-gray-900 mb-6">
              $9.99<span className="text-lg text-gray-600">/month</span>
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Everything in Premium</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>
                  Teacher hosting tools (spectator mode) — coming soon
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>Spanish dialect selection — coming soon</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>
                  Classroom-friendly multiplayer controls — coming soon
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="text-green-600 flex-shrink-0 mt-1"
                  size={20}
                />
                <span>More teacher tools — coming soon</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full bg-gray-300 text-gray-600 px-6 py-3 rounded-lg font-medium cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
