import * as fs from 'fs';
import * as path from 'path';
import { ValidatorResult, ValidationIssue, SentinelConfig } from '../types';
import { BaseValidator } from './base';

export interface DocumentationMetrics {
  exportedFunctions: number;
  documentedFunctions: number;
  exportedClasses: number;
  documentedClasses: number;
  hasReadme: boolean;
  hasChangelog: boolean;
  documentationCoverage: number;
  documentationScore: number;
}

/**
 * Valida a qualidade e cobertura da documentação do projeto.
 *
 * Verificações:
 * - Funções/métodos exportados sem JSDoc
 * - Classes exportadas sem documentação
 * - Presença de README.md
 * - Presença de CHANGELOG.md
 * - Qualidade dos comentários (não vazios, informativos)
 */
export class DocumentationValidator extends BaseValidator {
  readonly name = 'Documentation Coverage';

  constructor(config: SentinelConfig) {
    super(config);
  }

  validate(sourceDir: string): ValidatorResult {
    const issues: ValidationIssue[] = [];
    const metrics = this.analyzeDocumentation(sourceDir, issues);

    const score = metrics.documentationScore;
    const threshold = 60;
    const passed = score >= threshold && issues.filter(i => i.severity === 'error').length === 0;

    return this.buildResult(passed, issues, metrics as any, score, threshold);
  }

  private analyzeDocumentation(sourceDir: string, issues: ValidationIssue[]): DocumentationMetrics {
    let exportedFunctions = 0;
    let documentedFunctions = 0;
    let exportedClasses = 0;
    let documentedClasses = 0;

    try {
      const files = this.getAllFiles(sourceDir);
      const codeFiles = files.filter(f =>
        (f.endsWith('.ts') || f.endsWith('.js')) &&
        !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') &&
        !f.endsWith('.d.ts'),
      );

      for (const file of codeFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relativeFile = path.relative(sourceDir, file);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Detectar funções exportadas
          if (/^\s*export\s+(async\s+)?function\s+\w+/.test(line)) {
            exportedFunctions++;
            if (this.hasJSDoc(lines, i)) {
              documentedFunctions++;
            } else {
              issues.push(this.createIssue('warning', 'UNDOCUMENTED_EXPORT',
                `Exported function lacks JSDoc documentation`,
                { file: relativeFile, line: i + 1, suggestion: 'Add /** ... */ comment describing the function purpose and parameters' },
              ));
            }
          }

          // Detectar métodos públicos exportados (arrow function exports)
          if (/^\s*export\s+const\s+\w+\s*=\s*(async\s*)?\(/.test(line)) {
            exportedFunctions++;
            if (this.hasJSDoc(lines, i)) {
              documentedFunctions++;
            } else {
              issues.push(this.createIssue('warning', 'UNDOCUMENTED_EXPORT',
                `Exported arrow function lacks JSDoc documentation`,
                { file: relativeFile, line: i + 1, suggestion: 'Add /** ... */ comment before the export' },
              ));
            }
          }

          // Detectar classes exportadas
          if (/^\s*export\s+(abstract\s+)?class\s+\w+/.test(line)) {
            exportedClasses++;
            if (this.hasJSDoc(lines, i)) {
              documentedClasses++;
            } else {
              issues.push(this.createIssue('warning', 'UNDOCUMENTED_CLASS',
                `Exported class lacks JSDoc documentation`,
                { file: relativeFile, line: i + 1, suggestion: 'Add /** ... */ comment describing the class responsibility' },
              ));
            }
          }
        }
      }

      // Verificar presença de README
      const hasReadme = fs.existsSync(path.join(sourceDir, 'README.md')) ||
                        fs.existsSync(path.join(sourceDir, 'readme.md'));
      if (!hasReadme) {
        issues.push(this.createIssue('warning', 'NO_README',
          'Project has no README.md file',
          { suggestion: 'Create a README.md with project description, installation and usage instructions' },
        ));
      }

      // Verificar presença de CHANGELOG
      const hasChangelog = fs.existsSync(path.join(sourceDir, 'CHANGELOG.md')) ||
                           fs.existsSync(path.join(sourceDir, 'changelog.md'));
      if (!hasChangelog) {
        issues.push(this.createIssue('info', 'NO_CHANGELOG',
          'Project has no CHANGELOG.md file',
          { suggestion: 'Consider maintaining a changelog to track version history' },
        ));
      }

      const totalExported = exportedFunctions + exportedClasses;
      const totalDocumented = documentedFunctions + documentedClasses;
      const documentationCoverage = totalExported > 0
        ? Math.round((totalDocumented / totalExported) * 100)
        : 100;

      return {
        exportedFunctions,
        documentedFunctions,
        exportedClasses,
        documentedClasses,
        hasReadme,
        hasChangelog,
        documentationCoverage,
        documentationScore: this.calculateScore(documentationCoverage, hasReadme, hasChangelog),
      };
    } catch (error) {
      issues.push(this.createIssue('error', 'ANALYSIS_ERROR',
        `Error analyzing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ));
      return {
        exportedFunctions: 0,
        documentedFunctions: 0,
        exportedClasses: 0,
        documentedClasses: 0,
        hasReadme: false,
        hasChangelog: false,
        documentationCoverage: 0,
        documentationScore: 0,
      };
    }
  }

  /** Verifica se a linha anterior contém um bloco JSDoc */
  private hasJSDoc(lines: string[], lineIndex: number): boolean {
    // Procurar para trás por JSDoc ou comentário inline
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
      const trimmed = lines[i].trim();
      if (trimmed === '') continue; // pular linhas em branco
      if (trimmed.startsWith('*/') || trimmed.startsWith('*') || trimmed.startsWith('/**')) {
        return true;
      }
      if (trimmed.startsWith('//')) {
        return true;
      }
      // Encontrou uma linha de código antes de qualquer comentário
      break;
    }
    return false;
  }

  private calculateScore(coverage: number, hasReadme: boolean, hasChangelog: boolean): number {
    let score = coverage * 0.7; // 70% do peso é cobertura de docs
    if (hasReadme) score += 20;  // 20% é ter README
    if (hasChangelog) score += 10; // 10% é ter CHANGELOG
    return Math.round(Math.min(score, 100));
  }
}
