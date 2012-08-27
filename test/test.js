/*jslint node:true, nomen:false */
var ms = require('../lib/index'), nodeunit = require('nodeunit'), mailer = require('nodemailer'), mailPort = 4025, 
mailServer, testFn, sendmail, from = "smtpmailtest@gmail.com";

//mailServer = ms.init(mailPort);

mailer.SMTP = {
	host: "localhost",
	port: mailPort,
	hostname: "localhost.local"
};
sendmail = function(to,subject,body,headers,cb) {
  if (!cb && typeof(headers) === "function") {
    cb = headers;
    headers = {};
  }
	mailer.send_mail({
		sender: from, 
		to:to,
		subject:subject,
		body:body,
		headers:headers
	},cb);
};



testFn = {
	sendMail: nodeunit.testCase({
		setUp: function(callback) {
			mailServer = ms.init(mailPort);
			callback();
		},
		tearDown: function(callback) {
			mailServer.stop(callback);
		},
		// not logged in should give unauthenticated
		specificHandler : function(test) {
			var handler, checkDone, count = 0, expected = 2, addr = "foo@gmail.com", subject = "email test", body = "This is a test email";
			// bind a handler
			handler = function(address,id,email) {
				test.equal(address,addr,"Should have address sent to handler as '"+addr+"'");
				test.equal(email.body,body,"Body should match");
				test.equal(email.headers.To,addr,"Should have header address To match");
				test.equal(email.headers.From,from,"Should have header address From match");
				checkDone();
			};
			checkDone = function() {
				count++;
				if (count >= expected) {
					test.done();
				}
			};
			mailServer.bind(addr,handler);
		
			// send out the email with the activation code
			sendmail(addr,subject,body, function(error, success){
				// indicate we are done
				test.equal(true,success,"Should have success in sending mail");
				if (success) {
					checkDone();
				} else {
					test.done();
				}
			});
		},
		catchAllHandler : function(test) {
			var handler, checkDone, count = 0, expected = 2, addr = "foo@gmail.com", subject = "email test", body = "This is a test email";
			// bind a handler
			handler = function(address,id,email) {
				test.equal(address,null,"Should have address 'null' sent to handler");
				test.equal(email.body,body,"Body should match");
				test.equal(email.headers.To,addr,"Should have header address To match");
				test.equal(email.headers.From,from,"Should have header address From match");
				checkDone();
			};
			checkDone = function() {
				count++;
				if (count >= expected) {
					test.done();
				}
			};
			mailServer.bind(handler);
		
			// send out the email with the activation code
			sendmail(addr,subject,body, function(error, success){
				// indicate we are done
				test.equal(true,success,"Should have success in sending mail");
				if (success) {
					checkDone();
				} else {
					test.done();
				}
			});
		},
		foldedHeader: function(test) {
			var handler, checkDone, count = 0, expected = 2, addr = "foo@gmail.com", subject = "email test", body = "This is a test email",
			xfolded = "This is\r\n  a folded header";
			// bind a handler
			handler = function(address,id,email) {
				test.equal(address,addr,"Should have address sent to handler as '"+addr+"'");
				test.equal(email.body,body,"Body should match");
				test.equal(email.headers.To,addr,"Should have header address To match");
				test.equal(email.headers.From,from,"Should have header address From match");
				test.equal(email.headers.Xfolded,xfolded.replace(/\r\n\s+/," "),"Should have the folded header");
				checkDone();
			};
			checkDone = function() {
				count++;
				if (count >= expected) {
					test.done();
				}
			};
			mailServer.bind(addr,handler);
		
			// send out the email with the activation code
			sendmail(addr,subject,body, {xfolded:xfolded},function(error, success){
				// indicate we are done
				test.equal(true,success,"Should have success in sending mail");
				if (success) {
					checkDone();
				} else {
					test.done();
				}
			});
		}
	}),
	modules: nodeunit.testCase({
		setUp: function(callback) {
			mailServer = ms.init(mailPort);
			callback();
		},
		tearDown: function(callback) {
			mailServer.stop(callback);
		},
		logAll : function(test) {
			var success, addr = "foo@gmail.com", subject = "email test", body = "This is a test email", _log = console.log, message;
			message = "From: smtpmailtest@gmail.com\nTo: foo@gmail.com\nSubject: email test\nThis is a test email\n\n";
			
			// load the module
			success = mailServer.module("logAll");
			test.equal(success,true,"Should have success loading module");
			// send a mail, see that it ends up on the console
			// but first capture the console
			console.log = function(msg) {
			  //_log(msg);
			  if (msg && typeof(msg) === "string") {
          // expect the message - but the date can change, so remove it
          test.equal(msg.replace(/\nDate:.*\nSubject/,"\nSubject"),message,"Should be a specific message");
			  }
				console.log = _log;
				test.done();
			};

			// send out the email with the activation code
			sendmail(addr,subject,body, function(error, success){
				// indicate we are done
				test.equal(true,success,"Should have success in sending mail");
				if (!success) {
					test.done();
				}
			});
		}
	})
};

nodeunit.reporters["default"].run(testFn,null);

