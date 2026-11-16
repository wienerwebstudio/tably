plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "at.tapperl.einrichtung"
    compileSdk = 35

    defaultConfig {
        applicationId = "at.tapperl.einrichtung"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "DEFAULT_API", "\"https://api.staging.tapperl.at\"")
    }

    // Optionaler Release-Schlüssel über Umgebungsvariablen (nie im Repository).
    val ks = System.getenv("TAPPERL_KEYSTORE")
    signingConfigs {
        if (ks != null) {
            create("release") {
                storeFile = file(ks)
                storePassword = System.getenv("TAPPERL_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TAPPERL_KEY_ALIAS") ?: "tapperl"
                keyPassword = System.getenv("TAPPERL_KEY_PASSWORD") ?: System.getenv("TAPPERL_KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ks != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core"))
}
