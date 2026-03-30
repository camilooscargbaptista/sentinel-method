/**
 * Architecture Fitness Functions — Declarative architectural constraints
 *
 * Define rules in `.nexusrc.json` that are continuously evaluated:
 *   - maxFileLines: No file exceeds N lines
 *   - maxCyclomaticComplexity: No function exceeds complexity threshold
 *   - noCyclicDependencies: Enforce acyclic dependency graph
 *   - layerEnforcement: Layer A cannot import from Layer B
 *   - maxCoupling: Afferent/efferent coupling limits
 *   - testCoverageFloor: Minimum coverage per module
 *   - namingConvention: Enforce file/class naming patterns
 *   - dependencyBan: Forbid specific imports
 *   - maxPublicApi: Limit exported symbols per module
 *   - responseTimeP99: Performance SLA enforcement
 *
 * @author Camilo Girardelli — Girardelli Tecnologia
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type FitnessFunctionType =
  | "maxFileLines"
  | "maxCyclomaticComplexity"
  | "noCyclicDependencies"
  | "layerEnforcement"
  | "maxCoupling"
  | "testCoverageFloor"
  | "namingConvention"
  | "dependencyBan"
  | "maxPublicApi"
  | "responseTimeP99";

export interface FitnessFunctionRule {
  type: FitnessFunctionType;
  /** Human-readable description */
  description?: string;
  /** Rule-specific configuration */
  params: Record<string, unknown>;
  /** Severity if violated */
  severity: "error" | "warning";
  /** Glob patterns for files this rule applies to (default: all) */
  include?: string[];
  /** Glob patterns for files to exclude */
  exclude?: string[];
}

export interface FitnessEvaluation {
  rule: FitnessFunctionRule;
  passed: boolean;
  violations: FitnessViolation[];
}

export interface FitnessViolation {
  file: string;
  line?: number;
  message: string;
  actual: string | number;
  expected: string | number;
}

export interface FitnessReport {
  timestamp: string;
  rules: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  evaluations: FitnessEvaluation[];
  overallPassed: boolean;
}

/** Input data the fitness engine needs from analyzers */
export interface FitnessInput {
  files: FileMetrics[];
  dependencies?: DependencyEdge[];
  coverage?: ModuleCoverage[];
  performanceMetrics?: PerformanceMetric[];
}

export interface FileMetrics {
  path: string;
  lines: number;
  maxComplexity: number;
  exports: number;
  imports: string[];
  layer?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface ModuleCoverage {
  module: string;
  lineCoverage: number;
  branchCoverage: number;
}

export interface PerformanceMetric {
  endpoint: string;
  p99: number;
}

// ═══════════════════════════════════════════════════════════════
// BUILT-IN FITNESS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

type FitnessEvaluator = (
  rule: FitnessFunctionRule,
  input: FitnessInput,
) => FitnessViolation[];

const EVALUATORS: Record<FitnessFunctionType, FitnessEvaluator> = {
  maxFileLines: (rule, input) => {
    const max = (rule.params.max as number) ?? 500;
    return input.files
      .filter(f => f.lines > max)
      .map(f => ({
        file: f.path,
        message: `File has ${f.lines} lines (max: ${max})`,
        actual: f.lines,
        expected: max,
      }));
  },

  maxCyclomaticComplexity: (rule, input) => {
    const max = (rule.params.max as number) ?? 15;
    return input.files
      .filter(f => f.maxComplexity > max)
      .map(f => ({
        file: f.path,
        message: `Cyclomatic complexity ${f.maxComplexity} exceeds threshold ${max}`,
        actual: f.maxComplexity,
        expected: max,
      }));
  },

  noCyclicDependencies: (_rule, input) => {
    if (!input.dependencies) return [];
    const cycles = detectCycles(input.dependencies);
    return cycles.map(cycle => ({
      file: cycle[0],
      message: `Cyclic dependency: ${cycle.join(" → ")}`,
      actual: cycle.join(" → "),
      expected: "no cycles",
    }));
  },

  layerEnforcement: (rule, input) => {
    const forbidden = rule.params.forbidden as { from: string; to: string }[] ?? [];
    const violations: FitnessViolation[] = [];

    for (const file of input.files) {
      if (!file.layer) continue;
      for (const imp of file.imports) {
        const importedFile = input.files.find(f => imp.includes(f.path) || f.path.includes(imp));
        if (!importedFile?.layer) continue;

        const isForbidden = forbidden.some(
          f => file.layer === f.from && importedFile.layer === f.to,
        );
        if (isForbidden) {
          violations.push({
            file: file.path,
            message: `Layer '${file.layer}' cannot import from '${importedFile.layer}'`,
            actual: `${file.layer} → ${importedFile.layer}`,
            expected: "forbidden layer dependency",
          });
        }
      }
    }
    return violations;
  },

  maxCoupling: (rule, input) => {
    const maxAfferent = (rule.params.maxAfferent as number) ?? 10;
    const maxEfferent = (rule.params.maxEfferent as number) ?? 8;
    const violations: FitnessViolation[] = [];

    if (!input.dependencies) return [];

    // Calculate afferent (incoming) and efferent (outgoing) coupling
    const afferent = new Map<string, number>();
    const efferent = new Map<string, number>();

    for (const edge of input.dependencies) {
      afferent.set(edge.to, (afferent.get(edge.to) ?? 0) + 1);
      efferent.set(edge.from, (efferent.get(edge.from) ?? 0) + 1);
    }

    for (const [file, count] of afferent.entries()) {
      if (count > maxAfferent) {
        violations.push({
          file,
          message: `Afferent coupling ${count} exceeds max ${maxAfferent}`,
          actual: count,
          expected: maxAfferent,
        });
      }
    }

    for (const [file, count] of efferent.entries()) {
      if (count > maxEfferent) {
        violations.push({
          file,
          message: `Efferent coupling ${count} exceeds max ${maxEfferent}`,
          actual: count,
          expected: maxEfferent,
        });
      }
    }

    return violations;
  },

  testCoverageFloor: (rule, input) => {
    const minLine = (rule.params.minLineCoverage as number) ?? 80;
    const minBranch = (rule.params.minBranchCoverage as number) ?? 70;

    if (!input.coverage) return [];

    return input.coverage
      .flatMap(m => {
        const violations: FitnessViolation[] = [];
        if (m.lineCoverage < minLine) {
          violations.push({
            file: m.module,
            message: `Line coverage ${m.lineCoverage}% below floor ${minLine}%`,
            actual: m.lineCoverage,
            expected: minLine,
          });
        }
        if (m.branchCoverage < minBranch) {
          violations.push({
            file: m.module,
            message: `Branch coverage ${m.branchCoverage}% below floor ${minBranch}%`,
            actual: m.branchCoverage,
            expected: minBranch,
          });
        }
        return violations;
      });
  },

  namingConvention: (rule, input) => {
    const pattern = rule.params.pattern as string;
    if (!pattern) return [];

    const regex = new RegExp(pattern);
    return input.files
      .filter(f => !regex.test(f.path))
      .map(f => ({
        file: f.path,
        message: `File name does not match pattern '${pattern}'`,
        actual: f.path,
        expected: pattern,
      }));
  },

  dependencyBan: (rule, input) => {
    const banned = (rule.params.banned as string[]) ?? [];
    const violations: FitnessViolation[] = [];

    for (const file of input.files) {
      for (const imp of file.imports) {
        const bannedMatch = banned.find(b => imp.includes(b));
        if (bannedMatch) {
          violations.push({
            file: file.path,
            message: `Banned dependency '${bannedMatch}' imported`,
            actual: imp,
            expected: `not ${bannedMatch}`,
          });
        }
      }
    }
    return violations;
  },

  maxPublicApi: (rule, input) => {
    const max = (rule.params.max as number) ?? 20;
    return input.files
      .filter(f => f.exports > max)
      .map(f => ({
        file: f.path,
        message: `Module exports ${f.exports} symbols (max: ${max})`,
        actual: f.exports,
        expected: max,
      }));
  },

  responseTimeP99: (rule, input) => {
    const maxMs = (rule.params.maxMs as number) ?? 500;
    if (!input.performanceMetrics) return [];

    return input.performanceMetrics
      .filter(m => m.p99 > maxMs)
      .map(m => ({
        file: m.endpoint,
        message: `P99 latency ${m.p99}ms exceeds SLA ${maxMs}ms`,
        actual: m.p99,
        expected: maxMs,
      }));
  },
};

// ═══════════════════════════════════════════════════════════════
// CYCLE DETECTION (Kahn's algorithm)
// ═══════════════════════════════════════════════════════════════

function detectCycles(edges: DependencyEdge[]): string[][] {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Build adjacency list
  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, new Set());
    if (!graph.has(edge.to)) graph.set(edge.to, new Set());
    graph.get(edge.from)!.add(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    if (!inDegree.has(edge.from)) inDegree.set(edge.from, 0);
  }

  // Kahn's — find nodes that can't be topologically sorted
  const queue: string[] = [];
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(node);
  }

  const sorted = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.add(node);
    for (const neighbor of graph.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Remaining nodes are in cycles — extract cycle paths via DFS
  const inCycle = Array.from(graph.keys()).filter(n => !sorted.has(n));
  if (inCycle.length === 0) return [];

  const cycles: string[][] = [];
  const visited = new Set<string>();

  for (const start of inCycle) {
    if (visited.has(start)) continue;
    const cycle = traceCycle(start, graph, inCycle);
    if (cycle.length > 0) {
      cycles.push(cycle);
      cycle.forEach(n => visited.add(n));
    }
  }

  return cycles;
}

function traceCycle(
  start: string,
  graph: Map<string, Set<string>>,
  inCycle: string[],
): string[] {
  const cycleSet = new Set(inCycle);
  const path: string[] = [start];
  const pathSet = new Set([start]);
  let current = start;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const neighbors = graph.get(current) ?? new Set();
    const next = Array.from(neighbors).find(n => cycleSet.has(n) && !pathSet.has(n));
    if (!next) {
      // Check if we can close the cycle
      const closesLoop = Array.from(neighbors).find(n => n === start);
      if (closesLoop) {
        path.push(start);
        return path;
      }
      return path.length > 1 ? [...path, start] : [];
    }
    path.push(next);
    pathSet.add(next);
    current = next;
  }
}

// ═══════════════════════════════════════════════════════════════
// FITNESS ENGINE
// ═══════════════════════════════════════════════════════════════

export class FitnessEngine {
  private rules: FitnessFunctionRule[];

  constructor(rules: FitnessFunctionRule[]) {
    this.rules = rules;
  }

  /**
   * Evaluate all fitness functions against the provided metrics.
   */
  evaluate(input: FitnessInput): FitnessReport {
    const evaluations: FitnessEvaluation[] = [];

    for (const rule of this.rules) {
      const evaluator = EVALUATORS[rule.type];
      if (!evaluator) {
        evaluations.push({
          rule,
          passed: false,
          violations: [{
            file: "",
            message: `Unknown fitness function type: ${rule.type}`,
            actual: rule.type,
            expected: "valid type",
          }],
        });
        continue;
      }

      // Filter input files by include/exclude globs (simplified matching)
      const filteredInput = this.filterInput(input, rule);
      const violations = evaluator(rule, filteredInput);

      evaluations.push({
        rule,
        passed: violations.length === 0,
        violations,
      });
    }

    const passed = evaluations.filter(e => e.passed).length;
    const failed = evaluations.filter(e => !e.passed).length;
    const errors = evaluations
      .filter(e => !e.passed && e.rule.severity === "error")
      .length;
    const warnings = evaluations
      .filter(e => !e.passed && e.rule.severity === "warning")
      .length;

    return {
      timestamp: new Date().toISOString(),
      rules: this.rules.length,
      passed,
      failed,
      warnings,
      errors,
      evaluations,
      overallPassed: errors === 0,
    };
  }

  /**
   * Load rules from a .nexusrc.json config object.
   */
  static fromConfig(config: { fitnessRules?: FitnessFunctionRule[] }): FitnessEngine {
    return new FitnessEngine(config.fitnessRules ?? []);
  }

  private filterInput(input: FitnessInput, rule: FitnessFunctionRule): FitnessInput {
    if (!rule.include && !rule.exclude) return input;

    const filtered = input.files.filter(f => {
      if (rule.include && rule.include.length > 0) {
        const matched = rule.include.some(pattern => simpleGlob(pattern, f.path));
        if (!matched) return false;
      }
      if (rule.exclude && rule.exclude.length > 0) {
        const excluded = rule.exclude.some(pattern => simpleGlob(pattern, f.path));
        if (excluded) return false;
      }
      return true;
    });

    return { ...input, files: filtered };
  }
}

/**
 * Simple glob matching (supports * and **).
 */
function simpleGlob(pattern: string, path: string): boolean {
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${regex}$`).test(path);
}
