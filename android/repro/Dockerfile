# Environnement du build de vérification (ticket 020) : proche du serveur de build de F-Droid (Debian trixie, JDK 21,
# SDK installé par sdkmanager, sources sous /home/vagrant/build/fr.langswap). `langswap release` y construit l'APK
# release non signé à partir des sources de la version, puis compare avec l'APK signé (apksigcopier compare) :
# s'ils diffèrent, F-Droid ne pourra pas publier l'APK de l'auteur, et rien n'est publié.
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jdk-headless unzip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV ANDROID_HOME=/opt/android-sdk
RUN curl -sSfL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    && echo "7ec965280a073311c339e571cd5de778b9975026cfcbe79f2b1cdcb1e15317ee  /tmp/tools.zip" | sha256sum -c \
    && mkdir -p $ANDROID_HOME/cmdline-tools && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
    && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && rm /tmp/tools.zip \
    && yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses >/dev/null \
    && $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" >/dev/null
RUN useradd -m vagrant
USER vagrant
WORKDIR /home/vagrant/build/fr.langswap/android/langswap
CMD ["./gradlew", "--no-daemon", "assembleRelease"]
