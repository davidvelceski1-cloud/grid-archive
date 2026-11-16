import { test } from "node:test";
import assert from "node:assert/strict";
import { decadeRange } from "../src/lib/nlsearch";

test("decade phrases resolve to year ranges", () => {
  assert.deepEqual(decadeRange("ferrari wins in the rain in the 90s"), [1990, 1999]);
  assert.deepEqual(decadeRange("the 1970s"), [1970, 1979]);
  assert.deepEqual(decadeRange("2000s champions"), [2000, 2009]);
  assert.deepEqual(decadeRange("in the 10s"), [2010, 2019]);
  assert.deepEqual(decadeRange("the 50's"), [1950, 1959]);
  assert.equal(decadeRange("senna at monaco"), null);
});
