/**
 * Validated RDE summary model for widget rendering (#132).
 * Never treat raw CLI logs as the canonical display payload.
 */

import type { RunKotonohaResult } from "./kotonoha.js";
import { exitCodeLabel, type ToolResultPayload } from "./kotonoha.js";
import { i18n } from "./i18n.js";

export const RDE_SUMMARY_FORMAT = "kotonoha.rde_summary.v0.1" as const;

export type RdeCategoryCounts = Record<string, number>;

export type RdeValidatedSummary = {
  format: typeof RDE_SUMMARY_FORMAT;
  state: "validated";
  spec_version: string;
  subject_ref: string;
  category_counts: RdeCategoryCounts;
  total_items: number;
  banner_en: string;
  banner_ja: string;
};

export type RdeValidationErrorSummary = {
  format: typeof RDE_SUMMARY_FORMAT;
  state: "validation_error";
  exit_code: number;
  exit_label: string;
  issue_count: number | null;
  message_en: string;
  message_ja: string;
  banner_en: string;
  banner_ja: string;
};

export type RdeSummaryPayload = RdeValidatedSummary | RdeValidationErrorSummary;

const CATEGORY_KEYS = [
  "preserved",
  "transformed",
  "lost",
  "complemented",
  "deviation_risk",
  "intentionally_unresolved",
  "next_update_policy",
] as const;

export function parseValidatedRdeSummary(rdeJson: string): RdeValidatedSummary | null {
  let root: unknown;
  try {
    root = JSON.parse(rdeJson);
  } catch {
    return null;
  }
  if (!root || typeof root !== "object") {
    return null;
  }
  const inner = (root as { rde_review_output?: unknown }).rde_review_output;
  if (!inner || typeof inner !== "object") {
    return null;
  }
  const review = inner as {
    spec_version?: string;
    subject_ref?: string;
    categories?: Record<string, unknown>;
  };
  const spec_version = review.spec_version?.trim();
  const subject_ref = review.subject_ref?.trim();
  if (!spec_version || !subject_ref) {
    return null;
  }
  const categories = review.categories ?? {};
  const category_counts: RdeCategoryCounts = {};
  let total_items = 0;
  for (const key of CATEGORY_KEYS) {
    const raw = categories[key];
    const count = Array.isArray(raw) ? raw.length : 0;
    category_counts[key] = count;
    total_items += count;
  }
  return {
    format: RDE_SUMMARY_FORMAT,
    state: "validated",
    spec_version,
    subject_ref,
    category_counts,
    total_items,
    banner_en: i18n.humanBannerEn,
    banner_ja: i18n.humanBannerJa,
  };
}

function parseIssueCount(stderr: string): number | null {
  const en = stderr.match(/(\d+)\s+issue/i);
  if (en) {
    return Number(en[1]);
  }
  const ja = stderr.match(/（(\d+)\s*件）/);
  if (ja) {
    return Number(ja[1]);
  }
  return null;
}

export function buildValidationErrorSummary(
  result: RunKotonohaResult,
  hints?: { hint_en?: string; hint_ja?: string },
): RdeValidationErrorSummary {
  const issue_count = parseIssueCount(result.stderr);
  const message_en =
    hints?.hint_en ??
    (issue_count !== null
      ? `RDE validation failed (${issue_count} issue(s)). Fix the JSON before attach.`
      : i18n.validateFailedEn);
  const message_ja =
    hints?.hint_ja ??
    (issue_count !== null
      ? `RDE 検証に失敗しました（${issue_count} 件）。attach 前に JSON を修正してください。`
      : i18n.validateFailedJa);
  return {
    format: RDE_SUMMARY_FORMAT,
    state: "validation_error",
    exit_code: result.exitCode,
    exit_label: exitCodeLabel(result.exitCode),
    issue_count,
    message_en,
    message_ja,
    banner_en: i18n.humanBannerEn,
    banner_ja: i18n.humanBannerJa,
  };
}

export function toolResultWithRdeSummary(
  result: RunKotonohaResult,
  summary: RdeSummaryPayload,
  extra?: Record<string, unknown>,
  widgetUri?: string,
): ToolResultPayload {
  const payload = {
    exit_code: result.exitCode,
    exit_label: exitCodeLabel(result.exitCode),
    rde_summary: summary,
    ...extra,
  };
  const text = JSON.stringify(payload, null, 2);
  const out: ToolResultPayload & {
    structuredContent?: RdeSummaryPayload;
    _meta?: Record<string, unknown>;
  } = {
    content: [{ type: "text", text }],
    structuredContent: summary,
    ...(result.exitCode !== 0 ? { isError: true } : {}),
  };
  if (widgetUri) {
    out._meta = {
      ui: { resourceUri: widgetUri },
      "openai/outputTemplate": widgetUri,
    };
  }
  return out;
}
