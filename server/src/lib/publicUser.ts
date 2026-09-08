// The single place a User row is ever trimmed before leaving the server —
// never let a raw Prisma User row (which carries passwordHash) reach a
// response body.
export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  dateOfBirth: Date | null;
  lifeStage: string | null;
  avatarInitials: string | null;
  onboarded: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    dateOfBirth: user.dateOfBirth,
    lifeStage: user.lifeStage,
    avatarInitials: user.avatarInitials,
    onboarded: user.onboarded,
  };
}
