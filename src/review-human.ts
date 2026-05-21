/**
 * Human-path review MCP tools (#136) — never pass --agent-run-id; clear env agent context.
 */

import { i18n } from "./i18n.js";
import {
  exitCodeLabel,
  runKotonoha,
  toolResultFromCli,
  withTempJsonFile,
  type RunKotonohaOptions,
  type RunKotonohaResult,
  type ToolResultPayload,
} from "./kotonoha.js";

export const HUMAN_REVIEW_RESULT_FORMAT = "kotonoha.human_review_result.v0.1" as const;

export type HumanReviewKind = "approve" | "hold" | "reject";

export type HumanReviewResult = {
  format: typeof HUMAN_REVIEW_RESULT_FORMAT;
  decision: HumanReviewKind;
  review_decision_id: string | null;
  meaning_delta_id: string;
  rde_assessment_id: string | null;
  decided_by: string;
  recorded_by: "human_via_agent_channel";
  banner_en: string;
  banner_ja: string;
  confirm_en: string;
  confirm_ja: string;
};

function buildHumanReviewEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  delete env.KOTONOHA_AGENT_RUN_ID;
  return env;
}

export function runHumanReviewCli(
  kind: HumanReviewKind,
  input: {
    delta_id: string;
    assessment_id?: string;
    decided_by?: string;
    rationale_json?: string;
  },
  extraEnv?: NodeJS.ProcessEnv,
): Promise<RunKotonohaResult> {
  const args = ["review", kind, "--delta-id", input.delta_id];
  if (input.assessment_id) {
    args.push("--assessment-id", input.assessment_id);
  }
  if (input.decided_by?.trim()) {
    args.push("--decided-by", input.decided_by.trim());
  }

  const runOpts: RunKotonohaOptions = {
    args,
    env: buildHumanReviewEnv(extraEnv),
  };

  if (input.rationale_json?.trim()) {
    return withTempJsonFile(input.rationale_json, (path) =>
      runKotonoha({
        ...runOpts,
        args: [...args, "--rationale", path],
      }),
    );
  }
  return runKotonoha(runOpts);
}

export function humanReviewResultPayload(
  kind: HumanReviewKind,
  input: {
    delta_id: string;
    assessment_id?: string;
    decided_by: string;
  },
  cli: Awaited<ReturnType<typeof runKotonoha>>,
  widgetUri?: string,
): ToolResultPayload & { structuredContent?: HumanReviewResult } {
  const structured: HumanReviewResult = {
    format: HUMAN_REVIEW_RESULT_FORMAT,
    decision: kind,
    review_decision_id: cli.exitCode === 0 ? cli.stdout.trim() : null,
    meaning_delta_id: input.delta_id,
    rde_assessment_id: input.assessment_id ?? null,
    decided_by: input.decided_by,
    recorded_by: "human_via_agent_channel",
    banner_en: i18n.humanBannerEn,
    banner_ja: i18n.humanBannerJa,
    confirm_en: i18n.humanDecisionRecordedEn,
    confirm_ja: i18n.humanDecisionRecordedJa,
  };

  const text = JSON.stringify(
    {
      exit_code: cli.exitCode,
      exit_label: exitCodeLabel(cli.exitCode),
      human_review: structured,
      stdout: cli.stdout.trimEnd(),
      stderr: cli.stderr.trimEnd(),
    },
    null,
    2,
  );

  const out: ToolResultPayload & {
    structuredContent?: HumanReviewResult;
    _meta?: Record<string, unknown>;
  } = {
    content: [{ type: "text", text }],
    structuredContent: structured,
    ...(cli.exitCode !== 0 ? { isError: true } : {}),
  };

  if (widgetUri) {
    out._meta = {
      ui: { resourceUri: widgetUri },
      "openai/outputTemplate": widgetUri,
    };
  }
  return out;
}

export function toolResultFromHumanReview(
  kind: HumanReviewKind,
  input: {
    delta_id: string;
    assessment_id?: string;
    decided_by?: string;
    rationale_json?: string;
  },
  widgetUri?: string,
  extraEnv?: NodeJS.ProcessEnv,
): Promise<ToolResultPayload> {
  const decidedBy = input.decided_by?.trim() || "human";
  return runHumanReviewCli(kind, { ...input, decided_by: decidedBy }, extraEnv).then((cli) => {
    if (cli.exitCode === 2 && cli.stderr.includes("denied_actions")) {
      return toolResultFromCli(cli, {
        hint_en: i18n.autonomousReviewDeniedEn,
        hint_ja: i18n.autonomousReviewDeniedJa,
        forbidden: "--agent-run-id and KOTONOHA_AGENT_RUN_ID on human review tools",
      });
    }
    return humanReviewResultPayload(
      kind,
      {
        delta_id: input.delta_id,
        assessment_id: input.assessment_id,
        decided_by: decidedBy,
      },
      cli,
      widgetUri,
    );
  });
}
