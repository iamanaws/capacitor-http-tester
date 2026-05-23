{
  description = "Capacitor HTTP tester development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    android.url = "github:tadfisher/android-nixpkgs/stable";
  };

  outputs =
    {
      self,
      nixpkgs,
      android,
    }:
    let
      systems = [
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          let
            pkgs = import nixpkgs {
              inherit system;
              config = {
                allowUnfree = true;
                android_sdk.accept_license = true;
              };
            };

            jdk = pkgs.jdk21;
            nodejs = pkgs.nodejs_22;

            buildToolsVersion = "36.0.0";
            ndkVersion = "26.1.10909125";

            androidSdk = android.sdk.${system} (
              sdkPackages:
              let
                buildTools = "build-tools-${builtins.replaceStrings [ "." ] [ "-" ] buildToolsVersion}";
                ndk = "ndk-${builtins.replaceStrings [ "." ] [ "-" ] ndkVersion}";
              in
              with sdkPackages;
              [
                cmdline-tools-latest
                emulator
                platform-tools
                platforms-android-36
                build-tools-35-0-0
                cmake-3-22-1
              ]
              ++ pkgs.lib.optionals (system == "x86_64-linux" || system == "x86_64-darwin") [
                system-images-android-36-google-apis-x86-64
              ]
              ++ pkgs.lib.optionals (system == "aarch64-darwin") [
                system-images-android-36-google-apis-arm64-v8a
              ]
              ++ [
                sdkPackages.${buildTools}
                sdkPackages.${ndk}
              ]
            );

            commonPackages =
              with pkgs;
              [
                androidSdk
                nodejs
                corepack
                jdk
                typescript
                typescript-language-server
                git
              ]
              ++ lib.optionals stdenv.isDarwin [
                cocoapods
              ];
          in
          f {
            inherit
              pkgs
              commonPackages
              system
              androidSdk
              jdk
              nodejs
              buildToolsVersion
              ndkVersion
              ;
          }
        );
    in
    {
      formatter = forSystems ({ pkgs, ... }: pkgs.nixfmt-tree);

      packages = forSystems (
        { pkgs, commonPackages, ... }:
        {
          default = pkgs.buildEnv {
            paths = commonPackages;
          };
        }
      );

      devShells = forSystems (
        {
          pkgs,
          commonPackages,
          system,
          jdk,
          buildToolsVersion,
          ndkVersion,
          ...
        }:
        {
          default = pkgs.mkShellNoCC {
            packages = commonPackages;

            JAVA_HOME = "${jdk}";

            shellHook = ''
              export ANDROID_HOME="$ANDROID_SDK_ROOT"
              export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
              export ANDROID_NDK_ROOT="$ANDROID_SDK_ROOT/ndk/${ndkVersion}"
              export GRADLE_OPTS="-Dorg.gradle.project.android.aapt2FromMavenOverride=$ANDROID_SDK_ROOT/build-tools/${buildToolsVersion}/aapt2"

              echo "--------------------------------------------------"
              echo "System: ${system}"
              echo "Capacitor Android Environment Activated"
              echo "Java Home (JAVA_HOME): $JAVA_HOME"
              echo "Android SDK Root (ANDROID_SDK_ROOT): $ANDROID_SDK_ROOT"
              echo "Android NDK Root (ANDROID_NDK_ROOT): $ANDROID_NDK_ROOT"
              echo "Node version: $(node --version)"
              echo "npm version: $(npm --version)"
              echo "--------------------------------------------------"
            '';
          };
        }
      );
    };
}
