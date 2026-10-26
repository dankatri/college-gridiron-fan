import { Ghost } from '@phosphor-icons/react';
import { JackOLantern } from '@/components/icons/JackOLantern';

interface Decoration {
  readonly kind: 'ghost' | 'pumpkin';
  readonly top: string;
  readonly left: string;
  readonly size: number;
  readonly duration: number;
  readonly delay: number;
}

/**
 * Scattered by hand rather than randomized: fixed positions keep every
 * render identical (no layout flicker from re-randomizing on re-render) and
 * keep the element count small and deliberate for mobile rendering cost.
 */
const DECORATIONS: readonly Decoration[] = [
  { kind: 'ghost', top: '8%', left: '6%', size: 36, duration: 7, delay: 0 },
  { kind: 'pumpkin', top: '14%', left: '88%', size: 30, duration: 4, delay: 0.5 },
  { kind: 'ghost', top: '68%', left: '4%', size: 44, duration: 8, delay: 1.2 },
  { kind: 'pumpkin', top: '85%', left: '90%', size: 34, duration: 3.6, delay: 0.2 },
  { kind: 'ghost', top: '34%', left: '94%', size: 28, duration: 6.5, delay: 2 },
  { kind: 'pumpkin', top: '5%', left: '45%', size: 26, duration: 4.5, delay: 1 },
  { kind: 'ghost', top: '88%', left: '55%', size: 32, duration: 7.5, delay: 0.8 },
  { kind: 'pumpkin', top: '52%', left: '2%', size: 30, duration: 3.8, delay: 1.6 },
];

/**
 * Week 9's decorative layer — floating ghosts and flickering jack-o'-lanterns.
 *
 * `fixed inset-0` + `pointer-events-none` on the wrapper (not just the icons)
 * guarantees the overlay can never intercept a click meant for the app
 * underneath, no matter how the icons inside are positioned.
 *
 * The layer deliberately sits at `z-0`, NOT a negative z-index. A negative
 * z-index paints before in-flow block backgrounds, so the app root's opaque
 * `bg-background` would cover the decorations completely — they would mount,
 * size and position correctly while rendering zero visible pixels. Content
 * stays above via `relative z-10` on the container instead.
 * `aria-hidden` keeps it out of the accessibility tree entirely — it carries
 * no information, so screen readers should never see it.
 */
export function HalloweenDecorations() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {DECORATIONS.map((decoration, index) => (
        <span
          key={index}
          className={
            decoration.kind === 'ghost'
              ? 'halloween-ghost absolute text-foreground/25'
              : 'halloween-pumpkin absolute text-primary/70'
          }
          style={{
            top: decoration.top,
            left: decoration.left,
            animationDuration: `${decoration.duration}s`,
            animationDelay: `${decoration.delay}s`,
          }}
        >
          {decoration.kind === 'ghost' ? (
            <Ghost size={decoration.size} weight="fill" />
          ) : (
            <JackOLantern size={decoration.size} />
          )}
        </span>
      ))}
    </div>
  );
}
