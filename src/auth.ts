import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { readStore, encryptionKey } from "@/lib/store";
import { withinRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/service-catalog";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || encryptionKey().toString("hex"),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/auth/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string" ||
          credentials.email.length > 200 ||
          credentials.password.length > 128
        )
          return null;
        const identifier =
          normalizePhone(credentials.email) ||
          credentials.email.trim().toLowerCase();
        if (!(await withinRateLimit(`login:${identifier}`, 10))) return null;
        const data = await readStore();
        const user = data.users.find(
          (item) =>
            (item.email === identifier ||
              Boolean(
                normalizePhone(identifier) &&
                normalizePhone(item.phone) === identifier,
              )) &&
            item.isActive,
        );
        if (!user?.passwordHash) return null;
        const [salt, hash] = user.passwordHash.split(":");
        const supplied = scryptSync(credentials.password, salt, 64);
        if (!timingSafeEqual(Buffer.from(hash, "hex"), supplied)) return null;
        return { id: user.id, name: user.fullName, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = String(token.id);
      return session;
    },
  },
});
