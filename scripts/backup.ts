import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createWriteStream, createReadStream } from "node:fs";
import { google } from "googleapis";

const require = createRequire(import.meta.url);
const yazl = require("yazl");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const oauthClientPath = process.env.GOOGLE_OAUTH_CLIENT_PATH;
const oauthTokenPath = process.env.GOOGLE_OAUTH_TOKEN_PATH;
const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!supabaseUrl) throw new Error("SUPABASE_URL is missing");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
if (!oauthClientPath) throw new Error("GOOGLE_OAUTH_CLIENT_PATH is missing");
if (!oauthTokenPath) throw new Error("GOOGLE_OAUTH_TOKEN_PATH is missing");
if (!googleDriveFolderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing");

const supabase = createClient(supabaseUrl, serviceRoleKey);

const tables = ["buildings", "floors", "rooms", "tenants", "payments"];

async function backupTable(tableName: string) {
  const { data, error } = await supabase.from(tableName).select("*");

  if (error) {
    throw new Error(`Failed backing up ${tableName}: ${error.message}`);
  }

  console.log(`✅ ${tableName}: ${data.length} records`);
  return data;
}

function createZip(jsonFilePath: string, zipFilePath: string) {
  return new Promise<void>((resolve, reject) => {
    const zipfile = new yazl.ZipFile();

    zipfile.addFile(jsonFilePath, "rentmanager-backup.json");

    const output = createWriteStream(zipFilePath);

    output.on("close", () => resolve());
    output.on("error", (error: Error) => reject(error));

    zipfile.outputStream.pipe(output);
    zipfile.end();
  });
}

function getDriveClient() {
  const credentials = JSON.parse(
    fsSync.readFileSync(oauthClientPath as string, "utf-8")
  );
  const tokens = JSON.parse(
    fsSync.readFileSync(oauthTokenPath as string, "utf-8")
  );

  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  oAuth2Client.setCredentials(tokens);

  return google.drive({ version: "v3", auth: oAuth2Client });
}

async function uploadToDrive(zipFilePath: string) {
  const drive = getDriveClient();

  const fileName = path.basename(zipFilePath);

  console.log(`⬆️  Uploading ${fileName} to Google Drive...`);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [googleDriveFolderId as string],
    },
    media: {
      mimeType: "application/zip",
      body: createReadStream(zipFilePath),
    },
    fields: "id, webViewLink",
  });

  console.log(`✅ Uploaded to Drive (file id: ${response.data.id})`);
  if (response.data.webViewLink) {
    console.log(`🔗 ${response.data.webViewLink}`);
  }
}

async function cleanupOldDriveBackups() {
  const drive = getDriveClient();

  console.log("🧹 Checking for old backups to clean up...");

  const response = await drive.files.list({
    q: `'${googleDriveFolderId}' in parents and name contains 'rentmanager-backup-' and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
  });

  const files = response.data.files || [];

  const KEEP_MINIMUM = 5;
  const MAX_AGE_DAYS = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

  // Always keep the most recent KEEP_MINIMUM backups untouched,
  // regardless of age — this is the safety net against accidental
  // deletion of everything if the date logic ever misbehaves.
  const filesToConsider = files.slice(KEEP_MINIMUM);

  const filesToDelete = filesToConsider.filter((file) => {
    if (!file.createdTime) return false;
    return new Date(file.createdTime) < cutoffDate;
  });

  if (filesToDelete.length === 0) {
    console.log("✅ No old backups to delete.");
    return;
  }

  console.log(
    `🗑️  Deleting ${filesToDelete.length} backup(s) older than ${MAX_AGE_DAYS} days...`
  );

  for (const file of filesToDelete) {
    try {
      await drive.files.delete({ fileId: file.id as string });
      console.log(`   Deleted: ${file.name}`);
    } catch (err) {
      console.error(`   Failed to delete ${file.name}:`, err);
    }
  }

  console.log(
    `✅ Cleanup complete. ${filesToDelete.length} old backup(s) removed.`
  );
}

async function runBackup() {
  console.log("==================================");
  console.log(" Rent Manager Backup");
  console.log("==================================");

  const backupData: {
    createdAt: string;
    tables: Record<string, unknown>;
  } = {
    createdAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of tables) {
    backupData.tables[table] = await backupTable(table);
  }

  const backupFolder = path.join(process.cwd(), "backups");
  await fs.mkdir(backupFolder, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(backupFolder, `temp-${timestamp}.json`);
  const zipPath = path.join(
    backupFolder,
    `rentmanager-backup-${timestamp}.zip`
  );

  await fs.writeFile(jsonPath, JSON.stringify(backupData, null, 2));
  await createZip(jsonPath, zipPath);
  await fs.unlink(jsonPath);

  console.log("");
  console.log(`📦 ZIP created: ${zipPath}`);

  await uploadToDrive(zipPath);
  await cleanupOldDriveBackups();

  console.log("");
  console.log("🎉 Backup completed!");
}

runBackup().catch((error) => {
  console.error("❌ Backup failed:");
  console.error(error.message);
  process.exit(1);
});