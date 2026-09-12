import "temporal-polyfill/full/global";
import "dotenv/config";
import bcrypt from "bcryptjs";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../prisma/contract.json" with { type: "json" };

const db = postgres({
  contractJson,
  url: process.env.DATABASE_URL,
});

const email = "admin@altertelegraf.at";
const password = "Admin123!";

try {
  const existingRestaurant = await db.orm.public.Restaurant.first({
    slug: "alter-telegraf",
  });

  const restaurant =
    existingRestaurant ??
    (await db.orm.public.Restaurant.create({
      name: "Alter Telegraf",
      slug: "alter-telegraf",
    }));

  const existingUser = await db.orm.public.User.first({
    email,
  });

  if (existingUser) {
    console.log("Admin-Benutzer existiert bereits.");
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    await db.orm.public.User.create({
      email,
      passwordHash,
      role: "admin",
      restaurantId: restaurant.id,
    });

    console.log("Admin erfolgreich erstellt.");
    console.log("E-Mail:", email);
    console.log("Passwort:", password);
  }
} finally {
  await db.close();
}