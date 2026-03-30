import * as fs from 'fs';
import { BaseValidator } from './base';
import {
  extractRouteHandlers,
  hasErrorHandling,
  hasInconsistentStatusCodes,
  hasInputValidation,
  hasResponseType,
  findHardcodedUrls,
  hasAuthMiddleware,
  checkRestNaming,
  isListEndpoint,
  hasPagination,
  findN1QueryPatterns,
  hasRateLimiting,
} from './api-contract-helpers';

/**
 * Métricas do validador de contrato API
 */
export interface ApiContractMetrics {
  totalRoutes: number;
  routesWithErrors: number;
  missingErrorResponses: number;
  inconsistentStatusCodes: number;
  missingInputValidation: number;
  noResponseType: number;
  hardcodedUrls: number;
  missingAuthMiddleware: number;
  restViolations: number;
  missingPagination: number;
  n1Queries: number;
  missingRateLimit: number;
}

/**
 * Validador de contrato API para detecção de problemas em endpoints REST
 * Analisa padrões de roteadores, controladores e handlers de API
 */
export class ApiContractValidator extends BaseValidator {
  readonly name = 'API Contracts';

  private metrics: ApiContractMetrics = {
    totalRoutes: 0,
    routesWithErrors: 0,
    missingErrorResponses: 0,
    inconsistentStatusCodes: 0,
    missingInputValidation: 0,
    noResponseType: 0,
    hardcodedUrls: 0,
    missingAuthMiddleware: 0,
    restViolations: 0,
    missingPagination: 0,
    n1Queries: 0,
    missingRateLimit: 0,
  };

  /**
   * Valida a arquitetura de contrato API dos handlers e rotas
   */
  validate(sourceDir: string) {
    this.metrics = this.resetMetrics();
    const issues: any[] = [];

    const sourceFiles = this.getSourceFiles(sourceDir);

    for (const file of sourceFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Pula arquivos de teste
      if (this.isTestFile(file)) continue;

      const fileIssues = this.analyzeApiContract(file, content);
      issues.push(...fileIssues);
    }

    const score = this.calculateScore(issues.length);
    const threshold = 60;

    return this.buildResult(
      issues.length === 0,
      issues,
      this.metrics,
      score,
      threshold
    );
  }

  /**
   * Analisa contrato API de um arquivo
   */
  private analyzeApiContract(filePath: string, content: string): any[] {
    const issues: any[] = [];

    // Extrai blocos de handlers de rota
    const routeBlocks = extractRouteHandlers(content);

    if (routeBlocks.length === 0) {
      return issues;
    }

    this.metrics.totalRoutes += routeBlocks.length;

    for (const block of routeBlocks) {
      let blockIssues = 0;

      // 1. Verifica respostas de erro ausentes
      if (!hasErrorHandling(block.content)) {
        issues.push(
          this.createIssue(
            'warning',
            'MISSING_ERROR_RESPONSES',
            `Route handler missing error responses (4xx/5xx status codes) in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.missingErrorResponses++;
        blockIssues += 5;
      }

      // 2. Verifica status codes inconsistentes
      if (hasInconsistentStatusCodes(block.content)) {
        issues.push(
          this.createIssue(
            'info',
            'INCONSISTENT_STATUS_CODES',
            `Route uses res.send() without explicit status code in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.inconsistentStatusCodes++;
      }

      // 3. Verifica validação de entrada ausente
      if (!hasInputValidation(block.content)) {
        issues.push(
          this.createIssue(
            'error',
            'MISSING_INPUT_VALIDATION',
            `Route handler missing request body/params validation in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.missingInputValidation++;
        blockIssues += 5;
      }

      // 4. Verifica type/schema de resposta ausente
      if (!hasResponseType(block.content)) {
        issues.push(
          this.createIssue(
            'warning',
            'NO_RESPONSE_TYPE',
            `API response missing type annotation or schema definition in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.noResponseType++;
      }

      // 5. Verifica URLs hardcoded
      const hardcodedUrls = findHardcodedUrls(block.content);
      if (hardcodedUrls.length > 0) {
        issues.push(
          this.createIssue(
            'warning',
            'HARDCODED_URLS',
            `Found hardcoded API URLs instead of constants/config (${hardcodedUrls.length} occurrences) in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.hardcodedUrls += hardcodedUrls.length;
        blockIssues += 2 * hardcodedUrls.length;
      }

      // 6. Verifica middleware de autenticação ausente
      if (!hasAuthMiddleware(block.content)) {
        issues.push(
          this.createIssue(
            'info',
            'MISSING_AUTH_MIDDLEWARE',
            `Route without authentication middleware pattern in ${block.name} - flagged for review`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.missingAuthMiddleware++;
      }

      // 7. Verifica violações de REST naming
      const restViolation = checkRestNaming(block.route || '');
      if (restViolation) {
        issues.push(
          this.createIssue(
            'info',
            'REST_NAMING_VIOLATION',
            `Endpoint violates REST conventions (verbs in URL): ${block.route} in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.restViolations++;
      }

      // 8. Verifica paginação ausente em GET list endpoints
      if (
        isListEndpoint(block.route || '', block.content) &&
        !hasPagination(block.content)
      ) {
        issues.push(
          this.createIssue(
            'info',
            'MISSING_PAGINATION',
            `GET list endpoint missing pagination parameters in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.missingPagination++;
      }

      // 9. Verifica padrões N+1 query
      const n1Patterns = findN1QueryPatterns(block.content);
      if (n1Patterns.length > 0) {
        issues.push(
          this.createIssue(
            'warning',
            'N_PLUS_ONE_QUERY',
            `Detected N+1 query pattern (${n1Patterns.length} occurrences) - loops with database calls in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.n1Queries += n1Patterns.length;
        blockIssues += 8 * n1Patterns.length;
      }

      // 10. Verifica rate limiting ausente
      if (!hasRateLimiting(block.content)) {
        issues.push(
          this.createIssue(
            'info',
            'MISSING_RATE_LIMIT',
            `Public route without rate limit middleware in ${block.name}`,
            {
              file: filePath,
              line: block.line,
            }
          )
        );
        this.metrics.missingRateLimit++;
      }

      if (blockIssues > 0) {
        this.metrics.routesWithErrors++;
      }
    }

    return issues;
  }


  /**
   * Verifica se é arquivo de teste
   */
  private isTestFile(filePath: string): boolean {
    return /\.(?:test|spec)\.\w+$/.test(filePath);
  }

  /**
   * Lê conteúdo de arquivo
   */
  private readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Calcula score baseado em penalidades
   */
  private calculateScore(issueCount: number): number {
    const basePenalty = issueCount * 3; // 3 pontos por issue
    const totalPenalty = Math.min(basePenalty, 40); // Máximo 40 pontos de penalidade
    return Math.max(0, 100 - totalPenalty);
  }

  /**
   * Reseta métricas
   */
  private resetMetrics(): ApiContractMetrics {
    return {
      totalRoutes: 0,
      routesWithErrors: 0,
      missingErrorResponses: 0,
      inconsistentStatusCodes: 0,
      missingInputValidation: 0,
      noResponseType: 0,
      hardcodedUrls: 0,
      missingAuthMiddleware: 0,
      restViolations: 0,
      missingPagination: 0,
      n1Queries: 0,
      missingRateLimit: 0,
    };
  }
}
