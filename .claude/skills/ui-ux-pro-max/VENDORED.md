# Vendored: UI/UX Pro Max

- Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Commit: `e59ff376a41f7ca47b7541ad5c116495cbade3ee`
- Copied: the upstream `.claude/skills/ui-ux-pro-max/` folder, plus the repo's root `LICENSE` (MIT) into this folder. `__pycache__` directories were dropped.

## Local edit (the only one)

`SKILL.md` invoked the search script as
`"${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py"`, which only resolves
when the skill is installed as a plugin. Every occurrence was changed to the repo-relative
`".claude/skills/ui-ux-pro-max/scripts/search.py"`, so commands must be run from the repo root:

```bash
python3 -I .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style -n 1
```

Upstream's `scripts/tests/test_skill_script_paths.py` checks for the plugin form in the core
`SKILL.md`, so that one upstream test is expected to disagree with this edit. Nothing else was changed.
