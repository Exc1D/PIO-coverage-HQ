/** Shown when a Server Action can't reach the server (dropped signal at a venue, etc.). */
export const OFFLINE_MESSAGE = "Couldn’t reach the server. Check your connection and try again; nothing was saved.";

/** Shown when the server hasn't answered in time. The save may still land, so don't say it failed. */
export const NO_ANSWER_MESSAGE = "The server hasn’t answered. Your change may still go through, so check the event before trying again.";

// ponytail: stops the wait, not the request. Next runs server actions one at a time, so a retry queues behind a stalled one; abort it if that bites.
export const SAVE_TIME_LIMIT_MS = 30_000;

/** `work`'s result, or `fallback` if it takes longer than `ms`. It can't cancel `work`, only stop waiting for it. */
export function withTimeLimit<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}
