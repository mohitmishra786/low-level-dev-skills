#!/usr/bin/env python3
"""Check every skill against the rules in AGENTS.md.

Usage: python3 scripts/check-skills.py [repo-root]
Exits non-zero and prints one line per problem if any check fails.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
skills_dir = root / "skills"
problems = []


def report(path, msg):
    problems.append(f"{path.relative_to(root)}: {msg}")


REQUIRED = ["## Purpose", "## Triggers", "## Workflow", "## Related skills"]
REF_RE = re.compile(r"`(skills/[a-z0-9-]+/[a-z0-9-]+)`")

for skill in sorted(skills_dir.glob("*/*/SKILL.md")):
    text = skill.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        report(skill, "missing YAML frontmatter")
        continue
    front, body = m.group(1), text[m.end():]

    name = re.search(r"^name:\s*(.+)$", front, re.M)
    desc = re.search(r"^description:\s*(.+)$", front, re.M)
    if not name or name.group(1).strip() != skill.parent.name:
        report(skill, f"frontmatter name must be '{skill.parent.name}'")
    for key, val in ((k, v) for k, v in re.findall(r"^(\w[\w-]*):[ \t]*(.*)$", front, re.M)):
        if val and val[0] not in "\"'|>" and re.search(r"\s#", val):
            report(skill, f"frontmatter '{key}' has an unquoted ' #' (YAML comment); quote the value")
    if not desc:
        report(skill, "frontmatter has no description")
    else:
        for clause in ("Use when", "Activates on"):
            if clause not in desc.group(1):
                report(skill, f"description lacks '{clause}'")

    headings = re.findall(r"^## .+$", body, re.M)
    for section in REQUIRED:
        if section not in [h.strip() for h in headings]:
            report(skill, f"missing section '{section}'")

    related = re.search(r"^## Related skills\s*$(.*?)(?=^## |\Z)", body, re.M | re.S)
    if related and len(REF_RE.findall(related.group(1))) < 2:
        report(skill, "Related skills needs 2+ `skills/<category>/<name>` references")

    if body.count("\n") > 500:
        report(skill, f"body is {body.count(chr(10))} lines (max 500)")

for md in sorted(skills_dir.rglob("*.md")):
    text = md.read_text(encoding="utf-8")
    for ref in REF_RE.findall(text):
        if not (root / ref / "SKILL.md").is_file():
            report(md, f"cross-reference to missing skill `{ref}`")
    in_block = False
    for lineno, line in enumerate(text.split("\n"), 1):
        if re.match(r"^\s*```", line):
            if not in_block and line.strip() == "```":
                report(md, f"line {lineno}: code block without language tag")
            in_block = not in_block

for p in problems:
    print(p)
count = len(list(skills_dir.glob("*/*/SKILL.md")))
print(f"{count} skills checked, {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
