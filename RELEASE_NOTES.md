# Temple Escape v3.1.1 — Map Repair

Download **TempleEscape-v3.1.1.html** from Assets and open it in a browser with WebGL 2. Everything is embedded in one offline file. There is still no Firebase, login, ChatGPT-site redirect, installer, or server requirement.

## Map repair

- Rebuilt the large-area connections that made v3.1 feel like separate square blocks joined by skinny strips.
- Major non-gated passages are now broad two-lane galleries with continuous openings between both sides of the corridor.
- The Upper Temple, Burial Chambers, lower temple, Sanctuary, Seal Control, Maintenance, and Workshop now connect through wider architecture that reads as one temple instead of disconnected room islands.
- Vertical transitions are continuous across both sides of the wider galleries, so floor elevation changes stay aligned instead of producing awkward single-file ramps.
- The Sealed Archive and Escape Wing intentionally remain narrow gated choke points. Their locks still cannot be bypassed through the widened layout or vents.
- Interior partitions were simplified so rooms still break line of sight without feeling like another random maze inside every room.
- Objective locations, supplies, lockers, vents, doors, checkpoints, signs, and the existing progression order were preserved.

## The Hunt remains intact

v3.1's hunter improvements are still included: faster chase repathing, state-specific vent use, more deliberate lost-sight searches, distinct chase crawl speed, and stronger bounded creature chase/crawl motion. The actual 18-bone creature rig, three skins, skeletal animation clips, positional audio, flashlight, physical vents, and capture sequence remain unchanged by this repair.

## Validation

The revised layout passed full objective progression, locked-room access, wall collision, corridor clearance, broad-gallery cross-connection, continuous-slope, vent, hunter, equipment, creature-rig, standalone HTML, and checksum verification. Browser visual playtesting is still the final manual check.

**Controls:** WASD move · Mouse look · Shift sprint · C crouch · E use/hold to work · F light · J journal · Q decoy · Esc pause.
