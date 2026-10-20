import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-12 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">This page or event doesn’t exist. It may have been removed or the link is incomplete.</p>
      <div>
        <Button asChild>
          <Link href="/board">Go to the board</Link>
        </Button>
      </div>
    </main>
  );
}
