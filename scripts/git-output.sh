#!/usr/bin/env bash
# Captures what Git prints, so the pages under /git quote it instead of typing it (docs/design/website-content.md).
# Each scenario builds a small history in a scratch directory, with fixed authors and dates so the hashes are the
# same on every run, then shows the commands a page quotes with their output, as a terminal prints them, into
# web/captures/<scenario>.txt. The file's first line names the Git that printed it; a new Git release means running
# this again and reading the diff.
#
# Usage: scripts/git-output.sh                  # every scenario
#        scripts/git-output.sh push-force       # one or more by name
#        GIT=/opt/homebrew/bin/git scripts/git-output.sh   # a Git other than the one on PATH
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

GIT="${GIT:-git}"
PINNED="2.56.0" # the pages are written against this version; a capture from another is marked as such
version=$("$GIT" --version | sed 's/^git version //')
[[ "$version" == "$PINNED"* ]] || echo "warning: capturing with git $version, not the pinned $PINNED" >&2

out="$PWD/web/captures" # absolute: the scenarios change directory
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Nothing from this machine leaks in: no user or system config, no colors, no pager, English, and a fixed clock.
export HOME="$work" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_PAGER=cat PAGER=cat TERM=dumb LC_ALL=C
export GIT_EDITOR=true # a merge or a continued rebase keeps the message Git proposes
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=init.defaultBranch GIT_CONFIG_VALUE_0=main
export GIT_CONFIG_KEY_1=color.ui GIT_CONFIG_VALUE_1=never

clock=0
tick() {
  clock=$((clock + 1))
  export GIT_AUTHOR_DATE="2026-10-04T12:$(printf '%02d' "$clock"):00+0000"
  export GIT_COMMITTER_DATE="$GIT_AUTHOR_DATE"
}

as() { cd "$work/$1"; }                      # work as ana or bot
run() { "$GIT" "$@" >/dev/null 2>&1; }       # a command the page doesn't quote
cr=$(printf '\r')
show() {                                     # a command the page quotes, with its output as a terminal leaves it:
  printf '$ git %s\n' "$*"                   # progress Git writes over with a carriage return ("Rebasing (1/1)")
  "$GIT" "$@" 2>&1 | sed -e "s/.*${cr}//" || true # is gone, as it is on the screen
}
commit() {                                   # commit <file> <message>: one more line in the file
  tick
  printf 'line %s\n' "$clock" >>"$1"
  run add "$1"
  run commit -q -m "$2"
}

# A fresh origin with one commit on main, and a clone each for ana and bot, each knowing the remote as ../origin.git.
fresh() {
  rm -rf "$work/origin.git" "$work/ana" "$work/bot"
  clock=0
  run init -q --bare "$work/origin.git"
  for who in ana bot; do
    run clone -q "$work/origin.git" "$work/$who"
    run -C "$work/$who" config user.name "$who"
    run -C "$work/$who" config user.email "$who@example.com"
    run -C "$work/$who" remote set-url origin ../origin.git
  done
  as ana
  commit README.md "readme: the project"
  commit api.py "api: the first endpoint"
  run push -u origin main
  as bot
  run pull
}

# bot's commit lands on origin first; ana commits on top of the old tip
race() {
  fresh
  as bot
  commit api.py "api: add the endpoint"
  run push
  as ana
  commit auth.js "auth: check the token"
}

scenario_push_non_fast_forward() { race; run fetch; show push; }
scenario_push_fetch_first() { race; show push; }
scenario_push_after_pull_rebase() { race; run fetch; show pull --rebase; show push; }
scenario_push_after_pull_merge() { race; run fetch; show pull --no-rebase; show push; }
scenario_pull_divergent() { race; run fetch; show pull; }
scenario_push_force() { race; run fetch; show push --force; }
scenario_push_force_with_lease() { race; show push --force-with-lease; run fetch; show push --force-with-lease; }
scenario_fetch_after_force() { race; run fetch; run push --force; as bot; show fetch; show status; }
scenario_push_everything_up_to_date() { fresh; as ana; show push; }
scenario_pull_already_up_to_date() { fresh; as ana; show pull; }
scenario_pull_fast_forward() { fresh; as bot; commit api.py "api: add the endpoint"; run push; as ana; show pull; }
scenario_status_ahead() { fresh; as ana; commit auth.js "auth: check the token"; show status; }
scenario_status_up_to_date() { fresh; as ana; show status; }
scenario_pull_conflict_merge() { same_file; show pull --no-rebase; show diff; keep_both; show add api.py; show commit --no-edit; }
scenario_pull_conflict_rebase() { same_file; show pull --rebase; show status; keep_both; show add api.py; show rebase --continue; }
scenario_pull_rebase_ours() { same_file; show pull --rebase -X ours; show log --oneline; }
scenario_pull_rebase_theirs() { same_file; show pull --rebase -X theirs; show log --oneline; show diff origin/main; }

# both touch the same place in api.py: bot's change lands first, ana's is built on the old tip
same_file() {
  fresh
  as bot
  commit api.py "api: add the endpoint"
  run push
  as ana
  commit api.py "api: rename the endpoint"
}

# how a person resolves that conflict by hand: the file with both sides' lines, the markers gone
keep_both() { printf 'line 2\nline 3\nline 4\n' >api.py; }

descriptions() {
  cat <<'EOF'
push-non-fast-forward: ana pushes a commit built on the old tip after bot's push landed; she fetched, so her clone knows it is behind
push-fetch-first: the same race, but ana never fetched, so her clone has not seen bot's commit at all
push-after-pull-rebase: after that rejection, ana pulls with --rebase, which puts her commit on top of bot's, and pushes again
push-after-pull-merge: the same recovery with a merge instead of a rebase
pull-divergent: a plain pull when the branches have diverged and no choice between rebase and merge is configured
push-force: ana pushes with --force instead of pulling: bot's commit is erased from origin's main
push-force-with-lease: the same push with --force-with-lease, refused while ana's clone is stale, taken once she fetched
fetch-after-force: bot fetches after ana's forced push and sees origin/main moved backwards
push-everything-up-to-date: ana pushes when origin already has everything she has
pull-already-up-to-date: ana pulls when origin has nothing she lacks
pull-fast-forward: ana pulls bot's commit onto a branch where she has nothing new, so main simply moves forward
status-ahead: ana has a commit origin lacks, and asks git status
status-up-to-date: ana's main and origin's are the same commit, and she asks git status
pull-conflict-merge: bot and ana changed the same place in api.py; ana's pull merges, stops on the conflict, and she resolves it by hand
pull-conflict-rebase: the same pull with --rebase; the rebase stops on the conflict, and she resolves it and continues
pull-rebase-ours: the same pull with --rebase -X ours, which keeps the side already on main and drops ana's
pull-rebase-theirs: the same pull with --rebase -X theirs, which keeps ana's side of the clash
EOF
}

names=("$@")
if ((${#names[@]} == 0)); then
  while IFS=: read -r name _; do names+=("$name"); done < <(descriptions)
fi

mkdir -p "$out"
for name in "${names[@]}"; do
  description=$(descriptions | sed -n "s/^$name: //p")
  [[ -n "$description" ]] || { echo "fatal: no scenario $name" >&2; exit 1; }
  {
    printf '# git version %s\n# %s: %s\n' "$version" "$name" "$description"
    "scenario_${name//-/_}"
  } >"$out/$name.txt"
  echo "$out/$name.txt"
done
