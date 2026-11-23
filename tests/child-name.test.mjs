import test from "node:test";
import assert from "node:assert/strict";
import { compareChildNames, displayChildName, splitChildName } from "../public/child-name.js";

test("names display surname, first name, and middle initial", () => {
  assert.equal(displayChildName("Jan Niño M. Bansag"), "Bansag, Jan Niño M.");
  assert.equal(displayChildName("Jan Nino Bansag"), "Bansag, Jan Nino");
  assert.equal(displayChildName(" Jason  D. Lubrido Jr. "), "Lubrido Jr., Jason D.");
  assert.equal(displayChildName("Maria de la Cruz"), "de la Cruz, Maria");
  assert.equal(displayChildName("Bansag, Jan Niño M."), "Bansag, Jan Niño M.");
  assert.equal(displayChildName("Madonna"), "Madonna");
});

test("an explicitly recorded surname overrides the legacy name guess", () => {
  assert.equal(displayChildName("Maria Josefa Cruz de la Paz", "de la Paz"), "de la Paz, Maria Josefa Cruz");
  assert.deepEqual(splitChildName("Maria Josefa Cruz de la Paz", "de la Paz"), { firstName: "Maria Josefa Cruz", middleInitial: "", surname: "de la Paz" });
  assert.deepEqual(splitChildName("Jan Nino Bansag"), { firstName: "Jan Nino", middleInitial: "", surname: "Bansag" });
  assert.deepEqual(splitChildName("Jan Niño M. Bansag", "Bansag", "M.", "Jan Niño"), { firstName: "Jan Niño", middleInitial: "M.", surname: "Bansag" });
  assert.equal(displayChildName("Jan Niño M. Bansag", "Bansag", "M.", "Jan Niño"), "Bansag, Jan Niño M.");
  assert.equal(displayChildName("Jan Niño m Bansag", "Bansag", "m", "Jan Niño"), "Bansag, Jan Niño M.");
  assert.equal(compareChildNames("Ana Bansag", "Belen Cruz", "Bansag", "Cruz") < 0, true);
});

test("registry names sort by the displayed family name", () => {
  const names = ["Jan Nino Cruz", "Jan Niño M. Bansag", "Maria de la Cruz"];
  assert.deepEqual(names.sort(compareChildNames), ["Jan Niño M. Bansag", "Jan Nino Cruz", "Maria de la Cruz"]);
});
