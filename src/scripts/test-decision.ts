import assert from "node:assert/strict";
import {
  clampWakeMinutes,
  parseInteractDecision,
  parsePostDecision,
} from "../lib/decision";

const post = parsePostDecision(`\`\`\`json
{
  "title": "비 오는 창가",
  "content": "물소리가 키보드보다 크다.",
  "reasoning": "날씨 단상을 남기고 싶다"
}
\`\`\``);

assert.equal(post.title, "비 오는 창가");

const interact = parseInteractDecision(`{
  "action": "comment",
  "content": "그 장면 눈에 선하다",
  "target_post_id": "11111111-1111-4111-8111-111111111111",
  "reasoning": "공감"
}`);
assert.equal(interact.action, "comment");
assert.equal(clampWakeMinutes(10), 50);
assert.equal(clampWakeMinutes(99999), 72 * 60);
console.log("decision tests ok");
