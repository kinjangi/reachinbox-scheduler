import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Demo Login',
      credentials: {
        email: { label: "Email (Any)", type: "text", placeholder: "demo@reachinbox.com" },
        password: { label: "Password (Any)", type: "password", placeholder: "password" }
      },
      async authorize(credentials) {
        // Accept ANY login for testing/demo purposes
        if (credentials?.email) {
          const emailParts = credentials.email.split('@');
          const name = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
          
          return {
            id: `user-${Date.now()}`,
            name: name,
            email: credentials.email,
          };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/',          // Redirect unauthenticated users to the home/login page
    error: '/auth/error', // Custom error page (optional)
  },
  callbacks: {
    async session({ session, token }) {
      // Forward the Google user id to the session object
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, always redirect to /dashboard
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
