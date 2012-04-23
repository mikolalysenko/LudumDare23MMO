var number_pool = [];
function makeFloatingNumber(x, y, color, text) {
  var txt;
  if(number_pool.length > 0) {
    txt = number_pool[number_pool.length-1];
    number_pool.pop();
  } else {
    txt = Crafty.e("FloatingNumber");
  }

  txt.attr({ 'x': x, 'y':y })
    .color(color)
    .text(text);
  
  txt.lifetime = 30;
  var interval = setInterval(function() {
    txt.y -= 1;
    if(txt.lifetime-- <= 0) {
      number_pool.push(txt);
      txt.x = -10000;
      txt.y = -10000;
      clearInterval(interval);
    }
  }, 30);
  
  return txt;
}

exports.createRPGComponents = function(level) {

  Crafty.c("FloatingNumber", {
    init : function() {
      this.addComponent("2D, DOM, Text, Color");
    }
  })

  Crafty.c("RPG", {
    _hp     : 10,
    _max_hp : 10,
    _xp     : 10,
    _level  : 0,
    _alive  : true,
    
    init : function() {
      this.bind("TakeDamage", function(args) {
        this._hp -= args.damage;
        makeFloatingNumber(this.x + this.w/2, this.y, "#ff0000", "" + args.damage);
      });
      
      this.bind("GainXP", function(args) {
        this._xp += args.xp;
        makeFloatingNumber(this.x + this.w/2, this.y, "#00ff00", "+" + args.value + "xp");
      });
      
      this.bind("GainLevel", function(args) {
        this._xp += args.xp;
        makeFloatingNumber(this.x + this.w/2, this.y, "#00ffff", "Level Up!");
      });
    },
  });
  
  Crafty.c("Corpse", {
    init : function() {
      this.addComponent("2D, Canvas, Tween");
      this.attr({alpha: 1.0});
      this.tween({alpha: 0.0}, 200);
      var corpse = this;
      this.bind("TweenEnd", function() {
        corpse.destroy();
      });
    }
  });
  
};

exports.makeFloatingNumber = makeFloatingNumber;
