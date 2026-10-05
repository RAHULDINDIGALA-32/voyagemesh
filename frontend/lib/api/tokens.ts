const prefix = "vm_workflow_token:";

export function saveWorkflowToken(threadId: string, token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${prefix}${threadId}`, token);
}

export function readWorkflowToken(threadId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${prefix}${threadId}`);
}
