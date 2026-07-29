import "dotenv/config";
import { google } from "googleapis";
import fs from "node:fs";
import readline from "node:readline";

const credentials = JSON.parse(
  fs.readFileSync("./credentials/oauth-client.json", "utf-8")
);

const { client_id, client_secret, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

console.log("Open this URL in your browser:");
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("\nPaste the code you got here: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(
    "./credentials/drive-token.json",
    JSON.stringify(tokens, null, 2)
  );
  console.log("✅ Token saved to credentials/drive-token.json");
  rl.close();
});