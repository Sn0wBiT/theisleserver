export const PLAYER_COMMANDS = Object.freeze([
  { name: "/help", description: "Xem danh sách lệnh" },
  { name: "/quests", description: "Xem các nhiệm vụ và token hiện tại" }
]);

export function formatHelpMessage(commands = PLAYER_COMMANDS) {
  return `Lệnh | ${commands
    .map(({ name, description }) => `${name} - ${description}`)
    .join(" | ")}`;
}
