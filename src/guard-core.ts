/**
 * Deterministic rule evaluation for the dsh-action-guard plugin.
 *
 * Pure functions, zero dependencies: same inputs always yield the same
 * verdict. The Cordis wrapper (src/index.ts) adapts this core to the
 * DeepSeek Harness `tools.guard()` seam; keeping the rules pure makes the
 * gate test runnable anywhere (no harness install required).
 *
 * Verdict contract (per harness "defensive patterns": report orthogonal
 * outcomes independently): `undefined` = allow, string = denial reason.
 * The function NEVER throws; an internal error fails CLOSED with a
 * distinctive reason so a broken guard can never silently become a hole.
 */

export interface GuardPolicy {
  /** Declared tool allowlist. Calls to tools outside it are denied. Omit to allow all known tools. */
  allowTools?: string[]
  /** Parameter bounds per tool: {tool: {arg: [lo, hi]}} — numeric only, bounds inclusive. */
  argBounds?: Record<string, Record<string, [number, number]>>
  /** Parameter values that are always denied per tool: {tool: {arg: [v1, v2, ...]}} */
  denyArgEquals?: Record<string, Record<string, unknown[]>>
  /** Parameter keys that must not appear at all per tool: {tool: [key1, key2, ...]} */
  denyArgKeys?: Record<string, string[]>
}

export interface GuardCall {
  readonly name: string
  readonly arguments: unknown
}

export type GuardVerdict = string | undefined

const FAIL_CLOSED = 'action-guard: internal evaluation error (fail-closed)'

/** Deterministic JSON stringify for hashing (sorted keys, no whitespace). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}'
}

/** Core rule evaluation. Rule order is fixed for determinism: R-unknown → R-keys → R-equals → R-bounds. */
export function evaluateGuard(policy: GuardPolicy, call: GuardCall): GuardVerdict {
  try {
    // R-unknown: allowlist enforcement
    if (policy.allowTools && !policy.allowTools.includes(call.name)) {
      return `action-guard: tool "${call.name}" is not in the declared allowlist (R-unknown)`
    }
    const args = (typeof call.arguments === 'object' && call.arguments !== null && !Array.isArray(call.arguments))
      ? call.arguments as Record<string, unknown>
      : {}
    // R-keys: forbidden parameter keys
    for (const key of policy.denyArgKeys?.[call.name] ?? []) {
      if (key in args) return `action-guard: argument "${key}" is forbidden for "${call.name}" (R-keys)`
    }
    // R-equals: denied parameter values
    for (const [arg, denied] of Object.entries(policy.denyArgEquals?.[call.name] ?? {})) {
      if (arg in args && denied.some(v => stableStringify(v) === stableStringify(args[arg]))) {
        return `action-guard: value of "${arg}" is in the denied set for "${call.name}" (R-equals)`
      }
    }
    // R-bounds: numeric parameter bounds (inclusive)
    for (const [arg, [lo, hi]] of Object.entries(policy.argBounds?.[call.name] ?? {})) {
      const v = args[arg]
      if (typeof v === 'number' && Number.isFinite(v) && (v < lo || v > hi)) {
        return `action-guard: "${arg}"=${v} outside declared bounds [${lo}, ${hi}] for "${call.name}" (R-bounds)`
      }
    }
    return undefined
  } catch {
    return FAIL_CLOSED
  }
}

/** Hash-chained ledger entry computation (SHA-256 via Web Crypto is async; this uses a fast FNV-1a for the chain id — the ledger is for correlation, not tamper-proofing; use an external ledger for guarantees). */
export function ledgerChainId(prevId: string, entry: Record<string, unknown>): string {
  const basis = prevId + stableStringify(entry)
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < basis.length; i++) {
    h1 ^= basis.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0
    h2 = (Math.imul(h2 ^ basis.charCodeAt(i), 2246822519)) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'))
}
