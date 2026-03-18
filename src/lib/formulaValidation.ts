/**
 * Formula validation utilities.
 * Validates expression syntax, variable references, and function calls before save.
 */

const SUPPORTED_FUNCTIONS = ["SUM", "AVG", "COUNT", "FIND", "MAX", "MIN"];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a formula expression for syntax, variable references, and function calls.
 */
export function validateFormula(
  expression: string,
  availableVariables: Record<string, number>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = expression.trim();
  if (!trimmed) {
    return { valid: false, errors: ["Expression is empty"], warnings: [] };
  }

  // Check balanced parentheses
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) {
      errors.push("Unmatched closing parenthesis ')'");
      break;
    }
  }
  if (depth > 0) {
    errors.push("Unmatched opening parenthesis '('");
  }

  // Check balanced quotes
  const doubleQuotes = (trimmed.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) {
    errors.push("Unmatched double quote");
  }

  // Check for unknown function calls
  const funcCalls = trimmed.match(/([A-Z_]+)\s*\(/g) || [];
  for (const call of funcCalls) {
    const funcName = call.replace(/\s*\($/, "");
    if (!SUPPORTED_FUNCTIONS.includes(funcName)) {
      errors.push(`Unknown function: ${funcName}(). Supported: ${SUPPORTED_FUNCTIONS.join(", ")}`);
    }
  }

  // Check for trailing/leading operators
  if (/^[*/]/.test(trimmed)) {
    errors.push("Expression starts with an operator");
  }
  if (/[+\-*/]$/.test(trimmed)) {
    errors.push("Expression ends with an operator");
  }

  // Check for consecutive operators
  if (/[+\-*/]\s*[+\-*/]/.test(trimmed.replace(/[()]/g, ""))) {
    warnings.push("Possible consecutive operators detected");
  }

  // Extract variable tokens (not inside function calls or quotes)
  const stripped = trimmed.replace(/"[^"]*"/g, "").replace(/\b(SUM|AVG|COUNT|FIND|MAX|MIN)\s*\([^)]*\)/g, "");
  const varTokens = stripped
    .split(/[+\-*/(),\s]+/)
    .map((t) => t.trim())
    .filter((t) => t && isNaN(Number(t)) && !t.includes(".") && !t.includes("["));

  for (const token of varTokens) {
    if (!(token in availableVariables) && !["CURRENT_MONTH", "PREV_MONTH", "LAST_3_MONTHS"].includes(token)) {
      warnings.push(`Variable "${token}" not found in current data — formula may error at runtime`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
