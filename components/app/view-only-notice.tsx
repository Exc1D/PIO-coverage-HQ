import { EyeIcon } from "lucide-react";
import Link from "next/link";

export function ViewOnlyNotice({ returnTo }: { returnTo: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      <span>
        You’re viewing read-only.{" "}
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="font-medium text-foreground underline underline-offset-4">
          Sign in with your PIN
        </Link>{" "}
        to make changes.
      </span>
    </p>
  );
}
