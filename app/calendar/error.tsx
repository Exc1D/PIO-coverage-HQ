"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function CalendarError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="The calendar couldn’t load" error={error} reset={reset} />;
}
