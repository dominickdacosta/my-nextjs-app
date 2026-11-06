import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type UserHandler = (request: Request, userId: string) => Promise<NextResponse>;

export function withUser(handler: UserHandler) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      return await handler(request, userId);
    } catch (error) {
      const errorType = error instanceof Error ? error.name : "UnknownError";
      console.error(`API request failed (${errorType}).`);
      return NextResponse.json(
        { error: "The request could not be completed." },
        { status: 500 },
      );
    }
  };
}

export function invalidInput(issues: unknown) {
  return NextResponse.json(
    { error: "Invalid request data.", issues },
    { status: 400 },
  );
}

export async function readJson(request: Request): Promise<
  | { body: unknown; response?: never }
  | { body?: never; response: NextResponse }
> {
  try {
    return { body: await request.json() };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        response: NextResponse.json(
          { error: "Request body must be valid JSON." },
          { status: 400 },
        ),
      };
    }
    throw error;
  }
}
