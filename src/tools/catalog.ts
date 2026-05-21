/**
 * Tool names aligned with kotonoha-mcp / 04_mcp_tools_and_ux.md §3.
 */

export const TOOL_NAMES = [
  "kotonoha_ping",
  "kotonoha_context_export",
  "kotonoha_rde_validate",
  "kotonoha_agent_record_start",
  "kotonoha_agent_record_complete",
  "kotonoha_meaning_delta_from_run",
  "kotonoha_rde_attach",
  "kotonoha_copy_human_review_command",
  "kotonoha_prepare_human_review",
  "kotonoha_review_approve",
  "kotonoha_review_hold",
  "kotonoha_review_reject",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}
