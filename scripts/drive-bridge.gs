/**
 * Thyroid Drive Bridge — makes files in Swapnil's Google Drive, AS Swapnil.
 *
 * WHY THIS EXISTS
 * The website's Google service account may no longer own Drive files: Google
 * answers "Service Accounts do not have storage quota". The two fixes Google
 * offers (a shared drive, domain-wide delegation) need a paid Workspace domain,
 * and this business runs on a consumer @gmail.com account. Deployed from his
 * own account with "Execute as: Me", this script creates the file as him, in
 * his quota, in the folder he made by hand. See lib/drive.ts.
 *
 * WHAT IT DOES (v2)
 * Everything about one woman lands in one folder inside his "Client Notes",
 * named "<Name> · <10 digits>": the notes Doc for each call, every report she
 * sends on WhatsApp, her consultation summary PDF. The folder is FOUND BY THE
 * DIGITS, never by the name — "Meera K." and "Meera Kulkarni" are one woman.
 * The worker sends one POST per job:
 *   pair          adopt the site's secret, the first time only
 *   clientFolder  her folder, made if she has none yet
 *   ensureDoc     the notes Doc for one call, made only if it is not there
 *   readDoc       a notes Doc read back, section by section
 *   saveFile      one file into her folder, at most once per dedupe key
 *
 * SOURCE OF TRUTH is the repo copy, scripts/drive-bridge.gs. Never edit only
 * the copy in the Apps Script editor. After editing it in the repo, run
 * `npm run sync:bridge`: lib/drive-bridge-source.ts is the copy the dashboard
 * hands out, and a test fails until the two match.
 *
 * FIRST DEPLOY
 *   1. script.google.com → New project → paste this file over Code.gs
 *      ("Connect Google Drive" on the dashboard has a Copy button for it).
 *   2. Deploy → New deployment → type: Web app.
 *      Execute as: Me.  Who has access: Anyone.  → Deploy → Authorize.
 *      "Google hasn't verified this app" is expected for your own script:
 *      Advanced → Go to (project name) → Allow.
 *   3. Copy the Web app URL (ends in /exec) and paste it into "Connect Google
 *      Drive" on the dashboard. That pairs it: the script keeps the secret the
 *      site sends the first time (trust on first use) and refuses any other
 *      afterwards. No Script Properties step.
 *
 * THE MANUAL WAY (still works; the worker's env vars win when they are set)
 *   Project Settings (gear) → Script Properties → add SHARED_SECRET, a long
 *   random value. The same value goes on the worker as DRIVE_BRIDGE_SECRET,
 *   and the Web app URL as DRIVE_BRIDGE_URL.
 *
 * TO PAIR AGAIN ("already paired", or a new site secret)
 *   Project Settings → Script Properties → delete SHARED_SECRET, then use
 *   "Connect Google Drive" again.
 *
 * AFTER CHANGING THIS FILE
 *   Paste it again, then Deploy → Manage deployments → Edit (pencil) →
 *   Version: New version → Deploy. That keeps the same /exec URL, so the
 *   worker and the pairing need nothing. "New deployment" would mint a new
 *   URL instead. Script Properties belong to the project, not the version,
 *   so the secret survives a redeploy.
 *
 * Opening the /exec URL in a browser answers {"ok":true,...}: a check that
 * the deployment is live, and which version it runs, that needs no secret and
 * reveals nothing.
 */

var VERSION_ = "v2";

/**
 * The grey italic that marks a hint line. readDoc recognises a hint by this
 * style rather than by its words, so a Doc made from an older template still
 * reads cleanly after the wording changes. Keep the two uses in step.
 */
var HINT_COLOR_ = "#757575";
var HEADER_SHADE_ = "#f3f3f3";
/** A pairing secret shorter than this is refused: a short one can be guessed. */
var MIN_SECRET_LENGTH_ = 16;
/** Seconds a folder this script made or found stays remembered (CacheService's maximum). */
var FOLDER_CACHE_SECONDS_ = 21600;
var LOCK_WAIT_MS_ = 20000;
/** Spelled out rather than MimeType.GOOGLE_DOCS: getMimeType() returns this string. */
var GOOGLE_DOC_MIME_ = "application/vnd.google-apps.document";

var ACTIONS_ = {
  clientFolder: clientFolder_,
  ensureDoc: ensureDoc_,
  readDoc: readDoc_,
  saveFile: saveFile_,
};

function doGet() {
  return reply_({
    ok: true,
    service: "thyroid-drive-bridge",
    version: VERSION_,
    actions: ["pair"].concat(Object.keys(ACTIONS_)),
  });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return reply_({ ok: false, error: "bad_json" });
  }
  if (!body || typeof body !== "object") return reply_({ ok: false, error: "bad_json" });

  try {
    return reply_(handle_(body));
  } catch (err) {
    return reply_({ ok: false, error: "script_error", detail: String((err && err.message) || err).slice(0, 300) });
  }
}

function handle_(body) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty("SHARED_SECRET");
  var action = String(body.action || "");

  // The one action an unpaired script answers: it is how it gets paired.
  if (action === "pair") return pair_(body, props, expected);

  if (!expected) return { ok: false, error: "script_not_configured" };
  if (body.secret !== expected) return { ok: false, error: "unauthorized" };

  // hasOwnProperty, so "toString" is an unknown action and not a function to run.
  var run = Object.prototype.hasOwnProperty.call(ACTIONS_, action) ? ACTIONS_[action] : null;
  if (!run) return { ok: false, error: "unknown_action", detail: action.slice(0, 60) };

  var root = rootFolder_(body.folderId);
  if (!root) return { ok: false, error: "folder_not_found" };
  return run(body, root);
}

/**
 * Trust on first use. The dashboard makes a random secret and sends it here;
 * while the script has none it adopts it, and from then on refuses any other.
 *
 * Nothing is adopted until the folder is proven readable: a wrong folder id
 * would otherwise pair the script with a secret the site then throws away,
 * and every later Connect would answer already_paired. With a secret already
 * set, a different one is refused before Drive is touched, so a stranger
 * cannot use this action to test folder ids.
 */
function pair_(body, props, expected) {
  var secret = typeof body.secret === "string" ? body.secret : "";
  if (expected) {
    if (secret !== expected) return { ok: false, error: "already_paired" };
    return rootFolder_(body.folderId) ? { ok: true, paired: false } : { ok: false, error: "folder_not_found" };
  }
  if (secret.length < MIN_SECRET_LENGTH_) {
    return { ok: false, error: "bad_secret", detail: "a pairing secret must be at least " + MIN_SECRET_LENGTH_ + " characters" };
  }
  if (!rootFolder_(body.folderId)) return { ok: false, error: "folder_not_found" };

  // Two Connect presses at once: only the first secret is kept.
  return withLock_(function () {
    var now = props.getProperty("SHARED_SECRET");
    if (now) return now === secret ? { ok: true, paired: false } : { ok: false, error: "already_paired" };
    props.setProperty("SHARED_SECRET", secret);
    return { ok: true, paired: true };
  });
}

/** Her folder, made if she has none yet. */
function clientFolder_(body, root) {
  var c = client_(body);
  if (!c.known) return { ok: false, error: "no_client" };
  return withLock_(function () {
    var r = ensureClientFolder_(root, c);
    return { ok: true, id: r.folder.getId(), url: r.folder.getUrl(), created: r.created };
  });
}

/**
 * The notes Doc for one call, in HER folder: found if it is there, made if it
 * is not.
 * Body: { phone, name, title, heading, preface, sections: NotesSection[] }
 * A request with no phone and no name (the v1 worker's) goes to the root
 * folder, as v1 did.
 */
function ensureDoc_(body, root) {
  var title = String(body.title || "").slice(0, 200);
  if (!title) return { ok: false, error: "no_title" };
  var c = client_(body);

  // Phone and laptop pressing Notes at the same moment must not make two docs.
  return withLock_(function () {
    var folder = c.known ? ensureClientFolder_(root, c).folder : root;
    var same = findNotesDoc_(folder, title);
    if (same) return { ok: true, id: same.getId(), url: same.getUrl(), title: same.getName(), created: false };

    var doc = DocumentApp.create(title);
    try {
      renderNotes_(doc.getBody(), body, title);
      doc.saveAndClose();
    } catch (err) {
      // A Doc that failed half-way is still a file in My Drive's root, outside
      // her folder, where the next press would never find it. Bin it, so a
      // failure leaves nothing behind but the error.
      try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (ignored) {}
      throw err;
    }

    // DocumentApp always creates in My Drive; move it where it belongs.
    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    return { ok: true, id: file.getId(), url: file.getUrl(), title: title, created: true };
  });
}

/**
 * The structure is the system's, the words are his. Per section: an H2, the
 * hint in grey italic, then where he types — a line, numbered slots, or a
 * table with a bold, shaded header row.
 */
function renderNotes_(body, req, title) {
  var H1 = DocumentApp.ParagraphHeading.HEADING1;
  var H2 = DocumentApp.ParagraphHeading.HEADING2;
  var P = DocumentApp.ParagraphHeading.NORMAL;
  var hints = [];
  var headerRows = [];

  // A new Doc starts with one empty paragraph: use it for the heading rather
  // than leaving a blank line above it. Every appended paragraph sets its
  // heading, because an appended paragraph can take the previous one's.
  // Two statements, never a chain: Paragraph.setText returns nothing (null in
  // V8), so `.setText(x).setHeading(H1)` threw "Cannot read properties of null
  // (reading 'setHeading')" on the first live press, 10-Nov-2026.
  var first = body.getParagraphs()[0];
  first.setText(String(req.heading || title));
  first.setHeading(H1);
  if (req.preface) body.appendParagraph(String(req.preface)).setHeading(P);

  var sections = Array.isArray(req.sections) ? req.sections : [];
  for (var i = 0; i < sections.length; i++) {
    var s = sections[i] || {};
    body.appendParagraph(String(s.heading || "")).setHeading(H2);
    if (s.hint) hints.push(body.appendParagraph(String(s.hint)).setHeading(P));

    var columns = Array.isArray(s.columns) ? s.columns.map(String) : [];
    if (s.kind === "table" && columns.length) {
      var cells = [columns];
      var rows = count_(s.rows, 3);
      for (var r = 0; r < rows; r++) cells.push(columns.map(blank_));
      var table = body.appendTable(cells);
      headerRows.push(table.getRow(0));
      // A Doc may not end on a table, and he needs a line below it anyway.
      body.appendParagraph("").setHeading(P);
    } else if (s.kind === "list") {
      var slots = count_(s.slots, 3);
      for (var k = 0; k < slots; k++) {
        body.appendListItem("").setGlyphType(DocumentApp.GlyphType.NUMBER);
      }
    } else {
      body.appendParagraph("").setHeading(P); // the line he types on
    }
  }

  // Styled last, once everything is in place: whatever is appended after a
  // styled paragraph can carry its style, and his typing line must not come
  // out grey italic like the hint above it.
  for (var h = 0; h < hints.length; h++) {
    hints[h].editAsText().setItalic(true).setForegroundColor(HINT_COLOR_);
  }
  for (var t = 0; t < headerRows.length; t++) {
    for (var c = 0; c < headerRows[t].getNumCells(); c++) {
      var cell = headerRows[t].getCell(c);
      cell.setBackgroundColor(HEADER_SHADE_);
      cell.editAsText().setBold(true);
    }
  }
}

/**
 * Read a notes Doc back, exactly as it stands. title "" means her newest one.
 * One section per H2, holding what sits between it and the next H2:
 * body-level NORMAL paragraphs (never the hint, never text inside a table),
 * numbered list items, and tables as rows of cell text, header row included.
 * Reading never makes a folder.
 */
function readDoc_(body, root) {
  var c = client_(body);
  if (!c.known) return { ok: false, error: "no_client" };
  var folder = findClientFolder_(root, c);
  if (!folder) return { ok: false, error: "doc_not_found" };

  var title = String(body.title || "");
  var file = title ? findNotesDoc_(folder, title) : notesDocs_(folder)[0] || null;
  if (!file) return { ok: false, error: "doc_not_found" };

  var doc = DocumentApp.openById(file.getId());
  return {
    ok: true,
    id: file.getId(),
    url: file.getUrl(),
    title: file.getName(),
    updatedAt: file.getLastUpdated().toISOString(),
    sections: readSections_(doc.getBody()),
  };
}

function readSections_(body) {
  var PARAGRAPH = DocumentApp.ElementType.PARAGRAPH;
  var LIST_ITEM = DocumentApp.ElementType.LIST_ITEM;
  var TABLE = DocumentApp.ElementType.TABLE;
  var H2 = DocumentApp.ParagraphHeading.HEADING2;
  var P = DocumentApp.ParagraphHeading.NORMAL;
  var out = [];
  var cur = null;

  for (var i = 0; i < body.getNumChildren(); i++) {
    var el = body.getChild(i);
    var type = el.getType();
    if (type == PARAGRAPH) {
      var p = el.asParagraph();
      var heading = p.getHeading();
      if (heading == H2) {
        cur = { heading: p.getText().trim(), paragraphs: [], listItems: [], tables: [] };
        out.push(cur);
      } else if (cur && heading == P) {
        // Emptiness first: the empty line he never typed on needs no style lookup.
        var text = p.getText();
        if (text.trim() && !isHint_(p)) cur.paragraphs.push(text);
      }
    } else if (type == LIST_ITEM) {
      var item = el.asListItem().getText();
      if (cur && item.trim()) cur.listItems.push(item);
    } else if (type == TABLE) {
      if (cur) cur.tables.push(readTable_(el.asTable()));
    }
  }
  return out;
}

function isHint_(p) {
  var t = p.editAsText();
  return t.isItalic() === true && String(t.getForegroundColor() || "").toLowerCase() === HINT_COLOR_;
}

function readTable_(table) {
  var rows = [];
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    var cells = [];
    for (var c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText());
    rows.push(cells);
  }
  return rows;
}

/**
 * One file into her folder, at most once per dedupe key. The key lives in the
 * file's description as "dedupe:<key>", so the same WhatsApp image, or the
 * same day's summary, never lands twice. replace=true supersedes the earlier
 * file instead: the new one is written, then the old one goes to the bin.
 * Body: { phone, name, fileName, mimeType, base64, dedupeKey, replace }
 */
function saveFile_(body, root) {
  var c = client_(body);
  if (!c.known) return { ok: false, error: "no_client" };
  var data = typeof body.base64 === "string" ? body.base64 : "";
  if (!data) return { ok: false, error: "no_file" };
  var fileName = String(body.fileName || "").replace(/[\\/\r\n]+/g, " ").slice(0, 120) || "file";
  var mimeType = String(body.mimeType || "") || "application/octet-stream";
  var tag = body.dedupeKey ? "dedupe:" + String(body.dedupeKey) : "";

  // A webhook retry and the manual "Save to Drive" for the same image can
  // arrive together; under the lock the second one finds the first's file.
  return withLock_(function () {
    var folder = ensureClientFolder_(root, c).folder;
    var earlier = tag ? filesTagged_(folder, tag) : [];
    if (earlier.length && body.replace !== true) {
      return { ok: true, id: earlier[0].getId(), url: earlier[0].getUrl(), created: false };
    }

    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName));
    if (tag) file.setDescription(tag);
    // Old copies go only once the new one exists: a failure in between
    // leaves two files, never none.
    for (var i = 0; i < earlier.length; i++) earlier[i].setTrashed(true);
    return { ok: true, id: file.getId(), url: file.getUrl(), created: true };
  });
}

// ── Her folder ──────────────────────────────────────────────────────────────

/**
 * Who the request is about, normalised exactly as lib/drive.ts does it
 * (digits10, clientName, clientFolderName), so the script and the worker
 * always agree on her folder's name.
 */
function client_(body) {
  var digits = String(body.phone || "").replace(/\D/g, "").slice(-10);
  var name = String(body.name || "").replace(/[\\/\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return {
    known: Boolean(digits || name),
    digits: digits,
    folderName: (name || "Unnamed") + " · " + (digits || "nophone"),
  };
}

/** Find her folder or make it. Call it only while holding the script lock. */
function ensureClientFolder_(root, c) {
  var found = findClientFolder_(root, c);
  if (found) return { folder: found, created: false };
  var made = root.createFolder(c.folderName);
  cachePut_(folderCacheKey_(c), made.getId());
  return { folder: made, created: true };
}

/**
 * Her folder inside root, or null. By the digits whenever there are any; a
 * client with no phone is matched on the exact folder name instead.
 *
 * Drive's search can lag a few seconds behind a folder it just made, and three
 * report pages sent together arrive as three requests a second apart. So a
 * folder this script made or found is also remembered by id for a few hours,
 * and that is checked first; without it the second page could miss the
 * folder the first one made and split her files across two.
 */
function findClientFolder_(root, c) {
  var key = folderCacheKey_(c);
  var cached = cacheGet_(key);
  if (cached) {
    var still = folderIfHers_(cached, root, c);
    if (still) return still;
  }
  var found = c.digits ? folderByDigits_(root, c.digits) : folderByName_(root, c.folderName);
  if (found) cachePut_(key, found.getId());
  return found;
}

function folderCacheKey_(c) {
  return c.digits ? "folder:" + c.digits : "folder-name:" + c.folderName;
}

/**
 * Drive's "contains" matches the start of a word, so a folder ending in
 * 98765432109 comes back for 9876543210 too: the number must stand alone.
 * If there are two (one made by hand, say), the older one is the one already
 * holding her files.
 */
function folderByDigits_(root, digits) {
  var it = root.searchFolders("title contains '" + digits + "' and trashed = false");
  var best = null;
  while (it.hasNext()) {
    var f = it.next();
    if (!ownsDigits_(f.getName(), digits)) continue;
    if (!best || f.getDateCreated().getTime() < best.getDateCreated().getTime()) best = f;
  }
  return best;
}

function folderByName_(root, name) {
  var it = root.getFoldersByName(name);
  var best = null;
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    if (!best || f.getDateCreated().getTime() < best.getDateCreated().getTime()) best = f;
  }
  return best;
}

function ownsDigits_(folderName, digits) {
  return new RegExp("(^|\\D)" + digits + "(\\D|$)").test(String(folderName));
}

/** A remembered folder counts only while it is still hers and still in root. */
function folderIfHers_(id, root, c) {
  try {
    var f = DriveApp.getFolderById(id);
    if (f.isTrashed()) return null;
    if (c.digits ? !ownsDigits_(f.getName(), c.digits) : f.getName() !== c.folderName) return null;
    var parents = f.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === root.getId()) return f;
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ── Notes Docs ──────────────────────────────────────────────────────────────

/**
 * The notes Doc with this title, else the one for the same call under another
 * spelling of her name. A notes title is "YYYY-MM-DD · Name · digits"; the date
 * and the digits are the parts that do not depend on how her name was typed
 * that day. Trashed docs never count, so a doc he binned comes back fresh
 * instead of resurrecting.
 */
function findNotesDoc_(folder, title) {
  var it = folder.getFilesByName(title);
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && f.getMimeType() === GOOGLE_DOC_MIME_) return f;
  }
  var key = titleKey_(title);
  if (!key) return null;
  var docs = notesDocs_(folder);
  for (var i = 0; i < docs.length; i++) {
    if (titleKey_(docs[i].getName()) === key) return docs[i];
  }
  return null;
}

/** Her notes Docs, newest call first (ties: the most recently made). */
function notesDocs_(folder) {
  var it = folder.getFilesByType(GOOGLE_DOC_MIME_);
  var docs = [];
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    var name = f.getName();
    if (!titleKey_(name)) continue; // a Doc of his own in her folder is not a notes Doc
    var date = name.split(" · ")[0];
    docs.push({ file: f, date: date === "undated" ? "" : date, made: f.getDateCreated().getTime() });
  }
  docs.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.made - a.made;
  });
  return docs.map(function (d) { return d.file; });
}

/** "date|digits" for a notes title (lib/drive notesTitle), "" for anything else. */
function titleKey_(title) {
  var parts = String(title || "").split(" · ");
  if (parts.length < 3) return "";
  var date = parts[0];
  var tail = parts[parts.length - 1];
  if (!/^(\d{4}-\d{2}-\d{2}|undated)$/.test(date) || !/^(\d{10}|nophone)$/.test(tail)) return "";
  return date + "|" + tail;
}

// ── Files ───────────────────────────────────────────────────────────────────

/** Files in her folder carrying this dedupe tag, newest first. */
function filesTagged_(folder, tag) {
  var it = folder.getFiles();
  var hits = [];
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && f.getDescription() === tag) hits.push(f);
  }
  hits.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  return hits;
}

// ── Plumbing ────────────────────────────────────────────────────────────────

function rootFolder_(id) {
  try {
    var folder = DriveApp.getFolderById(String(id || ""));
    folder.getName(); // touch it: an id that resolves to nothing must fail here, inside the try
    return folder.isTrashed() ? null : folder;
  } catch (err) {
    return null;
  }
}

/** The lock is taken once per request and always released, whatever throws. */
function withLock_(work) {
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS_);
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

/** A cache that is down costs one Drive search, never the request. */
function cacheGet_(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (err) {
    return null;
  }
}

function cachePut_(key, value) {
  try {
    CacheService.getScriptCache().put(key, value, FOLDER_CACHE_SECONDS_);
  } catch (err) {
    // see cacheGet_
  }
}

function count_(n, fallback) {
  var x = Math.floor(Number(n));
  return x >= 1 ? Math.min(x, 30) : fallback;
}

function blank_() {
  return "";
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
