"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="The dashboard couldn’t load" error={error} reset={reset} />;
}
