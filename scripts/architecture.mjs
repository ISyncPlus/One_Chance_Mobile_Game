import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

export function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

/** Fail closed: pure game code may only reference files within src/game. */
export function inspectSource(file, source, projectRoot = root) {
  const violations = [];
  const name = relative(projectRoot, file).replaceAll('\\', '/');
  const pure = name.startsWith('src/game/');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (pure && file.endsWith('.tsx')) violations.push(`${name}: JSX does not belong in the pure game layer`);
  if (pure && (tree.typeReferenceDirectives.length || tree.libReferenceDirectives.length || tree.referencedFiles.length)) {
    violations.push(`${name}: ambient reference directives can bypass the pure type boundary`);
  }
  function checkModule(specifier) {
    if (!ts.isStringLiteralLike(specifier)) {
      violations.push(`${name}: computed module references are not auditable`);
      return;
    }
    const moduleName = specifier.text;
    const local = moduleName.startsWith('.');
    const target = local ? relative(projectRoot, resolve(dirname(file), moduleName)).replaceAll('\\', '/') : moduleName;
    if (pure && (!local || !target.startsWith('src/game/'))) {
      violations.push(`${name}: pure game layer cannot import ${moduleName}`);
    }
    if (target.startsWith('src/diagnostics/') && !name.startsWith('src/diagnostics/') && name !== 'src/bootstrap/DevelopmentEntry.tsx') {
      violations.push(`${name}: diagnostics may only be reached through DevelopmentEntry`);
    }
    if ((name.startsWith('src/rendering/') || name.startsWith('src/animation/') || name.startsWith('src/ui/')) &&
        (target.startsWith('src/game/engine/') || target.startsWith('src/game/economy/') || target.startsWith('src/persistence/'))) {
      violations.push(`${name}: presentation must use application services, not ${moduleName}`);
    }
  }
  function visit(node) {
    if (pure && !name.startsWith('src/game/economy/') && ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && node.name.text === 'balanceUnits') {
      violations.push(`${name}: balance construction belongs to the central economy subsystem`);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) checkModule(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) checkModule(node.argument.literal);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) checkModule(node.moduleReference.expression);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (node.arguments[0]) checkModule(node.arguments[0]);
    }
    if (pure && ts.isIdentifier(node) && ['require', 'eval', 'Function', 'globalThis'].includes(node.text)) {
      violations.push(`${name}: ${node.text} can bypass the pure module boundary`);
    }
    if (pure && ts.isIdentifier(node) && ['Date', 'performance', 'fetch', 'XMLHttpRequest', 'WebSocket',
      'navigator', 'window', 'document', 'crypto', 'process', 'console', 'setTimeout', 'setInterval',
      'requestAnimationFrame'].includes(node.text)) {
      violations.push(`${name}: ${node.text} is ambient platform/time/randomness access`);
    }
    // No Math aliases/destructuring/computed lookup: these can hide an ambient random call.
    if (pure && ts.isIdentifier(node) && node.text === 'Math' &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node &&
        ['imul', 'floor', 'ceil', 'round', 'trunc', 'abs', 'min', 'max', 'sign'].includes(node.parent.name.text))) {
      violations.push(`${name}: Math must use an explicitly deterministic operation`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return violations;
}

export function auditArchitecture(projectRoot = root) {
  return sourceFiles(resolve(projectRoot, 'src')).flatMap((file) => inspectSource(file, readFileSync(file, 'utf8'), projectRoot));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = auditArchitecture();
  if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
  else console.log('Architecture boundaries passed.');
}
