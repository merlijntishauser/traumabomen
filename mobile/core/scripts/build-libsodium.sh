#!/bin/sh
# Build libsodium static libraries for the Kotlin/Native iOS targets from
# the official source tarball (pinned version + SHA-256, verified before
# unpacking). Invoked by Gradle; results are cached under the build dir and
# rebuilt only when missing.
#
# Usage: build-libsodium.sh <build-dir>

set -eu

VERSION="1.0.22"
SHA256="adbdd8f16149e81ac6078a03aca6fc03b592b89ef7b5ed83841c086191be3349"
BASE_URL="https://download.libsodium.org/libsodium/releases"

BUILD_DIR="$1"
TARBALL="libsodium-$VERSION.tar.gz"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

if [ ! -f "$TARBALL" ]; then
    curl -sfO "$BASE_URL/$TARBALL"
fi
echo "$SHA256  $TARBALL" | shasum -a 256 -c - >/dev/null

build_target() {
    name="$1"
    sdk="$2"
    triple="$3"

    if [ -f "$BUILD_DIR/$name/lib/libsodium.a" ]; then
        echo "libsodium $name: cached"
        return 0
    fi

    echo "libsodium $name: building"
    rm -rf "$BUILD_DIR/src-$name"
    mkdir "$BUILD_DIR/src-$name"
    tar xzf "$TARBALL" -C "$BUILD_DIR/src-$name" --strip-components=1

    sdkpath="$(xcrun --sdk "$sdk" --show-sdk-path)"
    cd "$BUILD_DIR/src-$name"
    ./configure \
        --host=aarch64-apple-darwin \
        --prefix="$BUILD_DIR/$name" \
        --disable-shared \
        --with-pic \
        CC="$(xcrun --sdk "$sdk" -f clang)" \
        CFLAGS="-O2 -arch arm64 -isysroot $sdkpath -target $triple" \
        LDFLAGS="-arch arm64 -isysroot $sdkpath -target $triple" \
        >/dev/null
    make -j"$(sysctl -n hw.ncpu)" install >/dev/null
    cd "$BUILD_DIR"
    rm -rf "$BUILD_DIR/src-$name"
    echo "libsodium $name: done"
}

# Directory names match the Kotlin/Native target naming used in Gradle.
build_target "ios-arm64" "iphoneos" "arm64-apple-ios14.0"
build_target "ios-simulator-arm64" "iphonesimulator" "arm64-apple-ios14.0-simulator"
