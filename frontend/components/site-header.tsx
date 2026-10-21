export function SiteHeader({
  route,
  backLabel,
  backText,
  onBack,
  onHome,
  onAbout,
}: {
  route: string;
  backLabel: string;
  backText: string;
  onBack: () => void;
  onHome: () => void;
  onAbout: () => void;
}) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        {route !== "/" ? (
          <button
            aria-label={`Back to ${backLabel}`}
            className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-forest hover:bg-paper"
            onClick={onBack}
            type="button"
          >
            {backText}
          </button>
        ) : (
          <span aria-hidden="true" className="min-w-11" />
        )}
        <button
          aria-label="Vyuha home"
          className="text-lg font-black tracking-tight text-forest"
          onClick={onHome}
          type="button"
        >
          Vyuha<span className="text-ink">.</span>
        </button>
        <nav aria-label="Main navigation" className="flex items-center gap-3 text-sm font-semibold">
          <button className="min-h-11 text-forest hover:underline" onClick={onHome} type="button">
            Home
          </button>
          <button className="min-h-11 text-forest hover:underline" onClick={onAbout} type="button">
            About
          </button>
        </nav>
      </div>
    </header>
  );
}
