#!/bin/sh

package_version=`npm show . version`

cat >build/cjs/package.json <<!EOF
{
    "version": "$package_version",
    "type": "commonjs"
}
!EOF

cat >build/esm/package.json <<!EOF
{
    "version": "$package_version",
    "type": "module"
}
!EOF
