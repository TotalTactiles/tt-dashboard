/**
 * Shared Confirmed / With YLWs pill toggle.
 * Standard for all such toggles across the dashboard so they can never drift.
 *
 * Colour rule:
 *  - Active "Confirmed" = Havelock Blue (#3D89DA)
 *  - Active "With YLWs" = YLW yellow (#E8B931)
 *  - Inactive = muted (transparent bg, muted-foreground text)
 */
type Props = {
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  className?: string;
};

export default function ConfirmedYlwToggle({ withYlw, setWithYlw, className }: Props) {
  return (
    <div
      className={`flex rounded-full bg-secondary/80 p-0.5 leading-none ${className ?? ""}`}
      style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
    >
      <button
        type="button"
        onClick={() => setWithYlw(false)}
        className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
          !withYlw
            ? "text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        style={!withYlw ? { backgroundColor: "#3D89DA" } : undefined}
      >
        Confirmed
      </button>
      <button
        type="button"
        onClick={() => setWithYlw(true)}
        className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
          withYlw
            ? "text-black shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        style={withYlw ? { backgroundColor: "#E8B931" } : undefined}
      >
        With YLWs
      </button>
    </div>
  );
}
