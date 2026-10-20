"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="The staff list couldn’t load" error={error} reset={reset} />;
}
