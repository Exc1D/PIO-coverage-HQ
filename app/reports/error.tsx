"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="The report couldn’t load" error={error} reset={reset} />;
}
