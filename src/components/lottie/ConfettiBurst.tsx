import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface ConfettiBurstProps {
  /** Toggling this to true triggers one confetti burst. */
  active: boolean;
  /** Duration in ms before unmount. Defaults to 1800. */
  duration?: number;
}

/**
 * Full-screen confetti celebration overlay.
 * Renders only while active; auto-removes after `duration`.
 */
export function ConfettiBurst({ active, duration = 1800 }: ConfettiBurstProps) {
  const [show, setShow] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!active) return;
    setShow(true);
    setNonce((n) => n + 1);
    const t = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(t);
  }, [active, duration]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] flex items-center justify-center">
      <DotLottieReact
        key={nonce}
        src="/anim/confetti.lottie"
        autoplay
        loop={false}
        style={{ width: '100%', height: '100%', maxWidth: 720, maxHeight: 720 }}
      />
    </div>
  );
}