export const decideFoundingRoleSync = ({
  configured,
  linked,
  memberPresent,
  membershipActive,
  hasRole,
}) => {
  if (!configured) return { action: "none", reason: "not_configured" };
  if (!linked) return { action: "none", reason: "not_linked" };
  if (!memberPresent) return { action: "none", reason: "missing_member" };
  if (membershipActive && !hasRole) return { action: "add", reason: "active_founder" };
  if (!membershipActive && hasRole) return { action: "remove", reason: "inactive_founder" };
  return { action: "none", reason: "already_synced" };
};
