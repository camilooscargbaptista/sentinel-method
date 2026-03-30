import * as fs from 'fs';
import { BaseValidator } from './base';
import {
  checkMissingAltAttributes,
  checkMissingAriaLabels,
  checkNonSemanticClickable,
  checkMissingFormLabels,
  checkPositiveTabindex,
  checkEmptyLinksButtons,
  checkAutoplayingMedia,
  checkHeadingHierarchy,
  checkColorOnlyInformation,
  calculateScore,
} from './accessibility-helpers';

/**
 * Interface para métricas de acessibilidade (WCAG)
 */
export interface AccessibilityMetrics {
  missingAltCount: number;
  missingAriaLabelsCount: number;
  nonSemanticElementsCount: number;
  missingFormLabelsCount: number;
  missingLangAttributeCount: number;
  positiveTabindexCount: number;
  emptyLinksButtonsCount: number;
  autoplayMediaCount: number;
  headingHierarchyIssuesCount: number;
  colorOnlyInfoCount: number;
}

/**
 * Validador de acessibilidade para detectar problemas WCAG 2.1
 * Analisa arquivos .tsx, .jsx, .html, .vue, .svelte
 */
export class AccessibilityValidator extends BaseValidator {
  readonly name = 'Accessibility (WCAG)';
  private readonly threshold = 70;
  private readonly supportedExtensions = ['.tsx', '.jsx', '.html', '.vue', '.svelte', '.ts', '.js'];

  /**
   * Executa a validação de acessibilidade no diretório source
   */
  public validate(sourceDir: string) {
    const files = this.getAllFiles(sourceDir);
    const issues: any[] = [];
    const metrics: AccessibilityMetrics = {
      missingAltCount: 0,
      missingAriaLabelsCount: 0,
      nonSemanticElementsCount: 0,
      missingFormLabelsCount: 0,
      missingLangAttributeCount: 0,
      positiveTabindexCount: 0,
      emptyLinksButtonsCount: 0,
      autoplayMediaCount: 0,
      headingHierarchyIssuesCount: 0,
      colorOnlyInfoCount: 0,
    };

    // Filtrar apenas arquivos suportados
    const relevantFiles = files.filter(file =>
      this.supportedExtensions.some(ext => file.endsWith(ext))
    );

    for (const file of relevantFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Executar validações específicas por tipo de arquivo
      if (file.endsWith('.html')) {
        this.validateHtmlFile(file, content, issues, metrics);
      } else if (file.endsWith('.vue') || file.endsWith('.svelte')) {
        this.validateFrameworkFile(file, content, issues, metrics);
      } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        this.validateJsxFile(file, content, issues, metrics);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        this.validateJavaScriptFile(file, content, issues, metrics);
      }
    }

    // Calcular score baseado em penalidades
    const score = calculateScore(metrics);
    const passed = score >= this.threshold && issues.length === 0;

    return this.buildResult(
      passed,
      issues,
      {
        metrics,
        totalIssues: issues.length,
        filesAnalyzed: relevantFiles.length,
      },
      score,
      this.threshold
    );
  }

  /**
   * Valida arquivo HTML
   */
  private validateHtmlFile(
    filePath: string,
    content: string,
    issues: any[],
    metrics: AccessibilityMetrics
  ): void {
    // Verificar atributo lang
    if (!/<html[^>]*\slang=/i.test(content) && !/<html[^>]*lang=/i.test(content)) {
      issues.push(
        this.createIssue(
          'warning',
          'WCAG-2.4.1',
          'Missing lang attribute on html element',
          { file: filePath, line: 1 }
        )
      );
      metrics.missingLangAttributeCount++;
    }

    // Executar validações comuns
    this.validateCommonAccessibilityIssues(filePath, content, issues, metrics);
  }

  /**
   * Valida arquivo de framework (Vue, Svelte)
   */
  private validateFrameworkFile(
    filePath: string,
    content: string,
    issues: any[],
    metrics: AccessibilityMetrics
  ): void {
    this.validateCommonAccessibilityIssues(filePath, content, issues, metrics);
  }

  /**
   * Valida arquivo JSX/TSX
   */
  private validateJsxFile(
    filePath: string,
    content: string,
    issues: any[],
    metrics: AccessibilityMetrics
  ): void {
    this.validateCommonAccessibilityIssues(filePath, content, issues, metrics);
  }

  /**
   * Valida arquivo JavaScript/TypeScript
   */
  private validateJavaScriptFile(
    filePath: string,
    content: string,
    issues: any[],
    metrics: AccessibilityMetrics
  ): void {
    // Procurar por padrões de createElement que podem ter problemas de acessibilidade
    const createElementRegex = /document\.createElement\s*\(\s*['"](\w+)['"]\s*\)/g;
    let match;

    while ((match = createElementRegex.exec(content)) !== null) {
      const tagName = match[1].toLowerCase();

      // Verificar se estão criando divs clicáveis sem acessibilidade
      if (tagName === 'div') {
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 500);
        const context = content.substring(contextStart, contextEnd);

        if (/\.addEventListener\s*\(\s*['"]click['"]\s*,/.test(context)) {
          const line = this.getLineNumber(content, match.index);
          issues.push(
            this.createIssue(
              'warning',
              'WCAG-4.1.3',
              'Non-semantic element (div) used as clickable. Use button instead.',
              { file: filePath, line }
            )
          );
          metrics.nonSemanticElementsCount++;
        }
      }
    }

    this.validateCommonAccessibilityIssues(filePath, content, issues, metrics);
  }

  /**
   * Valida problemas de acessibilidade comuns em todos os tipos de arquivo
   */
  private validateCommonAccessibilityIssues(
    filePath: string,
    content: string,
    issues: any[],
    metrics: AccessibilityMetrics
  ): void {
    checkMissingAltAttributes(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkMissingAriaLabels(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkNonSemanticClickable(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkMissingFormLabels(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkPositiveTabindex(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkEmptyLinksButtons(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkAutoplayingMedia(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkHeadingHierarchy(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
    checkColorOnlyInformation(filePath, content, issues, metrics, this.createIssue.bind(this), this.getLineNumber.bind(this));
  }


  /**
   * Lê conteúdo do arquivo
   */
  private readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Obtém o número da linha de um índice no conteúdo
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
}
