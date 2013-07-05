/*jslint node:true, nomen:true */
var server, handler, _ = require('underscore');

handler = function(addr,id,email) {
	var casedown = function (obj) {
		_.each(obj,function (v,k) {
			obj[k.toLowerCase()] = v;
		});
		return(obj);
	};
	// structure the mail message
	email.headers = casedown(email.headers);
	var msg = ["From: "+email.headers.from, "To: "+email.headers.to, "Date: "+email.headers.date,"Subject: "+email.headers.subject, email.body];
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