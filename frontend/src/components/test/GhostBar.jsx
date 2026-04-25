import { motion } from 'framer-motion';
import { Ghost } from 'lucide-react';

/**
 * Ghost Mode progress bar.
 * Shows a semi-transparent ghost marker at the position
 * the user would be at if they matched their best time.
 * 
 * @param {{
 *   currentIndex: number,
 *   totalQuestions: number,
 *   timeLeft: number,
 *   totalTime: number,
 *   ghostBestTime: number
 * }} props
 */
export default function GhostBar({ currentIndex, totalQuestions, timeLeft, totalTime, ghostBestTime }) {
  const safeTotalQuestions = Number(totalQuestions) > 0 ? Number(totalQuestions) : 1;
  const safeCurrentIndex = Math.max(0, Number(currentIndex) || 0);
  const safeTimeLeft = Math.max(0, Number(timeLeft) || 0);
  const safeTotalTime = Math.max(1, Number(totalTime) || 1);
  const bestTime = Math.max(0, Number(ghostBestTime) || 0);

  const userProgress = Math.min(100, ((safeCurrentIndex + 1) / safeTotalQuestions) * 100);

  // Ghost is at where a user finishing in ghostBestTime would be now
  const timeElapsed = Math.max(0, safeTotalTime - safeTimeLeft);
  const ghostProgress = bestTime > 0
    ? Math.min(100, (timeElapsed / bestTime) * 100)
    : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">Ви</span>
        {ghostProgress !== null && (
          <span className="flex items-center gap-1 text-purple-500">
            <Ghost className="w-3 h-3" /> Привид ({Math.floor(bestTime / 60)}:{String(bestTime % 60).padStart(2, '0')})
          </span>
        )}
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        {/* User bar */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full bg-primary"
          animate={{ width: `${userProgress}%` }}
          transition={{ duration: 0.3 }}
        />
        {/* Ghost marker */}
        {ghostProgress !== null && (
          <motion.div
            className="absolute top-0 h-full w-1.5 rounded-full bg-purple-400/60"
            animate={{ left: `calc(${Math.min(ghostProgress, 99)}% - 3px)` }}
            transition={{ duration: 0.5 }}
          />
        )}
      </div>
      {ghostProgress !== null && ghostProgress < userProgress && (
        <p className="text-xs text-green-500 font-medium">👻 Ти попереду привида!</p>
      )}
      {ghostProgress !== null && ghostProgress > userProgress && (
        <p className="text-xs text-purple-500">👻 Привид попереду — поспішай!</p>
      )}
    </div>
  );
}