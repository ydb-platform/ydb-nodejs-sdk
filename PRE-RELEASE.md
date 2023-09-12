# PRE-RELEASE project preview

The idea of Pre-release is to let the project can be tried out before the official release when the project code is
committed to npm with a new version assignment.

GitHub action pre-release-branch-update takes action when an code update was pushed to the main (master)
branch.  The action performs the project build, enabling save the result in git, and saves the result to
the pre-release branch.

Later, this code can be tested by adding to a test project using command
*npm install https://github.com/ydb-platform/ydb-nodejs-sdk.git#pre-release*.

When making changes to a project and building a new pre-release version by git push. It is **necessary**
to update the code of the component in test projects via *npm update*.
