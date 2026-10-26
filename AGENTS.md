## Git workflow

- You may inspect git status, git diff, git log and git blame.
- You may create commits when explicitly requested.
- Never push to a remote unless explicitly requested.
- Never use git reset --hard.
- Never force push.
- Never amend an existing commit unless explicitly requested.
- Do not discard user changes that you did not create.

## Model storage

- Whenever a model is available on Hugging Face, download and load it through the standard shared Hugging Face cache (`~/.cache/huggingface/hub` by default), so other projects and applications under the same user can reuse it without downloading it again.
- Do not create project-specific model caches or override the shared cache with repository-local paths. Respect the standard Hugging Face environment configuration consistently across downloads, inference workers, and model inventory tools.
- Models must be visible through `hf cache ls` without a project-specific `--cache-dir` argument. Reuse existing cached weights; when migrating legacy project-local caches, preserve their files and snapshot links without downloading the weights again.
