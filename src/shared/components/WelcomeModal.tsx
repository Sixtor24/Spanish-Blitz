import { X } from 'lucide-react';

type WelcomeModalProps = {
  onDismiss: () => void;
  onCreateSet: () => void;
};

export default function WelcomeModal({ onDismiss, onCreateSet }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
          type="button"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome to The Spanish Blitz 👋</h1>
          <p className="text-lg text-gray-600 mb-6">
            Create your own Spanish flashcards, practice pronunciation, and test yourself with games.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📝</span>
            <p className="text-gray-700 pt-1">Create your own flashcard sets</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎧</span>
            <p className="text-gray-700 pt-1">Hear Spanish pronunciation</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎙️</span>
            <p className="text-gray-700 pt-1">Practice speaking Spanish</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onCreateSet}
            className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg"
            type="button"
          >
            Create Your First Set
          </button>
          <button
            onClick={onDismiss}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            type="button"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
