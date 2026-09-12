import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { db } from "@/prisma/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const user = await db.orm.public.User.first({
        email,
      });

    if (!user) {
      return NextResponse.json(
        { error: "E-Mail oder Passwort ist falsch." },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "E-Mail oder Passwort ist falsch." },
        { status: 401 }
      );
    }

    const token = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Ein interner Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}