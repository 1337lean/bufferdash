#!/usr/bin/env bash
set -euo pipefail

deploy_dir="${BUFFERDASH_DEPLOY_DIR:-/opt/bufferdash}"
requested_command="${SSH_ORIGINAL_COMMAND:-}"

fail() {
  echo "Deployment rejected: $*" >&2
  exit 1
}

if [[ "$requested_command" =~ ^deploy[[:space:]]+([0-9a-f]{40})$ ]]; then
  deploy_sha="${BASH_REMATCH[1]}"
else
  fail "expected: deploy <40-character commit SHA>"
fi

command -v git >/dev/null 2>&1 || fail "git is not installed"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v flock >/dev/null 2>&1 || fail "flock is not installed"
[ -d "$deploy_dir/.git" ] || fail "$deploy_dir is not a Git checkout"

exec 9>"${HOME}/.bufferdash-deploy.lock"
flock -w 1800 9 || fail "another deployment did not finish within 30 minutes"

cd "$deploy_dir"

branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
[ "$branch" = "main" ] || fail "$deploy_dir must be checked out on main"

if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  fail "$deploy_dir has tracked or untracked changes"
fi

git fetch --prune origin refs/heads/main:refs/remotes/origin/main
git cat-file -e "${deploy_sha}^{commit}" 2>/dev/null || fail "commit $deploy_sha was not fetched"
git merge-base --is-ancestor "$deploy_sha" refs/remotes/origin/main || fail "commit $deploy_sha is not on origin/main"

if git merge-base --is-ancestor "$deploy_sha" HEAD; then
  echo "Commit $deploy_sha is already deployed or superseded by $(git rev-parse HEAD)."
  exit 0
fi

git merge-base --is-ancestor HEAD "$deploy_sha" || fail "commit $deploy_sha is not a fast-forward from $(git rev-parse HEAD)"
git merge --ff-only "$deploy_sha"

scripts/deploy-production.sh .env

