/**
 * @phm-audit/dsh-action-guard — deterministic pre-execution tool-call guard
 * for DeepSeek Harness (dsh), registered through the official monotonic
 * guard seam (`ctx.tools.guard`).
 *
 * "Everything is a plugin" ecosystem contribution. Rules are OPERATOR-
 * DECLARED policy (allowlist, argument bounds, denied values/keys) — not a
 * general safety oracle. Every verdict is appended to a local JSONL ledger
 * for incident forensics. Deterministic: same inputs, same verdict, no
 * network, no model calls.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolGuard } from '@deepseek-ai/dsh-core-tools'
import { evaluateGuard, ledgerChainId, type GuardPolicy } from './guard-core.ts'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'action-guard'

/** Services required by this plugin. */
export const inject = ['tools']

/** Plugin configuration. */
export interface Config {
  /** Operator-declared policy (see GuardPolicy in guard-core.ts). */
  policy: GuardPolicy
  /** Optional JSONL decision ledger. When set, every verdict is appended with a chain id. */
  ledger?: { path: string }
}

export function apply(ctx: Context, config: Config): void {
  const policy = config?.policy ?? {}
  let prevId = 'genesis'
  const guard: ToolGuard = (execution) => {
    const verdict = evaluateGuard(policy, { name: execution.name, arguments: execution.arguments })
    if (config?.ledger?.path) {
      try {
        mkdirSync(dirname(config.ledger.path), { recursive: true })
        const entry = {
          ts: new Date().toISOString(),
          callId: String(execution.callId),
          tool: execution.name,
          argsHash: ledgerChainId('args', { a: execution.arguments }),
          verdict: verdict ?? 'allow',
          ...(verdict ? { reason: verdict } : {}),
        }
        prevId = ledgerChainId(prevId, entry)
        appendFileSync(config.ledger.path, JSON.stringify({ ...entry, chain: prevId }) + '\n')
      } catch {
        // Ledger failures must not affect the verdict path (containment per harness defensive patterns).
      }
    }
    return verdict
  }
  ctx.tools.guard(guard)
  ctx.logger.info('action-guard: deterministic guard registered (allowlist=%s, bounds=%s, deny=%s)',
    String(policy.allowTools?.length ?? 'off'),
    String(policy.argBounds ? Object.keys(policy.argBounds).length : 'off'),
    String(policy.denyArgEquals ? Object.keys(policy.denyArgEquals).length : 'off'))
}

export default apply
