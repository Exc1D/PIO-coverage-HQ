"use server";

import { clientIpHash } from "@/lib/auth/ip";
import { db } from "@/lib/db/server";
import { notify } from "@/lib/notify";
import { recentHits, recordHit } from "@/lib/rate-limit";
import { isBot, parseRequest, REQUEST_FIELDS, REQUESTS_PER_HOUR } from "@/lib/request-form";
import { manilaDate } from "@/lib/time";
import type { EventRow } from "@/lib/types";

export type RequestState =
  | { submitted: true; title: string; date: string }
  | { submitted?: false; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;

const BUCKET = "public_request";
const HOUR = 60 * 60 * 1000;

export async function submitRequestAction(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const raw: Record<string, string> = {};
  for (const k of [...REQUEST_FIELDS, "website"]) raw[k] = String(formData.get(k) ?? "");
  const values = Object.fromEntries(REQUEST_FIELDS.map((k) => [k, raw[k]]));

  const ipHash = await clientIpHash();

  // Honeypot: look successful so bots move on, but save nothing.
  if (isBot(raw)) {
    await recordHit(BUCKET, ipHash);
    return { submitted: true, title: raw.title, date: raw.event_date };
  }

  if ((await recentHits(BUCKET, ipHash, HOUR)) >= REQUESTS_PER_HOUR) {
    return {
      error: "We’ve received several requests from your connection in the last hour. Please try again later or contact the PIO directly.",
      values,
    };
  }

  const parsed = parseRequest(raw, manilaDate(new Date()));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const activity = [{ actor_id: null, action: "created", from_status: null, to_status: "requested", details: { public_request: true } }];
  const { data, error } = await db()
    .rpc("create_event", { p_row: { ...parsed.data, status: "requested", created_by_id: null }, p_activity: activity })
    .single<EventRow>();
  if (error) {
    console.error("public request failed", error.code, error.message);
    return { error: "Your request couldn’t be sent. Please try again.", values };
  }
  await recordHit(BUCKET, ipHash);
  await notify({
    eventId: data.id,
    title: data.title,
    actorId: null,
    activity: [{ action: "created", from_status: null, to_status: "requested", details: { public_request: true } }],
  }).catch((e) => console.error("notify failed", e));

  return { submitted: true, title: data.title, date: data.event_date };
}
