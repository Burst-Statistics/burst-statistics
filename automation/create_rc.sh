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
plugin_name="burst-pro"
language_file_prefix="burst-statistics"

# Check if username is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

# Parse optional arguments
create_rc_only=false
if [[ "$2" == "--zip-only" ]]; then
  create_rc_only=true
fi

# Set username from the first argument
username="$1"

# Define variables
root_path="public_html/"
remote_path="public_html/wp-content"
# Get the directory of the current script

# Generate a timestamp
timestamp=$(date +"%Y%m%d%H%M%S")

# Define function to create RC
create_rc_zip() {
  exclude_languages="$1"
	# Step 1: Remove all .json files from the /languages/
	echo "Create RC for ${plugin_name}"
  echo "Create RC #1: Remove existing '${plugin_name}' directory and ZIP if they exist"
  cd .. || { echo "Failed to change directory"; exit 1; }

  [ -d "updates/${plugin_name}/" ] && rm -r updates/${plugin_name}/
  [ -f "updates/${plugin_name}-${stable_tag}.zip" ] && rm -r updates/${plugin_name}-${stable_tag}.zip

  # Step 9: Use rsync to copy files to '${plugin_name}', excluding the defined files and directories
  # This step copies only the necessary files to create a clean '${plugin_name}' directory.
  echo "Create RC #2: Copying files to 'updates/${plugin_name}' directory"
  EXCLUDES=(
    "--exclude=*.l10n.php"
    "--exclude=.git"
    "--exclude=.min.min."
    "--exclude=.DS_Store"
    "--exclude=.idea"
    "--exclude=.gitlab-ci.yml"
    "--exclude=phpunit.xml.dist"
    "--exclude=/tests/"
    "--exclude=/cypress/"
    "--exclude=/bin/"
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
    "--exclude=.million/"
    "--exclude=webpack.config.js"
    "--exclude=webpack.dev.js"
    "--exclude=webpack.prod.js"
    "--exclude=.travis.yml"
    "--exclude=cypress.config.js"
    "--exclude=.wp-env.json"
    "--exclude=.phpunit.result.cache"
    "--exclude=languages/*.json" #always exclude json files
    "--exclude=languages/*.po~" #loco translate backup files
    "--exclude=/node_modules/"
    "--exclude=/settings/node_modules/"
    "--exclude=/src/Admin/App/node_modules/"
    "--exclude=/src/Admin/Dashboard_Widget/node_modules/"
    "--exclude=/dashboard-widget/node_modules/"
    "--exclude=/mailer/maizzle/node_modules/"
  )

    # exclude src folder for pro plugin
    if [ "$plugin_name" == "burst-pro" ]; then
      EXCLUDES+=("--exclude=/settings/src/")
      EXCLUDES+=("--exclude=/dashboard-widget/src/")
      EXCLUDES+=("--exclude=/assets/js/src/")
      EXCLUDES+=("--exclude=/mailer/maizzle/") # maizzle is used to make template files, but they are build manually based on the maizzle code.
    fi

    #for RC zip generation for production, also exclude .po and .mo, as these are dynamically downloaded.
    if [ "$exclude_languages" == "true" ]; then
      EXCLUDES+=("--exclude=languages/*.po")
      EXCLUDES+=("--exclude=languages/*.mo")
    fi

  rsync -aqr "${EXCLUDES[@]}" ${plugin_name}/. updates/${plugin_name}/ || { echo "rsync failed"; exit 1; }

  # Step 10: Create a ZIP archive of the '${plugin_name}' directory, named according to the stable tag
  echo "Create RC #3: Creating a ZIP archive of the '${plugin_name}' directory within the 'updates' directory"
  cd updates || { echo "Failed to change directory"; exit 1; }
  zip -qr9 "${plugin_name}-${stable_tag}.zip" ${plugin_name} "__MACOSX" || { echo "Failed to create ZIP archive"; exit 1; }
  echo "Create RC Done! Created 'updates/${plugin_name}-${stable_tag}.zip"
}

download_pot_file() {
	# @todo make sure we are in the right folder
	# The right folder is the root of the plugin
	echo "Downloading .pot file"
	scp ${username}@translate.burst-statistics.com:"${remote_path}/plugins/${plugin_name}/languages/*.pot" languages
}

download_po_files() {
	# @todo make sure we are in the right folder
	# The right folder is the root of the plugin
	echo "Downloading .po files"
	scp ${username}@translate.burst-statistics.com:"${remote_path}/plugins/${plugin_name}/languages/*.po" languages
}

download_json_files() {
	# @todo make sure we are in the right folder
	# The right folder is the root of the plugin
	echo "Downloading .json files"
	scp ${username}@translate.burst-statistics.com:"${remote_path}/plugins/${plugin_name}/languages/*.json" languages
}

upload_json_files() {
  languages_dir="languages"
  scp "${languages_dir}"/*.json "${username}@translate.burst-statistics.com:${remote_path}/plugins/${plugin_name}/languages/" || { echo "scp upload jsons failed"; exit 1; }
}


upload_plugin() {

  zip_file="$1"

  # Define the relative path to the ZIP file
  zip_file_dir="${zip_file}"

	# cd to script dir
	cd "$(dirname "$0")" || { echo "Failed to change directory"; exit 1; }
	# Change to wp content/plugins/updates dir
	cd ../updates || { echo "Failed to change directory"; exit 1; }

	# Check if the ZIP file exists
	# Exit the script if the ZIP file is not found.
	if [ ! -f "$zip_file_dir" ]; then
		echo "File not found!"
		exit 1
	fi

	# Upload the ZIP file
  # This step uploads the ZIP file to the remote server.
  echo "Uploading ${zip_file_dir} to translate.burst-statistics.com:${remote_path}/plugins/"
  scp ${zip_file_dir} ${username}@translate.burst-statistics.com:"${remote_path}/plugins/" || { echo "scp failed"; exit 1; }

  # Rename the existing '${plugin_name}' folder, if it exists, and append the timestamp
  # This step renames any existing '${plugin_name}' folder to avoid conflicts.
  echo "Renaming existing '${plugin_name}' folder"
  ssh ${username}@translate.burst-statistics.com "if [ -d '${remote_path}/plugins/${plugin_name}' ]; then mv '${remote_path}/plugins/${plugin_name}' '${remote_path}/plugins-backup/${plugin_name}/${plugin_name}-${timestamp}'; fi" || { echo "ssh or mv failed"; exit 1; }

  # Unzip the new ZIP file
  # This step unzips the uploaded ZIP file.
  echo "Unzipping ${zip_file} to ${remote_path}/plugins/"
  ssh ${username}@translate.burst-statistics.com "unzip -q -o ${remote_path}/plugins/${zip_file} -d ${remote_path}/plugins/" || { echo "ssh or unzip failed"; exit 1; }

  # Optionally, remove the ZIP file from the server
  echo "Removing ${zip_file} from ${remote_path}/plugins/"
  ssh ${username}@translate.burst-statistics.com "rm ${remote_path}/plugins/${zip_file}"

  # Change back to burst-pro dir
  cd ../burst-pro || { echo "Failed to change directory"; exit 1; }
}

upload_zip_to_server() {
  echo "Step 3.1: Upload plugin to translate.burst-statistics.com"
  # cd to updates folder
  upload_plugin "${plugin_name}-${stable_tag}.zip"

	echo "Step 3.2: SSH Loco sync"

 relative_path="${remote_path}"
  #strip 'wp-content' from relative_path to get the relative path
  relative_path="${relative_path/wp-content/}"
  ssh ${username}@translate.burst-statistics.com "cd ${relative_path} && wp loco sync ${language_file_prefix} && echo \"Synced Loco: ${language_file_prefix}\"" || { echo "ssh or wp loco sync failed"; exit 1; }

	echo "Step 3.3: Download .po files and pot file "
	download_pot_file
  download_po_files

  echo "Step 3.4: Remove wp loco backup files from translate.burst-statistics.com"
  ssh ${username}@translate.burst-statistics.com "cd ${remote_path}/plugins/${plugin_name}/languages/ && rm -f ${language_file_prefix}-*.po~ && echo \"Deleted: ${language_file_prefix}*.po~\"" || { echo "ssh or rm failed for $target_lang"; exit 1; }

  # cd back to root of plugin
  cd "$(dirname "$0")" || { echo "Failed to change directory"; exit 1; }
}

# Change to the directory where the script is located
# This ensures that all subsequent commands are run from the correct directory.
cd "$(dirname "$0")" || { echo "Failed to change directory"; exit 1; }
cd .. || { echo "Failed to change directory"; exit 1; }
echo "Changed to directory: $(pwd), starting script..."

# Extract the stable tag from readme.txt
stable_tag=$(grep "Stable tag:" readme.txt | awk '{print $NF}')

#cleanup build directory and recreate
echo "Remove existing build directory"
cd "settings"; rm -rf "build";
echo "Run react build for settings"
npm install --force
npm run build
cd ..

cd "dashboard-widget"; rm -rf "build";
echo "Run react build for the dashboard widget"
npm install --force
npm run build
cd ..

# If only the RC should be created, run the function and exit
if $create_rc_only; then
  echo "Creating RC only..."
  create_rc_zip "true"
  echo "RC creation complete."
  exit 0
fi

# Step 1: Remove all .json files from the /languages/
echo "Step 1: Removing all .json files from /languages/"
find . -name "${language_file_prefix}-*.json" -print0 | xargs -0 rm

echo "Step 2: Downloading .pot file"
echo "downloading po files..."
download_po_files

echo "Step 2: Remote upload and sync with translate.burst-statistics.com"
create_rc_zip "false"
echo "upload zip to server "
upload_zip_to_server

echo "Step 4: Make MO"
wp i18n make-mo languages/

echo "Step 5: Create JSON files"
# This step breaks the .po files, because the react strings are removed from the .po files for some reason.
# because of this, we do not upload the entire plugin anymore, only the json files. which we need on the remove server
# for the Digital Ocean sync.
wp i18n make-json languages/

echo "Step 6: Upload JSON files"
upload_json_files

echo "Step 7: Sync to digital ocean"
ssh "${username}@translate.burst-statistics.com" "cd ${root_path} && wp cron event run auc_every_week_hook && echo 'started languages file sync to Digital Ocean'" || { echo "ssh languages file sync to digital ocean failed"; exit 1; }

# Create RC without translation files. They are on the server.
echo "Step 8: Create RC"
create_rc_zip "true"

# Translation files will be downloaded from the server, so don't be scared to see translation files.
echo "Done!"
