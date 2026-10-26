<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%9B%A1%EF%B8%8F-SENTINEL_METHOD-000000?style=for-the-badge&labelColor=0a0a0a" alt="Sentinel Method" />
</p>

<h1 align="center">
  <code>sentinel-method</code>
</h1>

<p align="center">
  <strong>The AI Code Quality Gate That Thinks Before It Ships</strong>
</p>

<p align="center">
  <em>14 validators. Sub-agent verification. Consensus engine.<br/>One command between chaos and production.</em>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Get_Started-%E2%86%92-00d4aa?style=for-the-badge" alt="Get Started" /></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-%E2%86%92-7c3aed?style=for-the-badge" alt="Architecture" /></a>
  <a href="#the-14-validators"><img src="https://img.shields.io/badge/Validators-%E2%86%92-f59e0b?style=for-the-badge" alt="Validators" /></a>
</p>

<br/>

<p align="center">
  <img src="https://img.shields.io/badge/v3.0.0-black?style=flat-square&logo=semver&logoColor=white" alt="v3.0.0" />
  <img src="https://img.shields.io/badge/TypeScript_5.1+-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js_18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Tests_765-passing-00d4aa?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/Coverage_95%25-statements-00d4aa?style=flat-square" alt="Coverage" />
  <img src="https://img.shields.io/badge/Validators-14-7c3aed?style=flat-square" alt="Validators" />
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square" alt="MIT" />
</p>

---

> **Sentinel runs in production inside [Guilda](https://www.arkolabs.ia.br/guilda/)**, the autonomous AI dev team by [Arko Labs](https://www.arkolabs.ia.br). Every change Guilda ships passes Sentinel's quality gates before a human merges it. [Book a demo →](https://www.arkolabs.ia.br/guilda/)

## The Problem

AI generates code fast. But **fast != safe**. Every unchecked commit is a potential security breach, a performance regression, an accessibility violation, or a maintenance nightmare waiting to happen.

## The Solution

Sentinel Method is a **production-grade quality gate** that intercepts AI-generated code and subjects it to 14 independent validators, dual sub-agent verification, and a consensus engine — all before a single line reaches your codebase.

```
npx sentinel validate ./src
```

That's it. One command. Zero tolerance for bad code.

---

## Quick Start

```bash
# Install
npm install sentinel-method

# Validate your project
npx sentinel validate ./src

# Initialize config files
npx sentinel init

# Install git hooks (pre-commit + pre-push)
npx sentinel hooks --install
```

---

## The 14 Validators

<table>
<thead>
<tr>
<th align="center">#</th>
<th>Validator</th>
<th>What It Catches</th>
<th>Standards</th>
</tr>
</thead>
<tbody>
<tr><td align="center"><code>01</code></td><td><strong>Testing Coverage</strong></td><td>Missing tests, weak assertions, no edge cases</td><td>Score 0-100</td></tr>
<tr><td align="center"><code>02</code></td><td><strong>Security Scanning</strong></td><td>Injection, XSS, hardcoded secrets, weak crypto</td><td>OWASP A01-A07, 12 CWEs</td></tr>
<tr><td align="center"><code>03</code></td><td><strong>Performance</strong></td><td>High complexity, memory leaks, sync bottlenecks</td><td>Cyclomatic &amp; cognitive</td></tr>
<tr><td align="center"><code>04</code></td><td><strong>Maintainability</strong></td><td>God functions, duplication, poor documentation</td><td>Halstead V/D/E, MI index</td></tr>
<tr><td align="center"><code>05</code></td><td><strong>Dependencies</strong></td><td>Unused packages, wildcard versions, missing lock</td><td>Package health</td></tr>
<tr><td align="center"><code>06</code></td><td><strong>Documentation</strong></td><td>Missing JSDoc, README gaps, no CHANGELOG</td><td>Coverage %</td></tr>
<tr><td align="center"><code>07</code></td><td><strong>Code Style</strong></td><td>Inconsistent formatting, console.log, trailing WS</td><td>Consistency score</td></tr>
<tr><td align="center"><code>08</code></td><td><strong>Architecture</strong></td><td>Circular deps, god classes, layer violations</td><td>Score 0-100</td></tr>
<tr><td align="center"><code>09</code></td><td><strong>API Contracts</strong></td><td>REST violations, missing auth, no rate limiting</td><td>REST &amp; OpenAPI</td></tr>
<tr><td align="center"><code>10</code></td><td><strong>Accessibility</strong></td><td>Missing alt, ARIA, semantic HTML, heading order</td><td>WCAG 2.1 AA</td></tr>
<tr><td align="center"><code>11</code></td><td><strong>Internationalization</strong></td><td>Hardcoded strings, locale-naive date/currency</td><td>i18n readiness</td></tr>
<tr><td align="center"><code>12</code></td><td><strong>Error Handling</strong></td><td>Empty catches, swallowed errors, unhandled promises</td><td>Resilience score</td></tr>
<tr><td align="center"><code>13</code></td><td><strong>Type Safety</strong></td><td><code>any</code> abuse, ts-ignore, non-null assertions</td><td>Type strictness</td></tr>
<tr><td align="center"><code>14</code></td><td><strong>Dead Code</strong></td><td>Unused imports, unreachable branches, phantom exports</td><td>Dead code score</td></tr>
</tbody>
</table>

---

## Architecture

```
                         ╔══════════════════════════════════════╗
                         ║        SENTINEL METHOD v3.0          ║
                         ║    "Trust, but verify. Twice."       ║
                         ╚══════════════╦═══════════════════════╝
                                        ║
                    ┌───────────────────╨───────────────────┐
                    │          14 VALIDATOR MATRIX           │
                    │                                       │
                    │  Testing ─── Security ─── Performance │
                    │  Maintain ── Dependency ── Docs       │
                    │  Style ──── Architect ─── API         │
                    │  A11y ───── i18n ──────── Errors      │
                    │  Types ──── Dead Code                 │
                    └───────────────────┬───────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
   ╔══════════╧═══════════╗  ╔═════════╧══════════╗  ╔══════════╧═══════════╗
   ║   SUB-AGENT VERIFY   ║  ║  INTELLIGENCE LAYER ║  ║   SENTINEL ENGINE    ║
   ║                       ║  ║                     ║  ║                      ║
   ║  SecurityVerifier     ║  ║  BusinessGates      ║  ║  Promise.all()       ║
   ║  ConsensusEngine      ║  ║  RiskBudget         ║  ║  PluginLoader        ║
   ║  Taint Flow Analysis  ║  ║  FitnessFunctions   ║  ║  ResultCache         ║
   ╚══════════╤═══════════╝  ╚═════════╤══════════╝  ╚══════════╤═══════════╝
              └─────────────────────────┼─────────────────────────┘
                                        │
                         ╔══════════════╧═══════════════╗
                         ║    REPORTER + CLI OUTPUT      ║
                         ║  Console │ JSON │ MD │ HTML   ║
                         ╚══════════════════════════════╝
```

### How Sub-Agent Verification Works

Sentinel doesn't just run validators — it **verifies its own findings**. The ConsensusEngine runs dual independent analysis paths and only reports issues where both agents agree. This eliminates false positives and gives you confidence that every flagged issue is real.

```
Validator Result ──→ Agent A (SecurityVerifier) ──→ ┐
                                                     ├──→ ConsensusEngine ──→ Final Verdict
Validator Result ──→ Agent B (Independent Check) ──→ ┘
```

---

## CLI Reference

```bash
# Core validation
sentinel validate [directory] [options]

# Project setup
sentinel init [--force]

# Git hooks
sentinel hooks --install | --remove | --status

# List validators
sentinel list
```

### Options

```
-f, --format <format>              Output: console | json | markdown | html
-t, --testing-threshold <n>        Min testing score (default: 80)
-s, --security-level <level>       strict | moderate | permissive
-p, --performance-target <target>  optimal | good | acceptable
-m, --maintainability-score <n>    Min maintainability (default: 75)
-o, --output <file>                Save report (auto-detects format)
-w, --watch                        Re-run on file changes
--fail-on-warnings                 Treat warnings as failures
--json                             Shorthand for -f json
--min-severity <level>             Filter: error | warning | info
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | Quality gate passed |
| `1`  | Quality gate failed |
| `2`  | Runtime error |

---

## Programmatic API

```typescript
import { Sentinel } from 'sentinel-method';

const sentinel = new Sentinel({
  testingThreshold: 80,
  securityLevel: 'strict',
  performanceTarget: 'optimal',
  maintainabilityScore: 75,
});

const result = await sentinel.validate('./src');

if (result.success) {
  console.log('Quality gate passed!');
} else {
  console.log(`Failed: ${result.summary.failedChecks} validators failed`);
  process.exit(1);
}
```

### Custom Validators (Plugin System)

```typescript
import { BaseValidator, PluginLoader } from 'sentinel-method';
import type { ValidatorResult, SentinelConfig } from 'sentinel-method';

class LicenseValidator extends BaseValidator {
  readonly name = 'License Check';

  validate(sourceDir: string): ValidatorResult {
    const files = this.getAllFiles(sourceDir);
    const hasLicense = files.some(f => f.includes('LICENSE'));

    return this.buildResult(
      hasLicense,
      hasLicense ? [] : [this.createIssue('error', 'NO_LICENSE', 'Missing LICENSE file')],
      { licenseFound: hasLicense },
    );
  }
}

// Register directly
const sentinel = new Sentinel();
sentinel.registerValidator(new LicenseValidator(config));

// Or load from directory
const loader = new PluginLoader();
loader.loadFromDirectory('./plugins');
```

---

## Configuration

### `.sentinelrc.json`

```json
{
  "testingThreshold": 80,
  "securityLevel": "strict",
  "performanceTarget": "optimal",
  "maintainabilityScore": 75,
  "excludePatterns": ["node_modules", "dist", "coverage"],
  "reporters": ["json", "markdown"],
  "failOnWarnings": false
}
```

### `.sentinelignore`

Uses `.gitignore` syntax. Default exclusions are always active: `node_modules/`, `.git/`, `dist/`, `coverage/`, `.*`.

```gitignore
# Generated
generated/
*.auto.ts

# Vendor
vendor/

# Legacy
legacy-module.js
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Sentinel Quality Gate
on: [push, pull_request]

jobs:
  sentinel:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npx sentinel validate ./src --json > sentinel-report.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sentinel-report-node${{ matrix.node-version }}
          path: sentinel-report.json
```

### GitLab CI

```yaml
sentinel:
  stage: validate
  image: node:20
  script:
    - npm ci
    - npx sentinel validate ./src -f markdown > sentinel-report.md
  artifacts:
    paths:
      - sentinel-report.md
```

---

## Security Coverage

Full OWASP Top 10 (2021) and CWE mapping:

| Detection | CWE | OWASP Category |
|-----------|-----|----------------|
| `eval()` / `Function()` | CWE-94, CWE-95 | A03 Injection |
| SQL template injection | CWE-89 | A03 Injection |
| Command injection | CWE-78 | A03 Injection |
| `innerHTML` / `document.write` | CWE-79 | A07 XSS |
| Hardcoded passwords/tokens | CWE-798 | A02 Crypto Failures |
| Hardcoded API keys | CWE-321 | A02 Crypto Failures |
| MD5/SHA-1 usage | CWE-327 | A02 Crypto Failures |
| Path traversal | CWE-22 | A01 Access Control |
| Unsafe deserialization | CWE-502 | A04 Insecure Design |

---

## Halstead Complexity Metrics

The Maintainability validator integrates Halstead software science metrics with a 20% weight in the final Maintainability Index:

- **Volume (V)**: `N * log2(n)` — information content of the code
- **Difficulty (D)**: `(n1/2) * (N2/n2)` — cognitive complexity to understand
- **Effort (E)**: `D * V` — mental effort to comprehend
- **Estimated Time**: `E / 18` — predicted development time (seconds)
- **Estimated Bugs**: `V / 3000` — predicted defect count

---

## Incremental Validation

```typescript
import { DiffAnalyzer } from 'sentinel-method';

const diff = new DiffAnalyzer('.');

// Only files changed in current PR
const prFiles = diff.getDiffAgainst('main');

// Only staged files (pre-commit)
const staged = diff.getStagedFiles();

// Filter to code files
const codeFiles = diff.filterCodeFiles(staged);
```

Result caching is automatic via `.sentinel-cache/`. Unchanged files are skipped on subsequent runs.

---

## Testing

```bash
npm test                # Run all 765 tests
npm run test:coverage   # With coverage report
npm run test:watch      # Watch mode
```

**765 tests** across 32 suites. **95% statement coverage**, 99% function coverage.

---

## API Reference

### Core Classes

| Class | Purpose |
|-------|---------|
| `Sentinel` | Main orchestrator — runs all validators, aggregates results |
| `BaseValidator` | Abstract base — file traversal, issue creation, result building |
| `FileCollector` | Cached I/O — collect, filter, read files with caching |
| `SentinelIgnore` | `.gitignore`-style pattern matching |
| `PluginLoader` | Load and register custom validator plugins |
| `ResultCache` | File-hash-based validation result caching |
| `HookManager` | Git hook installation and management |
| `DiffAnalyzer` | Git diff analysis for incremental validation |
| `ConsensusEngine` | Dual-agent verification with consensus scoring |
| `BusinessGates` | Business rule enforcement layer |
| `RiskBudget` | Risk allocation and tracking across validators |
| `FitnessFunctions` | Architectural fitness function evaluation |

### All 14 Validator Classes

| Class | Standards |
|-------|-----------|
| `TestingValidator` | Test coverage, assertions, edge cases |
| `SecurityValidator` | OWASP Top 10, CWE-22/78/79/89/94/95/321/327/502/798 |
| `PerformanceValidator` | Cyclomatic complexity, async patterns |
| `MaintainabilityValidator` | Halstead metrics, Maintainability Index |
| `DependencyValidator` | Package health, semver compliance |
| `DocumentationValidator` | JSDoc coverage, README/CHANGELOG |
| `CodeStyleValidator` | Formatting consistency |
| `ArchitectureValidator` | Circular deps, SOLID violations |
| `ApiContractValidator` | REST patterns, Express/NestJS/Next.js |
| `AccessibilityValidator` | WCAG 2.1 AA — HTML, Vue, Svelte, JSX |
| `I18nValidator` | Hardcoded strings, locale formatting |
| `ErrorHandlingValidator` | Error resilience patterns |
| `TypeSafetyValidator` | TypeScript strictness enforcement |
| `DeadCodeValidator` | Unused code elimination |

---

## Sentinel in production: Guilda

Sentinel is the quality backbone of **[Guilda](https://www.arkolabs.ia.br/guilda/)**, a complete autonomous development team of AI agents built by [Arko Labs](https://www.arkolabs.ia.br) for banks, fintechs and payment platforms.

- **PO and Architect agents** write the contract: stories with Gherkin acceptance criteria and an ADR
- **QA writes failing acceptance tests first**; dev agents take each card from red to green
- **Sentinel gates** block leaked secrets, coverage drops, failing lint and new vulnerabilities on the exact commit
- **A read-only reviewer** checks the diff; every action lands in a tamper-evident audit chain
- **No agent merges or deletes files**: you get a ready PR with its contract, proofs and AI cost

In one real day of operation: 5 deliveries for US$ 38.91 in AI.

👉 [See Guilda working on a sample project](https://www.arkolabs.ia.br/guilda/)

---

## License

MIT License 2026 — [Camilo Girardelli](https://github.com/camilogirardelli) / Girardelli Tecnologia

---

<p align="center">
  <strong>Built by <a href="https://github.com/camilogirardelli">Camilo Girardelli</a></strong><br/>
  IEEE Senior Member | Senior Software Architect | CTO at Girardelli Tecnologia
</p>

<p align="center">
  <sub>If AI writes the code, Sentinel decides if it ships.</sub>
</p>
