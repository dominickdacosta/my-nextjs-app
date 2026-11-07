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
