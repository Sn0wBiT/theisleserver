export const PLAYER_COMMANDS = Object.freeze([
  { name: "/help", description: "Xem danh sách lệnh" },
  { name: "/quests", description: "Xem các nhiệm vụ và token hiện tại" },
  { name: "/human", description: "Thử nghiệm: biến khủng long thành người" },
  { name: "/revive", description: "Admin: hồi sinh với đầy máu" }
]);

export function formatHelpMessage(commands = PLAYER_COMMANDS) {
  return `Lệnh | ${commands
    .map(({ name, description }) => `${name} - ${description}`)
    .join(" | ")}`;
}
