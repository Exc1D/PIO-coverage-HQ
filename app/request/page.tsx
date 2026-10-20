import type { Metadata } from "next";
import { RequestForm } from "@/components/request/request-form";

export const metadata: Metadata = {
  title: "Request event coverage",
  description: "Ask the Provincial Information Office of Camarines Norte to cover your event.",
};

// Public page: no sign-in, no staff navigation (see HideOnPublic in the root layout).
export default function RequestPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <p className="text-sm font-medium text-muted-foreground">Provincial Information Office · Camarines Norte</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Request event coverage</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Tell us about the event you’d like the PIO to cover. All fields are required except the start time and notes.
        Sending a request doesn’t guarantee coverage; we’ll get in touch.
      </p>
      <div className="relative rounded-xl border bg-card p-4 sm:p-6">
        <RequestForm />
      </div>
    </main>
  );
}
