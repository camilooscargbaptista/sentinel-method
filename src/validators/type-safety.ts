import * as fs from 'fs';
import * as path from 'path';
import { ValidatorResult, ValidationIssue, SentinelConfig } from '../types';
import { BaseValidator } from './base';

/**
 * Interface de métricas para análise de segurança de tipos.
 *
 * Rastreia issues de type safety encontradas no código TypeScript.
 */
export interface TypeSafetyMetrics {
  filesAnalyzed: number;
  anyUsage: number;
  typeAssertions: number;
  nonNullAssertions: number;
  missingReturnTypes: number;
  implicitAnyParameters: number;
  unsafeOptionalChaining: number;
  tsIgnoreDirectives: number;
  looseEquality: number;
  typeSafetyScore: number;
}

/**
 * Valida a segurança de tipos em arquivos TypeScript.
 *
 * Verificações:
 * - Uso explícito de `any` (`: any`, `as any`, `<any>`)
 * - Type assertions/casting (`: SomeType`, `<SomeType>`)
 * - Non-null assertions (`variable!.property`)
 * - Funções exportadas sem return type explícito
 * - Parâmetros de função sem type annotation
 * - Optional chaining profundo sem null checks
 * - Diretivas @ts-ignore e @ts-nocheck
 * - Igualdade frouxa (== em vez de ===)
 */
export class TypeSafetyValidator extends BaseValidator {
  readonly name = 'Type Safety';

  constructor(config: SentinelConfig) {
    super(config);
  }

  /**
   * Executa a validação completa de type safety.
   *
   * @param sourceDir - Diretório raiz do projeto
   * @returns Resultado padronizado da validação
   */
  validate(sourceDir: string): ValidatorResult {
    const issues: ValidationIssue[] = [];
    const metrics = this.analyzeTypeSafety(sourceDir, issues);

    const score = metrics.typeSafetyScore;
    const threshold = 70;
    const passed = score >= threshold && issues.filter(i => i.severity === 'error').length === 0;

    return this.buildResult(passed, issues, metrics as any, score, threshold);
  }

  /**
   * Analisa type safety em todos os arquivos TypeScript.
   *
   * @param sourceDir - Diretório raiz
   * @param issues - Array para coletar issues encontradas
   * @returns Métricas consolidadas
   */
  private analyzeTypeSafety(sourceDir: string, issues: ValidationIssue[]): TypeSafetyMetrics {
    let filesAnalyzed = 0;
    let anyUsage = 0;
    let typeAssertions = 0;
    let nonNullAssertions = 0;
    let missingReturnTypes = 0;
    let implicitAnyParameters = 0;
    let unsafeOptionalChaining = 0;
    let tsIgnoreDirectives = 0;
    let looseEquality = 0;

    try {
      const files = this.getAllFiles(sourceDir);
      const tsFiles = files.filter(f =>
        (f.endsWith('.ts') || f.endsWith('.tsx')) &&
        !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') &&
        !f.endsWith('.d.ts'),
      );

      for (const file of tsFiles) {
        filesAnalyzed++;
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relativeFile = path.relative(sourceDir, file);

        // Análises por linha
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // 1. Diretivas @ts-ignore e @ts-nocheck (severity: error)
          if (/@ts-ignore|@ts-nocheck/i.test(trimmed)) {
            tsIgnoreDirectives++;
            issues.push(this.createIssue('error', 'TS_IGNORE_DIRECTIVE',
              'Type checking suppression directive found (@ts-ignore or @ts-nocheck)',
              { file: relativeFile, line: i + 1, suggestion: 'Fix underlying type errors instead of suppressing them' },
            ));
          }

          // 2. Uso explícito de `any` (severity: warning)
          // Padrões: `: any`, `as any`, `<any>`
          if (/:\s*any\b|as\s+any\b|<any>/.test(line) && !trimmed.startsWith('//')) {
            anyUsage++;
            issues.push(this.createIssue('warning', 'EXPLICIT_ANY',
              'Explicit `any` type usage detected',
              { file: relativeFile, line: i + 1, suggestion: 'Use specific types instead of `any`. Consider using `unknown` if type is truly unknown.' },
            ));
          }

          // 3. Non-null assertions (severity: warning)
          // Padrão: `variable!.property` ou `variable!`
          if (/\w+!\s*[.[(]|\w+!\s*;|\w+!\s*$/.test(line) && !trimmed.startsWith('//')) {
            nonNullAssertions++;
            issues.push(this.createIssue('warning', 'NON_NULL_ASSERTION',
              'Non-null assertion operator (!) detected',
              { file: relativeFile, line: i + 1, suggestion: 'Use proper null checks or type guards instead of assertions' },
            ));
          }

          // 4. Type assertions/casting (severity: info)
          // Padrões: `as SomeType`, `<SomeType>`
          if (/\bas\s+\w+\b|<\w+>/.test(line) && !trimmed.startsWith('//')) {
            typeAssertions++;
            issues.push(this.createIssue('info', 'TYPE_ASSERTION',
              'Type assertion/casting detected',
              { file: relativeFile, line: i + 1, suggestion: 'Review type assertions for necessity. Proper typing is preferred.' },
            ));
          }

          // 5. Igualdade frouxa (== em vez de ===)
          // Padrão: == ou != (mas não ===, !==, ==>, <=, >=)
          if (/[^=!<>]==[^=]|[^=!<>]!=[^=]/.test(line) && !trimmed.startsWith('//')) {
            looseEquality++;
            issues.push(this.createIssue('warning', 'LOOSE_EQUALITY',
              'Loose equality operator (== or !=) used',
              { file: relativeFile, line: i + 1, suggestion: 'Use strict equality (=== and !==) instead' },
            ));
          }

          // 6. Unsafe optional chaining (severity: info)
          // Padrão: múltiplas encadeações de optional chaining (3+)
          const optionalChains = (line.match(/\?\./g) || []).length;
          if (optionalChains >= 3) {
            unsafeOptionalChaining++;
            issues.push(this.createIssue('info', 'UNSAFE_OPTIONAL_CHAINING',
              `Deep optional chaining detected (${optionalChains} levels)`,
              { file: relativeFile, line: i + 1, suggestion: 'Consider explicit null checks for better readability' },
            ));
          }
        }

        // Análises globais do arquivo
        const analysisResults = this.analyzeFileStructure(content, relativeFile);
        missingReturnTypes += analysisResults.missingReturnTypes;
        implicitAnyParameters += analysisResults.implicitAnyParameters;

        // Adicionar issues encontradas
        issues.push(...analysisResults.issues);
      }
    } catch (error) {
      issues.push(this.createIssue('error', 'ANALYSIS_ERROR',
        `Error analyzing type safety: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ));
    }

    // Cálculo de score: 100 - penalidades
    // any = 3 cada, ts-ignore = 10, non-null = 2, missing return type = 2, loose equality = 2
    const penalties = anyUsage * 3 + tsIgnoreDirectives * 10 + nonNullAssertions * 2 +
                      missingReturnTypes * 2 + looseEquality * 2;
    const typeSafetyScore = Math.max(100 - penalties, 0);

    return {
      filesAnalyzed,
      anyUsage,
      typeAssertions,
      nonNullAssertions,
      missingReturnTypes,
      implicitAnyParameters,
      unsafeOptionalChaining,
      tsIgnoreDirectives,
      looseEquality,
      typeSafetyScore: Math.min(typeSafetyScore, 100),
    };
  }

  /**
   * Analisa a estrutura de um arquivo TypeScript.
   *
   * Detecta:
   * - Funções exportadas sem return type explícito
   * - Parâmetros sem type annotation
   *
   * @param content - Conteúdo do arquivo
   * @param relativeFile - Caminho relativo do arquivo
   * @returns Resultados da análise estrutural
   */
  private analyzeFileStructure(
    content: string,
    relativeFile: string,
  ): { missingReturnTypes: number; implicitAnyParameters: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let missingReturnTypes = 0;
    let implicitAnyParameters = 0;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Pular linhas de comentário
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // 4. Funções exportadas sem return type explícito (severity: warning)
      // Padrão: export function/const sem ): type {
      if (/^export\s+(function|const|async\s+function)\s+\w+\s*\(/.test(trimmed)) {
        // Procura por pattern de return type
        const funcMatch = trimmed.match(/^export\s+(?:async\s+)?(?:function\s+)?(\w+)\s*\((.*)\)\s*(?::.*)?/);
        if (funcMatch && !trimmed.match(/\)\s*:\s*\w+\s*\{|\)\s*:\s*Promise/)) {
          // Verificar se há return type no próximo contexto (para arrow functions)
          if (!trimmed.includes('=>') || !trimmed.includes(':')) {
            missingReturnTypes++;
            issues.push(this.createIssue('warning', 'MISSING_RETURN_TYPE',
              'Exported function without explicit return type',
              { file: relativeFile, line: i + 1, suggestion: 'Add explicit return type annotation' },
            ));
          }
        }
      }

      // 5. Parâmetros de função sem type annotation em .ts (severity: warning)
      // Padrão: function/const com parâmetro sem type
      const paramMatch = line.match(/\(\s*(\w+)\s*(?:,|:|\))/);
      if (paramMatch && !/:\s*\w+|:\s*\{/.test(line)) {
        // Validação mais rigorosa: tem parênteses mas sem tipo
        if (/function\s+\w+\s*\(/.test(trimmed) || /const\s+\w+\s*=\s*\(/.test(trimmed)) {
          // Verificar se tem parâmetros sem tipo
          const hasParams = /\(\s*\w+\s*[,)]/.test(line);
          const hasTypes = /:\s*[\w[\]<>]+/.test(line);
          if (hasParams && !hasTypes) {
            implicitAnyParameters++;
            issues.push(this.createIssue('warning', 'IMPLICIT_ANY_PARAMETER',
              'Function parameter without type annotation',
              { file: relativeFile, line: i + 1, suggestion: 'Add explicit type annotation to function parameters' },
            ));
          }
        }
      }
    }

    return { missingReturnTypes, implicitAnyParameters, issues };
  }
}
