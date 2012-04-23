exports.createEnemyComponents = function(level) {
  Crafty.c("Attackable", {
    init : function() {
      this.addComponent("Mouse");
      this.bind("Click", function() {
        level.emitter.emit('click', {
          'x':this.x/16, 
          'y':this.y/16,
          'enemy':this,
        });
      });
    }
  });
}
