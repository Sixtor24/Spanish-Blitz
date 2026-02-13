import { useState } from 'react';
import { Mic } from 'lucide-react';
import { useMicrophone } from '@/lib/microphone-context';

interface BlitzMicModalProps {
  onComplete: () => void;
}

export default function BlitzMicModal({ onComplete }: BlitzMicModalProps) {
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
    } else {
      disableMic();
      setDenied(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
            <Mic className="text-purple-600" size={36} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Microphone Required
        </h2>

        {/* Body */}
        <p className="text-gray-600 text-center mb-8 leading-relaxed">
          This Blitz Challenge requires voice answers. Enable your microphone to participate.
        </p>

        {/* Denied error */}
        {denied && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 font-medium text-sm">
              Microphone permission was denied. Please allow microphone access in your browser settings and try again.
            </p>
          </div>
        )}

        {/* Single button: Practice with voice */}
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
              : 'Practice with voice'}
        </button>

        {/* Helper text */}
        <p className="text-xs text-gray-400 text-center mt-5">
          Your teacher requires voice answers for this activity.
        </p>
      </div>
    </div>
  );
}
