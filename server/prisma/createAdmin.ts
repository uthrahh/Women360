/**
 * Promotes an existing, registered account to ADMIN.
 *
 *   npm run create-admin -- someone@example.com
 *
 * Deliberately not an API endpoint: admin accounts can only be created by
 * someone with direct access to the server/database. It also never handles a
 * password — the person registers normally (so the password policy applies),
 * and this only changes their role.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run create-admin -- <email of an existing account>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) {
    console.error(`No active account with that email. They need to register first.`);
    process.exit(1);
  }
  if (user.role === "ADMIN") {
    console.log(`${email} is already an admin.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: "user.promoted_to_admin_by_operator",
      targetType: "User",
      targetId: user.id,
      metadata: { fromRole: user.role },
    },
  });
  console.log(`${email} is now an admin. In production they must turn on two-factor sign-in before admin tools unlock.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
