/*jslint node:true */
var ms = require('../lib/index'), nodeunit = require('nodeunit'), mailer = require('nodemailer'), mailPort = 4025, 
mailServer, testFn, sendmail, from = "mailtest@bar.com";

//mailServer = ms.init(mailPort);

mailer.SMTP = {
	host: "localhost",
	port: mailPort,
	hostname: "localhost.local"
};
sendmail = function(to,subject,body,cb) {
	mailer.send_mail({
		sender: from, 
		to:to,
		subject:subject,
		body:body
	},cb);
};



testFn = {
	testMail : {
		sendMail: nodeunit.testCase({
			setUp: function(callback) {
				mailServer = ms.init(mailPort);
				callback();
			},
			tearDown: function(callback) {
				mailServer.stop();
				callback();
			},
			// not logged in should give unauthenticated
			specificHandler : function(test) {
				var handler, checkDone, count = 0, expected = 2, addr = "foo@bar.com", subject = "email test", body = "This is a test email";
				// bind a handler
				handler = function(address,id,email) {
					test.equal(address,addr,"Should have address sent to handler as '"+addr+"'");
					test.equal(email.body,body+"\r\n","Body should match");
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
				var handler, checkDone, count = 0, expected = 2, addr = "foo@bar.com", subject = "email test", body = "This is a test email";
				// bind a handler
				handler = function(address,id,email) {
					test.equal(address,null,"Should have address 'null' sent to handler");
					test.equal(email.body,body+"\r\n","Body should match");
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
			}
		})
	}
};

nodeunit.reporters["default"].run(testFn,null);

