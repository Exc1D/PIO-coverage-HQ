import Link from "next/link";

export function ViewOnlyNotice({ returnTo }: { returnTo: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Staff?{" "}
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4">
        Sign in with your PIN
      </Link>
      .
    </p>
  );
}
