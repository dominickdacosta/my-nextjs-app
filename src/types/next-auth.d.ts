import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboarded: boolean;
    } & NonNullable<Session["user"]>;
  }
}
