/**
 * Thyroid Drive Bridge — creates files in Swapnil's Google Drive, AS Swapnil.
 *
 * WHY THIS EXISTS
 * The website's Google service account may no longer own Drive files: Google
 * answers "Service Accounts do not have storage quota". The two fixes Google
 * offers (a shared drive, domain-wide delegation) need a paid Workspace domain,
 * and this business runs on a consumer @gmail.com account. Deployed from his
 * own account with "Execute as: Me", this script creates the file as him, in
 * his quota, in the folder he made by hand. See lib/drive.ts.
 *
 * SOURCE OF TRUTH is the repo copy, scripts/drive-bridge.gs. Never edit only
 * the copy in the Apps Script editor.
 *
 * FIRST DEPLOY
 *   1. script.google.com → New project → paste this file over Code.gs.
 *   2. Project Settings (gear) → Script Properties → add SHARED_SECRET.
 *      The same value goes on the worker as DRIVE_BRIDGE_SECRET.
 *   3. Deploy → New deployment → type: Web app.
 *      Execute as: Me.  Who has access: Anyone.  → Deploy → Authorize.
 *      "Google hasn't verified this app" is expected for your own script:
 *      Advanced → Go to (project name) → Allow.
 *   4. Copy the Web app URL (ends in /exec) onto the worker as DRIVE_BRIDGE_URL.
 *
 * AFTER CHANGING THIS FILE
 *   Paste it again, then Deploy → Manage deployments → pencil → Version:
 *   New version → Deploy. That keeps the same /exec URL, so the worker needs
 *   nothing. "New deployment" would mint a new URL instead.
 *
 * Opening the /exec URL in a browser answers {"ok":true,...}: a check that
 * the deployment is live which needs no secret and reveals nothing.
 */

function doGet() {
  return reply_({ ok: true, service: "thyroid-drive-bridge", actions: ["ensureDoc"] });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return reply_({ ok: false, error: "bad_json" });
  }

  var expected = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (!expected) return reply_({ ok: false, error: "script_not_configured" });
  if (body.secret !== expected) return reply_({ ok: false, error: "unauthorized" });

  try {
    switch (body.action) {
      case "ensureDoc":
        return reply_(ensureDoc_(body));
      default:
        return reply_({ ok: false, error: "unknown_action", detail: String(body.action || "") });
    }
  } catch (err) {
    return reply_({ ok: false, error: "script_error", detail: String((err && err.message) || err).slice(0, 300) });
  }
}

/**
 * Find the Doc with this exact title in the folder, or make it.
 * Body: { folderId, title, heading, preface, sections: [{ heading, hint }] }
 */
function ensureDoc_(body) {
  var folder;
  try {
    folder = DriveApp.getFolderById(String(body.folderId || ""));
    folder.getName(); // touch it: an id that resolves to nothing must fail here, inside the try
  } catch (err) {
    return { ok: false, error: "folder_not_found" };
  }

  var title = String(body.title || "").slice(0, 200);
  if (!title) return { ok: false, error: "no_title" };

  // Phone and laptop pressing Notes at the same moment must not make two docs.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var same = folder.getFilesByName(title);
    while (same.hasNext()) {
      var f = same.next();
      if (!f.isTrashed()) return { ok: true, id: f.getId(), url: f.getUrl(), created: false };
    }

    var doc = DocumentApp.create(title);
    var b = doc.getBody();
    var H1 = DocumentApp.ParagraphHeading.HEADING1;
    var H2 = DocumentApp.ParagraphHeading.HEADING2;
    var P = DocumentApp.ParagraphHeading.NORMAL;

    // A new Doc starts with one empty paragraph: use it for the heading
    // rather than leaving a blank line above it.
    b.getParagraphs()[0].setText(String(body.heading || title)).setHeading(H1);
    if (body.preface) b.appendParagraph(String(body.preface)).setHeading(P);

    var sections = Array.isArray(body.sections) ? body.sections : [];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i] || {};
      b.appendParagraph(String(s.heading || "")).setHeading(H2);
      if (s.hint) b.appendParagraph(String(s.hint)).setHeading(P);
      b.appendParagraph("").setHeading(P); // the line he types on
    }
    doc.saveAndClose();

    // DocumentApp always creates in My Drive; move it where it belongs.
    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    return { ok: true, id: file.getId(), url: file.getUrl(), created: true };
  } finally {
    lock.releaseLock();
  }
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
