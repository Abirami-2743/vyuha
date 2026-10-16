import type { Evidence, Provenance } from "@/lib/contracts";

const provenanceLabels: Record<Provenance, string> = {
  qloo: "Qloo evidence",
  external: "External (map)",
  ai_interpretation: "AI interpretation",
  unknown: "Unknown",
};

const provenanceStyles: Record<Provenance, string> = {
  qloo: "border-emerald-800/20 bg-emerald-50 text-emerald-900",
  external: "border-sky-800/20 bg-sky-50 text-sky-900",
  ai_interpretation: "border-violet-800/20 bg-violet-50 text-violet-900",
  unknown: "border-slate-500/20 bg-slate-100 text-slate-700",
};

export function SourceTag({ source }: { source: Provenance }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${provenanceStyles[source]}`}
    >
      {provenanceLabels[source]}
    </span>
  );
}

export function EvidenceLine({
  evidence,
  fallback = "unknown",
}: {
  evidence: Evidence;
  fallback?: Provenance;
}) {
  return (
    <div className="space-y-2 border-l-2 border-line pl-3">
      <SourceTag source={evidence.source_type || fallback} />
      <p className="text-sm leading-6 text-slate-700">{evidence.claim}</p>
      <p className="break-all text-xs text-slate-500">Source: {evidence.source_reference}</p>
    </div>
  );
}
