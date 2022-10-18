#!/bin/sh

package_version=`npm show . version`

for target in esm cjs; do
    cat >build/$target/package.json <<!EOF
{
    "version": "$package_version"
}
!EOF
done
