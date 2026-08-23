export const PLAYER_COMMANDS = Object.freeze([
  { name: "/help", description: "Xem danh sách lệnh" },
  { name: "/quests [trang]", description: "Xem nhiệm vụ theo trang và token hiện tại" },
  { name: "/accept <quest-id>", description: "Nhận nhiệm vụ để bắt đầu theo dõi tiến độ" }
]);

export function formatHelpMessage(commands = PLAYER_COMMANDS) {
  return `Lệnh | ${commands
    .map(({ name, description }) => `${name} - ${description}`)
    .join(" | ")}`;
}
