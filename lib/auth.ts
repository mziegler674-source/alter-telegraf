import "server-only";

import { SignJWT, jwtVerify } from "jose";

const secret = process.env.AUTH_SECRET;

if (!secret) {
  throw new Error("AUTH_SECRET fehlt in der .env");
}

const secretKey = new TextEncoder().encode(secret);

export async function createSession(userId: number) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (typeof payload.userId !== "number") {
      return null;
    }

    return {
      userId: payload.userId,
    };
  } catch {
    return null;
  }
}