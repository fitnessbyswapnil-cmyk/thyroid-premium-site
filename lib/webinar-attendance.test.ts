import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PITCH_MINUTES,
  matchAttendance,
  parseCsv,
  phoneInRow,
  readAttendanceCsv,
  type AttendanceRegistrant,
} from "./webinar-attendance.ts";

const REG: AttendanceRegistrant[] = [
  { rowNumber: 2, phone: "9876543210", email: "", name: "Vaidehi Kulkarni" },
  { rowNumber: 3, phone: "9812345678", email: "priya@example.com", name: "Priya" },
  { rowNumber: 4, phone: "9800000001", email: "", name: "Priya" },
  { rowNumber: 5, phone: "9700000002", email: "", name: "Surekha" },
];

test("a phone anywhere in the row is the strongest match", () => {
  assert.equal(phoneInRow({ name: "Vaidehi 9876543210", email: "", minutes: 0 }), "9876543210");
  assert.equal(phoneInRow({ name: "V", email: "", minutes: 0, extra: ["+91 98765 43210"] }), "9876543210");
  assert.equal(phoneInRow({ name: "no digits", email: "", minutes: 0 }), "");
  // A landline-looking or too-short number is not a mobile.
  assert.equal(phoneInRow({ name: "022 55512345", email: "", minutes: 0 }), "");
});

test("phone, then email, then a name only when it is unique", () => {
  const r = matchAttendance(
    [
      { name: "Vaidehi 9876543210", email: "", minutes: 70 },
      { name: "P", email: "PRIYA@example.com", minutes: 60 },
      { name: "Surekha", email: "", minutes: 30 },
      { name: "Priya", email: "", minutes: 80 },
      { name: "Someone Else", email: "", minutes: 90 },
    ],
    REG,
  );
  assert.deepEqual(
    r.matched.map((m) => [m.rowNumber, m.minutes, m.by, m.stayedToPitch]),
    [[2, 70, "phone", true], [3, 60, "email", true], [5, 30, "name", false]],
  );
  // "Priya" is two registrants: matching either would be a guess.
  assert.deepEqual(r.unmatched, [
    { name: "Priya", email: "", minutes: 80, reason: "ambiguous_name" },
    { name: "Someone Else", email: "", minutes: 90, reason: "no_match" },
  ]);
  assert.equal(r.attended, 3);
  assert.equal(r.stayedToPitch, 2);
});

test("rejoining adds up, and the confident match reason wins", () => {
  const r = matchAttendance(
    [
      { name: "Vaidehi Kulkarni", email: "", minutes: 20 },
      { name: "9876543210", email: "", minutes: 40 },
    ],
    REG,
  );
  assert.deepEqual(r.matched, [
    { rowNumber: 2, phone: "9876543210", minutes: 60, stayedToPitch: true, by: "phone" },
  ]);
});

test("the pitch threshold is the class minute 55", () => {
  const at = (minutes: number) =>
    matchAttendance([{ name: "9876543210", email: "", minutes }], REG).matched[0].stayedToPitch;
  assert.equal(PITCH_MINUTES, 55);
  assert.equal(at(54), false);
  assert.equal(at(55), true);
});

test("the export is read by its own header titles", () => {
  const csv = [
    'Name (original name),User Email,Duration (Minutes),Guest',
    '"Kulkarni, Vaidehi",v@example.com,70,Yes',
    'Priya,priya@example.com,12,No',
    '',
  ].join("\r\n");
  const rows = readAttendanceCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => [r.name, r.email, r.minutes]),
    [["Kulkarni, Vaidehi", "v@example.com", 70], ["Priya", "priya@example.com", 12]],
  );
  assert.equal(parseCsv('a,"b,c"\n').length, 1);
});

test("a join timestamp is not mistaken for her phone number", () => {
  // Zoom writes "09/24/2026 07:58:31 PM"; inside those digits sits 9242026075,
  // which passes the mobile shape and used to win before the real number.
  assert.equal(phoneInRow({ name: "Priya", email: "", minutes: 70, extra: ["09/24/2026 07:58:31 PM"] }), "");
  assert.equal(
    phoneInRow({ name: "Priya", email: "", minutes: 70, extra: ["09/24/2026 07:58:31 PM", "9876543210"] }),
    "9876543210",
  );
  // 12 digits is still a phone with a country code.
  assert.equal(phoneInRow({ name: "919876543210", email: "", minutes: 0 }), "9876543210");
});
