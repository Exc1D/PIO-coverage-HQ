import type { Metadata } from "next";
import { TrackAnnotator } from "@/components/typhoon/track-annotator";

export const metadata: Metadata = { title: "Typhoon track" };

export default function TyphoonPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6">
      <div>
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">Typhoon track</h1>
        <p className="text-sm text-muted-foreground">
          Mark up PAGASA&apos;s track map for a post: circle Camarines Norte, point out the path, add labels. Nothing is saved; download or copy the result.
        </p>
      </div>
      <TrackAnnotator />
    </main>
  );
}
