"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorPanel({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-12 text-center" role="alert">
      <TriangleAlertIcon className="mx-auto size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This is usually a dropped connection. Check your signal and try again.
        {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
      </p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
