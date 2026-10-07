import { test } from "node:test";
import assert from "node:assert/strict";
import { tooltipPosition } from "./tooltip-position";

const viewport = { left: 0, top: 0, width: 800, height: 600 };
const size = { width: 220, height: 50 };
test("tooltips remain inside every viewport edge and switch below a trigger near the top", () => {
  for (const left of [0, 380, 790]) {
    for (const top of [0, 280, 590]) {
      const result = tooltipPosition(
        { left, top, width: 10, height: 10 },
        size,
        viewport,
      );
      assert.ok(result.left >= 10);
      assert.ok(result.left + size.width <= 790);
      assert.ok(result.top >= 10);
      assert.ok(result.top + size.height <= 590);
      assert.equal(result.side, top === 0 ? "bottom" : "top");
    }
  }
});
test("tooltips account for viewport offsets when zoomed and wrap to the available mobile width", () => {
  const view = { left: 90, top: 120, width: 240, height: 160 };
  const result = tooltipPosition(
    { left: 310, top: 240, width: 20, height: 20 },
    { width: 220, height: 130 },
    view,
  );
  assert.equal(result.left, 100);
  assert.equal(result.top, 130);
});
test("tooltips center above a trigger when there is room", () => {
  const result = tooltipPosition(
    { left: 300, top: 300, width: 40, height: 40 },
    size,
    viewport,
  );
  assert.equal(result.left, 210);
  assert.equal(result.top, 241);
  assert.equal(result.side, "top");
});
