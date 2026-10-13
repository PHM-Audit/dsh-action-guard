/**
 * END-TO-END SMOKE: the plugin's guard against the REAL published npm
 * packages @deepseek-ai/dsh-system-prompt + @deepseek-ai/dsh-tools
 * (0.0.1-rc.1) — not a stub, not source-reading. Services are loaded the
 * Cordis way (ctx.plugin) so `static inject` resolves, then a real tool is
 * registered and a real execute() call must be denied by our guard.
 */
import { describe, it, expect } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolRegistry } from '@deepseek-ai/dsh-tools'
import * as plugin from '../src/index.ts'
import { evaluateGuard, type GuardPolicy } from '../src/guard-core.ts'

const POLICY: GuardPolicy = { allowTools: ['read', 'write'] }

describe('plugin shape matches harness conventions', () => {
  it('name/inject/Config/default exports', () => {
    expect(plugin.name).toBe('action-guard')
    expect(plugin.inject).toEqual(['tools'])
    expect(typeof plugin.default).toBe('function')
  })

  it('published ToolGuard type accepts our verdict contract', () => {
    const guard = (execution: Readonly<Parameters<import('@deepseek-ai/dsh-tools').ToolGuard>[0]>) =>
      evaluateGuard(POLICY, { name: execution.name, arguments: execution.arguments })
    const fake = { name: 'drop_database', arguments: {}, callId: 't1' } as never
    expect(guard(fake)).toContain('R-unknown')
  })
})

describe('real published services, loaded the cordis way', () => {
  it('SystemPrompt + ToolRegistry load; our guard denies a real execute() call', async () => {
    const { SystemPrompt } = await import('@deepseek-ai/dsh-system-prompt')
    const ctx = new Context()
    ctx.plugin(SystemPrompt as never)
    ctx.plugin(ToolRegistry as never)
    // Cordis resolves services (and ToolRegistry's static inject) asynchronously.
    await new Promise(r => setTimeout(r, 150))
    const tools = (ctx as unknown as { tools?: { register: Function; guard: Function; execute: Function } }).tools
    expect(tools).toBeDefined()
    if (!tools) return

    // Register a minimal real tool (definition shape per published README).
    const disposerTool = tools.register({
      name: 'read',
      description: 'test stub',
      parameters: { type: 'object', properties: {}, required: [] },
      output: { schema: { type: 'object' }, render: () => [] },
      execute: async () => ({ ok: true }),
    })

    // Register OUR guard through the official seam (same call the plugin's apply makes).
    const disposerGuard = tools.guard((execution: { name: string; arguments: unknown }) =>
      evaluateGuard(POLICY, { name: execution.name, arguments: execution.arguments }))

    // A call to a non-allowlisted tool must be denied by our guard in the real pipeline.
    const result = await tools.execute({ callId: 'smoke-1', name: 'drop_database', arguments: {}, signal: new AbortController().signal } as never)
    const asText = JSON.stringify(result)
    expect(asText).toContain('R-unknown')

    disposerTool()
    disposerGuard()
  })
})
