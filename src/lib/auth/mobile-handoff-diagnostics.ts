export function logMobileHandoffDiagnostic(
  request: Request,
  stage: "complete" | "exchange",
  outcome: string,
) {
  console.info("[auth][mobile-handoff]", {
    stage,
    outcome,
    requestId: request.headers.get("x-vercel-id") ?? undefined,
  });
}
