(function() {
    const socket = new WebSocket("ws://localhost:3000/__live_reload_ws__");
      socket.onmessage = function(msg) {
        console.log(msg);
      if(msg.data === 'reload') {
        location.reload()
      }
    };
    console.log('Live reload enabled.');
  })();
