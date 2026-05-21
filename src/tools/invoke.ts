/**
 * HTTP tool invocation — 1:1 with kotonoha-mcp tool names (M5-P2-2).
 */

import { z } from "zod";

import { prepareHumanReviewPackage, buildHumanReviewApproveCommand } from "../human-review.js";
import { i18n } from "../i18n.js";
import {
  runKotonoha,
  toolResultFromCli,
  withTempJsonFile,
  type ToolResultPayload,
} from "../kotonoha.js";
import {
  buildValidationErrorSummary,
  parseValidatedRdeSummary,
  toolResultWithRdeSummary,
} from "../rde-summary.js";
import { toolResultFromHumanReview } from "../review-human.js";
import { HUMAN_REVIEW_WIDGET_URI, RDE_SUMMARY_WIDGET_URI } from "../widget-uris.js";
import { m6ChildEnv, type M6InvokeContext } from "../m6-context.js";
import { isToolName, type ToolName } from "./catalog.js";

const uuid = z.string().uuid();

export class ToolInvokeError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ToolInvokeError";
  }
}

export async function invokeTool(
  name: string,
  body: Record<string, unknown>,
  m6?: M6InvokeContext,
): Promise<ToolResultPayload> {
  if (!isToolName(name)) {
    throw new ToolInvokeError(`Unknown tool: ${name}`, 404);
  }
  return dispatch(name, body, m6);
}

async function dispatch(
  name: ToolName,
  body: Record<string, unknown>,
  m6?: M6InvokeContext,
): Promise<ToolResultPayload> {
  switch (name) {
    case "kotonoha_ping":
      return toolResultFromCli(await runKotonoha({ args: ["version"] }));

    case "kotonoha_context_export": {
      const input = z
        .object({
          file: z.string(),
          line_start: z.number().int().optional(),
          line_end: z.number().int().optional(),
          diff_ref: z.string().optional(),
          observation_json: z.string().optional(),
          repo_path: z.string().optional(),
        })
        .parse(body);
      const args = ["context", "export", input.file];
      if (input.line_start !== undefined) {
        args.push("--line-start", String(input.line_start));
      }
      if (input.line_end !== undefined) {
        args.push("--line-end", String(input.line_end));
      }
      if (input.diff_ref) {
        args.push("--diff-ref", input.diff_ref);
      }
      if (input.observation_json?.trim()) {
        return toolResultFromCli(
          await withTempJsonFile(input.observation_json, (obsPath) =>
            runKotonoha({
              args: [...args, "--observation", obsPath],
              cwd: input.repo_path,
            }),
          ),
        );
      }
      return toolResultFromCli(
        await runKotonoha({ args, cwd: input.repo_path }),
      );
    }

    case "kotonoha_rde_validate": {
      const { rde_json } = z.object({ rde_json: z.string() }).parse(body);
      const result = await runKotonoha({
        args: ["rde", "validate", "--strict"],
        stdin: rde_json,
      });
      if (result.exitCode === 0) {
        const summary = parseValidatedRdeSummary(rde_json);
        if (summary) {
          return toolResultWithRdeSummary(
            result,
            summary,
            undefined,
            RDE_SUMMARY_WIDGET_URI,
          );
        }
        return toolResultFromCli(result, {
          hint_en: "Validation passed but RDE summary could not be parsed.",
          hint_ja: "検証は成功しましたが要約を解析できませんでした。",
        });
      }
      const hints =
        result.exitCode === 2
          ? { hint_en: i18n.validateFailedEn, hint_ja: i18n.validateFailedJa }
          : {};
      const summary = buildValidationErrorSummary(result, hints);
      return toolResultWithRdeSummary(result, summary, hints, RDE_SUMMARY_WIDGET_URI);
    }

    case "kotonoha_agent_record_start": {
      const input = z
        .object({
          agent_kind: z.string().optional().default("gateway"),
          external_ref: z.string().optional(),
          capability_profile: z.string().optional().default("kotonoha-agent"),
        })
        .parse(body);
      const args = [
        "agent",
        "record",
        "start",
        "--agent-kind",
        input.agent_kind ?? "gateway",
        "--capability-profile",
        input.capability_profile ?? "kotonoha-agent",
      ];
      if (input.external_ref) {
        args.push("--external-ref", input.external_ref);
      }
      const result = await runKotonoha({ args, env: m6ChildEnv(m6) });
      if (result.exitCode === 0) {
        return toolResultFromCli(result, { agent_run_id: result.stdout.trim() });
      }
      if (result.exitCode === 1) {
        return toolResultFromCli(result, {
          hint_en: i18n.envErrorEn,
          hint_ja: i18n.envErrorJa,
        });
      }
      return toolResultFromCli(result);
    }

    case "kotonoha_agent_record_complete": {
      const input = z
        .object({
          run_id: uuid,
          output_artifacts_json: z.string().optional(),
        })
        .parse(body);
      const args = ["agent", "record", "complete", "--run-id", input.run_id];
      if (input.output_artifacts_json?.trim()) {
        return toolResultFromCli(
          await withTempJsonFile(input.output_artifacts_json, (path) =>
            runKotonoha({
              args: [...args, "--output-artifacts", path],
              env: m6ChildEnv(m6),
            }),
          ),
        );
      }
      return toolResultFromCli(await runKotonoha({ args, env: m6ChildEnv(m6) }));
    }

    case "kotonoha_meaning_delta_from_run": {
      const input = z
        .object({
          file: z.string(),
          agent_run_id: uuid,
          line_start: z.number().int().optional(),
          line_end: z.number().int().optional(),
          diff_ref: z.string().optional(),
          observation_json: z.string().optional(),
          repo_path: z.string().optional(),
        })
        .parse(body);
      const args = [
        "agent",
        "delta",
        "create",
        input.file,
        "--agent-run-id",
        input.agent_run_id,
      ];
      if (input.line_start !== undefined) {
        args.push("--line-start", String(input.line_start));
      }
      if (input.line_end !== undefined) {
        args.push("--line-end", String(input.line_end));
      }
      if (input.diff_ref) {
        args.push("--diff-ref", input.diff_ref);
      }
      if (input.observation_json?.trim()) {
        const result = await withTempJsonFile(input.observation_json, (obsPath) =>
          runKotonoha({
            args: [...args, "--observation", obsPath],
            cwd: input.repo_path,
            env: m6ChildEnv(m6),
          }),
        );
        if (result.exitCode === 0) {
          return toolResultFromCli(result, {
            meaning_delta_id: result.stdout.trim(),
          });
        }
        return toolResultFromCli(result);
      }
      const result = await runKotonoha({
        args,
        cwd: input.repo_path,
        env: m6ChildEnv(m6),
      });
      if (result.exitCode === 0) {
        return toolResultFromCli(result, {
          meaning_delta_id: result.stdout.trim(),
        });
      }
      return toolResultFromCli(result);
    }

    case "kotonoha_rde_attach": {
      const input = z
        .object({
          delta_id: uuid,
          rde_json: z.string(),
          strict: z.boolean().optional().default(true),
        })
        .parse(body);
      const args = [
        "rde",
        "attach",
        "--delta-id",
        input.delta_id,
        "--source-kind",
        "llm",
      ];
      if (input.strict) {
        args.push("--strict");
      }
      const result = await runKotonoha({
        args,
        stdin: input.rde_json,
        env: m6ChildEnv(m6),
      });
      const assessmentExtra =
        result.exitCode === 0
          ? { rde_assessment_id: result.stdout.trim() }
          : {};
      const validated = parseValidatedRdeSummary(input.rde_json);
      if (result.exitCode === 0 && validated) {
        return toolResultWithRdeSummary(
          result,
          validated,
          assessmentExtra,
          RDE_SUMMARY_WIDGET_URI,
        );
      }
      if (result.exitCode === 2) {
        const summary = buildValidationErrorSummary(result, {
          hint_en: i18n.validateFailedEn,
          hint_ja: i18n.validateFailedJa,
        });
        return toolResultWithRdeSummary(
          result,
          summary,
          { hint_en: i18n.validateFailedEn, hint_ja: i18n.validateFailedJa },
          RDE_SUMMARY_WIDGET_URI,
        );
      }
      return toolResultFromCli(result, assessmentExtra);
    }

    case "kotonoha_copy_human_review_command": {
      const input = z
        .object({
          delta_id: uuid,
          assessment_id: uuid.optional(),
          decided_by: z.string().optional().default("human"),
        })
        .parse(body);
      const cmd = buildHumanReviewApproveCommand({
        deltaId: input.delta_id,
        assessmentId: input.assessment_id,
        decidedBy: input.decided_by,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                format: "kotonoha.human_review_command.v0.1",
                command: cmd,
                hint_en: i18n.copyCliHintEn,
                hint_ja: i18n.copyCliHintJa,
                forbidden: "--agent-run-id on review commands",
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case "kotonoha_prepare_human_review":
      return prepareHumanReviewPackage(
        z
          .object({
            delta_id: uuid,
            agent_run_id: uuid.optional(),
            assessment_id: uuid.optional(),
            agent_run_completed: z.boolean().optional().default(true),
            rde_validation_passed: z.boolean().optional().default(true),
          })
          .parse(body),
      );

    case "kotonoha_review_approve":
      return toolResultFromHumanReview(
        "approve",
        z
          .object({
            delta_id: uuid,
            assessment_id: uuid.optional(),
            decided_by: z.string().optional().default("human"),
            rationale_json: z.string().optional(),
          })
          .parse(body),
        HUMAN_REVIEW_WIDGET_URI,
        m6ChildEnv(m6),
      );

    case "kotonoha_review_hold":
      return toolResultFromHumanReview(
        "hold",
        z
          .object({
            delta_id: uuid,
            assessment_id: uuid.optional(),
            decided_by: z.string().optional().default("human"),
            rationale_json: z.string().optional(),
          })
          .parse(body),
        HUMAN_REVIEW_WIDGET_URI,
        m6ChildEnv(m6),
      );

    case "kotonoha_review_reject":
      return toolResultFromHumanReview(
        "reject",
        z
          .object({
            delta_id: uuid,
            assessment_id: uuid.optional(),
            decided_by: z.string().optional().default("human"),
            rationale_json: z.string().optional(),
          })
          .parse(body),
        HUMAN_REVIEW_WIDGET_URI,
        m6ChildEnv(m6),
      );

    default: {
      const _exhaustive: never = name;
      throw new ToolInvokeError(`Unhandled tool: ${_exhaustive}`, 500);
    }
  }
}
