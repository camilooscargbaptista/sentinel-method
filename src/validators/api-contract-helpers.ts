/**
 * Extrai blocos de handlers de rotas do arquivo
 * Suporta Express, Fastify, Koa, NestJS e Next.js
 */
export function extractRouteHandlers(
  content: string
): Array<{ name: string; route?: string; content: string; line: number }> {
  const handlers: Array<{
    name: string;
    route?: string;
    content: string;
    line: number;
  }> = [];

  // Express/Fastify: app.get/post/put/delete/patch('route', handler)
  // Supports: function handler(req, res) { ... } AND (req, res) => { ... }
  const expressPattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:(?:function\s+\w+)?\s*\([^)]*\)\s*(?:=>)?\s*\{([^}]*)\}|(\([^)]*\)\s*=>\s*\{([^}]*)\}))/gs;
  let match;

  while ((match = expressPattern.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    const body = match[3] || match[5] || '';
    const line = content.substring(0, match.index).split('\n').length;

    handlers.push({
      name: `${method.toUpperCase()} ${route}`,
      route,
      content: body,
      line,
    });
  }

  // NestJS decorators: @Get/@Post/@Put/@Delete
  const nestPattern =
    // eslint-disable-next-line no-useless-escape
    /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]?([^'"`\)]*?)['"`]?\s*\)\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{([^}]*)\}/gs;

  while ((match = nestPattern.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    const functionName = match[3];
    const body = match[4];
    const line = content.substring(0, match.index).split('\n').length;

    handlers.push({
      name: `${functionName} (${method})`,
      route,
      content: body,
      line,
    });
  }

  // Next.js: export default function handler / export async function GET/POST
  const nextPattern = /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:handler|(?:GET|POST|PUT|DELETE|PATCH))\s*\([^)]*\)\s*\{([^}]*)\}/gs;

  while ((match = nextPattern.exec(content)) !== null) {
    const body = match[1];
    const line = content.substring(0, match.index).split('\n').length;

    handlers.push({
      name: 'Next.js handler',
      content: body,
      line,
    });
  }

  return handlers;
}

/**
 * Verifica se o handler tem tratamento de erro
 */
export function hasErrorHandling(content: string): boolean {
  const errorPatterns = [
    /res\.status\s*\(\s*[4-5]\d{2}\s*\)/,
    /res\.send\s*\(\s*\{.*?error/,
    /throw\s+new\s+Error/,
    /catch\s*\(/,
    /return\s+res\.json\s*\(\s*\{.*?(error|message)/,
    /HTTPException|BadRequest|Unauthorized|Forbidden|NotFound/,
  ];

  return errorPatterns.some((pattern) => pattern.test(content));
}

/**
 * Verifica se há status codes inconsistentes
 */
export function hasInconsistentStatusCodes(content: string): boolean {
  const sendWithoutStatus = /res\.send\s*\([^)]*\)(?!\s*\n.*res\.status)/;
  const hasStatusBefore = /res\.status\s*\([^)]*\)\s*\.send/;

  return (
    sendWithoutStatus.test(content) && !hasStatusBefore.test(content)
  );
}

/**
 * Verifica se há validação de entrada
 */
export function hasInputValidation(content: string): boolean {
  const validationPatterns = [
    /req\.body\s*\??\./,
    /req\.params\s*\??\./,
    /req\.query\s*\??\./,
    /validate\s*\(/i,
    /joi\./i,
    /zod\./i,
    /schema/i,
    /@Body\(\)/,
    /@Param\(\)/,
    /@Query\(\)/,
    /if\s*\(!.*\)\s*return/,
    /guard\|pipe/i,
  ];

  return validationPatterns.some((pattern) => pattern.test(content));
}

/**
 * Verifica se há type/schema de resposta
 */
export function hasResponseType(content: string): boolean {
  const typePatterns = [
    /:\s*(?:Promise\s*<|Observable\s*<)?[A-Z]\w+(?:\[\])?(?:>)?/,
    /@ApiResponse/,
    /interface\s+\w+Response/,
    /type\s+\w+Response\s*=/,
    /as const/,
    /satisfies\s+\w+/,
    /interface\s+\/\/.*?@api/i,
  ];

  return typePatterns.some((pattern) => pattern.test(content));
}

/**
 * Encontra URLs hardcoded
 */
export function findHardcodedUrls(content: string): string[] {
  const urls: string[] = [];
  const urlPattern =
    /(['"`])(https?:\/\/[^'"`]+|\/api\/[a-zA-Z]+\.com[^'"`]*)\1/g;
  let match;

  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}

/**
 * Verifica se há middleware de autenticação
 */
export function hasAuthMiddleware(content: string): boolean {
  const authPatterns = [
    /auth(?:ent|oriz)/i,
    /jwt/i,
    /bearer/i,
    /token/i,
    /isAuthenticated/i,
    /@UseGuards/,
    /middleware.*auth/i,
    /req\.user/,
  ];

  return authPatterns.some((pattern) => pattern.test(content));
}

/**
 * Verifica violação de naming REST (verbos em URLs)
 */
export function checkRestNaming(route: string): boolean {
  const restViolationPatterns = [
    /\/(?:get|post|put|delete|patch|create|update|remove|fetch|list|all)(?:\/|$)/i,
  ];

  return restViolationPatterns.some((pattern) => pattern.test(route));
}

/**
 * Verifica se é um endpoint de listagem
 */
export function isListEndpoint(route: string, content: string): boolean {
  const listPatterns = [
    /GET|\.get/i,
    /\/[^/]*(?:list|all|items|users|products)(?:\/|$)/i,
    /\[\]/,
  ];

  return listPatterns.some((pattern) => pattern.test(route || content));
}

/**
 * Verifica se há paginação
 */
export function hasPagination(content: string): boolean {
  const paginationPatterns = [
    /(?:limit|offset|page|take|skip)/i,
    /req\.query\.(?:limit|offset|page|take|skip)/,
    /skip\(\d+\)\.limit\(\d+\)/,
    /limit\(\d+\)\.offset\(\d+\)/,
  ];

  return paginationPatterns.some((pattern) => pattern.test(content));
}

/**
 * Encontra padrões N+1 query
 */
export function findN1QueryPatterns(content: string): string[] {
  const patterns: string[] = [];

  const loopPattern =
    /(?:forEach|map|for\s*\()\s*\([^)]*\)\s*(?:=>|{)[^}]*\.(?:find|query|get|findOne|findById|load)\s*\(/g;

  let match;
  while ((match = loopPattern.exec(content)) !== null) {
    patterns.push(match[0].substring(0, 50));
  }

  return patterns;
}

/**
 * Verifica se há rate limiting
 */
export function hasRateLimiting(content: string): boolean {
  const rateLimitPatterns = [
    /rateLimit/i,
    /throttle/i,
    /limiter/i,
    /@Throttle/,
    /express-rate-limit/i,
  ];

  return rateLimitPatterns.some((pattern) => pattern.test(content));
}
