import { NextResponse } from "next/server";
import { stat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isSavedRun } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SAVED_RUN_BYTES = 5 * 1024 * 1024;

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export async function GET() {
  const configuredPath = process.env.VYUHA_SAVED_RUN_PATH;
  if (!configuredPath) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const savedRunPath = resolve(process.cwd(), "..", configuredPath);
  try {
    const fileInfo = await stat(savedRunPath);
    if (!fileInfo.isFile() || fileInfo.size > MAX_SAVED_RUN_BYTES) {
      console.error("saved_run_read_rejected", {
        event: "saved_run_read_rejected",
        reason: "invalid_file_size_or_type",
      });
      return NextResponse.json(
        { error: "saved_run_unavailable" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    const content = await readFile(savedRunPath, "utf-8");
    const savedRun: unknown = JSON.parse(content);
    if (!isSavedRun(savedRun)) {
      console.error("saved_run_read_rejected", {
        event: "saved_run_read_rejected",
        reason: "invalid_saved_run_schema",
      });
      return NextResponse.json(
        { error: "saved_run_unavailable" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(savedRun, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    console.error("saved_run_read_failed", {
      event: "saved_run_read_failed",
      exception_type: errorType(error),
    });
    return NextResponse.json(
      { error: "saved_run_unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
