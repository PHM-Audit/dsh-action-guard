# @phm-audit/dsh-action-guard

A deterministic pre-execution tool-call guard plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), registered through the official **monotonic guard seam** (`ctx.tools.guard`).

> DeepSeek Harness follows an "everything is a plugin" architecture. This plugin fills one concrete slot: a rules-based, operator-declared guard whose verdicts are reproducible and whose decisions are recorded.

Gate test artifact: 2009-frame deterministic command stream (2000 benign + 7 injected violations + determinism/ledger/pathological-input checks, no RNG, no network) — **0 false positives on benign, all injected violations caught by the intended rule**, 12/12 vitest cases green (2026-10-13). Run: `bash run_demo.sh`.

## What it checks (all operator-declared, all deterministic)

- **R-unknown** — tool must be in the declared allowlist
- **R-keys** — forbidden parameter keys per tool
- **R-equals** — denied parameter values per tool
- **R-bounds** — numeric parameter bounds per tool (inclusive)
- **Fail-closed** — an internal evaluation error denies with a distinctive reason (a broken guard can never silently become a hole)
- **Decision ledger** — every verdict appended to a local JSONL ledger with a chain id (correlation artifact for incident forensics; FNV-based chain id, not a tamper-proofing guarantee)

## Honest scope

- The policy is **operator-declared** — this is not a general safety oracle, and it does not replace the harness's own permission/sandbox/approval layers; it composes with them at the guard seam.
- Same-source fix cycles are not independent stability trials. The 2009-frame gate is a mechanism demonstration, not a statistical claim.
- The guard core is a pure function (`src/guard-core.ts`, zero dependencies); the Cordis wrapper (`src/index.ts`) adapts it to `ctx.tools.guard` on current harness types. The wrapper is written against the published package layout and should be smoke-tested against the harness version you deploy (API may move — the project is under active development, per its own docs).
- Ledger writes are best-effort and contained; they cannot affect the verdict path.

## Plugin shape (matches harness plugin conventions)

```ts
export const name = 'action-guard'
export const inject = ['tools']
export interface Config { policy: GuardPolicy; ledger?: { path: string } }
export default apply   // registers one ToolGuard via ctx.tools.guard()
```

## License

MIT.
