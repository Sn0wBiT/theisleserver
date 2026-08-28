import { describe, expect, it } from "vitest";
import { readableError } from "./api";

describe("faction error translations", () => {
  it.each([
    ["invalid-invite-code", "Mã mời không hợp lệ"],
    ["already-in-faction", "Bạn đã thuộc một bầy đàn"],
    ["active-request-exists", "Bạn đã có một yêu cầu tham gia chưa được giải quyết"],
    ["forbidden", "Bạn không có quyền thực hiện thao tác này"],
    ["request-not-pending", "Yêu cầu này không còn ở trạng thái chờ"],
  ])("maps %s", (code, message) => {
    expect(readableError(code, 400)).toBe(message);
  });
});
