"use strict";

var TileTypes = require('./level.js').TileTypes,
    patcher = require('patcher'),
    rpg     = require('./rpg.js');

exports.makeMOBSpawner = function(gs, params) {

  var center = params.center,
      radius = params.radius || 200,
      retreat_distance = params.retreat_distance || 20 * 16;

  function locateSpawnPosition(nr) {
    var r = nr || radius;
    while(true) {
      var x = Math.floor((center[0] + r * (0.5 - Math.random()))/16)*16,
          y = Math.floor((center[1] + r * (0.5 - Math.random()))/16)*16;
      if(!(TileTypes[gs.level.get(x/16, y/16)].collides)) {
        return [x,y]
      }
    }
  }

  function spawnMOB() {
  
    var base_pos = locateSpawnPosition();
    var nattribs = patcher.clone(params.mob_attribs);
    nattribs.x = base_pos[0];
    nattribs.y = base_pos[1];
    
    console.log("Spawning MOB, ", nattribs);
    var mob = gs.createMOB(nattribs);
    rpg.addRPGComponents(gs, mob);

    var state = "Waiting",
        target_mob = null;

    mob.emitter.on("Tick", function() {
      if(state === "Waiting") {
        return;
      } else if(state === "Angry") {
        //Check if we are outside retreat radius; if so then go back to spawner
        var dist = Math.abs(base_pos[0] - mob.attribs.x) + Math.abs(base_pos[1] - mob.attribs.y),
            tdist = Math.abs(target_mob.attribs.x - mob.attribs.x) + Math.abs(target_mob.attribs.y - mob.attribs.y);
        if(dist >= retreat_distance || target_mob.dead()) {
          console.log("Retreating!", target_mob.dead(), dist);
          state = "Waiting";
          mob.emitter.emit("StopAttack");
          var target = locateSpawnPosition();
          mob.emitter.emit("WalkTo", {
            x: target[0],
            y: target[1],
            action: {}
          });
        } else {
          mob.emitter.emit("Attack", { target_id: target_mob.id });
        }
      } 
    });

    mob.emitter.on("Touch", function(args) {
      if(state === "Waiting") {
        if(args.source.is_player) {
          //Attack player!
          target_mob = args.source;
          state = "Angry";
          mob.emitter.emit("Attack", { target_id: target_mob.id });
        }
      }    
    });
    
    mob.emitter.on("TakeDamage", function(args) {
      if(state === "Angry") {
        return;
      }
      
      //Attack whoever attacked us
      if(args.attacker_id && args.attacker_id in gs.mobs) {
        var attacker = gs.mobs[args.attacker_id];
        target_mob = attacker
        state = "Angry";
        mob.emitter.emit("Attack", { target_id: target_mob.id });
      }
    });
    
    return mob;
  }

  var max_mobs = params.max_mobs;
  var mobs = [];
  
  setInterval(function() {
    //Remove dead mobs from queue
    for(var i=mobs.length-1; i>=0; --i) {
      if(mobs[i].dead()) {
        mobs[i] = mobs[mobs.length-1];
        mobs.pop();
      }
    }
  
    if(mobs.length < max_mobs) {
      mobs.push(spawnMOB());
    }
  }, params.spawn_rate);
}
