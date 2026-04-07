import NextAuth, { type AuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { azureADConfig, authConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

export const authOptions: AuthOptions = {
  secret: authConfig.secret,
  providers: [
    ...(azureADConfig.isConfigured
      ? [
          AzureADProvider({
            clientId: azureADConfig.clientId,
            clientSecret: azureADConfig.clientSecret,
            tenantId: azureADConfig.tenantId,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
          });

          if (dbUser) {
            (session.user as { id?: string; role?: string }).id = dbUser.id;
            (session.user as { id?: string; role?: string }).role = dbUser.role;
          } else {
            (session.user as { id?: string; role?: string }).role = "agent";
          }
        } catch (error) {
          console.error("❌ Failed to fetch user role for session:", error instanceof Error ? error.message : String(error));
          (session.user as { id?: string; role?: string }).role = "agent";
        }
      }

      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.email = profile.email ?? token.email;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };