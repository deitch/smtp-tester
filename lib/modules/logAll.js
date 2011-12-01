/*jslint node:true */
var server, handler;

handler = function(addr,id,email) {
	// structure the mail message
	var msg = ["From: "+email.headers.From, "To: "+email.headers.To, "Date: "+email.headers.Date,"Subject: "+email.headers.Subject, email.body];
	console.log(msg.join("\n")+"\n\n");
};

module.exports = {
	setServer : function(s) {
		server = s;
	},
	init : function() {
		server.bind(handler);
	}
};