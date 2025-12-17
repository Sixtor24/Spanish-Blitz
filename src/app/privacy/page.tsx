import Navigation from "@/shared/components/Navigation";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>

        <div className="bg-white rounded-lg shadow p-8 prose max-w-none">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Data Collection
          </h2>
          <p className="text-gray-700 mb-6">
            The Spanish Blitz collects minimal data necessary to provide our
            language learning services. We store your study progress, quiz
            results, and preferences to help you track your learning journey.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Voice Recognition
          </h2>
          <p className="text-gray-700 mb-6">
            Our app uses speech recognition technology configured for Spanish
            language input. Voice data may be processed by third-party speech
            recognition services provided by your browser (such as Google's Web
            Speech API when using Chrome). We do not store audio recordings of
            your voice.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Text-to-Speech
          </h2>
          <p className="text-gray-700 mb-6">
            Spanish audio output is generated using browser-based text-to-speech
            technology. No audio data is transmitted to our servers.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Study Data</h2>
          <p className="text-gray-700 mb-6">
            We store your study events, including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-6">
            <li>Cards you've studied</li>
            <li>Your answers (correct/incorrect/hard)</li>
            <li>Transcripts of spoken answers (text only, no audio)</li>
            <li>Quiz scores and accuracy</li>
          </ul>
          <p className="text-gray-700 mb-6">
            This data is used solely to track your progress and improve your
            learning experience.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Third-Party Services
          </h2>
          <p className="text-gray-700 mb-6">
            When using voice recognition features, your browser may send voice
            data to third-party services for processing. Please refer to your
            browser's privacy policy for more information about how voice data
            is handled.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Data Security
          </h2>
          <p className="text-gray-700 mb-6">
            We implement appropriate security measures to protect your personal
            information and study data.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
          <p className="text-gray-700">
            If you have questions about this privacy policy, please contact us
            at privacy@thespanishlearningclub.com
          </p>
        </div>
      </div>
    </div>
  );
}
