var Level = require('./client_level.js').ClientLevel,
    MOBComponents = require('./mob_component.js'),
    EnemyComponents = require('./enemy_component.js'),
    RPGComponents   = require('./rpg_components.js');

function Connection(session_id) {
  var conn = this;
  this.state = "Connecting";
  this.ws = new WebSocket("ws://" + window.location.host);
  this.handshake = null;
  this.onconnect = null;
  this.ws.onopen = function() {
    conn.ws.send(session_id);
    conn.ws.onmessage = function(msg) {
      var data = JSON.parse(msg.data);
      if(data && data.status === "OK") {
        conn.state = "Connected";
        conn.handshake = data;
        conn.ws.onmessage = null;
        if(conn.onconnect) {
          conn.onconnect();
        }
      } else {
        conn.state = "Failed";
        throw Error("Could not connect to server");
      }
    }
  }
}

Connection.prototype = {
  send : function(msg) {
    this.ws.send(JSON.stringify(msg));
  }
};

//Client api code
exports.start = function(session_id) {
  var conn;
  
  //Initialize crafty
  Crafty.init(400, 320);

  //Loading screen
  Crafty.scene("loading", function(){
    Crafty.load(["sprite.png", "terrain.png"], function() {
      Crafty.scene("connecting");
    });
    
    Crafty.e("2D, DOM, Text").attr({ w:200, h:20, x:150, y:120})
      .text("Loading")
      .css({ "text-align": "center" });
  });
  
  //Connecting screen
  Crafty.scene("connecting", function() {
    conn = new Connection(session_id);
    conn.onconnect = function() {
      Crafty.scene("main");
    }

    Crafty.e("2D, DOM, Text").attr({ w:200, h:20, x:150, y:120})
      .text("Connecting")
      .css({ "text-align": "center" });
  });
  
  //Game screen
  Crafty.scene("main", function() {
    Crafty.sprite(16, "terrain.png", {
      'Terrain': [0,0]
    });
    
    Crafty.sprite(16, "sprite.png", {
      'PlayerSprite': [0,0],
      'PlayerCorpse': [12,0],
      'RatSprite':    [0,1],
      'RatCorpse':    [4,1]
    });
    
    //Initialize level
    level = new Level(conn.handshake.level_data);
    Crafty.level = level;
    level.init();
    level.snapView(conn.handshake.attrib.x, conn.handshake.attrib.y);

    //Create component types    
    MOBComponents.createMOBComponents(level);
    EnemyComponents.createEnemyComponents(level);
    RPGComponents.createRPGComponents(level);
    
    //Initialize player
    var player = Crafty.e("LocalPlayer").makePlayer(conn);
    player.net_id = conn.handshake.mob_id;
    
    //Different network event types
    var net_mobs = {};
    net_mobs[conn.handshake.mob_id] = player;
    
    //Stupid hack
    Crafty.lookup_net_id = function(net_id) {
      return net_mobs[net_id];
    }
    
    var net_handlers = {
      'CreateMOB' : function(data) {
        var mob = Crafty.e(data.data.components);
        mob.net_id = data.mob_id;
        delete data.data['components'];
        mob.attr(data.data);
        net_mobs[data.mob_id] = mob;
        mob.addComponent("Attackable");
      },
      
      'EventMOB' : function(data) {
        net_mobs[data.mob_id].trigger(data.data.event, data.data.args);
      },
      
      'DestroyMOB' : function(data) {
        net_mobs[data.mob_id].destroy();
        delete net_mobs[data.mob_id];
      },
    };
    
    //Handle network messages
    conn.ws.onmessage = function(event) {
      var data = JSON.parse(event.data);
      var handler = net_handlers[data.type];
      if(handler) {
        handler(data);
      }
    };
  });
  
  Crafty.scene("loading");
}

