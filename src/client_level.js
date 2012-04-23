var level_module = require('./level.js'),
    TileTypes = level_module.TileTypes,
    Level = level_module.Level,
    EventEmitter = require('events').EventEmitter;

Crafty.c("Tile", {

  init : function() {
    //Initialize tile component
    this.addComponent("2D, Canvas, Sprite, Terrain, Mouse");
    this.attr({ 'x':-100, 'y':-100, 'w': 16, 'h': 16 });
    this.type = TileTypes[0];
  },
  
  setType : function(tile_type) {
    this.type = TileTypes[tile_type];
    
    if(this.type.use_bitmask) {
      var tx = this.x/16, ty = this.y/16;
      var bitmask = 
        (Crafty.level.get(tx-1, ty) == 0 ? 1 : 0) +
        (Crafty.level.get(tx+1, ty) == 0 ? 2 : 0) +
        (Crafty.level.get(tx, ty-1) == 0 ? 4 : 0) +
        (Crafty.level.get(tx, ty+1) == 0 ? 8 : 0);  
      this.sprite(bitmask, this.type.sprite[1], 1, 1);  
    } else {
      this.sprite(this.type.sprite[0], this.type.sprite[1], 1, 1);
    }
  },
  
  attachLevel : function(level) {
    this.bind('Click', function() {
      level.emitter.emit('click', {
        'x':this.x/16, 
        'y':this.y/16,
        'tile':this.type,
      });
    });
    return this;
  },
});

function ClientLevel(data) {

  var level = new Level(data);

  this.level = level;
  
  //BFS data
  this.get = level.get.bind(level);
  this.set = level.set.bind(level);
  this.boundedBFS = level.boundedBFS.bind(level);
  
  //Scroll stuff
  this.front_tiles = [];
  this.back_tiles   = [];
  
  //Current viewing coordinates
  this.view_coord     = [0,0];
  this.view_width     = 25;
  this.view_height    = 20;
  this.view_pad       = 2;
  this.scroll_speed   = 32;
  
  //Emitter for click events
  this.emitter = new EventEmitter();
  
  //If set, then background is scrolling
  this.scrolling = false;
  this.scroll_rate = 20;
}


//Initialize level
ClientLevel.prototype.init = function() {

  this.level.init();

  //Create tile buffers
  for(var i=0; i<this.view_width; ++i) {
    for(var j=0; j<this.view_height; ++j) {    
      this.front_tiles.push(Crafty.e("Tile").attachLevel(this));
      this.back_tiles.push(Crafty.e("Tile").attachLevel(this));
    }
  }
  
  //Set view port
  Crafty.viewport.x = 0;
  Crafty.viewport.y = 0;
}

//Snaps the view to a coordinate
ClientLevel.prototype.snapView = function(x, y) {
  x = Math.floor(x / (16 * (this.view_width - this.view_pad)));
  y = Math.floor(y / (16 * (this.view_height - this.view_pad)));

  this.view_coord[0] = x;
  this.view_coord[1] = y;
  
  var cx = this.view_coord[0] * (this.view_width - this.view_pad),
      cy = this.view_coord[1] * (this.view_height - this.view_pad);
      
  var idx = 0;
  for(var i=0; i<this.view_width; ++i) {
    for(var j=0; j<this.view_height; ++j) {
      this.front_tiles[idx++]
        .attr({ x:(cx + i)*16, y:(cy + j)*16 })
        .setType(this.get(cx+i,cy+j));
    }
  }
  
  //Move viewport
  Crafty.viewport.x = -cx*16;
  Crafty.viewport.y = -cy*16;
}

//Compute scroll axis
ClientLevel.prototype.scrollView = function(direction, sign) {

  if(this.scrolling) {
    return;
  }

  this.view_coord[direction] += sign;
  
  if(this.view_coord[direction] < 0) {
    this.view_coord[direction] = 0;
    return;
  }
  
  //Update tiles
  var cx = this.view_coord[0] * (this.view_width - this.view_pad),
      cy = this.view_coord[1] * (this.view_height - this.view_pad);
  var idx = 0;
  for(var i=0; i<this.view_width; ++i) {
    for(var j=0; j<this.view_height; ++j) {
      this.back_tiles[idx++]
        .attr({ x:(cx + i)*16, y:(cy + j)*16 })
        .setType(this.get(cx+i,cy+j));
    }
  }
  
  //Swap buffers
  var tmp = this.front_tiles;
  this.front_tiles = this.back_tiles;
  this.back_tiles = tmp;

  this.scrolling = true;
  
  var level = this,
      tx = -cx * 16,
      ty = -cy * 16;
  var scroll_interval = setInterval(function() {
  
    if(Crafty.viewport.x < tx) {
      Crafty.viewport.x = Math.min(Crafty.viewport.x+level.scroll_rate, tx); 
    } else if(Crafty.viewport.x > tx) {
      Crafty.viewport.x = Math.max(Crafty.viewport.x-level.scroll_rate, tx); 
    } else if(Crafty.viewport.y < ty) {
      Crafty.viewport.y = Math.min(Crafty.viewport.y+level.scroll_rate, ty); 
    } else if(Crafty.viewport.y > ty) {
      Crafty.viewport.y = Math.max(Crafty.viewport.y-level.scroll_rate, ty); 
    } else {
      level.scrolling = false;
      clearInterval(scroll_interval);
    }
  
  }, 20);
}


exports.ClientLevel = ClientLevel;
