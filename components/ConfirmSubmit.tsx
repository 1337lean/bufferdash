"use client";

export function ConfirmSubmit({ children, message }: { children: React.ReactNode; message: string }) {
  return <button className="danger-button" type="submit" onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</button>;
}
