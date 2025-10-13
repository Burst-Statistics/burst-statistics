#!/bin/bash
# Check if a commands exists
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "Error: $1 could not be found."
    exit 1
  fi
}
check_command wp
check_command scp
check_command ssh
check_command zip

# Define plugin and language file names
plugin_name="burst-statistics"
language_file_prefix="burst-statistics"

AUTOMATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$AUTOMATION_DIR")"
PLUGINS_DIR="$(dirname "$PLUGIN_DIR")"


UPDATES_DIR="${PLUGINS_DIR}/updates"
echo "UPDATES_DIR: ${UPDATES_DIR}"

if [ "$(id -u)" -eq 0 ]; then
  echo "❌ This script should NOT be run as root. Exiting."
  exit 1
fi

#cleanup build directory and recreate
echo "remove obsolete directories from pre 2.0 versions"
cd "$PLUGIN_DIR" || { echo "Failed to change directory"; exit 1; }
rm -rf "settings"
rm -rf "dashboard-widget"
echo "Remove existing build directory"
cd "$PLUGIN_DIR/includes/Admin/App" || { echo "Failed to change directory"; exit 1; }
rm -rf "build"
echo "Run react build for App"
npm install --force
npm run build
npm run build:css
chown -R $(whoami):staff build/
chmod -R u+rwX,go+rX build/

cd "$PLUGIN_DIR/includes/Admin/Dashboard_Widget" || { echo "Failed to change directory"; exit 1; }
rm -rf "build";
echo "Run react build for the dashboard widget"
npm install --force
npm run build
chown -R $(whoami):staff build/
chmod -R u+rwX,go+rX build/


# Define function to create RC
create_rc_zip() {
	echo "Create RC for ${plugin_name}"
  echo "Create RC #1: Remove existing '${plugin_name}' directory if it exists"
  cd "${PLUGINS_DIR}" || { echo "Failed to change directory"; exit 1; }

  [ -d "${UPDATES_DIR}/${plugin_name}/" ] && rm -r "${UPDATES_DIR}/${plugin_name}/"
    echo "Create RC #1: Remove existing ZIP if it exists"

[ -f "${UPDATES_DIR}/${plugin_name}-${stable_tag}.zip" ] && rm -f "${UPDATES_DIR}/${plugin_name}-${stable_tag}.zip"

  mkdir -p "${UPDATES_DIR}/${plugin_name}"

  # Step 9: Use rsync to copy files to '${plugin_name}', excluding the defined files and directories
  # This step copies only the necessary files to create a clean '${plugin_name}' directory.
  echo "Create RC #2: Copying files to '${UPDATES_DIR}/${plugin_name}' directory"
  EXCLUDES=(
    "--exclude=screenshots/"
    "--exclude=*.l10n.php"
    "--exclude=.gitlab-ci-local"
    "--exclude=.git"
    "--exclude=e2e"
    "--exclude=phpstan.gitlab.neon"
    "--exclude=phpstan.neon"
    "--exclude=playwright-report"
    "--exclude=playwright.config.js"
    "--exclude=test-results"
    "--exclude=.min.min."
    "--exclude=.DS_Store"
    "--exclude=.idea"
    "--exclude=.gitlab-ci.yml"
    "--exclude=docker-compose.yml"
    "--exclude=.gitlab-ci-local.yml"
    "--exclude=phpunit.xml.dist"
    "--exclude=/tests/"
    "--exclude=/cypress/"
    "--exclude=/bin/"
    "--exclude=/tmp/"
    "--exclude=/vendor/"
    "--exclude=/automation/"
    "--exclude=composer.*"
    "--exclude=.phpcs.xml.dist"
    "--exclude=prepros.config"
    "--exclude=.eslint"
    "--exclude=composer.phar"
    "--exclude=composer.lock"
    "--exclude=package.json"
    "--exclude=package-lock.json"
    "--exclude=.editorconfig"
    "--exclude=gulpfile.js"
    "--exclude=/.phpunit.cache/"
    "--exclude=.phpunit.cache"
    "--exclude=phpcs.xml.dist"
    "--exclude=.eslintignore"
    "--exclude=.eslintrc.json"
    "--exclude=.gitignore"
    "--exclude=.github/"
    "--exclude=.gitlab/"
    "--exclude=.million/"
    "--exclude=webpack.config.js"
    "--exclude=phpstan.wp-env.neon"
    "--exclude=webpack.dev.js"
    "--exclude=webpack.prod.js"
    "--exclude=.travis.yml"
    "--exclude=cypress.config.js"
    "--exclude=.wp-env.json"
    "--exclude=.phpunit.result.cache"
    "--exclude=languages/*.json" #always exclude json files
    "--exclude=languages/*.po~" #loco translate backup files
    "--exclude=/node_modules/"
    "--exclude=/dashboard-widget/"
    "--exclude=/settings/"
    "--exclude=/includes/Admin/App/node_modules/"
    "--exclude=/includes/Admin/App/.tanstack"
    "--exclude=/includes/Admin/Dashboard_Widget/node_modules/"
    "--exclude=/includes/TeamUpdraft/SharedComponents/node_modules/"
    "--exclude=/includes/TeamUpdraft/Onboarding/node_modules/"
    "--exclude=/includes/TeamUpdraft/Other_Plugins/node_modules/"
    "--exclude=/includes/TeamUpdraft/vendor/"
    "--exclude=/src/Admin/App/"
    "--exclude=/src/Admin/Dashboard_Widget/"
    "--exclude=/mailer/maizzle/node_modules/"
    "--exclude=/docker-compose-bitnami.yml"
    "--exclude=/dist-build/"
    "--exclude=/dist/"
    "--exclude=/.idea/"
  )

    EXCLUDES+=("--exclude=languages/*.po")
    EXCLUDES+=("--exclude=languages/*.mo")


#rsync -aqr "${EXCLUDES[@]}" ${plugin_name}/. updates/${plugin_name}/ || { echo "rsync failed"; exit 1; }
rsync -aqr "${EXCLUDES[@]}" "${PLUGIN_DIR}/." "${UPDATES_DIR}/${plugin_name}/" || { echo "rsync failed"; exit 1; }

  # Step 10: Create a ZIP archive of the '${plugin_name}' directory, named according to the stable tag
  echo "Create RC #3: Creating a ZIP archive of the '${plugin_name}' directory within the 'updates' directory"
  echo "cd to ${UPDATES_DIR}"
  cd "${UPDATES_DIR}" || exit 1
  echo "Creating ZIP archive... "
zip -qr9 "${plugin_name}-${stable_tag}.zip" "${plugin_name}" || { echo "Failed to create ZIP archive"; exit 1; }
  echo "Create RC Done! Created 'updates/${plugin_name}-${stable_tag}.zip"
}

# Change to the directory where the script is located
# This ensures that all subsequent commands are run from the correct directory.
cd "$(dirname "$0")" || { echo "Failed to change directory"; exit 1; }
cd .. || { echo "Failed to change directory"; exit 1; }
echo "Changed to directory: $(pwd), starting script..."

# Extract the stable tag from readme.txt
stable_tag=$(grep "Stable tag:" "$PLUGIN_DIR/readme.txt" | awk '{print $NF}')
#cleanup build directory and recreate
echo "remove obsolete directories from pre 2.0 versions"
cd "$PLUGIN_DIR" || { echo "Failed to change directory"; exit 1; }
rm -rf "settings"
rm -rf "dashboard-widget"

echo "Creating RC only..."
create_rc_zip "true"
echo "RC creation complete."

