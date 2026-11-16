pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "tapperl-einrichtung"
include(":core")
// Die Android-App nur einbinden, wenn ein Android-SDK vorhanden ist (die Protokoll-Tests laufen auch ohne).
val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
    ?: file("local.properties").takeIf { it.exists() }?.readLines()?.firstOrNull { it.startsWith("sdk.dir=") }?.substringAfter("=")
if (sdk != null) include(":app")
