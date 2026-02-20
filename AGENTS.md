# AGENTS.md

Guidelines for AI agents working in this repository.

## Project Overview

A curated suite of AI agent skills for systems and low-level C/C++ development toolchains. Each skill is a markdown file following the [SKILL.md format](https://github.com/anthropics/skills). Skills are organized by category and cross-reference each other.

## Repository Structure

```
skills/
├── compilers/        # gcc, clang, llvm, msvc-cl, cross-gcc
├── debuggers/        # gdb, lldb, core-dumps
├── profilers/        # linux-perf, valgrind, flamegraphs
├── build-systems/    # cmake, make, ninja
├── binaries/         # elf-inspection, linkers-lto, binutils
├── runtimes/         # sanitizers, fuzzing
└── low-level-programming/  # assembly-x86, assembly-arm, interpreters
```

Each skill has a `SKILL.md` file and optional `references/` for detailed content.

## Validation Commands

```bash
# Validate markdown formatting (requires markdownlint-cli)
markdownlint skills/**/*.md

# Check skill frontmatter is valid YAML
head -5 skills/compilers/gcc/SKILL.md

# Verify all skills have required sections
grep -l "## Purpose" skills/**/SKILL.md | wc -l
grep -l "## Triggers" skills/**/SKILL.md | wc -l
grep -l "## Workflow" skills/**/SKILL.md | wc -l
grep -l "## Related" skills/**/SKILL.md | wc -l

# Check cross-reference format (should use backticks, not links)
grep -r "skills/[a-z]" skills/ --include="*.md" | grep -v "`skills/"
```

## SKILL.md Format

### YAML Frontmatter

```yaml
---
name: skill-name
description: <skill-name> skill for <domain>. Use when <scenarios>. Activates on <triggers>.
---
```

- `name`: Lowercase, hyphen-separated, matches directory name
- `description`: Must include "Use when" and "Activates on" clauses

### Required Sections

Every SKILL.md must have:

1. **Purpose** (1-2 sentences): What the skill does
2. **Triggers** (4-6 items): User query patterns that activate this skill
3. **Workflow** (numbered subsections): Step-by-step guidance with:
   - Decision trees (ASCII in code blocks)
   - Command tables
   - Code examples with language tags
   - Error/symptom tables
4. **Related skills** (2+ references): Cross-references using backtick format

## Code Style Guidelines

### Markdown

- Maximum body: 500 lines (put exhaustive lists in `references/`)
- Code blocks: Always include language tag (` ```bash `, ` ```c `, ` ```cmake `)
- Tables: Pipe syntax with header separator
- Lists: `-` for unordered, `1.` for ordered

### Cross-References

Use backticks for skill references:
- **Correct**: `skills/compilers/gcc`
- **Incorrect**: "the gcc skill" or `[gcc](skills/compilers/gcc)`

For internal references: `[references/flags.md](references/flags.md)`

### Naming Conventions

- Skill directories: lowercase, hyphen-separated (`linux-perf`, `cross-gcc`)
- SKILL.md: always uppercase
- Reference files: lowercase with extension (`flags.md`, `cheatsheet.md`)

### Code Examples

Code examples should be:
- Complete and compilable where possible
- Annotated with comments explaining purpose
- Grouped with blank lines between related commands

```bash
# Comment explains purpose
gcc -Wall -Wextra -O2 -o prog main.c

# Related command follows blank line
./prog
```

### Tables

| Command | Effect |
|---------|--------|
| `cmd` | Description |

| Symptom | Cause | Fix |
|---------|-------|-----|
| Error message | Root cause | Resolution |

### Decision Trees

```
Question?
├── Yes → Action A
└── No  → Action B
```

## Common Workflows

### Adding a New Skill

1. Create `skills/<category>/<skill-name>/SKILL.md`
2. Add required sections (Purpose, Triggers, Workflow, Related skills)
3. Create `references/` if content exceeds 500 lines
4. Update README.md skills table
5. Add cross-references from 2+ related skills

### Updating an Existing Skill

1. Keep body under 500 lines
2. Move exhaustive flag lists to `references/`
3. Maintain numbered workflow subsections
4. Preserve existing cross-references

### Validating Changes

1. Run `markdownlint skills/**/*.md`
2. Verify frontmatter has `name` and `description`
3. Check all code blocks have language tags
4. Confirm cross-references use backtick format
5. Ensure Related skills section has 2+ entries

## Quality Checklist

- [ ] Frontmatter: `name` and `description` fields present
- [ ] Description: includes "Use when" and "Activates on"
- [ ] Purpose: 1-2 sentences
- [ ] Triggers: 4-6 user query patterns
- [ ] Workflow: numbered subsections (1, 2, 3...)
- [ ] Code blocks: language tags included
- [ ] Related skills: 2+ references in backtick format
- [ ] Body length: under 500 lines
