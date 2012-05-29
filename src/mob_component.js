
exports.createMOBComponents = function(level) {
  Crafty.c("MOB", {
    _speed : 1,
  
    init : function() {
    
      this.target_position  = [-1,-1];
      this.target_action    = {};
      this.target_path      = [];
      
      var last_move = { 
        left: false, 
        right: false, 
        up : false, 
        down: false 
      };
    
      this.bind('EnterFrame', function() {
      
        var path    = this.target_path,
            speed   = this._speed;
        

        if(path.length > 0) {        
          for(var i=0; i<speed; ++i) {
            var targ = path[0], ntile = level.get(targ[0], targ[1]);
            
            //Compute walking direction
            
            var move = { 
              left: false, 
              right: false, 
              up : false, 
              down: false 
            };
            
            var tx = targ[0] * 16, ty = targ[1] * 16;
            if(this.x < tx) { //Move right
              this.x += 1;
              move.right = true;
            } else if(this.x > tx) { //Move left
              this.x -= 1;
              move.left = true;
            } else if(this.y < ty) { //Move down
              this.y += 1;
              move.down = true;
            } else if(this.y > ty) { //Move up
              this.y -= 1;
              move.up = true;
            } else {
              this.target_path.shift();
              if(this.target_path.length === 0) {
                this.trigger('WalkStep', {direction: last_move} );
                this.trigger('WalkCompleted', { 
                  target: this.target_position, 
                  action: this.target_action, 
                  direction: last_move
                });
                return;
              } else {
                //Loop back around
                --i;
                continue;
              }
            }
            this.trigger('WalkStep', {direction: move} );
            last_move = move;
          }
        }
      });
      
      
      this.bind("WalkTo", function(data) {
        var sx = Math.floor(this.x / 16),
            sy = Math.floor(this.y / 16);
        var npath = level.boundedBFS([sx, sy], [Math.floor(data.x/16), Math.floor(data.y/16)], 50);
      
        this.trigger("WalkPath", {
          action: data.action,
          path: npath,
        });
      });
      
      this.bind("WalkPath", function(data) {
        var action = data.action,
            npath = data.path,
            ppath = this.target_path;
            
        var sx = Math.floor(this.x / 16),
            sy = Math.floor(this.y / 16);
        
        if(npath.length > 0 && (npath[0][0] !== sx) && (npath[0][1]!=sy) ) {
          var best_path = npath, best_score = 1000;
          for(var i=0; i<npath.length; ++i) {
            var tpath = level.boundedBFS([sx, sy], npath[i], 100);
            var score = tpath.length;
            
            if(tpath.length === 0) {
              continue;
            }
            
            if(score <= best_score) {
              best_score = score;
              best_path = tpath.concat(npath.slice(i+1));
            }
          }
          npath = best_path;
        }
            
        //Stop walking if already walking
        if(this.target_path.length > 0) {
          this.abortWalking({ cause: "override" });
        }
        
        if(npath.length > 0) {
          if(ppath.length > 0) {
            var skip = ppath[0];
            for(var i=1; i<npath.length; ++i) {
              if(npath[i][0] === skip[0] && npath[i][1] === skip[1]) {
                npath = npath.slice(i);
                break;
              }
            }
          }
        }
        
        this.target_path = npath;
        if(this.target_path.length > 0) {
          this.target_action = action;
        } else {
          this.target_action    = {};
        }
      });
      
    },
       
    
    abortWalking : function(reason) {
      var event = { 
        path: this.target_path, 
        action: this.target_action
      };
      if(reason) {
        event.reason = reason;
      }
      
      this.target_path = [];
      this.target_action = {};
      this.trigger('WalkAborted', event);
    },
  });
  
  Crafty.c("RatDead", {
    init: function() {
      this.addComponent("Corpse, RatCorpse");
    }
  });

  Crafty.c("Rat", {
    init: function() {
      this.addComponent("2D, MOB, Canvas, SpriteAnimation, RPG, RatSprite, WalkAnimation");
      this.animate("stand_left",  0, 1, 0);
      this.animate("walk_left",   0, 1, 1);
      this.animate("stand_right", 2, 1, 2);
      this.animate("walk_right",  2, 1, 3);
      this.animate("stand_up",    0, 1, 0);
      this.animate("walk_up",     0, 1, 1);
      this.animate("stand_down",  2, 1, 2);
      this.animate("walk_down",   2, 1, 3);
      this.corpse_type = "RatDead";
    }
  });
  
  Crafty.c("PlayerDead", {
    init : function() {
      this.addComponent("Corpse, PlayerCorpse");
    }
  });
  
  Crafty.c("Player", {
    init: function() {
      this.addComponent("2D, MOB, Canvas, SpriteAnimation, RPG, PlayerSprite, WalkAnimation");
      this.animate("stand_left",  0, 0, 0);
      this.animate("walk_left",   1, 0, 2);
      this.animate("stand_right", 3, 0, 3);
      this.animate("walk_right",  4, 0, 5);
      this.animate("stand_up",    6, 0, 6);
      this.animate("walk_up",     7, 0, 8);
      this.animate("stand_down",  9, 0, 9)
      this.animate("walk_down",   10, 0, 11);
      this.corpse_type = "PlayerDead";
      
      this.bind("Respawn", function(args) {
        delete args['components'];
        this.attr(args);
      });
    }
  });
  
  Crafty.c("ChatBalloon", {
    init : function() {
      this.addComponent("2D, DOM, Text, Tween");
      this.attr({alpha:0});
      this.css({ "text-align": "center" });
      this.w = 200;
      this.h = 20;
    },
    
    followEntity : function(entity) {
      this.bind("EnterFrame", function() {
        this.x = entity.x + entity.w/2 - this.w/2;
        this.y = entity.y - this.h - 8;
      });
    },
    
    showText : function(msg) {
      this.text(msg);
      this.attr({alpha:100});
      this.tween({alpha:0}, 300);
    },
  });
  
  
  Crafty.c("WalkAnimation", {
    init : function() {
    
      //Create chat balloon
      this.balloon = Crafty.e("ChatBalloon");
      this.balloon.followEntity(this);
    
      this.addComponent("Tween");
    
      this.bind("WalkStep", function(args) {
        var direction = args.direction;
        if(direction.left) {        
          if(!this.isPlaying("walk_left")) {
            this.stop().animate("walk_left", 5, -1);
          }
        } else if(direction.right) {
          if(!this.isPlaying("walk_right")) {
            this.stop().animate("walk_right", 5, -1);
          }
        } else if(direction.up) {
          if(!this.isPlaying("walk_up")) {
            this.stop().animate("walk_up", 5, -1);
          }
        } else if(direction.down) {
          if(!this.isPlaying("walk_down")) {
            this.stop().animate("walk_down", 5, -1);
          }
        }
      });
      
      this.bind("WalkCompleted", function(args) {
        this.stop();
        if(args.direction.left) {
          this.animate("stand_left", 1000, -1);
        } else if(args.direction.right) {
          this.animate("stand_right", 1000, -1);        
        } else if(args.direction.up) {
          this.animate("stand_up", 1000, -1);        
        } else if(args.direction.down) {
          this.animate("stand_down", 1000, -1);        
        }
      });
      
      
      this.bind("Killed", function(args) {
        this.stop();
        this.animate("stand_down", 1000, -1); 
        this.attr({alpha:0});
        Crafty.e(this.corpse_type)
            .attr({x:this.x, y:this.y});
      });
      
      this.bind("Respawn", function() {
        this.attr({alpha:100});
      });
      
      this.bind("PlayAttack", function() {
        this.attr({h:24, w:8});
        this.tween({h:16, w:16}, 10);
      });
      
      this.bind("TakeDamage", function() {
      });
      
      this.bind("Chat", function(args) {
        this.balloon.showText(args.value);
      });
      
      this.bind("Remove", function() {
        this.balloon.destroy();
      });
    }
  });
  
  
  Crafty.c("LocalPlayer", {
  
    init : function() {
    }, 
    
    makePlayer : function(connection) {
    
      var chat_text = document.createElement("input");
      chat_text.size = 40;
      chat_text.maxlength = 80;
      document.body.appendChild(chat_text);
      chat_text.onkeyup = function(ev) {
        if(ev.keyCode === 13) {
          connection.send({
            type:"Chat",
            value: chat_text.value
          });
          chat_text.value = "";
        }
      };
    
    
      //Initialize from connection
      var hs = connection.handshake;
      this.addComponent(hs.attrib.components);
      delete hs.attrib["components"];
      this.attr(hs.attrib);
      
      //Update view
      level.snapView(this.x, this.y);
      
      var player = this;
      level.emitter.on('click', function(data) {
        if(data.tile) {
          connection.send({ 
            type: "WalkTo", 
            x: data.x*16, 
            y: data.y*16 
          });
        } else if(data.enemy) {
          connection.send({
            type: "Attack",
            target_id: data.enemy.net_id,
          });
        }
      });
      
      this.bind("Respawn", function(args) {
        level.snapView(args.x, args.y);
      });
      
      this.bind("WalkStep", function(data) {
      
        //Attempt to scroll level
        var tx = this.x/16 - level.view_coord[0] * (level.view_width - level.view_pad),
            ty = this.y/16 - level.view_coord[1] * (level.view_height - level.view_pad);
            
        if(tx < 1 && data.direction.left) {
          level.scrollView(0, -1);
        } else if(tx >= level.view_width - 1 && data.direction.right) {
          level.scrollView(0, 1);
        } else if(ty < 1 && data.direction.up) {
          level.scrollView(1, -1);
        } else if(ty >= level.view_height - 1 && data.direction.down) {
          level.scrollView(1, 1);
        }
      });
      
      
      return this;
    },
  });
}


