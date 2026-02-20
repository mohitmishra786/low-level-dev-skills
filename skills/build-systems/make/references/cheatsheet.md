# GNU Make Cheatsheet

Source: https://www.gnu.org/software/make/manual/make.html

## Automatic variables

| Variable | Meaning |
|----------|---------|
| `$@` | Target filename |
| `$<` | First prerequisite |
| `$^` | All prerequisites (no duplicates) |
| `$+` | All prerequisites (with duplicates) |
| `$?` | Prerequisites newer than target |
| `$*` | Stem (matched `%` in pattern rule) |
| `$(@D)` | Directory part of `$@` |
| `$(@F)` | File part of `$@` |
| `$(<D)` | Directory part of `$<` |
| `$(<F)` | File part of `$<` |

---

## Special targets

| Target | Effect |
|--------|--------|
| `.PHONY: all clean` | Declare targets that are not files |
| `.DEFAULT_GOAL := all` | Set default target |
| `.SUFFIXES:` | Clear default suffix rules |
| `.SILENT:` | Suppress command echoing globally |
| `.ONESHELL:` | Run recipe lines in one shell |
| `.DELETE_ON_ERROR:` | Remove target on recipe failure |

---

## Functions

| Function | Effect |
|----------|--------|
| `$(wildcard *.c)` | Expand glob |
| `$(patsubst %.c,%.o,files)` | Replace pattern |
| `$(subst from,to,text)` | Replace literal string |
| `$(strip text)` | Remove whitespace |
| `$(notdir path)` | Filename without directory |
| `$(dir path)` | Directory component |
| `$(basename file)` | Filename without extension |
| `$(suffix file)` | Extension only |
| `$(addprefix pre,list)` | Add prefix to each word |
| `$(addsuffix suf,list)` | Add suffix to each word |
| `$(filter %.c,list)` | Keep matching words |
| `$(filter-out %.c,list)` | Remove matching words |
| `$(sort list)` | Sort and deduplicate |
| `$(foreach var,list,expr)` | Loop |
| `$(if cond,then,else)` | Conditional |
| `$(shell cmd)` | Run shell command |
| `$(call var,arg1,arg2)` | Call a function-like variable |
| `$(origin var)` | Where a variable came from |
| `$(value var)` | Value without expansion |
| `$(info msg)` | Print message during parse |
| `$(error msg)` | Fatal error during parse |
| `$(warning msg)` | Warning during parse |

---

## Variable assignment

| Syntax | Type | When expanded |
|--------|------|---------------|
| `VAR = value` | Recursive | At use |
| `VAR := value` | Simple | At definition |
| `VAR ::= value` | POSIX simple | At definition |
| `VAR ?= value` | Conditional | Only if unset |
| `VAR += value` | Append | Depends on type |

---

## Conditionals

```makefile
ifeq ($(CC),gcc)
  CFLAGS += -fanalyzer
endif

ifneq ($(BUILD),release)
  CFLAGS += -g
endif

ifdef DEBUG
  CFLAGS += -DDEBUG
endif
```

---

## Multi-line variables

```makefile
define HELP_TEXT
Usage: make [target]
  all    - build everything
  clean  - remove build artifacts
endef

help:
	@echo '$(HELP_TEXT)'
```

---

## Order-only prerequisites

```makefile
# build/ must exist, but its timestamp doesn't trigger rebuild
build/%.o: src/%.c | build
	$(CC) -c -o $@ $<
```

---

## Recursive make (use sparingly)

```makefile
SUBDIRS := lib src

.PHONY: all $(SUBDIRS)
all: $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@
```

Prefer a flat include-based approach over recursive make for correctness.

---

## Command line overrides

```bash
make CFLAGS="-O3 -march=native"    # override variable
make CC=clang                       # change compiler
make -n                             # dry run (print commands)
make -B                             # force rebuild all
make -k                             # keep going on error
make -j$(nproc)                     # parallel
make -p                             # print database (all rules)
make --warn-undefined-variables     # catch typos
```
