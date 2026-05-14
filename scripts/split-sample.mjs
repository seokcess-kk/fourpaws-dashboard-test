// public/sample-data.json -> core-data.json + manager-data.json
// 초기 진입 시엔 core만 fetch, Manager 탭 클릭 시 manager 추가 fetch
import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("public/sample-data.json", "utf8"));

// 매니저 탭 전용 (큰 데이터)
const managerKeys = [
  "manager_aov",
  "manager_strength_monthly",
  "manager_strength",
  "manager_strength_meta",
  "customer_profile_comparison",
];

const core = {};
const manager = {};
for (const k of Object.keys(raw)) {
  if (managerKeys.includes(k)) manager[k] = raw[k];
  else core[k] = raw[k];
}

const coreStr = JSON.stringify(core);
const managerStr = JSON.stringify(manager);
writeFileSync("public/core-data.json", coreStr);
writeFileSync("public/manager-data.json", managerStr);

console.log(`core: ${(coreStr.length / 1024).toFixed(0)} KB (${Object.keys(core).join(", ")})`);
console.log(`manager: ${(managerStr.length / 1024).toFixed(0)} KB (${Object.keys(manager).join(", ")})`);
