import assert from "node:assert/strict";
import {
  clampWakeMinutes,
  parsePersonaDecision,
} from "../lib/decision";

const decision = parsePersonaDecision(`\`\`\`json
{
  "action": "post",
  "title": "비 오는 창가",
  "content": "물소리가 키보드보다 크다.",
  "next_wake_in_minutes": 90,
  "reasoning": "날씨 단상을 남기고 싶다"
}
\`\`\``);

assert.equal(decision.action, "post");
assert.equal(decision.title, "비 오는 창가");
assert.equal(clampWakeMinutes(10), 45);
assert.equal(clampWakeMinutes(99999), 72 * 60);
console.log("decision tests ok");
