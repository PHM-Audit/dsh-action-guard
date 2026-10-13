# @phm-audit/dsh-action-guard

A deterministic pre-execution tool-call guard plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), registered through the official **monotonic guard seam** (`ctx.tools.guard`).

> DeepSeek Harness follows an "everything is a plugin" architecture. This plugin fills one concrete slot: a rules-based, operator-declared guard whose verdicts are reproducible and whose decisions are recorded.

Gate test artifact: 2009-frame deterministic command stream (2000 benign + 7 injected violations + determinism/ledger/pathological-input checks, no RNG, no network) — **0 false positives on benign, all injected violations caught by the intended rule**, 12/12 vitest cases green (2026-10-13). Run: `bash run_demo.sh`.

End-to-end smoke: the Cordis wrapper is additionally verified against the **published npm packages** `@deepseek-ai/dsh-system-prompt` + `@deepseek-ai/dsh-tools` 0.0.1-rc.1 (2026-10-13) — loaded the cordis way (`ctx.plugin`, `static inject` resolved), a real tool registered, and a real `execute()` call to a non-allowlisted tool **denied with the expected R-unknown reason through the actual pipeline** (3/3 smoke cases). Version-pinned smoke: the harness is under active development; re-run `npx vitest run tests/smoke.harness.spec.ts` against your deployed version.

## What it checks (all operator-declared, all deterministic)

- **R-unknown** — tool must be in the declared allowlist
- **R-keys** — forbidden parameter keys per tool
- **R-equals** — denied parameter values per tool
- **R-bounds** — numeric parameter bounds per tool (inclusive)
- **Fail-closed** — an internal evaluation error denies with a distinctive reason (a broken guard can never silently become a hole)
- **Decision ledger** — every verdict appended to a local JSONL ledger with a chain id (correlation artifact for incident forensics; FNV-based chain id, not a tamper-proofing guarantee)

## Method lineage — PHM

This plugin is the harness-native expression of the **PHM deterministic-verification methodology** (gate-first, evidence-first), whose parent project [agent-action-verifier](https://github.com/PHM-Audit/agent-action-verifier) is validated on the **AgentDojo official benchmark with a real LLM in the loop** (no ASR/FP events in the v2.2 re-run, FP fix-cycle 16 → 1 → 0 published, all artifacts open with SHA-256 chains, third-party thread engagement on record).

What that lineage means concretely, versus the (crowded, 155-plugin) Security & Permissions category:

1. **Official third-party benchmark lineage** — the parent method is measured on AgentDojo, not only on self-built samples (verified 2026-10-13 across a 10-repo sample of direct competitors: none cites an industry-standard benchmark; the closest, dsh-defend, uses a self-built 105-sample red-team set).
2. **Cross-domain deployment record** — the same gate criteria (benign FP=0 / injected FN=0 / deterministic repeats / fail-closed / audit ledger) run in robot (Unitree official-URDF gate), traffic-flow (845k-frame NGSIM), and SDK-contract lines — a method with a track record, not a one-off plugin.
3. **Open, recomputable evidence** — every claim in this README has an on-disk artifact: gate counts in `tests/`, smoke in `tests/smoke.harness.spec.ts` against published npm versions, SHA-256SUMS manifest.

The category being crowded is stated on purpose: this plugin's value is the evidence chain and the standard-interface demonstration, not feature uniqueness.

## Honest scope

## Honest scope

- The policy is **operator-declared** — this is not a general safety oracle, and it does not replace the harness's own permission/sandbox/approval layers; it composes with them at the guard seam.
- Same-source fix cycles are not independent stability trials. The 2009-frame gate is a mechanism demonstration, not a statistical claim.
- The guard core is a pure function (`src/guard-core.ts`, zero dependencies); the Cordis wrapper (`src/index.ts`) imports `ToolGuard` from the published `@deepseek-ai/dsh-tools` package and is smoke-tested as described above. One earlier revision imported a wrong internal-only package name; the smoke test against npm packages is the guard against that class of error.
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
