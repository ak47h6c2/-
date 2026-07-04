import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const specPath = path.join(webRoot, "design-system", "careerpilot-apac.design-system.json");
const handoffPath = path.join(webRoot, "design-system", "FIGMA_HANDOFF.md");
const generatedFigmaScriptPath = path.join(webRoot, "design-system", "generated", "careerpilot-figma-library.use-figma.js");
const generatedFigmaManifestPath = path.join(webRoot, "design-system", "generated", "careerpilot-figma-library.manifest.json");
const previewPath = path.join(webRoot, "src", "app", "design-system", "page.tsx");
const appPagePath = path.join(webRoot, "src", "app", "page.tsx");
const cssPath = path.join(webRoot, "src", "app", "globals.css");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeCssValue(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function extractRootVariables(css) {
  const rootMatch = css.match(/:root\s*\{(?<body>[\s\S]*?)\n\}/);
  assert(rootMatch?.groups?.body, "Missing :root token block in globals.css.");

  const variables = new Map();
  for (const match of rootMatch.groups.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    variables.set(match[1], normalizeCssValue(match[2]));
  }

  return variables;
}

function flattenTokenGroups(tokens) {
  return Object.entries(tokens).flatMap(([group, items]) => {
    assert(Array.isArray(items), `Token group ${group} must be an array.`);
    return items.map((item) => ({ group, ...item }));
  });
}

function checkTokens(spec, variables) {
  const tokenItems = flattenTokenGroups(spec.tokens);
  const failures = [];

  for (const token of tokenItems) {
    if (!token.css || !token.value) continue;

    const actual = variables.get(token.css);
    if (!actual) {
      failures.push(`${token.name} references missing CSS variable ${token.css}.`);
      continue;
    }

    if (normalizeCssValue(token.value) !== actual) {
      failures.push(`${token.name} expected ${token.value}, got ${actual}.`);
    }
  }

  assert(failures.length === 0, failures.join("\n"));
}

function checkComponents(spec, css) {
  const failures = [];

  for (const component of spec.components || []) {
    if (!component.figmaComponent) {
      failures.push(`${component.name} is missing figmaComponent.`);
    }
    if (!component.usage) {
      failures.push(`${component.name} is missing usage.`);
    }
    for (const className of component.classes || []) {
      const selectorPattern = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (!selectorPattern.test(css)) {
        failures.push(`${component.name} references missing CSS class .${className}.`);
      }
    }
  }

  assert(failures.length === 0, failures.join("\n"));
}

function checkTypographyRules(css) {
  const failures = [];
  const fontViewportMatches = [...css.matchAll(/font-size\s*:\s*[^;]*(?:vw|vh|vmin|vmax|clamp\()/g)].map((match) => match[0]);
  if (fontViewportMatches.length > 0) {
    failures.push(`Viewport-scaled font sizes are not allowed: ${fontViewportMatches.join(" | ")}`);
  }

  const negativeLetterSpacing = [...css.matchAll(/letter-spacing\s*:\s*-\d/g)].map((match) => match[0]);
  if (negativeLetterSpacing.length > 0) {
    failures.push(`Negative letter spacing is not allowed: ${negativeLetterSpacing.join(" | ")}`);
  }

  assert(failures.length === 0, failures.join("\n"));
}

function checkAccessibilityAndMotion(css, appPage) {
  const failures = [];

  if (!css.includes(":focus-visible")) {
    failures.push("Interactive controls need visible :focus-visible styles.");
  }
  if (!css.includes(".skip-link")) {
    failures.push("Skip link styles are missing.");
  }
  if (!css.includes("@media (prefers-reduced-motion: reduce)")) {
    failures.push("Reduced-motion CSS media query is missing.");
  }
  if (!appPage.includes("MotionConfig") || !appPage.includes('reducedMotion="user"')) {
    failures.push("Framer Motion must respect user reduced-motion preferences.");
  }
  if (!appPage.includes('href="#main-workbench"') || !appPage.includes('id="main-workbench"')) {
    failures.push("Dashboard must provide a skip link target for keyboard users.");
  }

  assert(failures.length === 0, failures.join("\n"));
}

function checkGeneratedFigmaScriptSyntax(script) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    new AsyncFunction("figma", script);
  } catch (error) {
    throw new Error(`Generated Figma script has invalid JavaScript syntax: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const [specRaw, css, handoff, preview, appPage, generatedFigmaScript, generatedFigmaManifestRaw] = await Promise.all([
    fs.readFile(specPath, "utf8"),
    fs.readFile(cssPath, "utf8"),
    fs.readFile(handoffPath, "utf8"),
    fs.readFile(previewPath, "utf8"),
    fs.readFile(appPagePath, "utf8"),
    fs.readFile(generatedFigmaScriptPath, "utf8"),
    fs.readFile(generatedFigmaManifestPath, "utf8")
  ]);
  const spec = JSON.parse(specRaw);
  const generatedFigmaManifest = JSON.parse(generatedFigmaManifestRaw);
  const variables = extractRootVariables(css);
  const specHash = sha256(specRaw);

  assert(spec.name === "CareerPilot APAC Design System", "Unexpected design system name.");
  assert(spec.locale === "zh-CN", "Design system locale must be zh-CN.");
  assert(spec.product === "CareerPilot APAC", "Product name must remain CareerPilot APAC.");
  assert((spec.components || []).length >= 8, "Design system should document at least 8 component groups.");
  assert((spec.qualityGates || []).length >= 5, "Design system should document quality gates.");

  checkTokens(spec, variables);
  checkComponents(spec, css);
  checkTypographyRules(css);
  checkAccessibilityAndMotion(css, appPage);

  for (const component of spec.components || []) {
    assert(handoff.includes(component.figmaComponent), `Figma handoff is missing ${component.figmaComponent}.`);
    assert(generatedFigmaScript.includes(component.figmaComponent), `Generated Figma script is missing ${component.figmaComponent}.`);
  }

  assert(preview.includes("design-system-page"), "Design system preview route is missing the expected root class.");
  assert(preview.includes("设计系统组件库"), "Design system preview route must use Chinese UI copy.");
  assert(generatedFigmaManifest.specHash === specHash, "Generated Figma manifest is stale. Run npm run figma:export -w @careerpilot/web.");
  assert(generatedFigmaScript.includes(`careerpilot-design-system-hash=${specHash}`), "Generated Figma script hash is stale. Run npm run figma:export -w @careerpilot/web.");
  assert(generatedFigmaScript.includes("return await main();"), "Generated Figma script must return a structured result.");
  assert(!generatedFigmaScript.includes("figma.closePlugin"), "Generated Figma script must not call figma.closePlugin().");
  assert(!generatedFigmaScript.includes("figma.notify"), "Generated Figma script must not call figma.notify().");
  assert(generatedFigmaScript.includes("setVariableCodeSyntax(\"WEB\", \"var(\" + token.css + \")\")"), "Generated Figma script must set Web code syntax from CSS variables.");
  checkGeneratedFigmaScriptSyntax(generatedFigmaScript);

  const result = {
    ok: true,
    tokenCount: flattenTokenGroups(spec.tokens).length,
    componentCount: spec.components.length,
    qualityGateCount: spec.qualityGates.length,
    figmaScriptHash: specHash
  };

  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
