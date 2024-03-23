(() => {
	const socket = new WebSocket("ws://localhost:3000/__live_reload_ws__");
	socket.onmessage = (msg) => {
		if (msg.data === "reload") {
			location.reload();
		}
	};
	console.log("Live reload enabled.");
})();
