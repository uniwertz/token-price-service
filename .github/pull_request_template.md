## Summary
This PR implements a cleaner, tag-based deployment workflow and fixes critical CI/CD issues.

## Changes

### 🚀 Tag-based Deployment
- Implement semantic version tag deployment (`v*.*.*`)
- Simplify Docker image tagging (version + latest)
- Remove complex branch-based conditionals
- GitOps updates now push directly to main (no intermediate PRs)
- Security scans run only for tagged releases

### 🐛 Bug Fixes
- Fix "unable to read tree" error by using `actions/checkout@v5` instead of manual git clone
- Remove 24 stale branches (dependabot + old release branches)

### 🧹 Cleanup
- Reduce CI/CD code by ~40 lines
- Cleaner, more maintainable workflow
- Keep PR checks for code review

## Deployment Process
```bash
# 1. Merge PR to main
# 2. Create and push tag
git tag v1.0.0 && git push origin v1.0.0
# 3. CI/CD automatically deploys to production
```

## Commits
- `2e6135c` - feat: implement tag-based deployment workflow
- `c9419bf` - fix: use actions/checkout@v5 to resolve tree object errors
- `c5931e4` - Bump version
- `decc0ad` - Minor fix

## Testing
- ✅ All commits tested in dev branch
- ✅ Ready for PR checks validation
