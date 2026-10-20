"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function EventError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="This event couldn’t load" error={error} reset={reset} />;
}
