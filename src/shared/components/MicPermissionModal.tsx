import { useState } from 'react';
import { Mic, Eye, Ear } from 'lucide-react';
import { useMicrophone } from '@/lib/microphone-context';

interface MicPermissionModalProps {
  onComplete: () => void;
  /** When true, mic is mandatory — no skip/close, only "Enable Microphone" */
  required?: boolean;
}

export default function MicPermissionModal({ onComplete, required = false }: MicPermissionModalProps) {
  const { enableMic, disableMic } = useMicrophone();
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleEnableVoice = async () => {
    setRequesting(true);
    setDenied(false);
    const granted = await enableMic();
    setRequesting(false);
    if (granted) {
      onComplete();
    } else if (required) {
      // Required mode: don't dismiss, show error
      disableMic();
      setDenied(true);
    } else {
      // Optional mode: treat denial as "no mic" and dismiss
      disableMic();
      onComplete();
    }
  };

  const handleWithoutVoice = () => {
    disableMic();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            required
              ? 'bg-gradient-to-br from-red-100 to-orange-100'
              : 'bg-gradient-to-br from-purple-100 to-blue-100'
          }`}>
            <Mic className={required ? 'text-red-500' : 'text-purple-600'} size={36} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          {required ? 'Microphone Required' : 'How do you want to practice right now?'}
        </h2>

        {/* Body */}
        <p className="text-gray-600 text-center mb-8 leading-relaxed">
          {required
            ? 'This activity requires voice answers. Please enable your microphone to participate.'
            : 'You can practice just by reading and listening, or you can practice speaking out loud to improve your pronunciation.'}
        </p>

        {/* Denied error (required mode only) */}
        {required && denied && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 font-medium text-sm">
              Microphone permission was denied. Please allow microphone access in your browser settings and try again.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleEnableVoice}
            disabled={requesting}
            className="w-full flex items-center justify-center gap-3 bg-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-wait shadow-lg shadow-purple-200"
          >
            <Mic size={22} />
            {requesting
              ? 'Requesting permission...'
              : denied
                ? 'Try Again'
                : required
                  ? 'Enable Microphone'
                  : 'Practice with voice'}
          </button>

          {!required && (
            <button
              onClick={handleWithoutVoice}
              className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-200 transition-colors"
            >
              <Eye size={20} />
              Practice without voice
              <Ear size={20} />
            </button>
          )}
        </div>

        {/* Helper text */}
        <p className="text-xs text-gray-400 text-center mt-5">
          {required
            ? 'Your teacher requires voice answers for this activity.'
            : 'You can change this anytime. No pressure.'}
        </p>
      </div>
    </div>
  );
}
