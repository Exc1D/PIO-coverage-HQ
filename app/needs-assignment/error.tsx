"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function NeedsAssignmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="This list couldn’t load" error={error} reset={reset} />;
}
