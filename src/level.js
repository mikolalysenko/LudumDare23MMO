var BinaryHeap = require('./heap.js').BinaryHeap;

var TileTypes = {
  0: {
    name: 'Grass',
    sprite: [0,0],
    collides: false,
    use_bitmask: false
  },  
  1: {
    name: 'Stone',
    sprite: [0,1],
    collides: true,
    use_bitmask: true
  },
  2: {
    name: 'Water',
    sprite: [0,2],
    collides: true,
    use_bitmask: true
  },
  3: {
    name: 'Tile',
    sprite: [1,0],
    collides: false,
    use_bitmask:false
  },
  4 : {
    name: 'Snow',
    sprite: [4,0],
    collides:false,
    use_bitmask: false
  },
  5: {
    name: 'Spawn',
    sprite: [3,0],
    collides: false,
    use_bitmask:false
  },
  6: {
    name: 'Secret',
    sprite: [2,0],
    collides: true,
    use_bitmask: false
  },
  
  14: {
    name: 'Stone',
    sprite: [0,1],
    collides: true,
    use_bitmask: true
  }
};

//Level data
function Level(data) {
  this.map_width      = 256;
  this.map_height     = 256;
  
  if(data) {
    this.map_data = data;
  } else {
    this.map_data = new Array(this.map_width * this.map_height);
    for(var i=0; i<this.map_width * this.map_height; ++i) {
      this.map_data[i] = 0;
    }
  }
}


//Initialize level
Level.prototype.init = function() {
}

//Retrieves a tile
Level.prototype.get = function(x, y) {
  if(x < 0 || x >= this.map_width ||
     y < 0 || y >= this.map_height ) {
    return 1;
  }
  return this.map_data[x + y*this.map_width];
}

//Sets a tile
Level.prototype.set = function(x, y, t) {
  if(x < 0 || x >= this.map_width ||
     y < 0 || y >= this.map_height ) {
    return;
  }
  this.map_data[x + y*this.map_width] = t;
}

//Execute a bounded a-star/breadth first search
Level.prototype.boundedBFS = function(start, goal, bound) {

  if(start[0] === goal[0] && start[1] === goal[1]) {
    return [ [start[0], start[1]] ]
  }

  var to_visit = new BinaryHeap(),
      diam = 2*bound+1,
      table = new Array(diam * diam);

  to_visit.push([ 
    Math.abs(start[0]-goal[0]) + Math.abs(start[1]-goal[1])
    , start[0]
    , start[1]
    , 0
    , 0 ]);
  
  table[0] = [start[0], start[1], -1];    
  
  while(to_visit.size() > 0) {
    var cur = to_visit.pop();
    
    //Iterate over neighbors
    for(var dx=-1; dx<=1; ++dx)
    for(var dy=-1; dy<=1; ++dy) {
    
      //Check if within von-Neumann neighborhood
      if(Math.abs(dx) + Math.abs(dy) !== 1) {
        continue;
      }
      
      //Change order of local search to avoid walking in boxy lines
      var tx = dx, ty = dy;
      var n = [cur[1] + tx, cur[2] + ty, cur[3]];
      
      //Check if already visited
      var idx = ((n[0]-start[0]+diam)%diam) 
           + diam*((n[1]-start[1]+diam)%diam);
      if(table[idx]) {
        continue;
      }
      table[idx] = n;
      
      //Check coordinate in map
      var collides = TileTypes[this.get(n[0], n[1])].collides;
      if(collides) {
        continue;
      }
      
      //Check for completion
      if(n[0] === goal[0] && 
         n[1] === goal[1]) {
        var result = [[n[0], n[1]]];
        while(n[2] >= 0) { 
          n = table[n[2]];
          result.push([n[0], n[1]]);
        }
        result.reverse();
        return result;
      }
      
      //Add to index, continue
      if(cur[4] < bound) {
        var a = (n[0]-goal[0]), b = (n[1]-goal[1]);
      
        to_visit.push([
          Math.sqrt(a*a + b*b) + cur[4]
          , n[0]
          , n[1]
          , idx
          , cur[4] + 1
        ]);
      }
    }
  } 
  
  //No path within bound
  console.log("No path available");
  return [];
}

exports.TileTypes = TileTypes;
exports.Level = Level;
