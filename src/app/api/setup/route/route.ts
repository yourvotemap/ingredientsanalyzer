import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { setupKey } = await request.json();
  if (setupKey !== "initial-setup-2024") {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
  }

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({ message: "Setup already completed", users: existingUsers });
    }

    const adminPassword = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        email: "admin@company.co.jp",
        name: "管理者",
        hashedPassword: adminPassword,
        role: "admin",
        department: "開発部",
      },
    });

    const salesPassword = await bcrypt.hash("sales123", 12);
    await prisma.user.create({
      data: {
        email: "sales@company.co.jp",
        name: "営業太郎",
        hashedPassword: salesPassword,
        role: "viewer",
        department: "営業部",
      },
    });

    return NextResponse.json({
      message: "Setup complete",
      users: [
        { email: "admin@company.co.jp", role: "admin" },
        { email: "sales@company.co.jp", role: "viewer" },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Setup failed: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 500 }
    );
  }
}
