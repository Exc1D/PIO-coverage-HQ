"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin } from "@/lib/auth/login";
import { hashPin, pinSchema } from "@/lib/auth/pin";
import { createSession, destroySession } from "@/lib/auth/session";
import { STAFF_TAG } from "@/lib/data/staff";
import { db, DB_ERRORS } from "@/lib/db/server";
import { fieldErrors } from "@/lib/form-errors";
import { safeNext } from "@/lib/safe-next";

export type FormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      /** Non-secret values echoed back so React's post-action form reset keeps them. PINs are never echoed. */
      values?: Record<string, string>;
    }
  | undefined;

const loginSchema = z.object({
  staffId: z.uuid("Pick your name."),
  pin: pinSchema,
  next: z.string().optional(),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    staffId: formData.get("staffId"),
    pin: formData.get("pin"),
    next: formData.get("next") ?? undefined,
  });
  const values = { staffId: String(formData.get("staffId") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const result = await attemptLogin(parsed.data.staffId, parsed.data.pin);
  if (!result.ok) return { error: result.message, values };
  redirect(safeNext(parsed.data.next));
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

const setupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name.").max(120),
    displayName: z.string().trim().min(1, "Enter a short display name, e.g. “Grace S.”").max(40),
    pin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((v) => v.pin === v.confirmPin, { path: ["confirmPin"], message: "The PINs don't match." });

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse({
    fullName: formData.get("fullName"),
    displayName: formData.get("displayName"),
    pin: formData.get("pin"),
    confirmPin: formData.get("confirmPin"),
  });
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { data, error } = await db()
    .rpc("create_first_head", {
      p_full_name: parsed.data.fullName,
      p_display_name: parsed.data.displayName,
      p_pin_hash: await hashPin(parsed.data.pin),
    })
    .single<{ id: string; session_version: number }>();

  if (error) {
    if (error.code === DB_ERRORS.conflict) redirect("/login");
    return { error: "Setup failed. Please try again.", values };
  }
  updateTag(STAFF_TAG);
  await createSession(data.id, data.session_version);
  redirect("/");
}
