import "server-only";
import type { ActivityEntry } from "@/lib/workflow";

export type EventNotification = {
  eventId: string;
  title: string;
  actorId: string | null;
  activity: readonly ActivityEntry[];
};

/**
 * Hook for future notifications (email/SMS/Messenger are out of scope for
 * now). Called after every committed event change with the activity rows it
 * produced: status changes, assignments, ticks. Must never throw into the
 * caller; a failed notification can't undo a saved change.
 */
export async function notify(notification: EventNotification): Promise<void> {
  // Intentionally a no-op until a notification channel is added.
  void notification;
}
