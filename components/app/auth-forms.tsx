"use client";

import { useActionState } from "react";
import { setupAction, signInAction, type FormState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function PinInput({ name, label, error, autoComplete }: { name: string; label: string; error?: string; autoComplete: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="password"
        inputMode="numeric"
        pattern="\d{4,6}"
        minLength={4}
        maxLength={6}
        autoComplete={autoComplete}
        required
        className="h-11 text-lg tracking-[0.4em]"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <div className="grid gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={state?.values?.name}
          autoComplete="username"
          autoCapitalize="words"
          spellCheck={false}
          className="h-11"
          aria-invalid={fe.name ? true : undefined}
          aria-describedby={fe.name ? "name-hint name-error" : "name-hint"}
        />
        <p id="name-hint" className="text-sm text-muted-foreground">
          Your full name or short name, as on your staff account.
        </p>
        <FieldError id="name-error" message={fe.name} />
      </div>
      <PinInput name="pin" label="PIN" error={fe.pin} autoComplete="current-password" />
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
      <p className="text-sm text-muted-foreground">You stay signed in on this device for 8 hours.</p>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  const fe = state?.fieldErrors ?? {};
  const text = (name: string, label: string, placeholder: string, autoComplete: string) => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        required
        defaultValue={state?.values?.[name]}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11"
        aria-invalid={fe[name] ? true : undefined}
        aria-describedby={fe[name] ? `${name}-error` : undefined}
      />
      <FieldError id={`${name}-error`} message={fe[name]} />
    </div>
  );
  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      {text("fullName", "Full name", "Grace Santos", "name")}
      {text("displayName", "Display name", "Grace S.", "nickname")}
      <PinInput name="pin" label="Choose a 4–6 digit PIN" error={fe.pin} autoComplete="new-password" />
      <PinInput name="confirmPin" label="Repeat the PIN" error={fe.confirmPin} autoComplete="new-password" />
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Creating…" : "Create head account"}
      </Button>
    </form>
  );
}
