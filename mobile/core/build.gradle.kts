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

kotlin {
    jvmToolchain(17)

    compilerOptions {
        // expect/actual classes are the designed seam between commonMain and
        // the platform crypto bindings; accept the Beta status deliberately.
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    // The JVM target runs the shared compatibility suite in CI and feeds the
    // future Android app. The iOS targets (iosArm64, iosSimulatorArm64) land
    // together with the libsodium cinterop actuals; the expect declarations
    // in commonMain already define the seam they must fill.
    jvm()

    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
            implementation("app.cash.sqldelight:runtime:2.3.2")
            // HTTP only; JSON stays explicit kotlinx-serialization so every
            // payload byte is visible in this codebase.
            implementation("io.ktor:ktor-client-core:3.5.1")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
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
    // Canonical cross-platform fixture, shared with the frontend Vitest
    // guard (frontend/src/lib/cryptoCompat.unit.test.ts).
    systemProperty(
        "cryptoFixture",
        rootDir.resolve("../../frontend/src/fixtures/crypto-compat.fixture.json").absolutePath,
    )
}
