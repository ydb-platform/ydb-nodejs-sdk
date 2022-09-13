#!/bin/sh

package_version=`npm show . version`

for target in esm cjs; do
    cp -R certs build/$target/src/
    [[ $target == "esm" ]] && type="module" || type="commonjs"
    cat >build/$target/package.json <<!EOF
{
    "version": "$package_version",
    "type": "$type"
}
!EOF
done
