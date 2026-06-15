export const statusChoices = [
  { name: "Watching", value: "watching" },
  { name: "Completed", value: "completed" },
  { name: "Dropped", value: "dropped" },
  { name: "On Hold", value: "on_hold" },
  { name: "Planned", value: "planned" },
  { name: "Rewatching", value: "rewatching" },
];

export const dbStatusLabels = {
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "On Hold",
  plan_to_watch: "Planned",
  rewatching: "Rewatching",
};

export const normalizeStatusInput = (value) => {
  const input = String(value || "").trim().toLowerCase();
  if (input === "planned") return "plan_to_watch";
  return input;
};

export const normalizeStatusForDisplay = (value) =>
  dbStatusLabels[String(value || "").toLowerCase()] || "Unknown";

