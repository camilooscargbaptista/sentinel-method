import * as fs from 'fs';
import { ValidatorResult, ValidationIssue, MaintainabilityMetrics, SentinelConfig } from '../types';
import { BaseValidator } from './base';

/**
 * Métricas de Halstead para análise de complexidade de software.
 *
 * Baseado em: Halstead, M.H. (1977). Elements of Software Science.
 * As métricas medem a "informação" contida no código-fonte.
 */
export interface HalsteadMetrics {
  /** Operadores distintos (η1) */
  uniqueOperators: number;
  /** Operandos distintos (η2) */
  uniqueOperands: number;
  /** Total de operadores (N1) */
  totalOperators: number;
  /** Total de operandos (N2) */
  totalOperands: number;
  /** Vocabulário do programa: η = η1 + η2 */
  vocabulary: number;
  /** Comprimento do programa: N = N1 + N2 */
  length: number;
  /** Volume: V = N × log2(η) */
  volume: number;
  /** Dificuldade: D = (η1 / 2) × (N2 / η2) */
  difficulty: number;
  /** Esforço: E = D × V */
  effort: number;
  /** Tempo estimado em segundos: T = E / 18 (Stroud number) */
  estimatedTime: number;
  /** Bugs estimados: B = V / 3000 */
  estimatedBugs: number;
}

export class MaintainabilityValidator extends BaseValidator {
  readonly name = 'Maintainability Checker';
  private readonly maxFunctionLength = 50;
  private readonly maxCyclomaticComplexity = 10;

  /** Operadores TypeScript/JavaScript reconhecidos para Halstead */
  private readonly operators = new Set([
    // Aritméticos
    '+', '-', '*', '/', '%', '**',
    // Atribuição
    '=', '+=', '-=', '*=', '/=', '%=', '**=',
    // Comparação
    '==', '!=', '===', '!==', '<', '>', '<=', '>=',
    // Lógicos
    '&&', '||', '!', '??',
    // Bitwise
    '&', '|', '^', '~', '<<', '>>', '>>>',
    // Ternário
    '?', ':',
    // Acesso
    '.', '?.', '...',
    // Outros
    '=>', 'typeof', 'instanceof', 'in', 'new', 'delete', 'void',
    // Keywords como operadores
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'return', 'throw', 'try', 'catch', 'finally',
    'import', 'export', 'from', 'as', 'default',
    'const', 'let', 'var', 'function', 'class', 'async', 'await',
  ]);

  constructor(config: SentinelConfig) {
    super(config);
  }

  validate(sourceDir: string): ValidatorResult {
    const issues: ValidationIssue[] = [];
    const metrics = this.analyzeMaintainability(sourceDir, issues);

    const score = metrics.maintainabilityIndex;
    const threshold = this.config.maintainabilityScore;
    const passed = score >= threshold && issues.filter(i => i.severity === 'error').length === 0;

    return this.buildResult(passed, issues, metrics, score, threshold);
  }

  /**
   * Calcula métricas de Halstead para um bloco de código.
   * Análise léxica simplificada mas eficaz para TypeScript/JavaScript.
   */
  calculateHalstead(code: string): HalsteadMetrics {
    const operatorCounts = new Map<string, number>();
    const operandCounts = new Map<string, number>();

    // Remover comentários e strings para análise limpa
    const cleanCode = code
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/\/\/.*/g, '')              // line comments
      .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '"STR"'); // strings → placeholder

    // Tokenizar: keywords, identificadores, operadores
    const tokens = cleanCode.match(/[a-zA-Z_$][a-zA-Z0-9_$]*|[+\-*/%=<>!&|^~?.,:;]+|[0-9]+(?:\.[0-9]+)?/g) || [];

    for (const token of tokens) {
      if (this.operators.has(token)) {
        operatorCounts.set(token, (operatorCounts.get(token) || 0) + 1);
      } else {
        operandCounts.set(token, (operandCounts.get(token) || 0) + 1);
      }
    }

    const n1 = operatorCounts.size;                     // η1
    const n2 = Math.max(operandCounts.size, 1);         // η2 (min 1 para evitar div/0)
    const N1 = [...operatorCounts.values()].reduce((s, c) => s + c, 0);
    const N2 = [...operandCounts.values()].reduce((s, c) => s + c, 0);

    const vocabulary = n1 + n2;                                          // η
    const length = N1 + N2;                                              // N
    const volume = length > 0 && vocabulary > 1
      ? Math.round(length * Math.log2(vocabulary) * 100) / 100
      : 0;                                                               // V
    const difficulty = n2 > 0
      ? Math.round(((n1 / 2) * (N2 / n2)) * 100) / 100
      : 0;                                                               // D
    const effort = Math.round(difficulty * volume * 100) / 100;          // E
    const estimatedTime = Math.round((effort / 18) * 100) / 100;        // T (Stroud)
    const estimatedBugs = Math.round((volume / 3000) * 1000) / 1000;    // B

    return {
      uniqueOperators: n1,
      uniqueOperands: n2,
      totalOperators: N1,
      totalOperands: N2,
      vocabulary,
      length,
      volume,
      difficulty,
      effort,
      estimatedTime,
      estimatedBugs,
    };
  }

  private analyzeMaintainability(sourceDir: string, issues: ValidationIssue[]): MaintainabilityMetrics {
    let totalCyclomaticComplexity = 0;
    let namingIssues = 0;
    let missingDocs = 0;
    let functionCount = 0;
    let duplicationPercentage = 0;

    try {
      const files = this.getAllFiles(sourceDir);
      const fileContents = new Map<string, string>();

      for (const file of files.filter(f => f.endsWith('.ts') || f.endsWith('.js'))) {
        const content = fs.readFileSync(file, 'utf-8');
        fileContents.set(file, content);
      }

      for (const [file, content] of fileContents) {
        const lines = content.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];

          // Detectar definições de função
          if (/^\s*(export\s+)?(async\s+)?function\s+|^\s*const\s+\w+\s*=\s*(\(|async\s*\()/g.test(line)) {
            functionCount++;

            // Calcular complexidade ciclomática
            const complexity = this.calculateComplexity(line);
            totalCyclomaticComplexity += complexity;

            if (complexity > this.maxCyclomaticComplexity) {
              issues.push(this.createIssue('warning', 'HIGH_COMPLEXITY',
                `Function has cyclomatic complexity of ${complexity} (threshold: ${this.maxCyclomaticComplexity})`,
                { file, line: lineNum + 1, suggestion: 'Consider breaking down this function into smaller, more focused functions' },
              ));
            }

            // Verificar comprimento da função
            const funcLength = this.getFunctionLength(lines, lineNum);
            if (funcLength > this.maxFunctionLength) {
              issues.push(this.createIssue('warning', 'LONG_FUNCTION',
                `Function is ${funcLength} lines long (threshold: ${this.maxFunctionLength})`,
                { file, line: lineNum + 1, suggestion: 'Consider refactoring into smaller functions with single responsibility' },
              ));
            }

            // Verificar documentação
            if (lineNum > 0 && !/^\s*\/\//g.test(lines[lineNum - 1]) && !/^\s*\/\*/g.test(lines[lineNum - 1])) {
              missingDocs++;
              issues.push(this.createIssue('info', 'MISSING_DOCS',
                'Function lacks documentation comment',
                { file, line: lineNum + 1, suggestion: 'Add JSDoc or inline comments explaining function purpose and parameters' },
              ));
            }
          }

          // Verificar convenções de nomenclatura
          const varMatch = line.match(/const\s+([a-z_$][a-z0-9_$]*)|let\s+([a-z_$][a-z0-9_$]*)/gi);
          if (varMatch) {
            for (const match of varMatch) {
              const varName = match.split(/\s+/)[1];
              if (varName.length < 2 || /[A-Z]/.test(varName)) {
                namingIssues++;
                issues.push(this.createIssue('info', 'NAMING_CONVENTION',
                  `Variable name '${varName}' doesn't follow conventions`,
                  { file, line: lineNum + 1, suggestion: 'Use camelCase for variables and descriptive names' },
                ));
              }
            }
          }
        }
      }

      // Calcular duplicação de código
      duplicationPercentage = this.calculateDuplication(fileContents);

      // Calcular métricas de Halstead agregadas
      const allCode = [...fileContents.values()].join('\n');
      const halstead = this.calculateHalstead(allCode);

      // Alertar sobre alta dificuldade de Halstead
      if (halstead.difficulty > 50) {
        issues.push(this.createIssue('warning', 'HALSTEAD_DIFFICULTY',
          `High Halstead difficulty: ${halstead.difficulty} (code is hard to understand/maintain)`,
          { suggestion: 'Simplify logic, extract helper functions, reduce variable reuse' },
        ));
      }

      // Alertar sobre alto volume (código denso)
      if (halstead.volume > 5000) {
        issues.push(this.createIssue('info', 'HALSTEAD_VOLUME',
          `High code volume: ${halstead.volume} (consider splitting into modules)`,
          { suggestion: 'Break large files into smaller, focused modules' },
        ));
      }

      if (functionCount === 0) functionCount = 1;

      const maintainabilityIndex = this.calculateMaintainabilityIndex(
        functionCount,
        totalCyclomaticComplexity,
        missingDocs,
        duplicationPercentage,
        halstead,
      );

      return {
        cyclomaticComplexity: Math.round(totalCyclomaticComplexity / Math.max(functionCount, 1)),
        functionLength: this.maxFunctionLength,
        namingQuality: Math.max(100 - namingIssues * 5, 0),
        documentationCoverage: Math.round(((functionCount - missingDocs) / Math.max(functionCount, 1)) * 100),
        duplicationPercentage,
        maintainabilityIndex,
        halstead,
      } as MaintainabilityMetrics & { halstead: HalsteadMetrics };
    } catch (error) {
      issues.push(this.createIssue('error', 'ANALYSIS_ERROR',
        `Error analyzing maintainability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ));
    }

    return {
      cyclomaticComplexity: 0,
      functionLength: this.maxFunctionLength,
      namingQuality: 100,
      documentationCoverage: 0,
      duplicationPercentage: 0,
      maintainabilityIndex: 0,
    };
  }

  private calculateComplexity(line: string): number {
    let complexity = 1;
    complexity += (line.match(/if\s*\(/gi) || []).length;
    complexity += (line.match(/else\s*if\s*\(/gi) || []).length;
    complexity += (line.match(/\?.*:/g) || []).length;
    complexity += (line.match(/for\s*\(|foreach|while\s*\(/gi) || []).length;
    complexity += (line.match(/catch\s*\(/gi) || []).length;
    complexity += (line.match(/&&|\|\|/g) || []).length * 0.5;
    return Math.max(complexity, 1);
  }

  private getFunctionLength(lines: string[], startLine: number): number {
    let braceCount = 0;
    let isInFunction = false;
    let length = 0;

    for (let i = startLine; i < lines.length && i < startLine + 200; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      length++;

      if (braceCount > 0) isInFunction = true;
      if (isInFunction && braceCount === 0) break;
    }

    return length;
  }

  private calculateDuplication(fileContents: Map<string, string>): number {
    let totalLines = 0;
    let duplicateLines = 0;
    const lineMap = new Map<string, number>();

    for (const content of fileContents.values()) {
      const lines = content.split('\n').filter(l => l.trim().length > 10);
      totalLines += lines.length;

      for (const line of lines) {
        const normalized = line.trim();
        lineMap.set(normalized, (lineMap.get(normalized) || 0) + 1);
      }
    }

    for (const count of lineMap.values()) {
      if (count > 1) {
        duplicateLines += count - 1;
      }
    }

    return totalLines > 0 ? Math.round((duplicateLines / totalLines) * 100) : 0;
  }

  private calculateMaintainabilityIndex(
    functionCount: number,
    totalComplexity: number,
    missingDocs: number,
    duplication: number,
    halstead?: HalsteadMetrics,
  ): number {
    const avgComplexity = Math.max(totalComplexity / Math.max(functionCount, 1), 1);
    const docCoverage = Math.max(100 - (missingDocs / Math.max(functionCount, 1)) * 100, 0);
    const duplicationScore = Math.max(100 - duplication, 0);
    const complexityScore = Math.max(100 - avgComplexity * 5, 0);

    // Se Halstead disponível, incorporar no índice
    // Difficulty > 30 começa a penalizar; cap em 100
    if (halstead && halstead.vocabulary > 0) {
      const halsteadScore = Math.max(100 - halstead.difficulty, 0);

      // Pesos: complexidade 30%, docs 25%, duplicação 25%, halstead 20%
      const index = (
        complexityScore * 0.30 +
        docCoverage * 0.25 +
        duplicationScore * 0.25 +
        halsteadScore * 0.20
      );
      return Math.round(Math.min(index, 100));
    }

    // Fallback sem Halstead (comportamento anterior)
    const index = (docCoverage * 0.3 + duplicationScore * 0.3 + complexityScore * 0.4);
    return Math.round(Math.min(index, 100));
  }
}
