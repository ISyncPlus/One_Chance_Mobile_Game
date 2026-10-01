# ADR 0002: Preserve the Expo Constants path-quoting fix

Status: implemented for expo-constants 57.0.20.

The iOS build failed in `[CP-User] Generate app.config for prebuilt Constants.manifest` because the upstream podspec passes an unquoted script path through `bash -c`. This workspace contains spaces. The called script also uses an unquoted PROJECT_DIR in `basename`.

`patches/expo-constants+57.0.20.patch` quotes the executable inside the inner shell, shell-escapes an explicit PROJECT_ROOT if provided, and quotes the basename argument. It preserves manifest generation rather than bypassing the build phase. No game or application behaviour changes.

`patch-package` is a development dependency so this small upstream fix is versioned and reapplied on install. `postinstall` uses `--error-on-fail`; dependency upgrades must review or remove the patch rather than ignore failed application. CocoaPods must be regenerated after changing the podspec patch.

Remove the patch after a compatible upstream release fixes these paths and a clean native build in a directory containing spaces passes. Native compilation is the integration check for this patch.

The next build exposed the same issue in Expo's generated application bundling phase. `plugins/withQuotedBundleScript.cjs` quotes that command substitution through an Expo config plugin, leaving generated native files reproducible. The plugin is idempotent and fails if the upstream template changes unexpectedly. Tests reproduce the original failure in a temporary directory containing spaces and prove the corrected invocation succeeds. No native build phases are skipped.
