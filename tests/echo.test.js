import test from 'node:test';
import assert from 'node:assert/strict';
import {footstepLoudness,pingRadius,nextPingSlot,PING_SLOTS} from '../src/echo-rules.js';

test('crouching is quieter than walking, and sprinting is loudest',()=>{
 const crouch=footstepLoudness({crouched:true}),walk=footstepLoudness({}),sprint=footstepLoudness({running:true});
 assert.ok(crouch<walk&&walk<sprint);
 assert.equal(footstepLoudness({inVent:true}),crouch);
});
test('louder sounds travel further and the radius stays bounded',()=>{
 assert.ok(pingRadius(1)>pingRadius(.45)&&pingRadius(.45)>pingRadius(.12));
 assert.equal(pingRadius(5),pingRadius(1));assert.equal(pingRadius(-1),pingRadius(0));
});
test('a new sound takes a free slot first, then replaces the oldest',()=>{
 assert.equal(nextPingSlot([2,-1,3]),1);
 assert.equal(nextPingSlot([2,4.5,3]),1);
 assert.equal(nextPingSlot(new Array(PING_SLOTS).fill(1)),0);
});
