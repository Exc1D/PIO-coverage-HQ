"use client";

// Last-resort error page when the root layout itself fails. Must render its own <html>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.125rem" }}>PIO Production couldn’t load</h1>
        <p style={{ color: "#525252" }}>This is usually a dropped connection. Check your signal and try again.</p>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #d4d4d4" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
