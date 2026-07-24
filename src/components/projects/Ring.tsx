interface Props {
  pct: number; // 0-100
  size: number;
  stroke?: number;
  showLabel?: boolean;
  labelSize?: number;
}

export function Ring({ pct, size, stroke = 3, showLabel = false, labelSize = 15 }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const done = clamped >= 100;
  const color = done ? "#22C55E" : "#3D89DA";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1D1D22" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease, stroke 300ms ease" }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute tabular-nums font-semibold"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: labelSize,
            color: done ? "#22C55E" : "#E6EEF3",
          }}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
