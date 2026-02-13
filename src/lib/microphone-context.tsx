import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MicrophoneContextValue {
  /** Whether the microphone is enabled for voice features in the current game session */
  micEnabled: boolean;
  /** Enable mic: requests browser permission, returns true if granted */
  enableMic: () => Promise<boolean>;
  /** Disable mic: user chose not to use it */
  disableMic: () => void;
  /** Reset mic state (called when entering a new game mode so the prompt shows again) */
  resetMic: () => void;
}

const MicrophoneContext = createContext<MicrophoneContextValue | null>(null);

export function MicrophoneProvider({ children }: { children: ReactNode }) {
  const [micEnabled, setMicEnabled] = useState(false);

  const enableMic = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicEnabled(true);
      return true;
    } catch {
      setMicEnabled(false);
      return false;
    }
  }, []);

  const disableMic = useCallback(() => {
    setMicEnabled(false);
  }, []);

  const resetMic = useCallback(() => {
    setMicEnabled(false);
  }, []);

  return (
    <MicrophoneContext.Provider value={{ micEnabled, enableMic, disableMic, resetMic }}>
      {children}
    </MicrophoneContext.Provider>
  );
}

export function useMicrophone() {
  const ctx = useContext(MicrophoneContext);
  if (!ctx) {
    throw new Error('useMicrophone must be used within a MicrophoneProvider');
  }
  return ctx;
}
