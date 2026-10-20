"use client";

import { ErrorPanel } from "@/components/app/error-panel";

export default function BoardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="The board couldn’t load" error={error} reset={reset} />;
}
