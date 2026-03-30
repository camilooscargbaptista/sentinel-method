import * as fs from 'fs';
import { BaseValidator } from './base';

/**
 * Métricas de internacionalização coletadas durante a validação
 */
export interface I18nMetrics {
  hardcodedStrings: number;
  dateFormatting: number;
  currencyFormatting: number;
  missingLocale: number;
  hardcodedPlurals: number;
  stringConcatenation: number;
  hardcodedJsxText: number;
}

/**
 * Validador de Internacionalização (i18n/L10n) para o Sentinel Method
 *
 * Detecta strings hardcoded, formatação de data/moeda/número sem localização,
 * parâmetros de locale ausentes, pluralização manual e texto hardcoded em JSX.
 */
export class I18nValidator extends BaseValidator {
  readonly name = 'Internationalization';

  private metrics: I18nMetrics = {
    hardcodedStrings: 0,
    dateFormatting: 0,
    currencyFormatting: 0,
    missingLocale: 0,
    hardcodedPlurals: 0,
    stringConcatenation: 0,
    hardcodedJsxText: 0,
  };








  /**
   * Valida o diretório de fonte em busca de problemas de internacionalização
   */
  validate(sourceDir: string) {
    this.metrics = {
      hardcodedStrings: 0,
      dateFormatting: 0,
      currencyFormatting: 0,
      missingLocale: 0,
      hardcodedPlurals: 0,
      stringConcatenation: 0,
      hardcodedJsxText: 0,
    };

    const files = this.getSourceFiles(sourceDir);
    const issues: any[] = [];

    for (const filePath of files) {
      const content = this.readFile(filePath);
      if (!content) continue;

      // Verificar strings hardcoded em contextos de interface
      this.checkHardcodedStrings(content, issues);

      // Verificar formatação de data manual
      this.checkDateFormatting(content, issues);

      // Verificar formatação de moeda/número
      this.checkCurrencyFormatting(content, issues);

      // Verificar uso de Intl API sem locale explícito
      this.checkMissingLocale(content, issues);

      // Verificar pluralização manual
      this.checkHardcodedPlurals(content, issues);

      // Verificar concatenação de strings
      this.checkStringConcatenation(content, issues);

      // Verificar texto hardcoded em JSX
      this.checkHardcodedJsxText(content, issues);
    }

    const score = this.calculateScore();
    const passed = score >= 60;

    return this.buildResult(
      passed,
      issues,
      this.metrics,
      score,
      60
    );
  }

  /**
   * Verifica strings hardcoded em contextos de interface
   */
  private checkHardcodedStrings(content: string, issues: any[]) {
    // Ignorar imports, type annotations, URLs
    const sanitized = this.removeImports(this.removeTypeAnnotations(content));

    // Detectar console messages, alert, toast
    const consolePattern = /console\.(log|warn|error)\s*\(\s*['"`]([^'"`]{3,})['"`]/g;
    let match;

    while ((match = consolePattern.exec(sanitized)) !== null) {
      // Ignorar URLs e caminhos
      if (this.isUrlOrPath(match[2])) continue;

      this.metrics.hardcodedStrings++;
      issues.push(
        this.createIssue(
          'warning',
          'I18N_HARDCODED_STRING',
          `Hardcoded user-facing string in ${match[1]}(): "${match[2]}"`,
          { line: this.getLineNumber(sanitized, match.index), suggestion: match[0] }
        )
      );
    }

    // Detectar alert() e toast()
    const alertPattern = /(?:alert|toast)\s*\(\s*['"`]([^'"`]{3,})['"`]/g;
    while ((match = alertPattern.exec(sanitized)) !== null) {
      if (this.isUrlOrPath(match[1])) continue;

      this.metrics.hardcodedStrings++;
      issues.push(
        this.createIssue(
          'warning',
          'I18N_HARDCODED_STRING',
          `Hardcoded string in alert/toast: "${match[1]}"`,
          { line: this.getLineNumber(sanitized, match.index), suggestion: match[0] }
        )
      );
    }
  }

  /**
   * Verifica formatação de data manual
   */
  private checkDateFormatting(content: string, issues: any[]) {
    // toLocaleDateString() sem locale
    const localeDatePattern = /\.toLocaleDateString\s*\(\s*\)/g;
    let match;

    while ((match = localeDatePattern.exec(content)) !== null) {
      this.metrics.dateFormatting++;
      issues.push(
        this.createIssue(
          'warning',
          'I18N_DATE_FORMATTING',
          'toLocaleDateString() called without explicit locale parameter',
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }

    // Acesso manual a componentes de data
    const manualDatePattern = /\.(getMonth|getFullYear|getDate|getHours|getMinutes)\(\)/g;
    while ((match = manualDatePattern.exec(content)) !== null) {
      // Verificar se está em contexto de formatação (template string, concatenação)
      const context = content.substring(
        Math.max(0, match.index - 50),
        Math.min(content.length, match.index + 100)
      );

      if (/[`+$]/.test(context)) {
        this.metrics.dateFormatting++;
        issues.push(
          this.createIssue(
            'warning',
            'I18N_DATE_FORMATTING',
            `Manual date formatting detected: ${match[0]} - use Intl.DateTimeFormat instead`,
            { line: this.getLineNumber(content, match.index), suggestion: match[0] }
          )
        );
      }
    }
  }

  /**
   * Verifica formatação de moeda/número manual
   */
  private checkCurrencyFormatting(content: string, issues: any[]) {
    // Símbolos de moeda hardcoded
    // eslint-disable-next-line no-useless-escape
    const currencySymbolPattern = /['"`]\s*[$€£¥₹]\s*['"`]|['"`]R\$['"`]/g;
    let match;

    while ((match = currencySymbolPattern.exec(content)) !== null) {
      // Ignorar CSS values
      if (this.isCssValue(content, match.index)) continue;

      this.metrics.currencyFormatting++;
      issues.push(
        this.createIssue(
          'warning',
          'I18N_CURRENCY_FORMATTING',
          `Hardcoded currency symbol: ${match[0]} - use Intl.NumberFormat instead`,
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }

    // .toFixed() sem formatação apropriada
    const toFixedPattern = /\.toFixed\s*\(\s*(\d+)\s*\)/g;
    while ((match = toFixedPattern.exec(content)) !== null) {
      // Verificar contexto - se é para moeda/número
      const context = content.substring(
        Math.max(0, match.index - 50),
        Math.min(content.length, match.index + 50)
      );

      if (/(?:price|currency|amount|cost|total|fee|rate)\s*[:=]|return/.test(context)) {
        this.metrics.currencyFormatting++;
        issues.push(
          this.createIssue(
            'warning',
            'I18N_CURRENCY_FORMATTING',
            `toFixed(${match[1]}) detected - use Intl.NumberFormat for proper localization`,
            { line: this.getLineNumber(content, match.index), suggestion: match[0] }
          )
        );
      }
    }
  }

  /**
   * Verifica uso de Intl API sem locale explícito
   */
  private checkMissingLocale(content: string, issues: any[]) {
    // Intl.NumberFormat sem locale
    const numberFormatPattern = /new\s+Intl\.NumberFormat\s*\(\s*(?:\)|undefined|null)\s*\)/g;
    let match;

    while ((match = numberFormatPattern.exec(content)) !== null) {
      this.metrics.missingLocale++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_MISSING_LOCALE',
          'Intl.NumberFormat instantiated without explicit locale parameter',
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }

    // Intl.DateTimeFormat sem locale
    const dateFormatPattern = /new\s+Intl\.DateTimeFormat\s*\(\s*(?:\)|undefined|null)\s*\)/g;
    while ((match = dateFormatPattern.exec(content)) !== null) {
      this.metrics.missingLocale++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_MISSING_LOCALE',
          'Intl.DateTimeFormat instantiated without explicit locale parameter',
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }

    // toLocaleString sem locale
    const localeStringPattern = /\.toLocaleString\s*\(\s*\)/g;
    while ((match = localeStringPattern.exec(content)) !== null) {
      this.metrics.missingLocale++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_MISSING_LOCALE',
          'toLocaleString() called without explicit locale parameter',
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }
  }

  /**
   * Verifica pluralização manual
   */
  private checkHardcodedPlurals(content: string, issues: any[]) {
    // Ternário simples para pluralização (count === 1 ? 'item' : 'items')
    const pluralTernaryPattern = /\bcount\s*===\s*1\s*\?\s*['"`](\w+)['"`]\s*:\s*['"`](\w+s?)['"`]/g;
    let match;

    while ((match = pluralTernaryPattern.exec(content)) !== null) {
      this.metrics.hardcodedPlurals++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_HARDCODED_PLURAL',
          `Naive pluralization detected: ${match[0]} - use Intl.PluralRules instead`,
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }

    // String + 's' pattern
    const stringPluralPattern = /['"`](\w+)['"`]\s*\+\s*['"`]s['"`]/g;
    while ((match = stringPluralPattern.exec(content)) !== null) {
      this.metrics.hardcodedPlurals++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_HARDCODED_PLURAL',
          `String concatenation for pluralization: ${match[0]} - use Intl.PluralRules`,
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }
  }

  /**
   * Verifica concatenação de strings para mensagens
   */
  private checkStringConcatenation(content: string, issues: any[]) {
    // 'Hello ' + variable + ', welcome' pattern
    const concatPattern = /['"`]([^'"`]{5,})['"`]\s*\+\s*\w+\s*\+\s*['"`]([^'"`]{3,})['"`]/g;
    let match;

    while ((match = concatPattern.exec(content)) !== null) {
      this.metrics.stringConcatenation++;
      issues.push(
        this.createIssue(
          'info',
          'I18N_STRING_CONCATENATION',
          'String concatenation for message building - use template functions instead',
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }
  }

  /**
   * Verifica texto hardcoded em JSX
   */
  private checkHardcodedJsxText(content: string, issues: any[]) {
    // <tag>Text Content</tag> pattern - texto que começa com letra maiúscula
    const jsxTextPattern = /<(button|h[1-6]|p|span|div|a|label|li|td|th|option)[^>]*>([A-Z][^<{]*?)<\/\1>/g;
    let match;

    while ((match = jsxTextPattern.exec(content)) !== null) {
      const text = match[2].trim();

      // Ignorar muito curto ou comum
      if (text.length < 2 || /^\d+$/.test(text)) continue;

      // Ignorar se contém template/variáveis
      if (/\$\{|\{|\.|\[|\]/.test(text)) continue;

      this.metrics.hardcodedJsxText++;
      issues.push(
        this.createIssue(
          'warning',
          'I18N_HARDCODED_JSX_TEXT',
          `Hardcoded text in JSX <${match[1]}>: "${text}" - wrap in translation function`,
          { line: this.getLineNumber(content, match.index), suggestion: match[0] }
        )
      );
    }
  }

  /**
   * Remove imports para análise
   */
  private removeImports(content: string): string {
    return content.replace(/^import\s+.*?from\s+['"`].*?['"`];?/gm, '');
  }

  /**
   * Remove type annotations para análise
   */
  private removeTypeAnnotations(content: string): string {
    return content.replace(/:\s*(?:string|number|boolean|any|unknown|void|never|object|interface|type)\b/g, '');
  }

  /**
   * Verifica se um texto é URL ou caminho
   */
  private isUrlOrPath(text: string): boolean {
    return /^(?:https?:\/\/|\/|\.\/|\.\.\/)/.test(text) || /\.[a-z]{2,}$/.test(text);
  }

  /**
   * Verifica se o match está em valor CSS
   */
  private isCssValue(content: string, index: number): boolean {
    const before = content.substring(Math.max(0, index - 30), index);
    return /(?:color|background|border|font|style)\s*[:=]/.test(before);
  }

  /**
   * Obtém o número da linha para um índice
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Lê conteúdo do arquivo
   */
  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Calcula o score de i18n
   */
  private calculateScore(): number {
    const penalties =
      (this.metrics.hardcodedStrings * 2) +
      (this.metrics.dateFormatting * 3) +
      (this.metrics.currencyFormatting * 3) +
      (this.metrics.missingLocale * 1) +
      (this.metrics.hardcodedPlurals * 2) +
      (this.metrics.stringConcatenation * 1) +
      (this.metrics.hardcodedJsxText * 2);

    return Math.max(0, 100 - penalties);
  }
}
