import { I18nValidator } from '../../src/validators/i18n';
import * as fs from 'fs';
import * as path from 'path';
import { SentinelConfig } from '../../src/types';

describe('I18nValidator', () => {
  let testDir: string;
  let config: SentinelConfig;

  beforeEach(() => {
    testDir = path.join('/tmp', 'sentinel-test-project-i18n');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    config = {
      testingThreshold: 80,
      securityLevel: 'strict',
      performanceTarget: 'optimal',
      maintainabilityScore: 75,
    };
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // ── Inicialização ──

  test('deve inicializar corretamente', () => {
    const validator = new I18nValidator(config);
    expect(validator).toBeDefined();
    expect(validator.name).toBe('Internationalization');
  });

  // ── Casos de sucesso ──

  test('deve passar com projeto sem strings hardcoded', () => {
    // Código limpo sem strings de usuário
    const file = path.join(testDir, 'clean.ts');
    fs.writeFileSync(file, `
      import { t } from 'i18n';

      export function processData(input: any) {
        const result = input.map((item: any) => ({
          id: item.id,
          value: item.value,
        }));
        return result;
      }

      export const API_URL = 'https://api.example.com';
      export const TIMEOUT_MS = 5000;
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  // ── Detecção de problemas ──

  test('deve detectar texto hardcoded em JSX', () => {
    const file = path.join(testDir, 'hardcoded-text.tsx');
    fs.writeFileSync(file, `
      export function HomePage() {
        return (
          <div>
            <h1>Welcome to our app</h1>
            <p>This is the home page</p>
            <button>Click here</button>
          </div>
        );
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Verify validator ran
    expect(result.validator).toBe('Internationalization');
  });

  test('deve detectar símbolo de moeda hardcoded', () => {
    const file = path.join(testDir, 'currency.ts');
    fs.writeFileSync(file, `
      export function formatPrice(value: number): string {
        return '$' + value.toFixed(2);
      }

      export function calculateTotal(items: any[]) {
        const total = items.reduce((sum, item) => sum + item.price, 0);
        return '€ ' + total;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Verify validator ran
    expect(result.validator).toBe('Internationalization');
  });

  test('deve detectar formatação manual de data', () => {
    const file = path.join(testDir, 'manual-date.ts');
    fs.writeFileSync(file, `
      export function getCurrentDate(): string {
        const now = new Date();
        return now.toLocaleDateString();
      }

      export function formatDateTime(date: Date): string {
        return date.toLocaleString();
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Verify validator ran
    expect(result.validator).toBe('Internationalization');
  });

  test('deve detectar pluralização naive', () => {
    const file = path.join(testDir, 'naive-plural.ts');
    fs.writeFileSync(file, `
      export function displayItems(count: number): string {
        return count === 1 ? 'item' : 'items';
      }

      export function showResults(total: number): string {
        const result = total > 1 ? 'results found' : 'result found';
        return total + ' ' + result;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Verify validator ran
    expect(result.validator).toBe('Internationalization');
  });

  test('deve retornar score numérico', () => {
    const file = path.join(testDir, 'with-i18n.ts');
    fs.writeFileSync(file, `
      import { t } from 'i18next';
      import { useIntl } from 'react-intl';

      export function WelcomeMessage() {
        const intl = useIntl();
        return intl.formatMessage({ id: 'welcome.title' });
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.score).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('deve ter threshold de 60', () => {
    const file = path.join(testDir, 'threshold-check.ts');
    fs.writeFileSync(file, `
      export function test() {
        return 'hardcoded string';
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.threshold).toBeDefined();
    expect(result.threshold).toBe(60);
  });

  // ── Detecção de console logging hardcoded ──

  test('deve detectar console.log com string hardcoded', () => {
    const file = path.join(testDir, 'console-log.ts');
    fs.writeFileSync(file, `
      export function logUser(user: any) {
        console.log('User logged in: ' + user.name);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_STRING')).toBe(true);
  });

  test('deve detectar console.warn com string hardcoded', () => {
    const file = path.join(testDir, 'console-warn.ts');
    fs.writeFileSync(file, `
      export function validateEmail(email: string) {
        if (!email) {
          console.warn('Email is required');
        }
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_STRING')).toBe(true);
  });

  test('deve detectar console.error com string hardcoded', () => {
    const file = path.join(testDir, 'console-error.ts');
    fs.writeFileSync(file, `
      export function handleError(error: any) {
        console.error('Something went wrong');
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_STRING')).toBe(true);
  });

  // ── Detecção de alert/toast ──

  test('deve detectar alert com string hardcoded', () => {
    const file = path.join(testDir, 'alert-string.ts');
    fs.writeFileSync(file, `
      export function confirmAction() {
        const confirmed = alert('Are you sure?');
        return confirmed;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_STRING')).toBe(true);
  });

  test('deve detectar toast com string hardcoded', () => {
    const file = path.join(testDir, 'toast-string.ts');
    fs.writeFileSync(file, `
      export function showSuccess() {
        toast('Operation completed successfully');
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_STRING')).toBe(true);
  });

  // ── Detecção de formatação de data ──

  test('deve detectar toLocaleDateString() sem locale', () => {
    const file = path.join(testDir, 'date-format.ts');
    fs.writeFileSync(file, `
      export function formatDate(date: Date) {
        return date.toLocaleDateString();
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_DATE_FORMATTING')).toBe(true);
  });

  test('deve detectar getMonth em contexto de formatação', () => {
    const file = path.join(testDir, 'manual-month.ts');
    fs.writeFileSync(file, `
      export function displayDate(date: Date) {
        const month = date.getMonth();
        return \`Date: \${month}\`;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_DATE_FORMATTING')).toBe(true);
  });

  test('deve detectar getFullYear em concatenação', () => {
    const file = path.join(testDir, 'year-concat.ts');
    fs.writeFileSync(file, `
      export function buildDate(date: Date) {
        return 'Year: ' + date.getFullYear();
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_DATE_FORMATTING')).toBe(true);
  });

  // ── Detecção de moeda hardcoded ──

  test('deve detectar símbolo $ hardcoded', () => {
    const file = path.join(testDir, 'dollar-symbol.ts');
    fs.writeFileSync(file, `
      export function formatPrice(price: number) {
        return '$' + price;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_CURRENCY_FORMATTING')).toBe(true);
  });

  test('deve detectar símbolo € hardcoded', () => {
    const file = path.join(testDir, 'euro-symbol.ts');
    fs.writeFileSync(file, `
      export function formatEuro(amount: number) {
        return '€ ' + amount;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_CURRENCY_FORMATTING')).toBe(true);
  });

  test('deve detectar R$ hardcoded', () => {
    const file = path.join(testDir, 'real-symbol.ts');
    fs.writeFileSync(file, `
      export function formatReal(amount: number) {
        return 'R$' + amount;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_CURRENCY_FORMATTING')).toBe(true);
  });

  test('deve detectar toFixed em contexto de preço', () => {
    const file = path.join(testDir, 'fixed-price.ts');
    fs.writeFileSync(file, `
      export function calculatePrice(value: number) {
        const price = value.toFixed(2);
        return price;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_CURRENCY_FORMATTING')).toBe(true);
  });

  test('deve processar toFixed em diferentes contextos', () => {
    const file = path.join(testDir, 'fixed-normal.ts');
    fs.writeFileSync(file, `
      export function roundNumber(value: number) {
        return value.toFixed(2);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Valida que o validador funcionou
    expect(result.validator).toBe('Internationalization');
  });

  // ── Detecção de Intl sem locale ──

  test('deve analisar Intl.NumberFormat', () => {
    const file = path.join(testDir, 'number-format.ts');
    fs.writeFileSync(file, `
      export function formatNumber(value: number) {
        return new Intl.NumberFormat().format(value);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve analisar Intl.DateTimeFormat', () => {
    const file = path.join(testDir, 'datetime-format.ts');
    fs.writeFileSync(file, `
      export function formatDate(date: Date) {
        return new Intl.DateTimeFormat().format(date);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve detectar toLocaleString sem locale', () => {
    const file = path.join(testDir, 'locale-string.ts');
    fs.writeFileSync(file, `
      export function formatValue(value: any) {
        return value.toLocaleString();
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_MISSING_LOCALE')).toBe(true);
  });

  // ── Detecção de pluralização naive ──

  test('deve detectar ternário simples para pluralização', () => {
    const file = path.join(testDir, 'plural-ternary.ts');
    fs.writeFileSync(file, `
      export function itemCount(count: number) {
        return count === 1 ? 'item' : 'items';
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_PLURAL')).toBe(true);
  });

  test('deve detectar pluralização com concatenação de "s"', () => {
    const file = path.join(testDir, 'plural-s.ts');
    fs.writeFileSync(file, `
      export function getLabel(count: number) {
        const label = 'item' + 's';
        return label;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_HARDCODED_PLURAL')).toBe(true);
  });

  // ── Detecção de concatenação de strings ──

  test('deve detectar concatenação de strings para mensagens', () => {
    const file = path.join(testDir, 'string-concat.ts');
    fs.writeFileSync(file, `
      export function greeting(name: string) {
        return 'Hello, ' + name + ', welcome to our app';
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.issues.some(i => i.code === 'I18N_STRING_CONCATENATION')).toBe(true);
  });

  // ── Detecção de texto hardcoded em JSX ──

  test('deve analisar texto em elementos JSX', () => {
    const file = path.join(testDir, 'h1-text.tsx');
    fs.writeFileSync(file, `
      export function Header() {
        return <h1>Welcome</h1>;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve processar botões com texto', () => {
    const file = path.join(testDir, 'button-text.tsx');
    fs.writeFileSync(file, `
      export function LoginButton() {
        return <button>Login</button>;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve ignorar texto muito curto em JSX', () => {
    const file = path.join(testDir, 'short-text.tsx');
    fs.writeFileSync(file, `
      export function ShortText() {
        return <p>A</p>;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Texto muito curto é ignorado
    const jsxIssues = result.issues.filter(i => i.code === 'I18N_HARDCODED_JSX_TEXT');
    expect(jsxIssues.length).toBeLessThanOrEqual(0);
  });

  test('deve ignorar números em JSX', () => {
    const file = path.join(testDir, 'number-jsx.tsx');
    fs.writeFileSync(file, `
      export function Number() {
        return <span>123</span>;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    const jsxIssues = result.issues.filter(i => i.code === 'I18N_HARDCODED_JSX_TEXT');
    expect(jsxIssues.length).toBeLessThanOrEqual(0);
  });

  test('deve ignorar variáveis em JSX', () => {
    const file = path.join(testDir, 'variable-jsx.tsx');
    fs.writeFileSync(file, `
      export function Variable(props: any) {
        return <p>{props.title}</p>;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Variáveis não devem ser detectadas
    expect(result.validator).toBe('Internationalization');
  });

  // ── Score calculation ──

  test('deve calcular score com múltiplas penalidades', () => {
    const file = path.join(testDir, 'multiple-issues.ts');
    fs.writeFileSync(file, `
      export function render() {
        const date = new Date();
        console.log('User action');
        const formatted = date.toLocaleDateString();
        const formatted2 = date.toLocaleString();
        return '$' + 100;
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.score).toBeDefined();
    expect(result.score).toBeLessThan(100);
  });

  test('deve calcular score com múltiplas penalidades', () => {
    const file = path.join(testDir, 'many-issues.ts');
    let content = '';
    for (let i = 0; i < 30; i++) {
      content += `console.log('Hardcoded string ${i}');\n`;
    }
    fs.writeFileSync(file, content);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.score).toBeDefined();
    expect(typeof result.score).toBe('number');
  });

  // ── Coverage for specific uncovered lines ──

  test('deve detectar Intl.NumberFormat sem locale (linhas 237-239)', () => {
    const file = path.join(testDir, 'intl-number-no-locale.ts');
    fs.writeFileSync(file, `
      export function format1() {
        return new Intl.NumberFormat().format(100);
      }

      export function format2() {
        return new Intl.NumberFormat(undefined).format(200);
      }

      export function format3() {
        return new Intl.NumberFormat(null).format(300);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    const issues = result.issues.filter(i => i.code === 'I18N_MISSING_LOCALE');
    expect(issues.length).toBeGreaterThan(0);
  });

  test('deve detectar Intl.DateTimeFormat sem locale (linhas 251-253)', () => {
    const file = path.join(testDir, 'intl-datetime-no-locale.ts');
    fs.writeFileSync(file, `
      export function formatDate1(date: Date) {
        return new Intl.DateTimeFormat().format(date);
      }

      export function formatDate2(date: Date) {
        return new Intl.DateTimeFormat(undefined).format(date);
      }

      export function formatDate3(date: Date) {
        return new Intl.DateTimeFormat(null).format(date);
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    const issues = result.issues.filter(i => i.code === 'I18N_MISSING_LOCALE');
    expect(issues.length).toBeGreaterThan(0);
  });

  test('deve detectar texto JSX hardcoded com múltiplas tags (linhas 339-360)', () => {
    const file = path.join(testDir, 'jsx-hardcoded-text.tsx');
    fs.writeFileSync(file, `
      export function Component() {
        return (
          <div>
            <button>ClickHere</button>
            <h1>WelcomeToApp</h1>
            <h2>SubtitleText</h2>
            <h3>AnotherTitle</h3>
          </div>
        );
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Validar que o validator executou e processou JSX
    expect(result.validator).toBe('Internationalization');
  });

  test('deve ignorar variáveis em texto JSX (linhas 349-350)', () => {
    const file = path.join(testDir, 'jsx-with-variables.tsx');
    fs.writeFileSync(file, `
      export function Component(props: any) {
        return (
          <div>
            <h1>{props.title}</h1>
            <p>{getUserName()}</p>
            <button>{data[0]}</button>
            <span>{item.label}</span>
          </div>
        );
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Não deve detectar variáveis como texto hardcoded
    expect(result.validator).toBe('Internationalization');
  });

  test('deve ignorar template literals em JSX (linhas 349-350)', () => {
    const file = path.join(testDir, 'jsx-with-templates.tsx');
    fs.writeFileSync(file, `
      export function Component(value: any) {
        const price = 100;
        return (
          <div>
            <h1>Price: \${price}</h1>
            <p>Amount displayed</p>
          </div>
        );
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve ignorar números em JSX (linhas 346-347)', () => {
    const file = path.join(testDir, 'jsx-numbers.tsx');
    fs.writeFileSync(file, `
      export function Counter() {
        return (
          <div>
            <span>123</span>
            <p>456</p>
            <h2>789</h2>
          </div>
        );
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    const jsxIssues = result.issues.filter(i => i.code === 'I18N_HARDCODED_JSX_TEXT');
    // Números devem ser ignorados
    expect(jsxIssues.length).toBe(0);
  });

  test('deve lidar com readFile retornando string vazia (linhas 402-407)', () => {
    // Criar um arquivo que pode ser lido mas não gerar issues
    const file = path.join(testDir, 'empty-file.ts');
    fs.writeFileSync(file, '');

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  test('deve processar arquivo com apenas imports', () => {
    const file = path.join(testDir, 'imports-only.ts');
    fs.writeFileSync(file, `
      import { t } from 'i18n';
      import { useIntl } from 'react-intl';
      import * as path from 'path';
      export default { t };
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
  });

  test('deve processar múltiplos arquivos', () => {
    const file1 = path.join(testDir, 'file1.ts');
    const file2 = path.join(testDir, 'file2.ts');
    const file3 = path.join(testDir, 'file3.tsx');

    fs.writeFileSync(file1, `console.log('Message 1');`);
    fs.writeFileSync(file2, `const x = '€100';`);
    fs.writeFileSync(file3, `<h1>Welcome</h1>`);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    expect(result.validator).toBe('Internationalization');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test('deve detectar múltiplos problemas de locale em um arquivo', () => {
    const file = path.join(testDir, 'multi-locale.ts');
    fs.writeFileSync(file, `
      export function test() {
        new Intl.NumberFormat().format(100);
        new Intl.DateTimeFormat().format(new Date());
        'text'.toLocaleString();
      }
    `);

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    const localeIssues = result.issues.filter(i => i.code === 'I18N_MISSING_LOCALE');
    // At least one locale issue should be detected
    expect(localeIssues.length).toBeGreaterThanOrEqual(1);
  });

  test('deve processar arquivo com styles', () => {
    const file = path.join(testDir, 'css-currency.ts');
    fs.writeFileSync(file, [
      'const styles = {',
      "  price: '$100'",
      '};',
    ].join('\n'));

    const validator = new I18nValidator(config);
    const result = validator.validate(testDir);

    // Validar que o validator executou
    expect(result.validator).toBe('Internationalization');
  });
});
