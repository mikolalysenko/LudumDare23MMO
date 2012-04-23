
exports.addRPGComponents = function(gs, mob) {


  mob.emitter.on("TakeDamage", function(args) {
    if(mob.attribs.hp <= 0) {
      return;
    }
    
    mob.attribs.hp -= args.damage;
    if(mob.attribs.hp <= 0) {
      mob.alive = false;
      mob.broadcastEvent("Killed", args);

      var attacker_id = args.attacker_id;
      if(attacker_id in gs.mobs) {
        var attacker = gs.mobs[attacker_id];
        attacker.broadcastEvent("GainXP", {
          value: 10 * mob.attribs.level * Math.max(1, 2 + mob.attribs.level - attacker.attribs.level)
        });
      }
      
      if(!mob.is_player) {
        gs.destroyMOB(mob);
      }
    }
  });
  
  mob.emitter.on("GainXP", function(args) {
    mob.attribs.xp += args.value;
    var next_level = mob.attribs.level * 100
    if(mob.attribs.xp > next_level) {
      mob.attribs.level += 1;
      mob.attribs.xp -= next_level;
      mob.attribs.max_hp += 10 * mob.attribs.level;
      mob.attribs.hp = mob.attribs.max_hp;
      mob.attribs.attack_power += 2 * mob.attribs.level;
      mob.attribs.defense_power += mob.attribs.level;
      
      mob.broadcastEvent("GainLevel", { 
        level: mob.attribs.level,
      });
    }
  });

  var attack_cooldown = false;
  
  //Executes an attack
  function doAttack(target) {
    if(attack_cooldown) {
      console.log("In cooldown");
      return;
    }
    attack_cooldown = true;
    setTimeout(function() {
      attack_cooldown = false;
    }, mob.attribs.attack_speed);
  
    var damage = Math.max(0, mob.attribs.attack_power - target.attribs.defense_power);
  
    //Do something :-P
    mob.broadcastEvent("PlayAttack", {
      damage: damage,
      target_id: target.id
    });
    target.broadcastEvent("TakeDamage", {
      damage: damage,
      attacker_id: mob.id
    });
  }
  
  mob.emitter.on("WalkCompleted", function(args) {
    if(mob.dead()) {
      return;
    }
  
    console.log("Walk complete!", args);
    if(args.action && args.action.type && args.action.type === "Attack") {
      mob.emitter.emit("Attack", {target_id: args.action.target_id});
    }
  });
  
  mob.emitter.on("Attack", function(args) {
  
    if(mob.dead()) {
      return;
    }
    if(!mob.is_player && attack_cooldown) {
      return;
    }
  
    console.log("Attacking: id=", mob.id, args);
  
    var target_id = args.target_id;
    if(!(target_id in gs.mobs)) {
      console.log("Target id not found");
      return;
    }
    var target = gs.mobs[target_id];
    
    var sx = Math.floor(mob.attribs.x/16),
        sy = Math.floor(mob.attribs.y/16),
        tx = Math.floor(target.attribs.x/16),
        ty = Math.floor(target.attribs.y/16);
    
    var tpath = gs.level.boundedBFS([sx,sy],[tx,ty],50);
    
    if(tpath.length === 0) {
      console.log("No path");
      return;
    } else if(tpath.length <= 2) {
      console.log("Adjacent");
      doAttack(target);
      return;
    } else {
      console.log("Walking to target");
      var tpos = tpath[tpath.length-2];
      mob.broadcastEvent("WalkTo", {
        x: 16*tpos[0], 
        y: 16*tpos[1], 
        action: {
          type: "Attack",
          "target_id": target_id
        }
      });
    }
  });
}
