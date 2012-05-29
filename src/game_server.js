var util  = require('util'),
    ws    = require('ws'),
    AccountManager = require('./accounts.js').AccountManager,
    Level = require('./level.js').Level,
    EventEmitter = require('events').EventEmitter,
    enemies = require('./enemies.js'),
    World = require('./data/world_entities.js'),
    rpg   = require('./rpg.js');

function MOB(id, gs, attribs) {
  this.id         = id;
  this.gs         = gs;
  this.attribs    = attribs;
  this.emitter    = new EventEmitter();
  this._alive      = true;
  this.is_player  = false;
  
  if(!(this.attribs.x)) { this.attribs.x = 0; }
  if(!(this.attribs.y)) { this.attribs.y = 0; }
  if(!(this.attribs.target_path)) { this.attribs.target_path = []; }
  
  var mob = this;
  
  mob.emitter.on("WalkPath", function(data) {
    if(mob.dead()) {
      return;
    }
  
    if(mob.attribs.target_path.length > 0) {
      mob.emitter.emit("WalkAborted", {
        reason: "override", 
        path: mob.attribs.target_path, 
        action: mob.attribs.target_action
      });
    }
    mob.attribs.target_path =  data.path;
    if(data.path.length > 0) {
      mob.attribs.target_path.unshift();
      mob.attribs.target_action = data.action;
    } else {
      mob.attribs.target_action    = {};
    }
  });
  
  this.emitter.on("WalkTo", function(data) {
    if(mob.dead()) {
      console.log("Aborting walk: dead");
      return;
    }
  
    var sx = Math.floor(mob.attribs.x / 16),
        sy = Math.floor(mob.attribs.y / 16);
    var npath = gs.level.boundedBFS([sx, sy], [Math.floor(data.x/16), Math.floor(data.y/16)], 50);
    if(npath.length === 0) {
      npath = [[sx,sy]];
    }
    
    mob.broadcastEvent("WalkPath", {
      action: data.action,
      path: npath,
    });
  });
  
  this.emitter.on("Tick", function(data) {
    if(mob.dead()) {
      return;
    }
  
    if(mob.attribs.target_path.length > 0) {
    
      var direction = { 
        left: false, 
        right: false, 
        up: false, 
        down: false
      };
    
      var nx = mob.attribs.target_path[0][0]*16,
          ny = mob.attribs.target_path[0][1]*16;
      mob.attribs.target_path.shift();
      if(mob.attribs.x < nx) {
        direction.right = true;
      } else if(mob.attribs.x > nx) {
        direction.left = true;
      } else if(mob.attribs.y < ny) {
        direction.down = true;
      } else if(mob.attribs.y > ny) {
        direction.up = true;
      }
      mob.attribs.x = nx;
      mob.attribs.y = ny;
      
      
      if(mob.attribs.target_path.length === 0) {
        mob.emitter.emit("WalkCompleted", {
          target: mob.attribs.target_position, 
          action: mob.attribs.target_action, 
          direction: direction
        });
        mob.target_action = {};
      }      
      mob.emitter.emit("WalkStep", { direction: direction });
    }
    
    
    for(var dx=-1; dx<=1; ++dx)
      for(var dy=-1; dy<=1; ++dy) {
        if(Math.abs(dx) + Math.abs(dy) <= 1) {
          var mob_list = gs.query_mobs(mob.attribs.x+dx*16, mob.attribs.y+dy*16);
          for(var k=0; k<mob_list.length; ++k) {
            if(mob_list[k] !== mob) {
              mob.emitter.emit("Touch", { 
                target: mob_list[k], 
                source: mob 
              });
              mob_list[k].emitter.emit("Touch", { target: mob_list[k], source: mob });
            }
          }
        }
      }
    
  });
}

//Broadcasts an event both locally and remotely
MOB.prototype = {

  broadcastEvent : function(event, args) {
    this.gs.broadcast({
      type: "EventMOB", 'mob_id': this.id, 
      'data': {
        'event': event,
        'args': args
      }
    });
    this.emitter.emit(event, args);
  },
  
  dead : function() {
    return !(this._alive && (this.id in this.gs.mobs));
  },
};

function Client(params) {
  this.id       = params.id,
  this.gs       = params.gs;
  this.ws       = params.ws;
  this.mob      = params.mob;
  this.account  = params.account;
}


Client.prototype = {

  save: function() {
    console.log("Saving: ", this.mob.id, ", client=", this.id);
    this.account.data.attribs = this.mob.attribs;
    this.account.update();
  },
  
  disconnect: function() {
    //Force disconnect by killing socket
    console.log("Disconnecting client");
    save();
    this.ws.close();
  },

};



function GameServer(options) {
  //Store ref to this
  var gs = this;

  //Unpack input
  gs.settings    = options.settings;
  gs.sessions    = options.sessions;
  gs.db          = options.db;
  gs.server      = options.server;
  gs.wss         = new ws.Server({server: gs.server});
  
  //Level data
  gs.level       = new Level(options.level);

  //Account data
  gs.accounts    = new AccountManager(gs.db, World.makeDefaultAttribs);

  //Client list
  gs.clients    = {};
  var next_client_id = 0;
  
  //Entity list
  gs.mobs       = {};
  var next_mob_id = 0;
  
  var mob_index = {};
  
  //Returns list of all mobs in cell (as of start of frame)
  gs.query_mobs = function(x, y) {
    x = Math.floor(x / 16);
    y = Math.floor(y / 16);
    var idx = x + y * 256;
    if(mob_index[idx]) {
      return mob_index[idx];
    }
    return [];
  }

  
  //Tick all the mobs
  gs.tick = function(event) {
    //Rebuild index
    mob_index = {};
    for(var i in gs.mobs) {
      var mob = gs.mobs[i],
          mx = Math.floor(mob.attribs.x/16),
          my = Math.floor(mob.attribs.y/16),
          idx = mx + my*256;
      if(mob_index[idx]) {
        mob_index[idx].push(mob);
      } else {
        mob_index[idx] = [mob];
      }
    }
    for(var i in gs.mobs) {
      gs.mobs[i].emitter.emit('Tick');
    }
  }
  
  //Broadcast generic message to all clients
  gs.broadcast = function(event) {
    var stringified = JSON.stringify(event);
    console.log("Broadcasting: " + stringified);
    for(var i in gs.clients) {
      gs.clients[i].ws.send(stringified);
    }
  }
  
  //Create a MOB
  gs.createMOB = function(data) {
    var mob_id = "" + next_mob_id++;
    var mob = new MOB(mob_id, gs, data);
    
    util.log("Creating mob:" + mob_id + ", attrib:" + JSON.stringify(data));
    gs.mobs[mob_id] = mob;
    gs.broadcast({ 
      'type': 'CreateMOB', 
      'mob_id': mob_id, 
      'data': mob.attribs
    });
    mob.emitter.emit('Created');
    return mob;
  }
  
  //Destroy a MOB
  gs.destroyMOB = function(mob) {
    gs.broadcast({ 'type': 'DestroyMOB', 'mob_id': mob.id });
    mob.emitter.emit('Destroyed');
    delete gs.mobs[mob.id];
  }
  
  //Add a client
  gs.addClient = function(ws, account) {  
    //Create client MOB and add to world
    var mob = gs.createMOB(account.data.attribs);
    mob.is_player = true;
    rpg.addRPGComponents(gs,mob);
    
    var handshake = {
      status:'OK',
      mob_id : mob.id,
      attrib : account.data.attribs,
      level_data: gs.level.map_data,
    };
    ws.send(JSON.stringify(handshake));
    
    console.log("got a client connection" + JSON.stringify(account.data));
    
    for(var i in gs.mobs) {
      if(i !== mob.id + "") {
        console.log("Sending mob: " + i + ", mob.id = " + mob.id);
        ws.send(JSON.stringify({'type': 'CreateMOB', 'mob_id': i, 'data': gs.mobs[i].attribs}));
      }
    }    
    
    //Create client
    var client = new Client({
      'id': "" + next_client_id++,
      'gs': gs,
      'ws': ws,
      'mob': mob,
      'account': account,
    });
    gs.clients[client.id] = client;
        
        
    function checkCoord(x, y) {
      return x && Math.abs(x - mob.attribs.x) <= 50*16 &&
        y && Math.abs(y - mob.attribs.y) <= 50*16;
    }
    
    var throttle_counter = 0,
        inactivity_counter = 0,
        save_count = 0,
        killClient;
    
    var client_interval = setInterval(function() {
      console.log("Interval: ", client.id);
      throttle_counter = 0;
      inactivity_counter += 5;
      save_count++;
      if(inactivity_counter > 25*60) {
        console.log("Time out: ", client.id);
        killClient();
      }
      if(save_count > 60) {
        client.save();
      }
    }, 5 * 1000);

    //Need to handle respawn event    
    mob.emitter.on("Killed", function(args) {
      mob._alive = false;
      setTimeout(function() {
        mob._alive = true;
        if(!mob.dead()) {
          World.handleRespawn(mob);
        }
      }, 5 * 1000);
    });
    
    ws.on('message', function(data) {
      console.log("Got message from player: " + data);
      inactivity_counter = 0;
      ++throttle_counter;
      if(throttle_counter > 30) {
        console.log("Throttling client: ", client.id);
        return;
      }
      
      //TODO: Handle message from player here
      
      var msg = JSON.parse(data);
      
      if(msg.type === "WalkTo") {
        mob.emitter.emit("StopCommand");
        if(checkCoord(msg.x, msg.y)  && !mob.dead()) {
          mob.emitter.emit("WalkTo", {
            x: msg.x, 
            y: msg.y, 
            action: ""
          });
        }
      } else if(msg.type === "Attack" && msg.target_id in gs.mobs) {
        console.log("Executing attack input");
        mob.emitter.emit("StopCommand");
        mob.emitter.emit("Attack", {target_id: msg.target_id});
      } else if(msg.type === "Chat" && 
          typeof(msg.value) === "string") {
        console.log("Got chat input");
        var txt = msg.value;
        if(txt.length > 80) {
          txt = txt.substr(0, 80);
        }
        txt = txt.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;");
        mob.broadcastEvent("Chat", { value: txt });
      }
    });
    
    killClient = function() {
      if(client.id in gs.clients) {
        console.log("Killing client:", client.id);
        clearInterval(client_interval);
        client.save();
        delete gs.clients[client.id];
        client.account.logout();
        gs.destroyMOB(mob);
        ws.close();
      }
    };
    
    ws.on('close', killClient);
    ws.on('error', killClient);
  };

  //Upon recieving connection, create client
  gs.wss.on('connection', function(ws) {
    util.log("Got websocket connection");
  
    //Set timeout, wait for handshake
    var timeout;
    var listener = ws.once('message', function(session_id) {
      clearTimeout(timeout);
      var user_id = gs.sessions.getToken(session_id);
      if(user_id) {
        gs.accounts.tryLogin(user_id, function(err, account) {
          if(err) {
            util.log("Error on login: " + err);
            ws.close();
            return;
          }
          gs.addClient(ws, account);
        });
      } else {
        util.log("Invalid session id");
        ws.close();
      }
    });
    
    //Kill connection on timeout
    timeout = setTimeout(gs.settings.login_timeout, function() {
      util.log("Client timed out");
      ws.removeAllListeners();
      ws.close();
    });
  });
  
  setInterval(function() { gs.tick(); }, 320);
  
  //Initialize the world!
  World.initializeWorld(gs);
};

exports.GameServer = GameServer;
