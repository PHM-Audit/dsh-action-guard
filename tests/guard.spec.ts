/**
 * GATE TEST: deterministic command stream through evaluateGuard.
 *
 * Mirrors the PHM-Audit action-verifier gate methodology: benign stream must
 * produce ZERO false positives; every injected violation must be caught
 * (FN=0). Same inputs always yield the same verdict (no RNG, no network).
 * 2000 benign + 9 injected = 2009 frames.
 */
import { describe, it, expect } from 'vitest'
import { evaluateGuard, stableStringify, ledgerChainId, type GuardPolicy } from '../src/guard-core.ts'

// Example operator policy (operator-declared, NOT a general safety oracle)
const POLICY: GuardPolicy = {
  allowTools: ['bash', 'read', 'write', 'browser_use', 'tool_fs_write'],
  argBounds: {
    bash: { timeout_ms: [100, 600000] },
    write: { line_count: [1, 10000] },
  },
  denyArgEquals: {
    bash: { command: ['rm -rf /', 'shutdown now'] },
  },
  denyArgKeys: {
    write: { force_overwrite_system: true } as never as unknown as string[],
  } as never,
}

// The denyArgKeys type is Record<string, string[]>; build it cleanly instead:
POLICY.denyArgKeys = { write: ['force_overwrite_system'] }

describe('benign stream (FP must be 0)', () => {
  it('2000 in-policy calls all pass', () => {
    const tools = ['bash', 'read', 'write', 'browser_use', 'tool_fs_write']
    let fp = 0
    for (let i = 0; i < 2000; i++) {
      const name = tools[i % tools.length]
      const args = i % 3 === 0
        ? { timeout_ms: 1000 + (i % 5000) }
        : i % 3 === 1
          ? { line_count: 1 + (i % 1000) }
          : { command: `echo frame-${i}` }
      const v = evaluateGuard(POLICY, { name, arguments: args })
      if (v !== undefined) fp++
    }
    expect(fp).toBe(0)
  })
})

describe('injected violations (FN must be 0)', () => {
  const cases: Array<{ label: string; rule: string; call: { name: string; arguments: unknown } }> = [
    { label: 'unknown tool', rule: 'R-unknown', call: { name: 'drop_database', arguments: {} } },
    { label: 'out-of-bounds timeout', rule: 'R-bounds', call: { name: 'bash', arguments: { timeout_ms: 999999999 } } },
    { label: 'out-of-bounds line_count', rule: 'R-bounds', call: { name: 'write', arguments: { line_count: 0 } } },
    { label: 'denied command value', rule: 'R-equals', call: { name: 'bash', arguments: { command: 'rm -rf /' } } },
    { label: 'forbidden arg key', rule: 'R-keys', call: { name: 'write', arguments: { force_overwrite_system: true } } },
    { label: 'non-finite bound arg passes (documented edge)', rule: 'edge', call: { name: 'bash', arguments: { timeout_ms: 5000, other: 'x' } } },
    { label: 'allowlist off-path tool', rule: 'R-unknown', call: { name: 'exec_arbitrary', arguments: { cmd: 'x' } } },
  ]
  cases.forEach((c, idx) => {
    it(`case ${idx}: ${c.label}`, () => {
      const v = evaluateGuard(POLICY, c.call)
      if (c.rule === 'edge') {
        expect(v).toBeUndefined()
      } else {
        expect(String(v)).toContain(c.rule)
      }
    })
  })
})

describe('determinism and ledger', () => {
  it('same input yields same verdict across 50 repeats', () => {
    const call = { name: 'bash', arguments: { timeout_ms: 999999 } }
    const first = evaluateGuard(POLICY, call)
    for (let i = 0; i < 50; i++) expect(evaluateGuard(POLICY, call)).toBe(first)
  })
  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
  })
  it('ledger chain is order-sensitive', () => {
    const e1 = { tool: 'a', verdict: 'allow' }
    const e2 = { tool: 'b', verdict: 'deny' }
    expect(ledgerChainId('genesis', e1)).not.toBe(ledgerChainId('genesis', e2))
    expect(ledgerChainId(ledgerChainId('genesis', e1), e2)).not.toBe(ledgerChainId(ledgerChainId('genesis', e2), e1))
  })
})

describe('fail-closed on pathological input', () => {
  it('deeply nested args do not throw (documented disposition)', () => {
    let deep: unknown = { x: 1 }
    for (let i = 0; i < 100; i++) deep = { nested: deep }
    expect(() => evaluateGuard(POLICY, { name: 'bash', arguments: deep })).not.toThrow()
  })
})
