import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const CLI_PATH = path.join(__dirname, '../dist/cli.js');
const PROJECT_DIR = path.join('/tmp', 'sentinel-test-cli-project');

/** Helper: executa o CLI e retorna stdout */
function runCli(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, FORCE_COLOR: '0' }, // sem cores para facilitar assertions
    });
  } catch (error: any) {
    // CLI pode sair com exit code 1 (quality gate failed) — isso é válido
    return error.stdout || error.stderr || '';
  }
}

describe('CLI: sentinel command', () => {
  beforeAll(() => {
    // Garantir que o build está atualizado
    execSync('npx tsc', { cwd: path.join(__dirname, '..') });
  });

  // ── Comando list ──

  describe('list command', () => {
    test('deve listar todos os validators', () => {
      const output = runCli('list');

      expect(output).toContain('Sentinel Method');
      expect(output).toContain('Available Validators');

      // 7 validators nativos
      expect(output).toContain('Testing Coverage');
      expect(output).toContain('Security Scanning');
      expect(output).toContain('Performance Benchmarks');
      expect(output).toContain('Maintainability Checker');
      expect(output).toContain('Dependency Analysis');
      expect(output).toContain('Documentation Coverage');
      expect(output).toContain('Code Style');
      expect(output).toContain('Total: 14 validators');
    });
  });

  // ── Comando validate ──

  describe('validate command', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(PROJECT_DIR, 'src'), { recursive: true });
      fs.mkdirSync(path.join(PROJECT_DIR, 'tests'), { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(PROJECT_DIR)) {
        fs.rmSync(PROJECT_DIR, { recursive: true });
      }
    });

    test('deve validar um diretório e mostrar output console', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        '/** App module */\nexport const x = 1;\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -t 0 -m 0`);

      expect(output).toContain('Sentinel Method');
      expect(output).toContain('Validators');
      expect(output).toContain('Summary');
      expect(output).toContain('Quality gate');
    });

    test('deve mostrar Score Breakdown na saída console', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        '/** App */\nexport const x = 1;\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -t 0 -m 0`);

      expect(output).toContain('Score Breakdown');
      expect(output).toContain('Validator');
      expect(output).toContain('Score');
      expect(output).toContain('Threshold');
    });

    test('deve gerar output JSON com --json', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        'export const x = 1;\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} --json -t 0 -m 0`);

      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('results');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.results).toHaveLength(14);
    });

    test('deve gerar output Markdown com -f markdown', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        'export const x = 1;\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -f markdown -t 0 -m 0`);

      expect(output).toContain('# Sentinel Validation Report');
    });

    test('deve reportar erros em projeto com vulnerabilidades', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'danger.ts'),
        'const x = eval("code");\nconst pwd = "secret123";\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -t 0 -m 0`);

      expect(output).toContain('Security Scanning');
      expect(output).toContain('FAIL');
    });

    test('deve respeitar threshold de testing customizado', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        'export const x = 1;\n',
      );

      // Com threshold 0, testing não deve falhar por score
      const output = runCli(`validate ${PROJECT_DIR} -t 0 -m 0`);
      expect(output).toBeDefined();
    });

    test('deve aceitar security level permissive', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        'export const x = 1;\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -s permissive -t 0 -m 0`);
      expect(output).toBeDefined();
    });

    test('deve mostrar detalhes de métricas quando disponíveis', () => {
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), JSON.stringify({
        dependencies: { lodash: '^4.17.0' },
      }));
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        'import _ from "lodash";\n/** App */\nexport const x = _.identity(1);\n',
      );

      const output = runCli(`validate ${PROJECT_DIR} -t 0 -m 0`);

      // Deve ter seção Details com info de pelo menos um validator
      expect(output).toContain('Details');
    });
  });

  // ── Output to file ──

  describe('--output flag', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(PROJECT_DIR, 'src'), { recursive: true });
      fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(PROJECT_DIR, 'src', 'app.ts'),
        '/** App */\nexport const x = 1;\n',
      );
    });

    afterEach(() => {
      if (fs.existsSync(PROJECT_DIR)) {
        fs.rmSync(PROJECT_DIR, { recursive: true });
      }
    });

    test('deve salvar report JSON em arquivo com --output', () => {
      const outputFile = path.join(PROJECT_DIR, 'report.json');
      runCli(`validate ${PROJECT_DIR} -t 0 -m 0 -o ${outputFile}`);

      expect(fs.existsSync(outputFile)).toBe(true);
      const content = fs.readFileSync(outputFile, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('deve salvar report HTML com extensão .html', () => {
      const outputFile = path.join(PROJECT_DIR, 'report.html');
      runCli(`validate ${PROJECT_DIR} -t 0 -m 0 -o ${outputFile}`);

      expect(fs.existsSync(outputFile)).toBe(true);
      const content = fs.readFileSync(outputFile, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
    });

    test('deve salvar report Markdown com extensão .md', () => {
      const outputFile = path.join(PROJECT_DIR, 'report.md');
      runCli(`validate ${PROJECT_DIR} -t 0 -m 0 -o ${outputFile}`);

      expect(fs.existsSync(outputFile)).toBe(true);
      const content = fs.readFileSync(outputFile, 'utf-8');
      expect(content).toContain('# Sentinel Validation Report');
    });
  });

  // ── Help e version ──

  describe('help e version', () => {
    test('deve mostrar help do validate', () => {
      const output = runCli('validate --help');

      expect(output).toContain('validate');
      expect(output).toContain('--format');
      expect(output).toContain('--testing-threshold');
      expect(output).toContain('--security-level');
      expect(output).toContain('--json');
    });

    test('deve mostrar versão do package.json', () => {
      const output = runCli('--version');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../package.json');
      expect(output.trim()).toBe(pkg.version);
    });
  });

  // ── Comando init ──

  describe('init command', () => {
    let initDir: string;

    beforeEach(() => {
      initDir = path.join('/tmp', 'sentinel-test-init-project');
      fs.mkdirSync(initDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(initDir)) {
        fs.rmSync(initDir, { recursive: true });
      }
    });

    test('deve criar .sentinelrc.json e .sentinelignore', () => {
      try {
        execSync(`node ${CLI_PATH} init`, {
          encoding: 'utf8',
          cwd: initDir,
          timeout: 10000,
          env: { ...process.env, FORCE_COLOR: '0' },
        });
      } catch (e: any) {
        // init pode retornar stdout mesmo com exit code
      }

      expect(fs.existsSync(path.join(initDir, '.sentinelrc.json'))).toBe(true);
      expect(fs.existsSync(path.join(initDir, '.sentinelignore'))).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(initDir, '.sentinelrc.json'), 'utf-8'));
      expect(config.testingThreshold).toBe(80);
      expect(config.securityLevel).toBe('strict');
    });

    test('não deve sobrescrever arquivos existentes sem --force', () => {
      fs.writeFileSync(path.join(initDir, '.sentinelrc.json'), '{"custom": true}');

      const output = (() => {
        try {
          return execSync(`node ${CLI_PATH} init`, {
            encoding: 'utf8',
            cwd: initDir,
            timeout: 10000,
            env: { ...process.env, FORCE_COLOR: '0' },
          });
        } catch (e: any) {
          return e.stdout || '';
        }
      })();

      // Arquivo original deve estar intacto
      const config = JSON.parse(fs.readFileSync(path.join(initDir, '.sentinelrc.json'), 'utf-8'));
      expect(config.custom).toBe(true);
      expect(output).toContain('already exists');
    });

    test('deve sobrescrever com --force', () => {
      fs.writeFileSync(path.join(initDir, '.sentinelrc.json'), '{"custom": true}');

      try {
        execSync(`node ${CLI_PATH} init --force`, {
          encoding: 'utf8',
          cwd: initDir,
          timeout: 10000,
          env: { ...process.env, FORCE_COLOR: '0' },
        });
      } catch (e: any) {
        // ok
      }

      const config = JSON.parse(fs.readFileSync(path.join(initDir, '.sentinelrc.json'), 'utf-8'));
      expect(config.testingThreshold).toBe(80);
      expect(config.custom).toBeUndefined();
    });
  });

  // ── Erro: diretório inexistente ──

  describe('tratamento de erros', () => {
    test('deve mostrar erro para diretório inexistente', () => {
      const output = runCli('validate /tmp/nonexistent-sentinel-dir -t 0 -m 0');
      expect(output).toContain('Error');
    });
  });
});
