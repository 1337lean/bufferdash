"use client";

import { useFormState } from "react-dom";
import type { ActionState } from "@/app/actions";

export function ActionForm({
  action,
  children,
  className
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <p className="form-error">{state.error}</p>}
      {state.success && <p className="form-success">{state.success}</p>}
    </form>
  );
}
