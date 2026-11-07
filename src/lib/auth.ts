import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { APP_NAME } from "@/lib/constants";
import { getDb } from "@/lib/db/client";
import {
  accounts,
  profiles,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

const providers: NextAuthConfig["providers"] = [];

const authStateCookie = "vitals.authjs.state.v1";
const authNonceCookie = "vitals.authjs.nonce.v1";

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      checks: ["state", "nonce"],
    }),
  );
}

if (process.env.AUTH_RESEND_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: `${APP_NAME} <onboarding@resend.dev>`,
    }),
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  throw new Error("DATABASE_URL must be configured before starting the app.");
}

export const authConfig: NextAuthConfig = {
  cookies: {
    state: {
      name: authStateCookie,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 15 * 60,
      },
    },
    nonce: {
      name: authNonceCookie,
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 15 * 60,
      },
    },
  },
  logger: {
    error(error) {
      const errorType =
        "type" in error && typeof error.type === "string"
          ? error.type
          : error.name;
      const diagnosticMessage =
        /^(state|nonce|pkceCodeVerifier) (cookie was missing|value could not be parsed)$/.test(
          error.message,
        )
          ? error.message
          : "Authentication request failed.";
      const causeName =
        error.cause instanceof Error ? error.cause.name : undefined;
      console.error("[auth][error]", {
        type: errorType,
        message: diagnosticMessage,
        causeName,
      });
    },
  },
  ...(databaseUrl
    ? {
        adapter: DrizzleAdapter(getDb(), {
          usersTable: users,
          accountsTable: accounts,
          sessionsTable: sessions,
          verificationTokensTable: verificationTokens,
        }),
        session: { strategy: "database" },
      }
    : { session: { strategy: "jwt" } }),
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        if (databaseUrl) {
          const [profile] = await getDb()
            .select({ onboardedAt: profiles.onboardedAt })
            .from(profiles)
            .where(eq(profiles.userId, user.id))
            .limit(1);
          session.user.onboarded = Boolean(profile?.onboardedAt);
        } else {
          session.user.onboarded = false;
        }
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
