# The process of release a new version of the SDK

All commits to the project have to follow to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)

The github action https://github.com/gravity-ui/release-action is used for releases.

In short, for any commit with *feat:* and *bug:* prefixes, a release PR is created and subsequent commits are added to it.
To release a version to npm, a release PR must be accepted.

If you have questions about releases, you can ask them in the [Data UI: Open Source group](https://t.me/+mB1K40iDo0hmYTU6).

To run releases, you need to have admin rights in the github project.

Secrets required for release are stored in YDB_PLATFORM_BOT_TOKEN_REPO and NODE_AUTH_TOKEN variables.  And can be
altered by github project admin.

**Important**: After performing a release, you should check that the new version has appeared in npm. If the version
has not been updated, then to repeat the release you need to make a new commit without changing code with
*bug: npm update* subject and repeat the release.
