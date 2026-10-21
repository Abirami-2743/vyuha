export function SavedRunBanner({
  capturedAt,
  liveError,
}: {
  capturedAt: string;
  liveError?: string | null;
}) {
  return (
    <div
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
      role="status"
    >
      <p className="font-bold">
        Saved result, not live · captured {new Date(capturedAt).toLocaleString()}
      </p>
      {liveError && <p>{liveError}</p>}
    </div>
  );
}
