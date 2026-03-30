import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ValidatorResult, ValidationIssue, TestingMetrics, SentinelConfig } from '../types';
import { BaseValidator } from './base';
import {
  findProjectRoot,
  detectTestRunner,
  readCoverageData,
} from './testing-helpers';

/**
 * Valida a cobertura e qualidade dos testes do projeto.
 *
 * Estratégia de cobertura — 100% dados reais, zero estimativa:
 *
 * 1. Busca coverage reports existentes no projeto:
 *    - coverage-summary.json (Jest/Istanbul formato nativo)
 *    - coverage-final.json (Istanbul detailed — calcula summary)
 *    - lcov.info (formato universal — parser próprio)
 *    - clover.xml (busca no diretório coverage/)
 *
 * 2. Se não encontrar, detecta o test runner e EXECUTA com --coverage:
 *    - Jest: npx jest --coverage --coverageReporters=json-summary
 *    - Vitest: npx vitest run --coverage
 *    - Mocha+nyc: npx nyc --reporter=json-summary mocha
 *    - c8: npx c8 --reporter=json-summary node
 *
 * 3. Lê os dados reais gerados
 *
 * 4. Se tudo falhar (sem runner, sem permissão), reporta erro honesto
 *
 * Métricas adicionais (todas reais, extraídas dos arquivos):
 * - Contagem de assertions (expect/assert/should)
 * - Detecção de edge cases (null, undefined, boundary, error, timeout)
 * - Ratio de testes vs arquivos fonte
 * - Identificação de arquivos sem teste correspondente
 */
export class TestingValidator extends BaseValidator {
  readonly name = 'Testing Coverage';

  constructor(config: SentinelConfig) {
    super(config);
  }

  validate(sourceDir: string): ValidatorResult {
    const issues: ValidationIssue[] = [];
    const metrics = this.analyzeTestCoverage(sourceDir, issues);

    const score = metrics.qualityScore;
    const threshold = this.config.testingThreshold;
    const passed = score >= threshold && issues.filter(i => i.severity === 'error').length === 0;

    return this.buildResult(passed, issues, metrics, score, threshold);
  }

  private analyzeTestCoverage(sourceDir: string, issues: ValidationIssue[]): TestingMetrics {
    let testFiles = 0;
    let assertions = 0;
    let edgeCases = 0;
    let coverage = 0;

    try {
      const files = this.getAllFiles(sourceDir);
      const testFileList = files.filter(f =>
        f.endsWith('.test.ts') || f.endsWith('.spec.ts') ||
        f.endsWith('.test.js') || f.endsWith('.spec.js') ||
        f.endsWith('.test.tsx') || f.endsWith('.spec.tsx') ||
        f.endsWith('.test.jsx') || f.endsWith('.spec.jsx'),
      );
      const sourceFileCount = files.filter(f =>
        (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx')) &&
        !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') &&
        !f.endsWith('.test.js') && !f.endsWith('.spec.js') &&
        !f.endsWith('.test.tsx') && !f.endsWith('.spec.tsx') &&
        !f.endsWith('.test.jsx') && !f.endsWith('.spec.jsx') &&
        !f.endsWith('.d.ts'),
      ).length;

      if (sourceFileCount === 0) {
        issues.push(this.createIssue('error', 'NO_SOURCE_FILES',
          'No source files found in the specified directory'));
        return { coverage: 0, assertions: 0, testFiles: 0, edgeCases: 0, qualityScore: 0 };
      }

      testFiles = testFileList.length;

      if (testFiles === 0) {
        issues.push(this.createIssue('error', 'NO_TESTS',
          'No test files found (*.test.ts, *.spec.ts, etc.)'));
      }

      // Analisar conteúdo dos testes: assertions e edge cases
      for (const file of testFileList) {
        const content = fs.readFileSync(file, 'utf-8');

        // Contabilizar assertions (expect, assert, should patterns)
        const expectCount = (content.match(/expect\s*\(/g) || []).length;
        // eslint-disable-next-line no-useless-escape
        const assertCount = (content.match(/assert\s*[\.(]/g) || []).length;
        // eslint-disable-next-line no-useless-escape
        const shouldCount = (content.match(/\.should\s*[\.(]/g) || []).length;
        assertions += expectCount + assertCount + shouldCount;

        // Contabilizar edge cases com padrões precisos
        const edgePatterns = [
          /\bnull\b/g,
          /\bundefined\b/g,
          /\bedge\s*case/gi,
          /\bboundary/gi,
          /\bcorner\s*case/gi,
          /\bempty\s*(string|array|object|list)/gi,
          /\bnegative/gi,
          /\bzero\b/g,
          /\boverflow/gi,
          /\btimeout/gi,
          /\bthrow/g,
          /\breject/g,
          /\.catch\(/g,
          /\bNaN\b/g,
          /\bInfinity\b/g,
          /\bMAX_SAFE_INTEGER/g,
        ];
        for (const pattern of edgePatterns) {
          edgeCases += (content.match(pattern) || []).length;
        }
      }

      // ── Buscar dados reais de cobertura ──
      const projectRoot = findProjectRoot(sourceDir);
      const searchBase = projectRoot || sourceDir;

      // Passo 1: Tentar ler dados de cobertura já existentes
      let realCoverage = readCoverageData(searchBase);

      // Passo 2: Se não encontrou, tentar GERAR dados reais executando os testes
      if (!realCoverage && testFiles > 0) {
        const generated = this.generateCoverageData(searchBase, issues);
        if (generated) {
          realCoverage = readCoverageData(searchBase);
        }
      }

      if (realCoverage) {
        // Cobertura real: média ponderada (lines 40%, statements 30%, branches 20%, functions 10%)
        coverage = Math.round(
          realCoverage.lines.pct * 0.4 +
          realCoverage.statements.pct * 0.3 +
          realCoverage.branches.pct * 0.2 +
          realCoverage.functions.pct * 0.1,
        );

        // Issues baseadas em dados reais
        if (realCoverage.branches.pct < 50) {
          issues.push(this.createIssue('warning', 'LOW_BRANCH_COVERAGE',
            `Branch coverage is ${realCoverage.branches.pct.toFixed(1)}%`,
            { suggestion: 'Add tests covering more conditional branches (if/else, switch, ternary)' },
          ));
        }

        if (realCoverage.functions.pct < 60) {
          issues.push(this.createIssue('warning', 'LOW_FUNCTION_COVERAGE',
            `Function coverage is ${realCoverage.functions.pct.toFixed(1)}%`,
            { suggestion: 'Add tests for untested functions and methods' },
          ));
        }

        if (realCoverage.lines.pct < 50) {
          issues.push(this.createIssue('warning', 'LOW_LINE_COVERAGE',
            `Line coverage is ${realCoverage.lines.pct.toFixed(1)}%`,
            { suggestion: 'Increase test coverage to at least 50% of code lines' },
          ));
        }
      } else {
        // Sem dados reais de cobertura — NÃO inventamos números
        coverage = 0;

        if (testFiles > 0) {
          issues.push(this.createIssue('warning', 'NO_COVERAGE_DATA',
            'Could not generate coverage data. Score reflects only test infrastructure metrics.',
            { suggestion: 'Run tests with --coverage to generate coverage data (e.g., jest --coverage, nyc mocha, c8 node)' },
          ));
        }
      }

      if (assertions === 0 && testFiles > 0) {
        issues.push(this.createIssue('warning', 'NO_ASSERTIONS',
          'No assertions found in test files'));
      }

      if (edgeCases < assertions * 0.1 && assertions > 0) {
        issues.push(this.createIssue('warning', 'LOW_EDGE_CASES',
          'Edge case coverage is low. Consider adding more edge case tests.',
          { suggestion: 'Add tests for boundary conditions, null/undefined, error scenarios, and timeouts' },
        ));
      }

      // Verificar arquivos fonte sem teste correspondente
      if (testFiles > 0) {
        const sourceFiles = files.filter(f =>
          (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx')) &&
          !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') &&
          !f.endsWith('.test.js') && !f.endsWith('.spec.js') &&
          !f.endsWith('.test.tsx') && !f.endsWith('.spec.tsx') &&
          !f.endsWith('.test.jsx') && !f.endsWith('.spec.jsx') &&
          !f.endsWith('.d.ts'),
        );

        const testBasenames = testFileList.map(f => {
          const base = path.basename(f);
          return base.replace(/\.(test|spec)\.(ts|js|tsx|jsx)$/, '');
        });

        const untestedFiles = sourceFiles.filter(f => {
          const base = path.basename(f).replace(/\.(ts|js|tsx|jsx)$/, '');
          return !testBasenames.includes(base);
        });

        if (untestedFiles.length > 0 && untestedFiles.length <= 10) {
          for (const f of untestedFiles.slice(0, 5)) {
            issues.push(this.createIssue('info', 'UNTESTED_FILE',
              `No corresponding test file for ${path.relative(sourceDir, f)}`,
              { file: path.relative(sourceDir, f), suggestion: 'Create a test file for this module' },
            ));
          }
          if (untestedFiles.length > 5) {
            issues.push(this.createIssue('info', 'UNTESTED_FILES_SUMMARY',
              `${untestedFiles.length - 5} more source files without corresponding tests`,
            ));
          }
        }
      }
    } catch (error) {
      issues.push(this.createIssue('error', 'ANALYSIS_ERROR',
        `Error analyzing test coverage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ));
    }

    // ── Quality score: 100% dados reais ──
    const qualityScore = this.calculateQualityScore(
      coverage, assertions, testFiles, edgeCases,
    );

    return {
      coverage: Math.round(coverage),
      assertions,
      testFiles,
      edgeCases,
      qualityScore: Math.min(Math.max(qualityScore, 0), 100),
    };
  }

  /**
   * Calcula quality score baseado exclusivamente em dados mensuráveis.
   *
   * Com dados de cobertura (cenário ideal):
   *   coverage real (70%) + assertion quality (15%) + edge cases (15%)
   *
   * Sem dados de cobertura (fallback):
   *   assertion density (40%) + test file ratio (30%) + edge cases (20%) + test presence (10%)
   *   Tudo baseado em contagens reais dos arquivos, zero estimativa.
   */
  private calculateQualityScore(
    coverage: number,
    assertions: number,
    testFiles: number,
    edgeCases: number,
  ): number {
    // Métricas de assertions (dados reais extraídos dos arquivos)
    const avgAssertionsPerFile = testFiles > 0 ? assertions / testFiles : 0;
    const edgeCaseRatio = assertions > 0 ? edgeCases / assertions : 0;

    if (coverage > 0) {
      // ── Com coverage real: coverage domina o score ──
      const coverageScore = coverage * 0.7;
      const assertionBonus = Math.min(avgAssertionsPerFile * 0.5, 15);
      const edgeCaseBonus = Math.min(edgeCaseRatio * 100, 15);
      return Math.round(coverageScore + assertionBonus + edgeCaseBonus);
    }

    // ── Sem coverage: score baseado na infraestrutura de testes ──
    // Cada componente usa dados concretos e mensuráveis

    // 1. Assertion density: quantas assertions por arquivo de teste (max 40pts)
    // Benchmark: 10+ assertions/file = excelente, 5 = bom, <2 = fraco
    const densityScore = Math.min(avgAssertionsPerFile / 10 * 40, 40);

    // 2. Test presence: existência e quantidade de arquivos de teste (max 30pts)
    // Não é estimativa — é contagem real de arquivos
    const presenceScore = testFiles > 0 ? Math.min(testFiles * 5, 30) : 0;

    // 3. Edge case coverage: ratio real de edge cases vs assertions (max 20pts)
    const edgeScore = Math.min(edgeCaseRatio * 200, 20);

    // 4. Assertion volume: projetos com muitas assertions são mais robustos (max 10pts)
    // 100+ assertions = 10pts, escala linear
    const volumeScore = Math.min(assertions / 100 * 10, 10);

    return Math.round(densityScore + presenceScore + edgeScore + volumeScore);
  }


  /**
   * Executa o test runner com --coverage para gerar dados reais.
   * Retorna true se conseguiu gerar, false caso contrário.
   *
   * Timeout de 120 segundos para evitar travar em suites longas.
   */
  private generateCoverageData(projectRoot: string, issues: ValidationIssue[]): boolean {
    const runner = detectTestRunner(projectRoot);
    if (!runner) {
      issues.push(this.createIssue('info', 'NO_RUNNER_DETECTED',
        'Could not detect test runner. Supported: Jest, Vitest, Mocha+nyc, c8, AVA.',
        { suggestion: 'Add a test framework to your project or ensure it is listed in package.json' },
      ));
      return false;
    }

    try {
      issues.push(this.createIssue('info', 'GENERATING_COVERAGE',
        `Generating coverage data using ${runner.runner}...`,
      ));

      execSync(runner.command, {
        cwd: projectRoot,
        timeout: 120_000, // 2 minutos
        stdio: 'pipe', // capturar output, não poluir console
        env: { ...process.env, NODE_ENV: 'test', CI: 'true' },
      });

      return true;
    } catch {
      // Testes podem falhar (exit code != 0) mas ainda gerar coverage
      // Verificar se os arquivos de coverage foram criados
      const coverageSummary = path.join(runner.coverageDir, 'coverage-summary.json');
      const coverageFinal = path.join(runner.coverageDir, 'coverage-final.json');
      const lcov = path.join(runner.coverageDir, 'lcov.info');

      if (fs.existsSync(coverageSummary) || fs.existsSync(coverageFinal) || fs.existsSync(lcov)) {
        return true; // Coverage gerado apesar dos testes falharem
      }

      issues.push(this.createIssue('info', 'COVERAGE_GENERATION_FAILED',
        `Could not generate coverage data with ${runner.runner}. Tests may have failed or timed out.`,
        { suggestion: `Run manually: ${runner.command.replace(' 2>/dev/null', '')}` },
      ));
      return false;
    }
  }

}
