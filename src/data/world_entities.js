var enemies = require('../enemies.js');

var spawn_list = []

function getSpawn() {
  var loc = spawn_list[Math.floor(Math.random() * spawn_list.length)];
  console.log("Generating spawn location", loc);
  return loc;
}

exports.initializeWorld = function(gs) {
  for(var i=0; i<256; ++i) {
    for(var j=0; j<256; ++j) { 
      var t = gs.level.get(i,j);
      
      if(t >= 38 && t <= 43) {
        console.log("Placing mob spawner", i, j);
        
        var power = (t - 38);
        
        var scale = [1, 1.5, 2, 2.5, 3, 5][this.power];
        
        enemies.makeMOBSpawner(gs, {
          center: [16*i, 16*j],
          radius: 100,
          spawn_rate: 10 * 1000,
          max_mobs: [1, 1, 1, 1, 1, 1][power],
          mob_attribs: {
            hp: [4, 10, 50, 200, 500, 3500][power],
            max_hp: [4, 10, 50, 200, 500, 3500][power],
            level: [1, 3, 5, 7, 9, 100][power],
            xp: 0,
            attack_speed: [1500, 1400, 1300, 1200, 1100, 500][power],
            attack_power: [1, 6, 15, 30, 90, 200][power],
            defense_power: [0, 1, 5, 20, 40, 100][power],
            components: "Rat",  
          }
        }); 
        gs.level.set(i,j,gs.level.get(i,j-1));
      } else if(t === 5) {
        spawn_list.push([i*16, j*16]);
      }
    }
  }  
}

exports.makeDefaultAttribs = function() {
  var spoint = getSpawn();
  return {
    x: spoint[0],
    y: spoint[1],
    hp: 10,
    max_hp: 10,
    level: 1,
    xp: 0,
    attack_power : 1,
    attack_speed : 500,
    defense_power: 0,
    components: "Player",
  };
}

exports.handleRespawn = function(mob) {
  var spoint = getSpawn();
  mob.attribs.x = spoint[0];
  mob.attribs.y = spoint[1];
  mob.attribs.hp = mob.attribs.max_hp;
  mob.attribs.target_path = [];
  mob.broadcastEvent("Respawn", mob.attribs);  
}

