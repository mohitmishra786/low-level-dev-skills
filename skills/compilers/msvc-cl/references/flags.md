# MSVC cl.exe Flag Reference

Source: <https://learn.microsoft.com/en-us/cpp/build/reference/compiler-options>
Source: <https://learn.microsoft.com/en-us/cpp/build/clang-support-msbuild>

## Optimisation

| Flag | Effect |
|------|--------|
| `/Od` | Disable optimisation (debug) |
| `/O1` | Minimise size |
| `/O2` | Maximise speed (recommended release) |
| `/Ox` | Full optimisation (like `-O3`) |
| `/Os` | Favour code size |
| `/Ot` | Favour code speed |
| `/GL` | Whole-program optimisation (LTO compile phase) |
| `/fp:fast` | Unsafe FP optimisations |
| `/fp:precise` | Default FP |
| `/fp:strict` | Strict FP semantics |

Link with `/LTCG` when using `/GL`.

## Debug information

| Flag | Effect |
|------|--------|
| `/Zi` | External PDB (recommended) |
| `/Z7` | Embed debug info in `.obj` |
| `/Zd` | Line numbers only |
| `/Fd:name.pdb` | Name the PDB file |
| `/DEBUG` | Linker: generate PDB |
| `/DEBUG:FULL` | Full debug symbols |
| `/DEBUG:FASTLINK` | Faster link, requires PDB at debug time |

## Runtime libraries

| Flag | Library | Type |
|------|---------|------|
| `/MD` | `MSVCRT.dll` | Release dynamic |
| `/MDd` | `MSVCRTd.dll` | Debug dynamic |
| `/MT` | `libcmt.lib` | Release static |
| `/MTd` | `libcmtd.lib` | Debug static |

All TUs in a link must use the same choice.

## Warnings

| Flag | Effect |
|------|--------|
| `/W0` | No warnings |
| `/W1` | Severe warnings |
| `/W2` | Significant warnings |
| `/W3` | Production quality (default) |
| `/W4` | Informational warnings |
| `/Wall` | All warnings (very noisy) |
| `/WX` | Warnings as errors |
| `/wd4100` | Disable warning C4100 |
| `/we4239` | Treat C4239 as error |
| `/analyze` | Static analysis |

## Standards

| Flag | Standard |
|------|---------|
| `/std:c++14` | C++14 |
| `/std:c++17` | C++17 |
| `/std:c++20` | C++20 |
| `/std:c++latest` | Latest preview features |
| `/std:c11` | C11 |
| `/std:c17` | C17 |
| `/Za` | Disable Microsoft extensions |
| `/permissive-` | Standards conformance mode (recommended) |

## Output control

| Flag | Effect |
|------|--------|
| `/c` | Compile only |
| `/Fe:name` | Executable name |
| `/Fo:name` | Object file name |
| `/FA` | Assembly listing |
| `/FAs` | Interleaved source + asm |
| `/P` | Preprocessed output (`.i`) |
| `/showIncludes` | Print include tree |

## Linking (passed after `/link`)

| Flag | Effect |
|------|--------|
| `/SUBSYSTEM:CONSOLE` | Console app |
| `/SUBSYSTEM:WINDOWS` | GUI app |
| `/DLL` | Build DLL |
| `/ENTRY:fn` | Custom entry point |
| `/LTCG` | Link-time code generation (pairs with `/GL`) |
| `/INCREMENTAL:NO` | Disable incremental linking |
| `/LIBPATH:path` | Additional library search path |
| `/NODEFAULTLIB:lib` | Exclude a default library |
