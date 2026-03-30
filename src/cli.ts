#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { Sentinel } from './sentinel';
import {
  PASS,
  FAIL,
  WARN,
  INFO,
  printHeader,
  printValidatorResult,
  printSummary,
  debounce,
  filterBySeverity,
  detectFormatFromExtension,
} from './cli-helpers';


/** Executa validação e exibe resultados (reutilizado por run e watch) */
async function runValidation(
  sentinel: Sentinel,
  sourceDir: string,
  options: Record<string, any>,
): Promise<number> {
  const result = await sentinel.validate(sourceDir);
  const filtered = options.minSeverity ? filterBySeverity(result, options.minSeverity) : result;

  if (options.json || options.format === 'json') {
    console.log(JSON.stringify(filtered, null, 2));
  } else if (options.format === 'markdown') {
    console.log(filtered.report);
  } else {
    printHeader();

    console.log(chalk.bold('  ─── Validators ───────────────────────────'));
    console.log('');

    for (const validatorResult of filtered.results) {
      printValidatorResult(validatorResult);
    }

    printSummary(filtered);
  }

  // ── Salvar report em arquivo (--output) ──
  if (options.output) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Reporter } = require('./reporter');
    const reporter = new Reporter();

    const outputPath = path.resolve(options.output);
    const outputFormat = detectFormatFromExtension(outputPath);
    const report = reporter.format(filtered, outputFormat);

    fs.writeFileSync(outputPath, report.content);
    console.log(`\n  ${INFO} Report saved to ${chalk.cyan(outputPath)}\n`);
  }

  return result.exitCode;
}

// ── CLI Program ──

const program = new Command();

program
  .name('sentinel')
  .description('Sentinel Method — Production-Grade Quality Gate for AI-Generated Code')
  .version((() => { try { const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')); return pkg.version; } catch { return '3.0.0'; } })());

program
  .command('validate')
  .alias('v')
  .description('Run the full validation pipeline on a source directory')
  .argument('[directory]', 'Source directory to validate', '.')
  .option('-f, --format <format>', 'Report format: json, markdown, console', 'console')
  .option('-t, --testing-threshold <n>', 'Minimum testing score (0-100)', '80')
  .option('-s, --security-level <level>', 'Security level: strict, moderate, permissive', 'strict')
  .option('-p, --performance-target <target>', 'Performance target: optimal, good, acceptable', 'optimal')
  .option('-m, --maintainability-score <n>', 'Minimum maintainability score (0-100)', '75')
  .option('--fail-on-warnings', 'Treat warnings as failures', false)
  .option('--json', 'Output raw JSON (shorthand for -f json)')
  .option('--min-severity <level>', 'Filter issues by minimum severity: error, warning, info')
  .option('-w, --watch', 'Watch mode — re-run validation on file changes', false)
  .option('-o, --output <file>', 'Save report to file (auto-detects format from extension: .json, .md, .html)')
  .action(async (directory: string, options: Record<string, any>) => {
    const sourceDir = path.resolve(directory);

    const sentinel = new Sentinel({
      testingThreshold: parseInt(options.testingThreshold, 10),
      securityLevel: options.securityLevel,
      performanceTarget: options.performanceTarget,
      maintainabilityScore: parseInt(options.maintainabilityScore, 10),
      failOnWarnings: options.failOnWarnings,
      reporters: [options.json ? 'json' : options.format],
    });

    try {
      // ── Watch mode ──
      if (options.watch) {
        console.log(chalk.cyan(`\n  👁  Watch mode — monitoring ${sourceDir}\n`));
        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        // Primeira execução
        await runValidation(sentinel, sourceDir, options);

        // Observar mudanças com debounce de 500ms
        const rerun = debounce(async () => {
          console.clear();
          console.log(chalk.gray(`  ⟳ Re-validating at ${new Date().toLocaleTimeString()}...\n`));
          try {
            await runValidation(sentinel, sourceDir, options);
          } catch (err) {
            console.error(chalk.red(`  Watch error: ${err instanceof Error ? err.message : err}`));
          }
        }, 500);

        const fs = await import('fs');
        fs.watch(sourceDir, { recursive: true }, (_event, filename) => {
          // Ignorar arquivos gerados / ocultos
          if (!filename) return;
          if (filename.includes('node_modules')) return;
          if (filename.includes('.git')) return;
          if (filename.includes('dist/')) return;
          if (filename.includes('coverage/')) return;
          rerun();
        });

        // Manter processo vivo
        await new Promise(() => {});
        return;
      }

      // ── Execução normal ──
      const exitCode = await runValidation(sentinel, sourceDir, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
      process.exit(2);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all available validators')
  .action(() => {
    printHeader();
    console.log(chalk.bold('  Available Validators:'));
    console.log('');

    const sentinel = new Sentinel();
    const validators = sentinel.getValidators();

    for (const v of validators) {
      console.log(`  ${chalk.cyan('●')} ${v.name}`);
    }

    console.log('');
    console.log(chalk.gray(`  Total: ${validators.length} validators`));
    console.log('');
  });

program
  .command('init')
  .description('Initialize Sentinel in the current directory (generates config and ignore files)')
  .option('--force', 'Overwrite existing files', false)
  .action((options: Record<string, any>) => {
    const cwd = process.cwd();

    printHeader();
    console.log(chalk.bold('  Initializing Sentinel Method...\n'));

    // ── .sentinelrc.json ──
    const configPath = path.join(cwd, '.sentinelrc.json');
    if (!options.force && fs.existsSync(configPath)) {
      console.log(`  ${WARN} ${chalk.yellow('.sentinelrc.json already exists')} ${chalk.gray('(use --force to overwrite)')}`);
    } else {
      const defaultConfig = {
        testingThreshold: 80,
        securityLevel: 'strict',
        performanceTarget: 'optimal',
        maintainabilityScore: 75,
        failOnWarnings: false,
        reporters: ['console'],
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
      console.log(`  ${PASS} ${chalk.green('Created .sentinelrc.json')}`);
    }

    // ── .sentinelignore ──
    const ignorePath = path.join(cwd, '.sentinelignore');
    if (!options.force && fs.existsSync(ignorePath)) {
      console.log(`  ${WARN} ${chalk.yellow('.sentinelignore already exists')} ${chalk.gray('(use --force to overwrite)')}`);
    } else {
      const defaultIgnore = [
        '# Sentinel Ignore — padrões de exclusão (estilo .gitignore)',
        '# Diretórios de build e dependências são ignorados por default:',
        '# node_modules/, .git/, dist/, coverage/, .nyc_output/, .*',
        '',
        '# Adicione seus padrões abaixo:',
        '# *.min.js',
        '# vendor/',
        '# generated/',
        '',
      ].join('\n');
      fs.writeFileSync(ignorePath, defaultIgnore);
      console.log(`  ${PASS} ${chalk.green('Created .sentinelignore')}`);
    }

    console.log('');
    console.log(`  ${INFO} Run ${chalk.cyan('sentinel validate')} to start the quality gate`);
    console.log('');
  });

program
  .command('hooks')
  .description('Manage git hooks (pre-commit / pre-push)')
  .option('--install', 'Install pre-commit and pre-push hooks')
  .option('--remove', 'Remove Sentinel hooks')
  .option('--status', 'Show installed hooks status')
  .option('-t, --testing-threshold <n>', 'Testing threshold for hooks', '80')
  .option('-s, --security-level <level>', 'Security level for hooks', 'strict')
  .action((options: Record<string, any>) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { HookManager } = require('./hooks');
    const cwd = process.cwd();
    const manager = new HookManager(cwd);

    printHeader();

    if (!manager.isGitRepo()) {
      console.log(`  ${FAIL} ${chalk.red('Not a git repository')}`);
      console.log('');
      process.exit(1);
    }

    if (options.remove) {
      console.log(chalk.bold('  Removing Sentinel hooks...\n'));
      const removed = manager.removeAll();
      if (removed.preCommit) console.log(`  ${PASS} Removed pre-commit hook`);
      if (removed.prePush) console.log(`  ${PASS} Removed pre-push hook`);
      if (!removed.preCommit && !removed.prePush) {
        console.log(`  ${INFO} No Sentinel hooks found`);
      }
    } else if (options.status) {
      console.log(chalk.bold('  Git Hooks Status:\n'));
      const installed = manager.listInstalled();
      if (installed.length === 0) {
        console.log(`  ${INFO} No Sentinel hooks installed`);
      } else {
        for (const hook of installed) {
          console.log(`  ${PASS} ${chalk.green(hook)} — active`);
        }
      }
    } else if (options.install) {
      console.log(chalk.bold('  Installing Sentinel hooks...\n'));
      const hookOpts = {
        testingThreshold: parseInt(options.testingThreshold, 10),
        securityLevel: options.securityLevel,
      };
      const result = manager.installAll(hookOpts);

      if (result.preCommit.success) {
        console.log(`  ${PASS} ${result.preCommit.message}`);
      } else {
        console.log(`  ${WARN} ${result.preCommit.message}`);
      }

      if (result.prePush.success) {
        console.log(`  ${PASS} ${result.prePush.message}`);
      } else {
        console.log(`  ${WARN} ${result.prePush.message}`);
      }
    } else {
      // Default: mostrar status
      console.log(chalk.bold('  Git Hooks Status:\n'));
      const installed = manager.listInstalled();
      if (installed.length === 0) {
        console.log(`  ${INFO} No Sentinel hooks installed`);
        console.log(`\n  ${INFO} Use ${chalk.cyan('sentinel hooks --install')} to set up hooks`);
      } else {
        for (const hook of installed) {
          console.log(`  ${PASS} ${chalk.green(hook)} — active`);
        }
      }
    }

    console.log('');
  });

program.parse();
