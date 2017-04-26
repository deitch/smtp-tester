/*jslint unused:vars, node:true */
var mailer   = require('nodemailer');
var ms       = require('../lib/index');
var test     = require('tape');
var os       = require('os');
var async    = require('async');


var PORT = 4025;
var mailServer;
var smtpTransport;
var sender = 'smtpmailtest@gmail.com';


function sendmail(to, subject, body, headers, cb) {
  if (!cb && typeof(headers) === 'function') {
    cb = headers;
    headers = {};
  }
  smtpTransport.sendMail({
    from:    sender,
    to:      to,
    subject: subject,
    text:    body,
    headers: headers
  }, cb);
}

test('setup', function(t) {
  smtpTransport = mailer.createTransport({
    host: 'localhost',
    port: PORT,
    secure: false,
    name: os.hostname(),
    tls: {
      rejectUnauthorized: false
    }
  });
  mailServer = ms.init(PORT);
  t.end();
});


test('specific handler', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email',
  handler = function(address, id, email) {
    t.equal(address,            recp);
    t.equal(email.headers.To,   recp);
    t.equal(email.headers.From, sender);
    t.equal(email.body,         body);
    mailServer.unbind(recp,handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(recp, handler);
  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});

test('handler with two emails', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email', mails = [],
  handler = function(address, id, email) {
		// save this email
		mails.push({address:address, id: id, email: email});
  };

  mailServer.bind(recp, handler);

	// send the email twice, each time with a different subject, body
	async.waterfall([
		function (cb) {
			sendmail(recp, subject+"0", body+"0", cb);
		},
		function (res,cb) {
			sendmail(recp, subject+"1", body+"1", cb);
		}
	],function (err) {
		if (err) {
			t.error(err);
		} else {
			// process the emails
			t.equal(mails.length, 2);
			for (var i=0; i<mails.length; i++) {
		    t.equal(mails[i].address,            recp);
		    t.equal(mails[i].email.headers.To,   recp);
		    t.equal(mails[i].email.headers.From, sender);
		    t.equal(mails[i].email.subject,      subject+i);
		    t.equal(mails[i].email.body,         body+i);
			}
	    mailServer.unbind(recp,handler);
	    mailServer.removeAll();
			t.end();
		}
	});
});

test('two emails with different handlers', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email';
  var handler0Factory = function (cb) {
  	handler0 = function(address, id, email) {
	    t.equal(address,            recp);
	    t.equal(email.headers.To,   recp);
	    t.equal(email.headers.From, sender);
	    t.equal(email.subject,      subject+"0");
	    t.equal(email.body,         body+"0");
			mailServer.unbind(recp,handler0);
			mailServer.removeAll();
			cb(null);
	  };

    return handler0;
  };
  var handler1Factory = function (cb) {
		handler1 = function(address, id, email) {
	    t.equal(address,            recp);
	    t.equal(email.headers.To,   recp);
	    t.equal(email.headers.From, sender);
	    t.equal(email.subject,      subject+"1");
	    t.equal(email.body,         body+"1");
			mailServer.unbind(recp,handler1);
			mailServer.removeAll();
			cb(null);
	  };

    return handler1;
  };

	// send the email twice, each time with a different subject, body
	async.waterfall([
		function (cb) {
			sendmail(recp, subject+"0", body+"0", cb);
		},
		function (res,cb) {
			mailServer.bind(recp,handler0Factory(cb));
		},
		function (cb) {
			sendmail(recp, subject+"1", body+"1", cb);
		},
		function (res,cb) {
			mailServer.bind(recp,handler1Factory(cb));
		}
	],function (err) {
		if (err) {
			t.error(err);
		} else {
			t.end();
		}
	});
});



test('catch-all handler', function(t) {
  var recp = 'bar@gmail.com', subject = 'some other test', body = 'This is another test email',
  handler = function(address, id, email) {
    t.equal(address,            null);
    t.equal(email.headers.To,   recp);
    t.equal(email.headers.From,  sender);
    t.equal(email.body,         body);
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('folded headers', function(t) {
  var recp = 'bar@gmail.com', subject = 'email test why not', body = 'Why not a test email?',
  xfolded = 'This is a\r\n folded header', xfoldedtab = 'This is a\r\n\t tab folded header',
  handler = function(address, id, email) {
    t.equal(email.headers.To,                recp);
    t.equal(email.headers.From,              sender);
    t.equal(email.headers.get('xfolded'),    'This is a  folded header');
    t.equal(email.headers.get('xfoldedtab'), 'This is a \t tab folded header');
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  var headers = {
    xfolded:    xfolded,
    xfoldedtab: xfoldedtab
  };

  sendmail(recp, subject, body, headers, function(err, response) {
    t.error(err);
  });
});


test('remove by ID', function(t) {
  var recp = 'foo@gmail.com', subject = 'email strange test', body = 'Charmed test email',
  handler1 = function(address, id, email) {
    mailServer.remove(id);
    mailServer.unbind(handler1);

    var timeout = setTimeout(function() {
      mailServer.unbind(handler2);
      t.end();
    }, 500);

    var handler2 = function(address, id, email) {
      clearTimeout(timeout);
      t.fail('Did not expect to get any other message.');
      mailServer.unbind(handler2);
      t.end();
    };

    mailServer.bind(handler2);
  };

  mailServer.bind(handler1);

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('unescape double dots', function(t) {
  var to = 'foo@gmail.com',
      subject = 'email test',
      body = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam sagittis... Purus vitae aliquet euismod.',
  handler = function(address, id, email) {
    t.equal(email.text,         body);
    mailServer.unbind(to,handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(to, handler);

  smtpTransport.sendMail({
    from:    sender,
    to:      to,
    subject: subject,
    text:    body
  }, function(err, response) {
    t.error(err);
  });
});


test('unbind', function(t) {
  var recp = 'foo@gmail.com',
    subject = 'email strange test',
    body = 'Charmed test email';

  var handler1Called = false,
    handler2Called = false;

  var handler1 = function() {
    handler1Called = true;
  };

  var handler2 = function() {
    t.fail('`handler2` was unbound and should not be called.');
  };

  mailServer.bind(handler1);
  mailServer.bind(handler2);

  mailServer.unbind(handler2);

  sendmail(recp, subject, body, function(err, response) {
    t.ok(handler1Called);
    t.error(err);

    mailServer.unbind(handler1);
    t.end();
  });
});


test('modules', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test modules', body = 'This is a module test email',
  success = mailServer.module('logAll');
  t.equal(success, true);

  var _log    = console.log;
  console.log = function(msg) {
    console.log = _log;

    var lines = msg
      .split('\n')
      .filter(function(line) {
        return line.indexOf('Date:') === -1;
      });

    t.same(lines, [
      'From: '+sender,
      'To: '+recp,
      'Subject: '+subject,
      body,
      '',
      ''
    ]);

    t.end();
  };

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('teardown', function(t) {
  mailServer.stop();
  smtpTransport.close();
  t.end();
});
