// Tests Rune XP's state (xp.lua) without the game: the fade, the fill that sweeps in and glides, a new level, another
// skill while the bar shows, and that the result does not depend on the length of a step. Needs fengari.
// Run: node tools/test-xp.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'xp.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local function run(S, seconds, dt) for _ = 1, math.floor(seconds / dt + 0.5) do M.Step(S, dt) end end
local function near(a, b, e) return math.abs(a - b) <= (e or 0.01) end

-- a first notice: from unseen the fill starts at the left end, then glides to the progress
local S = M.New()
M.Take(S, "T_Notification_Skill_Woodcutting", 0.6)
assert(S.Cur == 0 and S.Target == 0.6 and S.Want == 1, "the fill sweeps in from empty")
local before = S.Cur
M.Step(S, 0.05)
assert(S.Cur > before and S.Cur < 0.6, "one step moves the fill, not all the way")
run(S, 0.3, 0.05)
assert(S.Alpha == 1, "seen after a third of a second, alpha " .. S.Alpha)
run(S, 4, 0.05)
assert(S.Cur == 0.6, "the fill ends on the progress, " .. S.Cur)

-- more XP in the same skill while it shows: the fill goes on from where it is
M.Take(S, "T_Notification_Skill_Woodcutting", 0.7)
assert(S.Cur == 0.6 and S.Target == 0.7, "a second gain glides on from the first")

-- a new level: the progress is lower than the fill, so the bar starts again from empty
run(S, 4, 0.05)
M.Take(S, "T_Notification_Skill_Woodcutting", 0.05)
assert(S.Cur == 0 and S.Target == 0.05, "a new level starts from empty")

-- another skill while the bar shows: from where that skill stood last time, or a little before its value
M.Take(S, "T_Notification_Skill_Mining", 0.5)
assert(near(S.Cur, 0.42), "an unknown skill starts a little before its value, " .. S.Cur)
run(S, 4, 0.05)
M.Take(S, "T_Notification_Skill_Woodcutting", 0.2)
assert(near(S.Cur, 0.05), "a known skill starts where it stood, " .. S.Cur)

-- the notice ends: a soft fade, and nothing below 0
M.Rest(S)
run(S, 0.2, 0.05)
assert(S.Alpha > 0 and S.Alpha < 1, "the fade out takes more than a fifth of a second")
run(S, 1, 0.05)
assert(S.Alpha == 0, "unseen after the fade")
run(S, 3, 0.05)   -- the fill ends its glide
local fade, fill = M.Step(S, 0.05)
assert(not fade and not fill, "at rest a step changes nothing")

-- the same motion with long and short steps
local A, B = M.New(), M.New()
M.Take(A, "x", 0.8) M.Take(B, "x", 0.8)
run(A, 0.6, 0.05) run(B, 0.6, 0.02)
assert(near(A.Cur, B.Cur, 0.02), "steps of 50 ms and 20 ms give the same fill: " .. A.Cur .. " and " .. B.Cur)

-- a progress out of range is held to 0..1
local C = M.New()
M.Take(C, "x", 1.7)
assert(C.Target == 1, "above 1 is 1")
M.Take(C, "x", -0.3)
assert(C.Target == 0, "below 0 is 0")

-- two notices at once: each has its turn, then round again; one notice is always the first
assert(M.Pick(1, 99) == 1 and M.Pick(2, 0) == 1 and M.Pick(2, 1.4) == 1 and M.Pick(2, 1.6) == 2 and M.Pick(2, 3.1) == 1, "two skills take turns")
assert(M.Pick(3, 3.1) == 3, "three skills too")

assert(M.SkillName("T_Notification_Skill_Woodcutting") == "WOODCUTTING")
assert(M.SkillName("T_Notification_Skill_Rune_Crafting") == "RUNE CRAFTING")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
