import type { SVGProps } from 'react';

export interface JackOLanternProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  title?: string;
}

/**
 * Hand-authored jack-o'-lantern icon, API-compatible with @phosphor-icons/react
 * usage (size/className/...props on a 256x256 viewBox). The face is cut out of
 * the pumpkin body via an evenodd fill so the surrounding background shows
 * through, rather than being drawn as separate shapes.
 */
export function JackOLantern({
  size = 24,
  className,
  title,
  'aria-hidden': ariaHiddenProp,
  ...rest
}: JackOLanternProps) {
  const ariaHidden = ariaHiddenProp ?? (title ? undefined : true);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden={ariaHidden}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d="M120,48 L116,20 C115,14 119,10 125,10 L131,10 C137,10 141,14 140,20 L136,48 Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M128,46
           C100,46 72,54 58,86
           C46,112 42,140 44,166
           C46,194 64,214 92,224
           C104,229 116,232 128,232
           C140,232 152,229 164,224
           C192,214 210,194 212,166
           C214,140 210,112 198,86
           C184,54 156,46 128,46
           Z
           M92,96 L108,130 L76,130 Z
           M164,96 L180,130 L148,130 Z
           M128,132 L136,152 L120,152 Z
           M70,168 L80,192 L92,168 L104,192 L116,168 L128,192 L140,168 L152,192 L164,168 L176,192 L186,168 L186,204 L70,204 Z"
      />
      <path
        d="M92,70 C84,110 84,170 94,212"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M164,70 C172,110 172,170 162,212"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}
