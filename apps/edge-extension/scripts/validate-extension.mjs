import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "manifest.json",
  "src/background.js",
  "src/content.js",
  "src/popup.html",
  "src/popup.js",
  "src/popup.css"
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error(`Missing extension files: ${missing.join(", ")}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const contentScript = fs.readFileSync(path.join(root, "src/content.js"), "utf8");
const popupScript = fs.readFileSync(path.join(root, "src/popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(root, "src/popup.html"), "utf8");

if (manifest.manifest_version !== 3) {
  console.error("Edge extension must use Manifest V3.");
  process.exit(1);
}

for (const [label, source] of [
  ["content.js", contentScript],
  ["popup.js", popupScript]
]) {
  try {
    new Function(source);
  } catch (error) {
    console.error(`${label} has a syntax error: ${error.message}`);
    process.exit(1);
  }
}

const requiredMessages = [
  "CAREERPILOT_SCAN_ATS",
  "CAREERPILOT_FILL_SAFE",
  "CAREERPILOT_EXTRACT_FORM_SCHEMA",
  "CAREERPILOT_SAVE_FORM_SNAPSHOT"
];

for (const message of requiredMessages) {
  if (!contentScript.includes(message) && !popupScript.includes(message)) {
    console.error(`Missing extension message: ${message}`);
    process.exit(1);
  }
}

const requiredContentFeatures = [
  "/api/autofill/ats-rules",
  "/api/autofill/context",
  "/api/autofill/mapping-rules",
  "/api/autofill/events",
  "loadAtsRules",
  "matchAtsFieldRule",
  "Ashby",
  "BambooHR",
  "wechatId",
  "sourceChannel",
  "dateOfBirth",
  "applicationId",
  "persistSnapshot"
];

for (const feature of requiredContentFeatures) {
  if (!contentScript.includes(feature)) {
    console.error(`Missing content feature: ${feature}`);
    process.exit(1);
  }
}

const requiredPopupFeatures = [
  "contextCard",
  "refreshContext",
  "openPackageButton",
  "?section=package&jobId=",
  "/api/autofill/context",
  "applicationId",
  "currentWindow"
];

for (const feature of requiredPopupFeatures) {
  if (!popupScript.includes(feature) && !popupHtml.includes(feature)) {
    console.error(`Missing popup context feature: ${feature}`);
    process.exit(1);
  }
}

console.log("CareerPilot Edge extension manifest looks valid.");
