const { withXcodeProject } = require('expo/config-plugins');

// Expo's native template invokes a command-substituted script path without quotes.
// Keep this in CNG, not as a manual edit to an ignored Xcode project.
function quoteBundleScript(script) {
  let found = false;
  const result = script.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed.includes('/scripts/react-native-xcode.sh')) return line;
    if (trimmed.startsWith('"`') && trimmed.endsWith('`"')) { found = true; return line; }
    if (trimmed.startsWith('`') && trimmed.endsWith('`')) { found = true; return `"${trimmed}"`; }
    throw new Error('Review the native bundle-script quoting plugin: upstream template changed.');
  }).join('\n');
  if (!found) throw new Error('React Native bundling script not found; review the native template.');
  return result;
}

function withQuotedBundleScript(config) {
  return withXcodeProject(config, (mod) => {
    const phases = mod.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    let found = false;
    for (const phase of Object.values(phases)) {
      if (typeof phase !== 'object' || phase.name !== '"Bundle React Native code and images"') continue;
      phase.shellScript = JSON.stringify(quoteBundleScript(JSON.parse(phase.shellScript)));
      found = true;
    }
    if (!found) throw new Error('Expected iOS bundle build phase is missing.');
    return mod;
  });
}

module.exports = withQuotedBundleScript;
module.exports.quoteBundleScript = quoteBundleScript;
