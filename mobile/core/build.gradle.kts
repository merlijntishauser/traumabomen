plugins {
    kotlin("multiplatform") version "2.3.21"
    kotlin("plugin.serialization") version "2.3.21"
    id("app.cash.sqldelight") version "2.3.2"
}

group = "org.traumabomen"
version = "0.1.0"

repositories {
    mavenCentral()
}

// libsodium is built from the official source tarball (pinned SHA-256) for
// each iOS target; the cinterop below binds the resulting static libraries.
val libsodiumDir = layout.buildDirectory.dir("libsodium")

val buildLibsodium = tasks.register<Exec>("buildLibsodium") {
    commandLine("scripts/build-libsodium.sh", libsodiumDir.get().asFile.absolutePath)
    outputs.dir(libsodiumDir)
}

// The crypto compatibility fixture is shared with the frontend; generating
// it into common test sources lets the same tests run on the JVM and on the
// iOS simulator, where reading repo files at runtime is not an option.
val generateCryptoFixture = tasks.register("generateCryptoFixture") {
    val fixture = rootDir.resolve("../../frontend/src/fixtures/crypto-compat.fixture.json")
    val outDir = layout.buildDirectory.dir("generated/cryptoFixture")
    inputs.file(fixture)
    outputs.dir(outDir)
    doLast {
        val target = outDir.get().asFile.resolve("org/traumabomen/core/crypto/CryptoFixtureJson.kt")
        target.parentFile.mkdirs()
        target.writeText(
            "package org.traumabomen.core.crypto\n\n" +
                "// Generated from frontend/src/fixtures/crypto-compat.fixture.json; do not edit.\n" +
                "internal const val CRYPTO_FIXTURE_JSON: String = \"\"\"${fixture.readText()}\"\"\"\n",
        )
    }
}

kotlin {
    jvmToolchain(17)

    compilerOptions {
        // expect/actual classes are the designed seam between commonMain and
        // the platform crypto bindings; accept the Beta status deliberately.
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    // The JVM target runs the shared compatibility suite in CI and feeds the
    // future Android app.
    jvm()

    // iOS targets bind libsodium (Argon2id + AES-256-GCM) via cinterop.
    val libsodiumTargetDirs = mapOf(
        "iosArm64" to "ios-arm64",
        "iosSimulatorArm64" to "ios-simulator-arm64",
    )
    // The app consumes the core as an XCFramework
    // (gradle assembleTraumabomenCoreXCFramework -> build/XCFrameworks).
    val xcf = org.jetbrains.kotlin.gradle.plugin.mpp.apple.XCFrameworkConfig(project, "TraumabomenCore")
    iosArm64 {
        binaries.framework {
            baseName = "TraumabomenCore"
            isStatic = true
            xcf.add(this)
        }
    }
    iosSimulatorArm64 {
        binaries.framework {
            baseName = "TraumabomenCore"
            isStatic = true
            xcf.add(this)
        }
        // Run tests on a simulator device that exists in this Xcode.
        testRuns.configureEach { deviceId = "iPhone 17 Pro" }
    }
    targets.withType<org.jetbrains.kotlin.gradle.plugin.mpp.KotlinNativeTarget>().configureEach {
        val dir = libsodiumTargetDirs.getValue(name)
        compilations.getByName("main").cinterops.create("libsodium") {
            definitionFile.set(file("src/nativeInterop/cinterop/libsodium.def"))
            includeDirs(libsodiumDir.map { it.dir("$dir/include") })
            extraOpts(
                "-libraryPath", libsodiumDir.get().asFile.resolve("$dir/lib").absolutePath,
                "-staticLibrary", "libsodium.a",
            )
        }
        compilations.configureEach {
            compileTaskProvider.configure { dependsOn(buildLibsodium) }
        }
    }

    // The cinterop tasks read the libsodium headers and static libraries.
    tasks.matching { it.name.startsWith("cinteropLibsodium") }.configureEach {
        dependsOn(buildLibsodium)
    }

    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
            implementation("app.cash.sqldelight:runtime:2.3.2")
            // HTTP only; JSON stays explicit kotlinx-serialization so every
            // payload byte is visible in this codebase.
            implementation("io.ktor:ktor-client-core:3.5.1")
        }
        iosMain.dependencies {
            implementation("io.ktor:ktor-client-darwin:3.5.1")
            implementation("app.cash.sqldelight:native-driver:2.3.2")
        }
        jvmMain.dependencies {
            implementation("io.ktor:ktor-client-cio:3.5.1")
            implementation("app.cash.sqldelight:sqlite-driver:2.3.2")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
        commonTest {
            kotlin.srcDir(generateCryptoFixture)
        }
        jvmTest.dependencies {
            implementation("app.cash.sqldelight:sqlite-driver:2.3.2")
            implementation("io.ktor:ktor-client-mock:3.5.1")
        }
        jvmMain.dependencies {
            // Argon2id for the JVM actual. The web derivation equivalence of
            // the libsodium implementation (the iOS actual) is proven in
            // mobile/spikes/crypto-compat; this suite proves BC against the
            // same fixture, so all three implementations are pinned to one
            // golden derivation.
            implementation("org.bouncycastle:bcprov-jdk18on:1.84")
        }
    }
}

sqldelight {
    databases {
        create("CoreDatabase") {
            packageName.set("org.traumabomen.core.db")
        }
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
