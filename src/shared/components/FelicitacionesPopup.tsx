/**
 * FelicitacionesPopup
 * Shows a celebratory popup with confetti when a student receives
 * a teacher recognition (felicitación) for completing a mission.
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "@/config/api";

const DARK_BLUE = "#084178";
const LIGHT_BLUE = "#10A5C3";

interface Felicitacion {
  id: string;
  teacher_name: string;
  mission_name?: string;
  message?: string;
}

// ─── Simple confetti particles ──────────────────────────────────────
function ConfettiCanvas() {
  useEffect(() => {
    const canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF8C00"];
    const particles: Array<{
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number; rotation: number; rv: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rv: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    let frame: number;
    let elapsed = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elapsed++;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rv;
        if (elapsed > 80) p.opacity = Math.max(0, p.opacity - 0.015);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < 160) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      id="confetti-canvas"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
}

// ─── Main Popup ─────────────────────────────────────────────────────
export default function FelicitacionesPopup() {
  const [felicitaciones, setFelicitaciones] = useState<Felicitacion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.felicitaciones.pending().then((data: Felicitacion[]) => {
      if (mounted && data && data.length > 0) {
        setFelicitaciones(data);
        setShowConfetti(true);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleDismiss = useCallback(async () => {
    const current = felicitaciones[currentIndex];
    if (current) {
      try { await api.felicitaciones.markViewed(current.id); } catch {}
    }

    if (currentIndex < felicitaciones.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setFelicitaciones([]);
      setShowConfetti(false);
    }
  }, [currentIndex, felicitaciones]);

  if (felicitaciones.length === 0) return null;

  const current = felicitaciones[currentIndex];

  return (
    <>
      {showConfetti && <ConfettiCanvas />}

      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
        <div
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300"
        >
          {/* Trophy */}
          <div className="text-6xl mb-4">🎉</div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: DARK_BLUE }}>
            <span className="dark:text-blue-300">¡Felicitaciones!</span>
          </h2>

          <p className="text-gray-600 dark:text-gray-300 mb-1">
            Your teacher <span className="font-semibold" style={{ color: LIGHT_BLUE }}>{current.teacher_name}</span> recognized you
          </p>

          {current.mission_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              for completing <span className="font-medium">{current.mission_name}</span>
            </p>
          )}

          {current.message && (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-6 text-sm text-gray-700 dark:text-gray-300 italic">
              "{current.message}"
            </div>
          )}

          {!current.message && <div className="mb-6" />}

          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl text-white font-bold text-lg transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${DARK_BLUE} 0%, ${LIGHT_BLUE} 100%)` }}
          >
            {currentIndex < felicitaciones.length - 1 ? "Next →" : "¡Gracias!"}
          </button>

          {felicitaciones.length > 1 && (
            <p className="text-xs text-gray-400 mt-3">
              {currentIndex + 1} of {felicitaciones.length}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
