import { useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { useMicrophone } from '../../lib/microphone-context';

interface VoiceModeBannerProps {
  onComplete: () => void;
}

export default function VoiceModeBanner({ onComplete }: VoiceModeBannerProps) {
  const { enableMic, disableMic } = useMicrophone();
  const [requesting, setRequesting] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<'voice' | 'listen' | null>(null);

  const handleVoiceOn = async () => {
    setRequesting(true);
    const granted = await enableMic();
    setRequesting(false);
    if (!granted) {
      disableMic();
    }
    onComplete();
  };

  const handleVoiceOff = () => {
    disableMic();
    onComplete();
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
          Solo Blitz
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
          How do you want to play?
        </h2>
        <p className="text-gray-500 mt-2 text-sm">
          Choose your practice style for this session.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Voice ON card */}
        <button
          onClick={handleVoiceOn}
          disabled={requesting}
          onMouseEnter={() => setHoveredCard('voice')}
          onMouseLeave={() => setHoveredCard(null)}
          className={`relative group rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 border-2 disabled:opacity-60 disabled:cursor-wait ${
            hoveredCard === 'voice'
              ? 'border-purple-500 bg-purple-50 shadow-xl shadow-purple-100 scale-[1.02]'
              : 'border-gray-200 bg-white shadow-md hover:shadow-lg'
          }`}
        >
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-200 ${
            hoveredCard === 'voice'
              ? 'bg-purple-600'
              : 'bg-gradient-to-br from-purple-500 to-purple-700'
          }`}>
            <Mic className="text-white" size={26} />
          </div>

          {/* Text */}
          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1">
            {requesting ? 'Requesting...' : 'Voice ON'}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 leading-snug">
            Speak out loud to practice your pronunciation
          </p>

          {/* Decorative accent */}
          <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
            hoveredCard === 'voice' ? 'bg-purple-500' : 'bg-gray-200'
          }`} />
        </button>

        {/* Voice OFF card */}
        <button
          onClick={handleVoiceOff}
          onMouseEnter={() => setHoveredCard('listen')}
          onMouseLeave={() => setHoveredCard(null)}
          className={`relative group rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 border-2 ${
            hoveredCard === 'listen'
              ? 'border-blue-400 bg-blue-50 shadow-xl shadow-blue-100 scale-[1.02]'
              : 'border-gray-200 bg-white shadow-md hover:shadow-lg'
          }`}
        >
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-200 ${
            hoveredCard === 'listen'
              ? 'bg-blue-500'
              : 'bg-gradient-to-br from-blue-400 to-blue-600'
          }`}>
            <Volume2 className="text-white" size={26} />
          </div>

          {/* Text */}
          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1">
            Voice OFF
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 leading-snug">
            Read and listen only — no microphone needed
          </p>

          {/* Decorative accent */}
          <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
            hoveredCard === 'listen' ? 'bg-blue-400' : 'bg-gray-200'
          }`} />
        </button>
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-gray-400 mt-5">
        You can change this anytime. No pressure.
      </p>
    </div>
  );
}
