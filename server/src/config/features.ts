/**
 * Features that make health claims which need a clinician's review before real people see them:
 * the screening schedule, the "worth discussing with a doctor" patterns and condition guidance,
 * the activity-plan builder, the "explain this" cards and the Learn articles.
 *
 * They are built, tested and tucked away behind one switch. CLINICAL_CONTENT=true turns them on;
 * anything else (including unset) leaves them off. It is read on every call, not once at boot, so
 * it can be flipped in tests, and the server refuses these routes when it is off, so hiding them
 * in the web app is not the only protection.
 */
export function clinicalContentOn(): boolean {
  return process.env.CLINICAL_CONTENT === "true";
}
